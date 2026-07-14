import { ChevronLeft, Store } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { useShallow } from 'zustand/react/shallow'

import { getAuthorizedNavigationGroups } from '@/app/navigation'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useUiStore } from '@/stores'
import { useAuthStore } from '@/stores/auth-store'

function SidebarNavigation({
  collapsed = false,
  onNavigate,
}: {
  collapsed?: boolean
  onNavigate?: () => void
}) {
  const user = useAuthStore((state) => state.user)
  const navigationGroups = getAuthorizedNavigationGroups(user?.permissions ?? [])

  return (
    <div className="flex-1 space-y-4 overflow-y-auto pr-1 scrollbar-thin">
      {navigationGroups.map((group) => (
        <div key={group.label} className="space-y-2">
          {!collapsed ? (
            <p className="px-2 text-[11px] font-black uppercase tracking-[0.22em] text-slate-600">
              {group.label}
            </p>
          ) : null}
          <nav className="space-y-1" aria-label={group.label}>
            {group.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onNavigate}
                title={collapsed ? item.label : undefined}
                aria-label={collapsed ? item.label : undefined}
                className={({ isActive }) =>
                  cn(
                    'group flex min-h-10 items-center gap-3 rounded-xl border px-3 py-2 text-sm font-bold transition',
                    isActive
                      ? 'border-orange-400/20 bg-[#102237] text-white shadow-[inset_3px_0_0_rgba(249,115,22,0.9)]'
                      : 'border-transparent text-slate-400 hover:border-white/[0.06] hover:bg-white/[0.04] hover:text-white',
                    collapsed && 'justify-center px-0',
                  )
                }
              >
                <item.icon className="h-[18px] w-[18px] shrink-0 text-slate-300 transition group-hover:text-orange-300" />
                {!collapsed ? <span className="truncate">{item.label}</span> : null}
              </NavLink>
            ))}
          </nav>
        </div>
      ))}
    </div>
  )
}

export function AppSidebar() {
  const user = useAuthStore((state) => state.user)
  const [sidebarCollapsed, mobileSidebarOpen, toggleSidebar, setMobileSidebarOpen] = useUiStore(
    useShallow((state) => [
      state.sidebarCollapsed,
      state.mobileSidebarOpen,
      state.toggleSidebar,
      state.setMobileSidebarOpen,
    ]),
  )
  const storeName = user?.store.tradeName ?? 'Cain Delivery'

  return (
    <>
      {mobileSidebarOpen ? (
        <div className="fixed inset-0 z-40 bg-black/55 backdrop-blur-sm lg:hidden">
          <aside className="flex h-full w-[272px] flex-col border-r border-white/10 bg-[#06111f] px-3 py-4 text-white">
            <div className="mb-5 flex items-center justify-between">
              <div className="flex min-w-0 items-center gap-3 overflow-hidden">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand/25 text-brand-soft">
                  <Store className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold">{storeName}</p>
                  <p className="text-xs font-medium text-slate-500">Admin operacional</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/10"
                aria-label="Fechar menu de navegacao"
                onClick={() => setMobileSidebarOpen(false)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </div>

            <SidebarNavigation onNavigate={() => setMobileSidebarOpen(false)} />
          </aside>
        </div>
      ) : null}

      <aside
        className={cn(
          'sticky top-0 hidden h-screen flex-col border-r border-white/10 bg-[#06111f] px-3 py-4 text-white transition-[width] lg:flex',
          sidebarCollapsed ? 'w-[76px]' : 'w-[248px]',
        )}
      >
        <div className="mb-5 flex items-center justify-between">
          <div className="flex min-w-0 items-center gap-3 overflow-hidden">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand/25 text-brand-soft">
              <Store className="h-6 w-6" />
            </div>
            {!sidebarCollapsed ? (
              <div className="min-w-0">
                <p className="truncate text-base font-semibold">{storeName}</p>
                <p className="text-xs font-medium text-slate-500">Admin operacional</p>
              </div>
            ) : null}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/10"
            aria-label={sidebarCollapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
            onClick={toggleSidebar}
          >
            <ChevronLeft className={cn('h-4 w-4 transition', sidebarCollapsed && 'rotate-180')} />
          </Button>
        </div>

        <SidebarNavigation collapsed={sidebarCollapsed} />

        {!sidebarCollapsed ? (
          <div className="border-t border-white/10 pt-4">
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full rounded-xl border-white/[0.08] bg-[#07192b] text-sm font-semibold text-slate-400 hover:bg-[#0a2036] hover:text-slate-100"
              onClick={toggleSidebar}
            >
              <ChevronLeft className="h-4 w-4" />
              Recolher menu
            </Button>
          </div>
        ) : null}
      </aside>
    </>
  )
}
