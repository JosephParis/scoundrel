import { useEffect, useRef, useState } from 'react'
import { initGoogleSignIn, saveUser } from '../../../utils/auth'

const hasGoogleClientId = !!import.meta.env.VITE_GOOGLE_CLIENT_ID

export function LoginModal({ open, onLogin, onClose }) {
  const buttonRef = useRef(null)
  const [error, setError] = useState('')
  // Lazy initializer covers the "script already loaded on a previous open"
  // case without needing a synchronous setState inside the effect below.
  const [gisReady, setGisReady] = useState(() => !!window.google?.accounts?.id)
  const [devName, setDevName] = useState('')

  // Lazy-load the GIS script the first time the modal opens. Keeps the
  // ~30 KB + extra request off the bundle for visitors who never sign in.
  useEffect(() => {
    if (!open || !hasGoogleClientId || gisReady) return
    const SRC = 'https://accounts.google.com/gsi/client'
    let script = document.querySelector(`script[src="${SRC}"]`)
    if (!script) {
      script = document.createElement('script')
      script.src = SRC
      script.async = true
      script.defer = true
      document.head.appendChild(script)
    }
    const onLoad = () => setGisReady(true)
    const onErr = () => setError('Google Sign-In failed to load. Please refresh the page.')
    script.addEventListener('load', onLoad)
    script.addEventListener('error', onErr)
    return () => {
      script.removeEventListener('load', onLoad)
      script.removeEventListener('error', onErr)
    }
  }, [open, gisReady])

  useEffect(() => {
    if (!open || !hasGoogleClientId || !gisReady || !buttonRef.current) return
    initGoogleSignIn(
      buttonRef.current,
      (user, credential) => onLogin(user, credential),
      (msg) => setError(msg)
    )
  }, [open, gisReady, onLogin])

  if (!open) return null

  const handleDevSignIn = (e) => {
    e.preventDefault()
    const name = devName.trim() || 'Player'
    const user = {
      name,
      email: `${name.toLowerCase().replace(/\s+/g, '.')}@local`,
      picture: null,
      sub: `local-${name}`,
    }
    saveUser(user)
    onLogin(user)
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-start sm:items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="panel max-w-md w-full p-6 sm:p-8 my-4 sm:my-auto relative shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="font-display text-rune text-2xl mb-1">Sign in</h2>
        <p className="text-[12px] text-slate-500 mb-4">
          Press <span className="font-mono text-slate-300">Esc</span> or click outside to cancel.
        </p>
        <p className="text-sm text-slate-300 leading-snug mb-6">
          {hasGoogleClientId
            ? 'Sign in with your Google account to save your progress and carry it across devices.'
            : 'Enter a name to begin.'}
        </p>

        {hasGoogleClientId ? (
          <div className="flex flex-col items-center gap-4">
            <div ref={buttonRef} className="flex items-center justify-center" style={{ minHeight: 44 }}>
              {!gisReady && !error && (
                <div className="flex items-center gap-2 text-slate-400 text-sm">
                  <span className="w-4 h-4 border-2 border-stone-500 border-t-transparent rounded-full animate-spin inline-block" />
                  Loading…
                </div>
              )}
            </div>
            {error && (
              <div className="w-full bg-red-900/30 border border-red-700/50 rounded-md px-3 py-2 text-red-300 text-sm text-left">
                <span className="font-semibold">Error: </span>{error}
              </div>
            )}
            <p className="text-[11px] text-slate-500 italic text-center">
              We use your name and profile picture, and store your game progress so it follows you across devices.
            </p>
          </div>
        ) : (
          <form onSubmit={handleDevSignIn} className="flex flex-col gap-3">
            <input
              type="text"
              value={devName}
              onChange={e => setDevName(e.target.value)}
              placeholder="Your name"
              autoFocus
              maxLength={30}
              className="w-full rounded-md border border-stone-700 bg-stone-900/80 text-parchment text-center text-base px-4 py-2 focus:outline-none focus:border-rune/60 transition"
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-md bg-gradient-to-b from-amber-600 to-amber-800 hover:from-amber-500 hover:to-amber-700 text-stone-950 text-sm font-medium border border-amber-700/80"
            >
              Continue
            </button>
          </form>
        )}

        <div className="flex items-center justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md border border-stone-700 hover:border-rune/60 text-slate-300 hover:text-parchment text-sm font-medium transition"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
