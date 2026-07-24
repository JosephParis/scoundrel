import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'

const Scoundrel = lazy(() => import('./games/scoundrel'))
const AdminDashboard = lazy(() => import('./admin/AdminDashboard'))

function App() {
  return (
    <main>
      <Suspense fallback={<PageLoading />}>
        <Routes>
          <Route path="/" element={<Scoundrel />} />
          <Route path="/admin" element={<AdminDashboard />} />
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
