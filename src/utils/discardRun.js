/**
 * Throwing away the run in progress, and nothing else.
 *
 * Two screens offer this: the error boundary's recovery screen, for a run that
 * crashes the renderer, and Settings, for a run that is stuck without throwing
 * (issue 27). They have to agree about what "discard" clears, so the key and the
 * removal live here rather than being written out twice.
 *
 * Only the live run goes. Settings, the leaderboard handle, run history and the
 * signed-in session survive: a corrupt run is the likely cause of both failure
 * modes, and wiping history to fix it would be a worse outcome than the fault.
 * Cloud sync would restore history anyway for a signed-in player.
 */
export const SAVE_KEY = 'scoundrel:save'

export function discardSavedRun() {
  try {
    localStorage.removeItem(SAVE_KEY)
  } catch {
    // Storage disabled or full: the caller reloads regardless, which is still
    // the better outcome than leaving the player on a screen they cannot leave.
  }
}
