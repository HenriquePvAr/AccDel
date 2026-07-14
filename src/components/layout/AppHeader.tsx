import { LogOut, PanelLeft, Plus, Search } from 'lucide-react'
import { type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { StoreSelector } from '@/components/layout/StoreSelector'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { queryClient } from '@/hooks/queries'
import { useCan } from '@/hooks/use-permissions'
import { roleLabelMap } from '@/lib/domain'
import { useOrderFiltersStore, useUiStore } from '@/stores'
import { useAuthStore } from '@/stores/auth-store'

export function AppHeader() {
  const navigate = useNavigate()
  const location = useLocation()
  const toggleMobileSidebar = useUiStore((state) => state.toggleMobileSidebar)
  const orderSearch = useOrderFiltersStore((state) => state.search)
  const setOrderSearch = useOrderFiltersStore((state) => state.setSearch)
  const currentUser = useAuthStore((state) => state.user)
  const clearSession = useAuthStore((state) => state.clearSession)
  const canViewOrders = useCan('orders:view')
  const canCreateOrders = useCan('orders:create')
  const isOrdersRoute = location.pathname.startsWith('/orders')

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
    <header className="sticky top-0 z-30 border-b border-white/10 bg-[#020914]/82 backdrop-blur-xl">
      <div className="flex items-center gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Button
          size="icon"
          variant="ghost"
          className="rounded-2xl text-slate-100 hover:bg-white/[0.08] lg:hidden"
          aria-label="Abrir menu de navegacao"
          onClick={toggleMobileSidebar}
        >
          <PanelLeft className="h-5 w-5" />
        </Button>

        <div className="hidden flex-1 items-center gap-3 lg:flex">
          {canViewOrders && !isOrdersRoute ? (
            <form className="relative max-w-xl flex-1" onSubmit={handleOrderSearch} role="search">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <Input
                value={orderSearch}
                onChange={(event) => setOrderSearch(event.target.value)}
                placeholder="Buscar pedido ou cliente"
                aria-label="Buscar pedido ou cliente"
                className="h-11 rounded-2xl border-white/10 bg-[#07111f] pl-10 text-slate-100 placeholder:text-slate-600 focus:border-orange-500 focus:ring-orange-500/20"
              />
            </form>
          ) : null}
        </div>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          {canCreateOrders ? (
            <Button
              type="button"
              aria-label="Criar novo pedido"
              onClick={() => navigate('/orders/new')}
              className="h-10 rounded-xl bg-orange-600 px-3 font-bold text-white hover:bg-orange-500 sm:px-4"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Novo pedido</span>
            </Button>
          ) : null}
          <div className="hidden max-w-[210px] md:block">
            <StoreSelector />
          </div>
          <div className="hidden items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-2.5 py-2 sm:flex">
            <div className="hidden text-right md:block">
              <p className="text-sm font-bold text-white">
                {currentUser?.name ?? 'Sessao ativa'}
              </p>
              <p className="text-xs text-slate-500">
                {currentUser ? roleLabelMap[currentUser.role] : 'Perfil'}
              </p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0b2038] text-sm font-black text-white ring-1 ring-white/10">
              {currentUser?.initials ?? 'AD'}
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-2xl border border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]"
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
