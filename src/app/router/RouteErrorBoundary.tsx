import { isRouteErrorResponse, useNavigate, useRouteError } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, RotateCcw } from 'lucide-react'

import { PageShell } from '@/components/shared/PageShell'
import { Button } from '@/components/ui/button'

function getErrorCopy(error: unknown) {
  if (isRouteErrorResponse(error)) {
    return {
      title: `${error.status} ${error.statusText}`,
      description:
        typeof error.data === 'string'
          ? error.data
          : 'A rota encontrou um problema inesperado.',
    }
  }

  if (error instanceof Error) {
    return {
      title: 'Falha ao carregar esta tela',
      description: error.message,
    }
  }

  return {
    title: 'Falha inesperada no admin',
    description: 'Recarregue a página. Se persistir, revise o console e a integração atual.',
  }
}

export function RouteErrorBoundary() {
  const error = useRouteError()
  const navigate = useNavigate()
  const copy = getErrorCopy(error)

  return (
    <main className="min-h-screen bg-background">
      <PageShell className="flex min-h-screen items-center justify-center">
      <div className="panel-surface max-w-xl space-y-5 p-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-status-danger/10 text-status-danger">
          <AlertTriangle className="h-7 w-7" />
        </div>
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Erro de rota
          </p>
          <h1 className="text-2xl font-semibold text-foreground">{copy.title}</h1>
          <p className="text-sm leading-6 text-muted-foreground">{copy.description}</p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
          <Button variant="secondary" onClick={() => window.location.reload()}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Recarregar
          </Button>
          <Button onClick={() => navigate('/dashboard')}>
            Voltar ao painel
          </Button>
        </div>
      </div>
      </PageShell>
    </main>
  )
}
