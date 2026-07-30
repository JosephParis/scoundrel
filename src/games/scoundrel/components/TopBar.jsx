import { useEffect, useRef, useState } from 'react'
import { audio, useMuted } from '../audio'
import { isDevToolsEnabled } from '../flags'

export function TopBar({ game, user, onOpenRules, onRetire, onOpenCredits, onOpenDev, onReplayTutorial, onOpenLogin, onSignOut, onOpenCardLibrary, onOpenHistory, onOpenLeaderboard, onOpenHome, onOpenSettings, onOpenFeedback }) {
  const runActive = game.phase === 'sanctuary' || game.phase === 'descent'
  return (
    <header className="fixed top-0 left-0 right-0 z-30 border-b border-stone-800/80 bg-dungeon/85 backdrop-blur-md flex justify-center">
      <div className="w-full max-w-4xl px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <button
            onClick={onOpenHome}
            aria-label="Home menu"
            title="Home menu"
            className="font-display text-rune text-sm sm:text-base tracking-[0.25em] hover:text-amber-300 transition"
          >
            SCOUNDREL
          </button>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Desktop-only buttons - hidden on mobile, shown in menu instead */}
          {runActive && (
            <button
              onClick={onOpenHome}
              aria-label="Pause"
              title="Pause (Esc)"
              className="hidden md:grid w-8 h-8 sm:w-9 sm:h-9 place-items-center rounded-md border border-stone-700 hover:border-rune/60 text-slate-400 hover:text-parchment transition"
            >
              <PauseIcon />
            </button>
          )}
          <MuteButton className="hidden md:grid" />
          <button
            onClick={onOpenRules}
            className="hidden md:flex px-3 py-1.5 rounded-md border border-stone-700 hover:border-rune/60 text-slate-300 hover:text-parchment text-xs sm:text-sm font-medium transition"
          >
            How to play
          </button>
          <button
            onClick={onReplayTutorial}
            className="hidden md:flex px-3 py-1.5 rounded-md border border-stone-700 hover:border-rune/60 text-slate-300 hover:text-parchment text-xs sm:text-sm font-medium transition"
          >
            Tutorial
          </button>
          <OverflowMenu
            runActive={runActive}
            user={user}
            onRetire={onRetire}
            onOpenCredits={onOpenCredits}
            onOpenDev={onOpenDev}
            onOpenLogin={onOpenLogin}
            onSignOut={onSignOut}
            onOpenCardLibrary={onOpenCardLibrary}
            onOpenHistory={onOpenHistory}
            onOpenLeaderboard={onOpenLeaderboard}
            onOpenSettings={onOpenSettings}
            onOpenFeedback={onOpenFeedback}
            onOpenHome={onOpenHome}
            onOpenRules={onOpenRules}
            onReplayTutorial={onReplayTutorial}
          />
        </div>
      </div>
    </header>
  )
}

function PauseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="w-4 h-4 sm:w-[18px] sm:h-[18px]"
      fill="currentColor"
      aria-hidden="true"
    >
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </svg>
  )
}

// Global sound toggle. Reads the mute flag straight from the audio store so it
// stays in sync no matter what flips it, and persists across visits.
function MuteButton({ className = '' }) {
  const muted = useMuted()
  return (
    <button
      onClick={() => audio.toggleMuted()}
      aria-label={muted ? 'Unmute sound' : 'Mute sound'}
      aria-pressed={muted}
      title={muted ? 'Sound off' : 'Sound on'}
      className={`w-8 h-8 sm:w-9 sm:h-9 grid place-items-center rounded-md border border-stone-700 hover:border-rune/60 text-slate-400 hover:text-parchment transition ${className}`}
    >
      <SpeakerIcon muted={muted} />
    </button>
  )
}

function SpeakerIcon({ muted }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="w-4 h-4 sm:w-[18px] sm:h-[18px]"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" stroke="none" />
      {muted ? (
        <path d="M17 9l5 6M22 9l-5 6" />
      ) : (
        <>
          <path d="M16.5 8.5a5 5 0 0 1 0 7" />
          <path d="M19 6a8.5 8.5 0 0 1 0 12" />
        </>
      )}
    </svg>
  )
}

// onOpenCardLibrary is still wired from index.jsx for the parked Card library
// item below, so it reads as unused until that item comes back.
// eslint-disable-next-line no-unused-vars
function OverflowMenu({ runActive, user, onRetire, onOpenCredits, onOpenDev, onOpenLogin, onSignOut, onOpenCardLibrary, onOpenHistory, onOpenLeaderboard, onOpenSettings, onOpenFeedback, onOpenHome, onOpenRules, onReplayTutorial }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const muted = useMuted()

  useEffect(() => {
    if (!open) return
    const onDocClick = e => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    const onKey = e => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const itemClass =
    'w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-stone-800/70 hover:text-parchment transition flex items-center gap-2'

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        aria-label="More options"
        aria-haspopup="menu"
        aria-expanded={open}
        title="More"
        className="px-2.5 py-1.5 rounded-md border border-stone-700 hover:border-rune/60 text-slate-400 hover:text-parchment text-base leading-none font-medium transition"
      >
        ⋮
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-56 rounded-md border border-stone-700 bg-dungeon/95 backdrop-blur-md shadow-2xl overflow-hidden z-40"
        >
          {/* Mobile-only menu items - shown only on small screens */}
          <div className="md:hidden">
            {runActive && (
              <button
                role="menuitem"
                onClick={() => {
                  setOpen(false)
                  onOpenHome()
                }}
                className={itemClass}
              >
                <span className="text-slate-400 w-4 text-center">⏸</span>
                <span>Pause</span>
              </button>
            )}
            <button
              role="menuitem"
              onClick={() => {
                setOpen(false)
                audio.toggleMuted()
              }}
              className={itemClass}
            >
              <span className="text-slate-400 w-4 text-center">{muted ? '🔇' : '🔊'}</span>
              <span>{muted ? 'Unmute' : 'Mute'}</span>
            </button>
            <button
              role="menuitem"
              onClick={() => {
                setOpen(false)
                onOpenRules()
              }}
              className={itemClass}
            >
              <span className="text-rune w-4 text-center">?</span>
              <span>How to play</span>
            </button>
            <button
              role="menuitem"
              onClick={() => {
                setOpen(false)
                onReplayTutorial()
              }}
              className={itemClass}
            >
              <span className="text-rune w-4 text-center">◆</span>
              <span>Tutorial</span>
            </button>
            <div className="h-px bg-stone-800" />
          </div>
          {user ? (
            <>
              <div className="px-3 py-2 flex items-center gap-2 border-b border-stone-800">
                {user.picture ? (
                  <img
                    src={user.picture}
                    alt=""
                    className="w-6 h-6 rounded-full border border-stone-700"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span className="w-6 h-6 rounded-full border border-stone-700 bg-stone-800 flex items-center justify-center text-[10px] text-slate-400">
                    {(user.name || '?').slice(0, 1).toUpperCase()}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] text-parchment truncate">{user.name}</div>
                  {user.email && (
                    <div className="text-[10px] text-slate-500 truncate">{user.email}</div>
                  )}
                </div>
              </div>
              <button
                role="menuitem"
                onClick={() => {
                  setOpen(false)
                  onSignOut()
                }}
                className={itemClass}
              >
                <span className="text-slate-400 w-4 text-center">↩</span>
                <span>Sign out</span>
              </button>
              <div className="h-px bg-stone-800" />
            </>
          ) : (
            <>
              <button
                role="menuitem"
                onClick={() => {
                  setOpen(false)
                  onOpenLogin()
                }}
                className={itemClass}
              >
                <span className="text-rune w-4 text-center">↪</span>
                <span>Log in with Google</span>
              </button>
              <div className="h-px bg-stone-800" />
            </>
          )}
          {/* TEMPORARY: Card library is parked alongside the rules modal's
              reference tabs. Restore by uncommenting; onOpenCardLibrary is
              still threaded in from index.jsx.
          <button
            role="menuitem"
            onClick={() => {
              setOpen(false)
              onOpenCardLibrary()
            }}
            className={itemClass}
          >
            <span className="text-rune w-4 text-center">☷</span>
            <span>Card library</span>
          </button>
          */}
          <button
            role="menuitem"
            onClick={() => {
              setOpen(false)
              onOpenHistory()
            }}
            className={itemClass}
          >
            <span className="text-rune w-4 text-center">❧</span>
            <span>Run history</span>
          </button>
          <button
            role="menuitem"
            onClick={() => {
              setOpen(false)
              onOpenLeaderboard()
            }}
            className={itemClass}
          >
            <span className="text-rune w-4 text-center">★</span>
            <span>Leaderboard</span>
          </button>
          <button
            role="menuitem"
            onClick={() => {
              setOpen(false)
              onOpenFeedback()
            }}
            className={itemClass}
          >
            <span className="text-rune w-4 text-center">✎</span>
            <span>Send feedback</span>
          </button>
          <button
            role="menuitem"
            onClick={() => {
              setOpen(false)
              onOpenSettings()
            }}
            className={itemClass}
          >
            <span className="text-rune w-4 text-center">⚒</span>
            <span>Settings</span>
          </button>
          <button
            role="menuitem"
            onClick={() => {
              setOpen(false)
              onOpenCredits()
            }}
            className={itemClass}
          >
            <span className="text-rune w-4 text-center">✦</span>
            <span>Credits</span>
          </button>
          {isDevToolsEnabled() && (
            <button
              role="menuitem"
              onClick={() => {
                setOpen(false)
                onOpenDev()
              }}
              className={itemClass}
            >
              <span className="text-amber-300/80 w-4 text-center">⚙</span>
              <span>Dev tools</span>
            </button>
          )}
          {runActive && (
            <>
              <div className="h-px bg-stone-800" />
              <button
                role="menuitem"
                onClick={() => {
                  setOpen(false)
                  onRetire()
                }}
                className="w-full text-left px-3 py-2 text-sm text-slate-400 hover:bg-stone-800/70 hover:text-blood transition flex items-center gap-2"
              >
                <span className="w-4 text-center">⚑</span>
                <span>Retire run</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export function RetireModal({ open, sigilsEarned, sigilTarget, onConfirm, onCancel }) {
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-start sm:items-center justify-center p-4 overflow-y-auto"
      onClick={onCancel}
    >
      <div
        className="panel max-w-md w-full p-6 sm:p-8 my-4 sm:my-auto relative shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="font-display text-blood text-2xl mb-1">Retire run?</h2>
        <p className="text-[12px] text-slate-500 mb-4">
          Press <span className="font-mono text-slate-300">Esc</span> or click outside to cancel.
        </p>
        <p className="text-sm text-slate-300 leading-snug mb-2">
          You will end this run with {sigilsEarned} of {sigilTarget} sigils set. All
          boons, weapons, and progress will be lost.
        </p>
        <p className="text-[12px] text-slate-500 italic leading-snug mb-6">
          The next who wakes here will walk into a different dungeon.
        </p>
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-md border border-stone-700 hover:border-rune/60 text-slate-300 hover:text-parchment text-sm font-medium transition"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-md bg-gradient-to-b from-red-700 to-red-900 hover:from-red-600 hover:to-red-800 text-parchment text-sm font-medium border border-red-800/80"
          >
            Retire
          </button>
        </div>
      </div>
    </div>
  )
}

// Destructive: starting the tutorial wipes the current run. Confirm
// before nuking progress.
export function TutorialReplayModal({ open, onConfirm, onCancel }) {
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-start sm:items-center justify-center p-4 overflow-y-auto"
      onClick={onCancel}
    >
      <div
        className="panel max-w-md w-full p-6 sm:p-8 my-4 sm:my-auto relative shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="font-display text-rune text-2xl mb-1">Replay the tutorial?</h2>
        <p className="text-[12px] text-slate-500 mb-4">
          Press <span className="font-mono text-slate-300">Esc</span> or click outside to cancel.
        </p>
        <p className="text-sm text-slate-300 leading-snug mb-2">
          A new run will start with the walkthrough. Your current run, including
          sigils, boons, and forge edits, will be lost.
        </p>
        <div className="flex items-center justify-end gap-2 mt-6">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-md border border-stone-700 hover:border-rune/60 text-slate-300 hover:text-parchment text-sm font-medium transition"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-md bg-gradient-to-b from-amber-600 to-amber-800 hover:from-amber-500 hover:to-amber-700 text-stone-950 text-sm font-medium border border-amber-700/80"
          >
            Start tutorial
          </button>
        </div>
      </div>
    </div>
  )
}

