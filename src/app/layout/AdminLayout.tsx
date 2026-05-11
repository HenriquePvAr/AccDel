import { Outlet } from 'react-router-dom'

import { AppHeader } from '@/components/layout/AppHeader'
import { AppSidebar } from '@/components/layout/AppSidebar'

export function AdminLayout() {
  return (
    <div className="min-h-screen bg-[#020914] text-slate-100 lg:grid lg:grid-cols-[auto_1fr]">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(249,115,22,0.11),transparent_28%),radial-gradient(circle_at_88%_8%,rgba(14,165,233,0.10),transparent_28%),linear-gradient(180deg,#020914_0%,#07111f_55%,#020914_100%)]" />
      <AppSidebar />
      <div className="relative min-w-0">
        <AppHeader />
        <main className="min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
