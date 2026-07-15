import { useQuery, useQueryClient } from '@tanstack/react-query'
import { LogOut, ShieldCheck, Store, UserRound } from 'lucide-react'

import { ErrorState, LoadingState } from '@/components/States'
import { apiRequest } from '@/lib/api'
import { useAuth } from '@/lib/auth-context'
import type { WaiterProfile } from '@/types'

export function ProfilePage() {
  const { logout } = useAuth()
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: ['waiter', 'profile'],
    queryFn: () => apiRequest<{ data: WaiterProfile }>('/waiter/profile'),
  })
  if (query.isPending) return <LoadingState label="Carregando perfil…" />
  if (query.isError) return <ErrorState message={query.error.message} onRetry={() => void query.refetch()} />
  const profile = query.data.data

  function signOut() {
    queryClient.clear()
    logout()
  }

  return (
    <section className="page profile-page">
      <div className="page-heading"><div><span className="eyebrow">Conta e dispositivo</span><h1>Perfil</h1></div></div>
      <div className="profile-card">
        <div className="profile-avatar"><UserRound size={30} /></div>
        <div><h2>{profile.name}</h2><p>{profile.email}</p><span className="status-badge neutral">{profile.role === 'manager' ? 'Gerente' : 'Garçom'} · {profile.operationalStatus === 'serving' ? 'Em atendimento' : 'Disponível'}</span></div>
      </div>
      <div className="profile-details">
        <div><Store size={20} /><span>Loja<strong>{profile.store.tradeName || profile.store.name}</strong></span></div>
        <div><ShieldCheck size={20} /><span>Segurança<strong>Sessão protegida por permissões do backend</strong></span></div>
      </div>
      <div className="profile-stats"><div><strong>{profile.tablesServed}</strong><span>mesas atendidas</span></div><div><strong>{profile.totalOrders}</strong><span>itens lançados</span></div></div>
      <button className="button secondary logout-button" type="button" onClick={signOut}><LogOut size={19} /> Sair deste dispositivo</button>
      <p className="privacy-note">Ao sair, o token, os dados em memória e seus rascunhos locais são removidos.</p>
    </section>
  )
}
