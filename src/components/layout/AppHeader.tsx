import { Bell, Command, LogOut, PanelLeft, Search, Sparkles } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { queryClient } from '@/hooks/queries'
import { roleLabelMap } from '@/lib/domain'
import { useUiStore } from '@/stores'
import { useAuthStore } from '@/stores/auth-store'

export function AppHeader() {
  const navigate = useNavigate()
  const toggleMobileSidebar = useUiStore((state) => state.toggleMobileSidebar)
  const currentUser = useAuthStore((state) => state.user)
  const clearSession = useAuthStore((state) => state.clearSession)

  const handleLogout = () => {
    clearSession()
    queryClient.clear()
    navigate('/login', { replace: true })
  }

  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-[#020914]/82 backdrop-blur-xl">
      <div className="flex items-center gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Button
          size="icon"
          variant="ghost"
          className="rounded-2xl text-slate-100 hover:bg-white/[0.08] lg:hidden"
          onClick={toggleMobileSidebar}
        >
          <PanelLeft className="h-5 w-5" />
        </Button>

        <div className="hidden flex-1 items-center gap-3 lg:flex">
          <div className="relative max-w-xl flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <Input
              placeholder="Buscar pedido, cliente, mesa ou motoboy"
              className="h-11 rounded-2xl border-white/10 bg-[#07111f] pl-10 text-slate-100 placeholder:text-slate-600 focus:border-orange-500 focus:ring-orange-500/20"
            />
          </div>
          <div className="rounded-full border border-orange-400/20 bg-orange-500/[0.10] px-3 py-2 text-xs font-bold text-orange-200">
            {currentUser?.store.tradeName ?? 'Cain Delivery'} · Operacao autenticada
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="hidden rounded-2xl border border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08] sm:inline-flex"
          >
            <Command className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="hidden rounded-2xl border border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08] sm:inline-flex"
          >
            <Sparkles className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="relative rounded-2xl border border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]"
          >
            <Bell className="h-4 w-4" />
            <span className="absolute right-1.5 top-1.5 rounded-full bg-orange-500 px-1.5 text-[10px] font-black text-white">
              12
            </span>
          </Button>
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-2.5 py-2">
            <div className="hidden text-right md:block">
              <p className="text-sm font-bold text-white">{currentUser?.name ?? 'Sessao ativa'}</p>
              <p className="text-xs text-slate-500">
                {currentUser ? roleLabelMap[currentUser.role] : 'Perfil'}
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#0b2038] text-sm font-black text-white ring-1 ring-white/10">
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
