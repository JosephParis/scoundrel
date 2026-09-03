/**
 * The Sigil desktop shell (docs/STEAM.md, S03 and S04).
 *
 * This is a window around the `steam` build of the same bundle that ships to
 * sigildeck.com -- not a port. The game is unchanged; what this file owns is
 * everything a browser was doing for us and now nobody is: the window, its
 * size, fullscreen, and the fact that a game bundle loaded from disk must not
 * be able to navigate anywhere else.
 *
 * CommonJS on purpose. package.json says `"type": "module"`, which makes every
 * bare .js file ESM; Electron's main process is CJS, so the extension is .cjs
 * rather than fighting that.
 *
 * Nothing here talks to Steam yet. The Steamworks bindings need an App ID that
 * does not exist until the fee is paid (docs/STEAM.md, S13), so achievements,
 * cloud saves and the overlay are deliberately absent rather than stubbed --
 * a stub that silently no-ops is worse than a gap you can see.
 */
const { app, BrowserWindow, screen, shell } = require('electron')
const { readFileSync, writeFileSync, mkdirSync } = require('node:fs')
const { join, dirname } = require('node:path')
const { MINIMUM, fitBounds } = require('./windowRules.cjs')

/** Where `npm run steam:dev` points instead of the built bundle. */
const DEV_SERVER = process.env.SIGIL_DEV_SERVER || ''

const stateFile = () => join(app.getPath('userData'), 'window-state.json')

/**
 * Restore the last window box, if it is still somewhere the user can see.
 *
 * A saved box is only usable while the display it was on still exists: unplug
 * an external monitor and yesterday's bounds put the window off the edge of the
 * world, with no way to drag it back. So a restored box has to intersect a
 * current display, or it is discarded.
 */
function loadState() {
  try {
    const saved = JSON.parse(readFileSync(stateFile(), 'utf8'))
    if (!Number.isFinite(saved.width) || !Number.isFinite(saved.height)) return null
    if (Number.isFinite(saved.x) && Number.isFinite(saved.y)) {
      const visible = screen.getAllDisplays().some(d => {
        const b = d.workArea
        return (
          saved.x < b.x + b.width && saved.x + saved.width > b.x &&
          saved.y < b.y + b.height && saved.y + saved.height > b.y
        )
      })
      if (!visible) return { width: saved.width, height: saved.height, fullscreen: !!saved.fullscreen }
    }
    return saved
  } catch {
    // No state yet, or a file we cannot parse. Either way the default is right,
    // and a corrupt state file must never be the reason the game does not open.
    return null
  }
}

function saveState(win) {
  try {
    // getNormalBounds is the restored box, not the maximised or fullscreen one.
    // Saving the fullscreen bounds would mean leaving fullscreen once put the
    // window at exactly screen size forever after.
    const bounds = win.getNormalBounds()
    mkdirSync(dirname(stateFile()), { recursive: true })
    writeFileSync(stateFile(), JSON.stringify({
      ...bounds,
      fullscreen: win.isFullScreen(),
      maximized: win.isMaximized(),
    }))
  } catch {
    // Window geometry is a convenience. Failing to persist it is not worth
    // taking the app down over, or even telling the player about.
  }
}

/** The default box for a first run, fitted to the display the cursor is on. */
function defaultBounds() {
  const { workArea } = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
  return fitBounds(workArea)
}

function createWindow() {
  const saved = loadState()
  const bounds = saved ?? defaultBounds()

  const win = new BrowserWindow({
    ...bounds,
    minWidth: MINIMUM.width,
    minHeight: MINIMUM.height,
    show: false,
    backgroundColor: '#0b0d12', // --color-dungeon, so the first paint is not white
    title: 'Sigil',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, 'preload.cjs'),
      // The bundle is first-party code, but it is still web content loaded off
      // disk. None of it needs Node, so none of it gets Node.
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  })

  if (saved?.fullscreen) win.setFullScreen(true)
  else if (saved?.maximized) win.maximize()

  // Paint before showing. Electron shows an empty frame otherwise, and on a
  // dark game that flash reads as a crash.
  win.once('ready-to-show', () => win.show())

  // F11 and Alt+Enter, the two things a player will try. Handled here rather
  // than in the renderer so they work even while a modal has focus, and so the
  // game's own keydown handlers (DescentView, SanctuaryView, TopBar) never have
  // to know the desktop build exists.
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return
    const f11 = input.key === 'F11'
    const altEnter = input.alt && (input.key === 'Enter' || input.code === 'Enter')
    if (f11 || altEnter) {
      win.setFullScreen(!win.isFullScreen())
      event.preventDefault()
    }
  })

  // Persist geometry. `close` rather than `closed`, because the window has to
  // still exist to be measured.
  win.on('close', () => saveState(win))

  // Everything outside the bundle opens in the player's own browser, and
  // nothing opens a second Electron window. Both halves matter: without the
  // first, sigildeck.com would load *inside* the game with no address bar and
  // no way back; without the second, any target="_blank" would spawn a
  // chromeless window the player cannot navigate.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:$/.test(safeProtocol(url))) shell.openExternal(url)
    return { action: 'deny' }
  })

  // The same rule for in-page navigation. The app is a hash router, so every
  // legitimate route change is a fragment change and never reaches this.
  win.webContents.on('will-navigate', (event, url) => {
    const here = DEV_SERVER || 'file://'
    if (url.startsWith(here)) return
    event.preventDefault()
    if (/^https?:$/.test(safeProtocol(url))) shell.openExternal(url)
  })

  // A single-player card game needs none of these. Denying by default means a
  // dependency that starts asking cannot start a prompt in front of a player.
  win.webContents.session.setPermissionRequestHandler((_wc, _permission, callback) => callback(false))

  if (DEV_SERVER) win.loadURL(DEV_SERVER)
  else win.loadFile(join(__dirname, '..', 'dist-steam', 'index.html'))

  return win
}

/** URL parsing that cannot throw on input we did not construct. */
function safeProtocol(url) {
  try {
    return new URL(url).protocol
  } catch {
    return ''
  }
}

// Steam launches the game by running the executable. A second launch -- a
// double-click while it is already running, or Steam retrying -- must raise the
// window that exists rather than opening a second copy with a second save.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  let mainWindow = null

  app.on('second-instance', () => {
    if (!mainWindow) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  })

  app.whenReady().then(() => {
    mainWindow = createWindow()

    app.on('activate', () => {
      // macOS keeps the process alive with no windows. Nothing ships for macOS
      // yet (docs/STEAM.md says Windows only for v1), but the handler costs one
      // line and its absence is a bug that only appears on the day it does.
      if (BrowserWindow.getAllWindows().length === 0) mainWindow = createWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
