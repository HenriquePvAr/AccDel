import { LogOut, Plus, Search } from 'lucide-react'
import { type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { navigationGroups } from '@/app/navigation'
import { StoreSelector } from '@/components/layout/StoreSelector'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { queryClient } from '@/hooks/queries'
import { useCan } from '@/hooks/use-permissions'
import { roleLabelMap } from '@/lib/domain'
import { useOrderFiltersStore } from '@/stores'
import { useAuthStore } from '@/stores/auth-store'

export function AppHeader() {
  const navigate = useNavigate()
  const location = useLocation()
  const orderSearch = useOrderFiltersStore((state) => state.search)
  const setOrderSearch = useOrderFiltersStore((state) => state.setSearch)
  const currentUser = useAuthStore((state) => state.user)
  const clearSession = useAuthStore((state) => state.clearSession)
  const canViewOrders = useCan('orders:view')
  const canCreateOrders = useCan('orders:create')
  const isOrdersRoute = location.pathname.startsWith('/orders')
  const currentPageLabel =
    navigationGroups.flatMap((group) => group.items).find((item) => item.to === location.pathname)
      ?.label ?? (isOrdersRoute ? 'Pedidos' : 'Cain Delivery')

  const handleLogout = () => {
    clearSession()
    queryClient.clear()
    navigate('/login', { replace: true })
  }

  const handleOrderSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    navigate('/orders')
  }

  return (
    <header className="sticky top-0 z-30 h-14 border-b border-border bg-white/95 backdrop-blur-sm sm:h-16">
      <div className="flex h-full items-center gap-3 px-3 sm:px-6 lg:px-8">
        <div className="min-w-0 flex-1 lg:hidden">
          <p className="truncate text-sm font-semibold text-foreground sm:text-base">{currentPageLabel}</p>
        </div>

        <div className="hidden min-w-0 flex-1 items-center justify-start gap-3 lg:flex">
          {canViewOrders && !isOrdersRoute ? (
            <form className="relative max-w-xl flex-1" onSubmit={handleOrderSearch} role="search">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <Input
                value={orderSearch}
                onChange={(event) => setOrderSearch(event.target.value)}
                placeholder="Buscar pedido ou cliente"
                aria-label="Buscar pedido ou cliente"
                className="h-[42px] pl-10"
              />
            </form>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          {canCreateOrders ? (
            <Button
              type="button"
              aria-label="Criar novo pedido"
              onClick={() => navigate('/orders/new')}
              className="h-12 px-3 sm:h-11 sm:px-4"
            >
              <Plus className="h-4 w-4" />
              <span className="sm:hidden">Novo</span>
              <span className="hidden sm:inline">Novo pedido</span>
            </Button>
          ) : null}
          <div className="hidden max-w-[190px] lg:block">
            <StoreSelector />
          </div>
          <div className="hidden items-center gap-2 border-l border-border pl-3 md:flex">
            <div className="hidden text-right md:block">
              <p className="max-w-36 truncate text-sm font-semibold text-foreground">
                {currentUser?.name ?? 'Sessao ativa'}
              </p>
              <p className="text-xs text-muted-foreground">
                {currentUser ? roleLabelMap[currentUser.role] : 'Perfil'}
              </p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-foreground text-xs font-bold text-white">
              {currentUser?.initials ?? 'AD'}
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="hidden border border-border md:inline-flex"
            aria-label="Sair do admin"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  )
}
