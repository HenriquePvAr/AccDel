import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'

import { AppShell } from '@/components/AppShell'
import { LoadingState } from '@/components/States'
import { useAuth } from '@/lib/auth-context'
import { LoginPage } from '@/pages/LoginPage'

const TablesPage = lazy(() => import('@/pages/TablesPage').then((module) => ({ default: module.TablesPage })))
const TableSessionPage = lazy(() => import('@/pages/TableSessionPage').then((module) => ({ default: module.TableSessionPage })))
const OrdersPage = lazy(() => import('@/pages/OrdersPage').then((module) => ({ default: module.OrdersPage })))
const ProfilePage = lazy(() => import('@/pages/ProfilePage').then((module) => ({ default: module.ProfilePage })))

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedLayout />}>
        <Route index element={<Suspense fallback={<LoadingState />}><TablesPage /></Suspense>} />
        <Route path="mesas/:tableId" element={<Suspense fallback={<LoadingState />}><TableSessionPage /></Suspense>} />
        <Route path="pedidos" element={<Suspense fallback={<LoadingState />}><OrdersPage /></Suspense>} />
        <Route path="perfil" element={<Suspense fallback={<LoadingState />}><ProfilePage /></Suspense>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function ProtectedLayout() {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <LoadingState label="Validando sessão…" />
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />
  return <AppShell />
}
