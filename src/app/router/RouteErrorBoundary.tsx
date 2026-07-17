import { isRouteErrorResponse, useNavigate, useRouteError } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, RotateCcw } from 'lucide-react'

import { PageShell } from '@/components/shared/PageShell'
import { Button } from '@/components/ui/button'

function getErrorCopy(error: unknown) {
  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      return {
        title: 'Pagina nao encontrada',
        description: 'Este endereco nao existe ou foi movido. Volte ao painel para continuar.',
      }
    }

    return {
      title: 'Nao foi possivel abrir esta pagina',
      description:
        typeof error.data === 'string'
          ? error.data
          : 'Tente novamente ou volte ao painel para continuar.',
    }
  }

  if (error instanceof Error) {
    return {
      title: 'Falha ao carregar esta tela',
      description: 'Tente recarregar. Se o problema continuar, avise o responsavel pelo painel.',
    }
  }

  return {
    title: 'Nao foi possivel abrir esta pagina',
    description: 'Recarregue a pagina ou volte ao painel para continuar.',
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
            Cain Delivery
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
