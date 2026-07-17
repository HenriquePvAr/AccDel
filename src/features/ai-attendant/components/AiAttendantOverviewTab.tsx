import {
  AlertCircle,
  Bot,
  Brain,
  Clock3,
  MessageSquare,
  Pause,
  Play,
  Smartphone,
  TestTube,
  Users,
  Zap,
} from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  useAiAttendantOverviewQuery,
  useUpdateAiAttendantSettingsMutation,
  useWhatsappSessionQuery,
} from '@/hooks/queries/ai-attendant'
import type { AiAttendantTabValue } from '@/pages/AiAttendantPage'

import { aiModeLabels, whatsappStatusLabels } from './ai-attendant-labels'

interface AiAttendantOverviewTabProps {
  onNavigate: (tab: AiAttendantTabValue) => void
}

export function AiAttendantOverviewTab({ onNavigate }: AiAttendantOverviewTabProps) {
  const { data: overview, isLoading, refetch } = useAiAttendantOverviewQuery()
  const { data: session } = useWhatsappSessionQuery()
  const updateSettings = useUpdateAiAttendantSettingsMutation()
  const [loadingDelayed, setLoadingDelayed] = useState(false)

  useEffect(() => {
    if (!isLoading) return

    const timer = window.setTimeout(() => setLoadingDelayed(true), 4000)
    return () => window.clearTimeout(timer)
  }, [isLoading])

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Alert variant={loadingDelayed ? 'warning' : 'default'}>
          <AlertTitle>
            <Clock3 className="h-4 w-4" />
            {loadingDelayed ? 'A verificacao esta demorando' : 'Carregando status do atendimento'}
          </AlertTitle>
          <AlertDescription>
            {loadingDelayed
              ? 'Os dados ainda nao responderam. Voce pode tentar novamente sem sair desta tela.'
              : 'Verificando IA, conexao do WhatsApp e conversas pendentes.'}
          </AlertDescription>
          {loadingDelayed ? (
            <Button type="button" size="sm" variant="outline" className="mt-3" onClick={() => void refetch()}>
              Tentar novamente
            </Button>
          ) : null}
        </Alert>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {['status', 'whatsapp', 'mode', 'today', 'human', 'errors'].map((item) => (
            <Skeleton key={item} className="h-28" />
          ))}
        </div>
      </div>
    )
  }

  if (!overview) {
    return (
      <Alert variant="danger">
        <AlertTitle>
          <AlertCircle className="h-4 w-4" />
          Nao foi possivel carregar a visao geral
        </AlertTitle>
        <AlertDescription>
          Verifique a conexao e se o usuario possui permissao para o atendimento automatico.
        </AlertDescription>
      </Alert>
    )
  }

  const whatsappConnected = overview.whatsappStatus === 'connected'
  const providerUnconfigured = session?.provider === 'unconfigured'
  const hasKnowledge = overview.knowledgeEntries > 0

  const handleToggleAi = () => {
    const nextEnabled = !overview.aiActive

    updateSettings.mutate({
      isEnabled: nextEnabled,
      mode: nextEnabled ? (overview.mode === 'off' ? 'hybrid' : overview.mode) : 'off',
    })
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <MetricTile
          icon={<Bot className="h-5 w-5" />}
          label="Status IA"
          value={overview.aiActive ? 'Ativa' : 'Inativa'}
          detail={overview.aiActive ? 'Pronta para operar conforme modo.' : 'Nao responde clientes.'}
          tone={overview.aiActive ? 'success' : 'muted'}
        />
        <MetricTile
          icon={<Smartphone className="h-5 w-5" />}
          label="WhatsApp"
          value={whatsappStatusLabels[overview.whatsappStatus]}
          detail={session?.phoneNumber ?? session?.lastError ?? 'Nenhum numero conectado.'}
          tone={whatsappConnected ? 'success' : overview.whatsappStatus === 'error' ? 'danger' : 'warning'}
        />
        <MetricTile
          icon={<Zap className="h-5 w-5" />}
          label="Modo atual"
          value={aiModeLabels[overview.mode]}
          detail={overview.mode === 'off' ? 'Resposta automatica desligada.' : 'Comportamento salvo.'}
          tone={overview.mode === 'off' ? 'muted' : 'success'}
        />
        <MetricTile
          icon={<MessageSquare className="h-5 w-5" />}
          label="Conversas hoje"
          value={String(overview.conversationsToday)}
          detail={`${overview.repliesSentToday} respostas da IA enviadas hoje.`}
          tone="default"
        />
        <MetricTile
          icon={<Users className="h-5 w-5" />}
          label="Aguardando humano"
          value={String(overview.waitingHuman)}
          detail="Conversas pendentes de atendimento manual."
          tone={overview.waitingHuman > 0 ? 'warning' : 'success'}
        />
        <MetricTile
          icon={<AlertCircle className="h-5 w-5" />}
          label="Erros"
          value={String(overview.integrationErrors)}
          detail={overview.integrationErrors > 0 ? 'Ha falhas de integracao registradas.' : 'Sem erro registrado.'}
          tone={overview.integrationErrors > 0 ? 'danger' : 'success'}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {providerUnconfigured ? (
          <Alert variant="danger" className="lg:col-span-3">
            <AlertTitle>
              <AlertCircle className="h-4 w-4" />
              Servico de WhatsApp nao configurado
            </AlertTitle>
            <AlertDescription>
              Complete as credenciais do servico escolhido antes de iniciar o atendimento.
            </AlertDescription>
          </Alert>
        ) : null}

        {!whatsappConnected ? (
          <Alert variant="warning">
            <AlertTitle>
              <Smartphone className="h-4 w-4" />
              WhatsApp desconectado
            </AlertTitle>
            <AlertDescription>
              Conecte uma sessao real para o atendente receber e enviar mensagens.
            </AlertDescription>
          </Alert>
        ) : null}

        {!hasKnowledge ? (
          <Alert variant="warning">
            <AlertTitle>
              <Brain className="h-4 w-4" />
              Base vazia
            </AlertTitle>
            <AlertDescription>
              Cadastre FAQs, politicas e dados da loja para melhorar o contexto das respostas.
            </AlertDescription>
          </Alert>
        ) : null}

        {overview.integrationErrors > 0 ? (
          <Alert variant="danger">
            <AlertTitle>
              <AlertCircle className="h-4 w-4" />
              Integracao com erro
            </AlertTitle>
            <AlertDescription>
              Abra WhatsApp ou Teste para consultar o motivo e tentar novamente.
            </AlertDescription>
          </Alert>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Acoes rapidas</CardTitle>
          <CardDescription>
            Atalhos para operar o atendente sem sair da visao geral.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button
            variant={overview.aiActive ? 'outline' : 'default'}
            size="sm"
            onClick={handleToggleAi}
            disabled={updateSettings.isPending}
          >
            {overview.aiActive ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {overview.aiActive ? 'Pausar IA' : 'Ativar IA'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => onNavigate('whatsapp')}>
            <Smartphone className="h-4 w-4" />
            Conectar WhatsApp
          </Button>
          <Button variant="outline" size="sm" onClick={() => onNavigate('test')}>
            <TestTube className="h-4 w-4" />
            Testar resposta
          </Button>
          <Button variant="outline" size="sm" onClick={() => onNavigate('conversations')}>
            <MessageSquare className="h-4 w-4" />
            Ver conversas
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

interface MetricTileProps {
  icon: ReactNode
  label: string
  value: string
  detail: string
  tone: 'default' | 'success' | 'warning' | 'danger' | 'muted'
}

function MetricTile({ icon, label, value, detail, tone }: MetricTileProps) {
  return (
    <Card className="min-h-28">
      <CardContent className="flex h-full flex-col gap-3 p-4">
        <div className="flex w-full items-center justify-between gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            {icon}
          </div>
          <Badge
            className="ml-auto"
            variant={
              tone === 'success'
                ? 'success'
                : tone === 'warning'
                  ? 'warning'
                  : tone === 'danger'
                    ? 'danger'
                    : 'default'
            }
          >
            {label}
          </Badge>
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="font-mono text-2xl font-bold tracking-tight text-foreground">{value}</p>
          <p className="text-sm leading-5 text-muted-foreground">{detail}</p>
        </div>
      </CardContent>
    </Card>
  )
}
