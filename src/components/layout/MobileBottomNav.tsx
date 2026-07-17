import { Bot, ChefHat, LogOut, Menu, Receipt, X } from 'lucide-react'
import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'

import { getAuthorizedNavigationGroups } from '@/app/navigation'
import { Button } from '@/components/ui/button'
import { queryClient } from '@/hooks/queries'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'

const primaryDestinations = [
  { label: 'Pedidos', to: '/orders', icon: Receipt, permission: 'orders:view' as const },
  { label: 'Cozinha', to: '/kitchen', icon: ChefHat, permission: 'kitchen:view' as const },
  { label: 'Atendimento', to: '/ai-attendant', icon: Bot, permission: 'ai_attendant:view' as const },
]

export function MobileBottomNav() {
  const navigate = useNavigate()
  const [moreOpen, setMoreOpen] = useState(false)
  const user = useAuthStore((state) => state.user)
  const clearSession = useAuthStore((state) => state.clearSession)
  const permissions = user?.permissions ?? []
  const primary = primaryDestinations.filter((item) => permissions.includes(item.permission))
  const primaryPaths = new Set(primaryDestinations.map((item) => item.to))
  const remainingGroups = getAuthorizedNavigationGroups(permissions)
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !primaryPaths.has(item.to)),
    }))
    .filter((group) => group.items.length > 0)

  const handleLogout = () => {
    clearSession()
    queryClient.clear()
    navigate('/login', { replace: true })
  }

  return (
    <>
      {moreOpen ? (
        <div className="fixed inset-0 z-50 xl:hidden" role="dialog" aria-modal="true" aria-label="Mais opcoes">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/45"
            aria-label="Fechar mais opcoes"
            onClick={() => setMoreOpen(false)}
          />
          <section className="absolute inset-x-0 bottom-0 max-h-[82vh] overflow-hidden rounded-t-2xl bg-white shadow-2xl">
            <header className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <p className="font-bold text-foreground">Mais opcoes</p>
                <p className="text-xs text-muted-foreground">{user?.store.tradeName ?? 'Cain Delivery'}</p>
              </div>
              <Button size="icon" variant="ghost" aria-label="Fechar" onClick={() => setMoreOpen(false)}>
                <X className="h-5 w-5" />
              </Button>
            </header>
            <div className="max-h-[calc(82vh-76px)] space-y-5 overflow-y-auto px-4 pb-[calc(22px+env(safe-area-inset-bottom))] pt-4 scrollbar-thin">
              {remainingGroups.map((group) => (
                <section key={group.label}>
                  <p className="mb-2 px-2 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
                    {group.label}
                  </p>
                  <nav className="grid grid-cols-2 gap-2" aria-label={group.label}>
                    {group.items.map((item) => (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        onClick={() => setMoreOpen(false)}
                        className={({ isActive }) => cn(
                          'flex min-h-14 items-center gap-3 rounded-xl border px-3 text-sm font-semibold',
                          isActive
                            ? 'border-primary/30 bg-primary/10 text-primary'
                            : 'border-border bg-white text-foreground',
                        )}
                      >
                        <item.icon className="h-5 w-5 shrink-0" />
                        <span>{item.label}</span>
                      </NavLink>
                    ))}
                  </nav>
                </section>
              ))}
              <Button type="button" variant="outline" className="h-12 w-full" onClick={handleLogout}>
                <LogOut className="h-5 w-5" />
                Sair do painel
              </Button>
            </div>
          </section>
        </div>
      ) : null}

      <nav
        className="fixed inset-x-0 bottom-0 z-40 grid min-h-[68px] grid-cols-4 border-t border-border bg-white/98 px-2 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_rgba(16,24,40,0.08)] xl:hidden"
        aria-label="Navegacao principal"
      >
        {primary.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => cn(
              'flex min-h-[68px] flex-col items-center justify-center gap-1 text-[11px] font-semibold',
              isActive ? 'text-primary' : 'text-muted-foreground',
            )}
          >
            <item.icon className="h-5 w-5" />
            <span>{item.label}</span>
          </NavLink>
        ))}
        <button
          type="button"
          className="flex min-h-[68px] flex-col items-center justify-center gap-1 text-[11px] font-semibold text-muted-foreground"
          onClick={() => setMoreOpen(true)}
        >
          <Menu className="h-5 w-5" />
          <span>Mais</span>
        </button>
      </nav>
    </>
  )
}
