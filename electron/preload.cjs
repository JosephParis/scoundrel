/**
 * The bridge between the desktop shell and the game bundle.
 *
 * Deliberately almost empty. The renderer is the same code that runs on
 * sigildeck.com, and every capability handed across this boundary is one the
 * web build does not have and therefore one more way the two can diverge. What
 * is here is a marker: enough for the app and its tests to know they are in the
 * desktop shell, and nothing that can act on the machine.
 *
 * When the Steamworks bindings land (docs/STEAM.md, S07), this is where their
 * surface goes -- `unlockAchievement(id)` and friends, each one a named channel
 * to the main process, never a handle to the SDK itself.
 */
const { contextBridge } = require('electron')

contextBridge.exposeInMainWorld('sigilDesktop', {
  /** Always true here, and undefined in every browser. */
  isDesktop: true,
  /** Which shell, for a bug report that arrives without a screenshot. */
  platform: process.platform,
  electron: process.versions.electron,
})
