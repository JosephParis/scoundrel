import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/react'
import { BrowserRouter } from 'react-router-dom'
import { PostHogContext } from '@posthog/react'
import './index.css'
import App from './App.jsx'
import VersionBadge from './VersionBadge.jsx'

// PostHog SDK is heavy. Defer its import past window.load + idle so it doesn't
// compete with LCP. Children mount immediately; usePostHog consumers no-op
// safely while client is null.
const POSTHOG_TOKEN = import.meta.env.VITE_PUBLIC_POSTHOG_TOKEN
const POSTHOG_HOST = import.meta.env.VITE_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com'

function Root() {
  const [posthogClient, setPosthogClient] = useState(null)

  useEffect(() => {
    if (!POSTHOG_TOKEN) return
    let cancelled = false
    let idleHandle
    let timeoutHandle

    const load = async () => {
      const { default: posthog } = await import('posthog-js')
      if (cancelled) return
      posthog.init(POSTHOG_TOKEN, {
        api_host: POSTHOG_HOST,
        defaults: '2026-01-30',
        person_profiles: 'identified_only',
      })
      setPosthogClient(posthog)
    }

    const schedule = () => {
      if (cancelled) return
      if (typeof window.requestIdleCallback === 'function') {
        idleHandle = window.requestIdleCallback(load, { timeout: 5000 })
      } else {
        timeoutHandle = setTimeout(load, 1500)
      }
    }

    if (document.readyState === 'complete') {
      schedule()
    } else {
      window.addEventListener('load', schedule, { once: true })
    }

    return () => {
      cancelled = true
      window.removeEventListener('load', schedule)
      if (idleHandle != null && typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(idleHandle)
      }
      if (timeoutHandle != null) clearTimeout(timeoutHandle)
    }
  }, [])

  return (
    <PostHogContext.Provider value={{ client: posthogClient }}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
      <VersionBadge />
      <Analytics />
      <SpeedInsights />
    </PostHogContext.Provider>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
