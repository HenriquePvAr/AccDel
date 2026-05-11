import type { ReactNode } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { ShieldAlert } from 'lucide-react'

import { getFirstAuthorizedPath } from '@/app/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { roleLabelMap } from '@/lib/domain'
import { useAuthStore } from '@/stores/auth-store'
import type { AdminPermission } from '@/types'

export function RequireAuth({ children }: { children: ReactNode }) {
  const location = useLocation()
  const status = useAuthStore((state) => state.status)
  const user = useAuthStore((state) => state.user)

  if (status === 'checking') {
    return <AuthLoadingScreen />
  }

  if (status !== 'authenticated' || !user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return children
}

export function RequirePermission({
  permission,
  children,
}: {
  permission: AdminPermission
  children: ReactNode
}) {
  const user = useAuthStore((state) => state.user)

  if (!user?.permissions.includes(permission)) {
    return <AccessDeniedScreen permission={permission} />
  }

  return children
}

export function AuthLoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#020914] px-6 text-slate-100">
      <div className="panel-surface flex w-full max-w-md items-center gap-4 p-5">
        <div className="h-11 w-11 animate-pulse rounded-2xl bg-primary/15" />
        <div>
          <p className="text-sm font-semibold">Restaurando sessao segura</p>
          <p className="text-sm text-muted-foreground">Validando acesso com a API do admin.</p>
        </div>
      </div>
    </div>
  )
}

function AccessDeniedScreen({ permission }: { permission: AdminPermission }) {
  const user = useAuthStore((state) => state.user)
  const fallbackPath = getFirstAuthorizedPath(user?.permissions ?? [])

  return (
    <main className="flex min-h-[calc(100vh-88px)] items-center justify-center px-6 py-10">
      <Card className="max-w-xl">
        <CardContent className="space-y-5 p-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-status-danger/10 text-status-danger">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Acesso bloqueado
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">
              Seu perfil nao tem permissao para esta area.
            </h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Perfil atual: {user ? roleLabelMap[user.role] : 'nao identificado'}. Permissao
              exigida: {permission}.
            </p>
          </div>
          <Button asChild>
            <Link to={fallbackPath}>Ir para uma area permitida</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}
