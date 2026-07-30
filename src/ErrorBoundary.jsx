import { Component } from 'react'
import { PostHogContext } from '@posthog/react'
import { submitFeedback } from './utils/feedback'

// Only the live run is discarded. Settings, the leaderboard handle, run history
// and the signed-in session are left alone: a corrupt run is the likely cause of
// a render crash, and wiping history to fix it would be a worse outcome than the
// crash. Cloud sync would restore history anyway for a signed-in player.
const SAVE_KEY = 'scoundrel:save'
const USER_KEY = 'scoundrel:user'

function currentAccountId() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || 'null')?.sub || 'guest'
  } catch {
    return 'guest'
  }
}

/**
 * Catches render errors anywhere below it and shows a recoverable screen
 * instead of a blank page.
 *
 * Without this, a single throw is a permanent white screen with no message and
 * no way out: Retire needs a live run and Begin Again needs a terminal phase, so
 * a player whose save renders badly has no in-app route back. That matters most
 * for a first batch of users, where one bad session is the whole impression.
 */
export class ErrorBoundary extends Component {
  // Class components can still read context, which is how the deferred PostHog
  // client is reached without hooks.
  static contextType = PostHogContext

  constructor(props) {
    super(props)
    this.state = { error: null, reported: false, sendState: 'idle' }
    this.componentStack = ''
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    this.componentStack = info?.componentStack || ''
    // Kept unconditionally: if the crash reaches a real user, the console is the
    // only other record of it.
    console.error('[scoundrel] uncaught render error', error, info)
    this.reportToPostHog(error)
  }

  componentDidUpdate() {
    // PostHog is imported lazily past window.load, so a crash during startup can
    // happen before the client exists. The provider re-renders this boundary once
    // the client arrives; retrying here means early crashes are still recorded.
    if (this.state.error && !this.state.reported) this.reportToPostHog(this.state.error)
  }

  reportToPostHog(error) {
    const client = this.context?.client
    if (!client) return
    try {
      client.capture('app_crashed', {
        message: String(error?.message || error),
        stack: String(error?.stack || '').slice(0, 4000),
        componentStack: String(this.componentStack).slice(0, 4000),
        path: window.location.pathname,
      })
      this.setState({ reported: true })
    } catch {
      // Analytics must never mask the error it is reporting.
    }
  }

  handleReload = () => {
    window.location.reload()
  }

  handleDiscardRun = () => {
    try {
      localStorage.removeItem(SAVE_KEY)
    } catch {
      // Storage disabled: reloading is still worth trying.
    }
    window.location.reload()
  }

  handleSendReport = async () => {
    const { error } = this.state
    this.setState({ sendState: 'sending' })
    const body = [
      'Automatic crash report.',
      '',
      `Message: ${String(error?.message || error)}`,
      `Path: ${window.location.pathname}`,
      '',
      'Stack:',
      String(error?.stack || '(none)').slice(0, 2000),
      '',
      'Component stack:',
      String(this.componentStack || '(none)').slice(0, 2000),
    ].join('\n')

    try {
      await submitFeedback({
        message: body,
        kind: 'bug',
        context: { crash: true, path: window.location.pathname },
        accountId: currentAccountId(),
      })
      this.setState({ sendState: 'sent' })
    } catch {
      this.setState({ sendState: 'failed' })
    }
  }

  render() {
    const { error, sendState } = this.state
    if (!error) return this.props.children

    const sendLabel = {
      idle: 'Send a crash report',
      sending: 'Sending…',
      sent: 'Report sent — thank you',
      failed: "Couldn't send — please try again",
    }[sendState]

    return (
      <div className="min-h-dvh bg-dungeon text-parchment flex items-center justify-center p-4">
        <div className="panel max-w-lg w-full p-6">
          <h1 className="font-display text-rune text-2xl mb-2">The dungeon collapsed</h1>
          <p className="text-[14px] text-slate-300 leading-relaxed mb-4">
            Something broke while drawing the screen. Your run history and settings are safe.
            Reloading usually fixes it; if it keeps happening, discard the current run.
          </p>

          <pre className="text-[11px] font-mono text-slate-400 bg-stone-900/80 border border-stone-800 rounded p-3 mb-4 overflow-x-auto whitespace-pre-wrap">
            {String(error?.message || error)}
          </pre>

          <div className="flex flex-col sm:flex-row gap-2">
            <button
              onClick={this.handleReload}
              className="px-4 py-2 rounded-md border border-rune/50 bg-gradient-to-b from-stone-800 to-stone-900 hover:border-rune text-rune font-medium transition"
            >
              Reload
            </button>
            <button
              onClick={this.handleDiscardRun}
              className="px-4 py-2 rounded-md border border-stone-700 hover:border-blood/60 text-slate-300 hover:text-blood font-medium transition"
            >
              Discard the current run
            </button>
            <button
              onClick={this.handleSendReport}
              disabled={sendState === 'sending' || sendState === 'sent'}
              className="px-4 py-2 rounded-md border border-stone-700 hover:border-stone-500 text-slate-400 hover:text-slate-200 font-medium transition disabled:opacity-60 disabled:hover:border-stone-700"
            >
              {sendLabel}
            </button>
          </div>

          <p className="text-[11px] text-slate-500 mt-4">
            Discarding affects only the run in progress. Past runs, your handle and your
            sign-in are kept.
          </p>
        </div>
      </div>
    )
  }
}

export default ErrorBoundary
