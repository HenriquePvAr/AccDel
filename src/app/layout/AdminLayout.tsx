import { Outlet } from 'react-router-dom'

import { AppHeader } from '@/components/layout/AppHeader'
import { AppSidebar } from '@/components/layout/AppSidebar'

export function AdminLayout() {
  return (
    <div className="admin-shell min-h-screen xl:grid xl:grid-cols-[auto_1fr]">
      <a
        href="#admin-content"
        className="fixed left-4 top-3 z-[90] -translate-y-20 rounded-lg bg-foreground px-4 py-2 text-sm font-semibold text-white shadow-lg transition-transform focus:translate-y-0"
      >
        Pular para o conteudo
      </a>
      <AppSidebar />
      <div className="relative min-w-0">
        <AppHeader />
        <main id="admin-content" className="min-w-0" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
