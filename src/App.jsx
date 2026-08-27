import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import MobileFitStage from './MobileFitStage.jsx'
import { IS_STANDALONE } from './buildTarget.js'

const Scoundrel = lazy(() => import('./games/scoundrel'))
const AdminDashboard = lazy(() => import('./admin/AdminDashboard'))
const PrivacyPolicy = lazy(() => import('./PrivacyPolicy'))

function App() {
  return (
    <main>
      <Suspense fallback={<PageLoading />}>
        <Routes>
          {/* Only the game is fitted to the viewport, and only on the site.
              The privacy policy is a document and is meant to scroll, and the
              standalone build is already inside EmbeddedStage, which fits the
              whole app to its iframe -- a second stage there would scale a
              scaled thing. */}
          <Route path="/" element={IS_STANDALONE ? <Scoundrel /> : <MobileFitStage><Scoundrel /></MobileFitStage>} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </main>
  )
}

function PageLoading() {
  return (
    <div className="min-h-dvh flex items-center justify-center bg-dungeon">
      <div className="h-10 w-10 rounded-full border-2 border-stone-700 border-t-rune animate-spin" />
    </div>
  )
}

export default App
