import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { submitFeedback, FEEDBACK_KINDS } from '../../../utils/feedback'

// Player feedback modal, reachable from the overflow menu. A short note plus an
// optional category; the current run context (phase, sigils, mode, theme) is
// attached automatically so a report reads in situ. Posts to /api/feedback and
// confirms in place. In dev the post is a no-op console log (see submitFeedback).
export function FeedbackModal({ open, onClose, game, user }) {
  const [kind, setKind] = useState(null)
  const [message, setMessage] = useState('')
  // 'idle' | 'sending' | 'done' | 'error'
  const [status, setStatus] = useState('idle')
  const [errorMsg, setErrorMsg] = useState('')

  // Fresh form each time the modal opens.
  useEffect(() => {
    if (!open) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setKind(null); setMessage(''); setStatus('idle'); setErrorMsg('')
  }, [open])

  if (!open) return null

  const canSend = message.trim().length > 0 && status !== 'sending'

  const send = async () => {
    if (!canSend) return
    setStatus('sending')
    setErrorMsg('')
    try {
      await submitFeedback({
        message: message.trim(),
        kind,
        accountId: user?.sub || 'guest',
        context: {
          phase: game?.phase ?? null,
          sigilsEarned: game?.sigilsEarned ?? null,
          descent: (game?.sigilsEarned || 0) + 1,
          mode: game?.mode ?? null,
          ascension: game?.ascension ?? null,
          theme: game?.theme || game?.nextTheme || null,
          tutorial: !!game?.tutorial,
        },
      })
      setStatus('done')
    } catch (e) {
      setStatus('error')
      setErrorMsg(e?.message || 'Could not send. Please try again.')
    }
  }

  return createPortal((
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-start sm:items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="panel max-w-lg w-full p-6 my-4 sm:my-auto relative shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-9 h-9 rounded-full bg-stone-800 hover:bg-stone-700 text-parchment text-xl leading-none flex items-center justify-center border border-stone-700"
          aria-label="Close feedback"
        >
          ×
        </button>

        <div className="mb-5">
          <div className="text-[10px] uppercase tracking-[0.3em] text-slate-500">Help shape the game</div>
          <h2 className="font-display text-rune text-2xl mt-1">Send feedback</h2>
        </div>

        {status === 'done' ? (
          <div className="space-y-4">
            <p className="text-[15px] text-slate-200 leading-relaxed">
              Thanks. Your note was sent, along with where you were in the run. It helps more than you'd think.
            </p>
            <div className="flex justify-end">
              <button
                onClick={onClose}
                className="px-5 py-2 rounded-md bg-rune/90 hover:bg-rune text-stone-950 text-sm font-semibold transition"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-2">What kind? (optional)</div>
              <div className="flex flex-wrap gap-2">
                {FEEDBACK_KINDS.map(k => (
                  <button
                    key={k.id}
                    onClick={() => setKind(kind === k.id ? null : k.id)}
                    className={`px-3 py-1.5 rounded-full text-[13px] border transition ${
                      kind === k.id
                        ? 'border-rune bg-rune/15 text-rune'
                        : 'border-stone-700 text-slate-300 hover:border-stone-500'
                    }`}
                  >
                    {k.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="feedback-message" className="block text-[10px] uppercase tracking-widest text-slate-500 mb-2">
                Your note
              </label>
              <textarea
                id="feedback-message"
                value={message}
                onChange={e => setMessage(e.target.value)}
                rows={5}
                maxLength={4000}
                autoFocus
                placeholder="What worked, what didn't, what confused you, what you'd change…"
                className="w-full rounded-md border border-stone-700 bg-stone-950 px-3 py-2 text-[14px] text-parchment leading-relaxed outline-none focus:border-rune/70 resize-y"
              />
              <div className="mt-1 text-[11px] text-slate-600">
                Your current run details are attached automatically.
              </div>
            </div>

            {status === 'error' && (
              <p className="text-[13px] text-red-400">{errorMsg}</p>
            )}

            <div className="flex justify-end gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-md border border-stone-700 text-slate-300 hover:border-stone-500 text-sm font-medium transition"
              >
                Cancel
              </button>
              <button
                onClick={send}
                disabled={!canSend}
                className="px-5 py-2 rounded-md bg-rune/90 hover:bg-rune disabled:opacity-40 disabled:cursor-not-allowed text-stone-950 text-sm font-semibold transition"
              >
                {status === 'sending' ? 'Sending…' : 'Send'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  ), document.body)
}
