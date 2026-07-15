import { ClipboardList, LayoutGrid, LogOut, UserRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'

import { useAuth } from '@/lib/auth'
import { useOnlineStatus } from '@/lib/online'

const navigation = [
  { to: '/', label: 'Mesas', icon: LayoutGrid },
  { to: '/pedidos', label: 'Pedidos', icon: ClipboardList },
  { to: '/perfil', label: 'Perfil', icon: UserRound },
]

export function AppShell() {
  const { user, logout } = useAuth()

  return (
    <div className="app-shell">
      <aside className="side-nav" aria-label="Navegação principal">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true">ϟ</span>
          <span><strong>Cain</strong><small>Garçom</small></span>
        </div>
        <nav>
          {navigation.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/'}>
              <Icon size={20} aria-hidden="true" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <button className="nav-logout" type="button" onClick={logout}>
          <LogOut size={19} aria-hidden="true" /> Sair
        </button>
      </aside>

      <div className="app-content">
        <header className="mobile-header">
          <div className="brand-lockup">
            <span className="brand-mark" aria-hidden="true">ϟ</span>
            <span><strong>Cain</strong><small>Garçom</small></span>
          </div>
          <span className="user-avatar" title={user?.name}>{user?.initials ?? 'CG'}</span>
        </header>
        <OfflineBanner />
        <UpdateNotice />
        <main id="conteudo-principal"><Outlet /></main>
      </div>

      <nav className="bottom-nav" aria-label="Navegação principal">
        {navigation.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === '/'}>
            <Icon size={21} aria-hidden="true" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

function UpdateNotice() {
  const [available, setAvailable] = useState(false)
  useEffect(() => {
    const show = () => setAvailable(true)
    window.addEventListener('cain-waiter:update-available', show)
    return () => window.removeEventListener('cain-waiter:update-available', show)
  }, [])
  if (!available) return null
  return <div className="update-notice" role="status"><span>Uma nova versão do Cain Garçom está pronta.</span><button type="button" onClick={() => window.location.reload()}>Atualizar</button></div>
}

function OfflineBanner() {
  const online = useOnlineStatus()
  if (online) return null
  return (
    <div className="offline-banner" role="status" data-offline-banner>
      Sem internet. Você pode revisar o rascunho, mas ações operacionais estão bloqueadas.
    </div>
  )
}
