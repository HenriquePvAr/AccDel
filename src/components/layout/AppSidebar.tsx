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
    <div className="flex-1 space-y-3 overflow-y-auto pr-1 scrollbar-thin">
      {navigationGroups.map((group) => (
        <div key={group.label} className="space-y-1.5">
          {!collapsed ? (
            <p className="px-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
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
                    'group flex min-h-10 items-center gap-3 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors duration-150',
                    isActive
                      ? 'border-white/10 bg-white/[0.09] text-white shadow-[inset_3px_0_0_#c65d2e]'
                      : 'border-transparent text-slate-400 hover:bg-white/[0.06] hover:text-white',
                    collapsed && 'justify-center px-0',
                  )
                }
              >
                <item.icon className={cn('h-[18px] w-[18px] shrink-0 transition-colors', 'text-slate-400 group-hover:text-white')} />
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
  const [sidebarCollapsed, toggleSidebar] = useUiStore(
    useShallow((state) => [
      state.sidebarCollapsed,
      state.toggleSidebar,
    ]),
  )
  const storeName = user?.store.tradeName ?? 'Cain Delivery'

  return (
    <>
      <aside
        className={cn(
          'admin-sidebar sticky top-0 hidden h-screen flex-col border-r border-white/10 px-3 py-3 text-white transition-[width] duration-200 xl:flex',
          sidebarCollapsed ? 'w-[68px]' : 'w-[232px]',
        )}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex min-w-0 items-center gap-3 overflow-hidden">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-white">
              <Store className="h-5 w-5" />
            </div>
            {!sidebarCollapsed ? (
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{storeName}</p>
                <p className="text-xs font-medium text-slate-400">Gestão da loja</p>
              </div>
            ) : null}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-white hover:bg-white/10"
            aria-label={sidebarCollapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
            onClick={toggleSidebar}
          >
            <ChevronLeft className={cn('h-4 w-4 transition', sidebarCollapsed && 'rotate-180')} />
          </Button>
        </div>

        <SidebarNavigation collapsed={sidebarCollapsed} />

      </aside>
    </>
  )
}
