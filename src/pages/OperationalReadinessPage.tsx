import type { ReactNode } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  CircleOff,
  Clock3,
  Database,
  MessagesSquare,
  Printer,
  RefreshCcw,
  ShieldCheck,
} from 'lucide-react'

import { PageShell } from '@/components/shared/PageShell'
import { SectionHeader } from '@/components/shared/SectionHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useReadinessQuery } from '@/hooks/queries'
import { usePageTitle } from '@/hooks/use-page-title'
import { cn } from '@/lib/utils'
import type { ReadinessSnapshot } from '@/services/operations/readiness-service'

const featureLabels: Record<string, string> = {
  whatsapp: 'WhatsApp',
  aiAttendant: 'Atendimento automatico',
  printing: 'Impressao',
  waiterPwa: 'Aplicativo do garcom',
  publicTracking: 'Acompanhamento publico',
  orderNotifications: 'Notificacoes de pedido',
}

export function OperationalReadinessPage() {
  usePageTitle('Sistema')
  const readinessQuery = useReadinessQuery()
  const responseSnapshot = readinessQuery.data
  const snapshot =
    responseSnapshot?.database &&
    responseSnapshot.migrations &&
    responseSnapshot.metrics &&
    responseSnapshot.features
      ? responseSnapshot
      : null

  return (
    <PageShell>
      <SectionHeader
        title="Sistema"
        description="Confira o que está disponível e o que precisa de atenção."
        actions={(
          <Button
            type="button"
            variant="outline"
            disabled={readinessQuery.isFetching}
            onClick={() => void readinessQuery.refetch()}
          >
            <RefreshCcw className={cn('h-4 w-4', readinessQuery.isFetching && 'animate-spin')} />
            Atualizar
          </Button>
        )}
      />

      {readinessQuery.isPending ? <ReadinessSkeleton /> : null}
      {readinessQuery.isError ? (
        <Card className="border-red-400/20 bg-red-400/[0.06]">
          <CardContent className="flex items-start gap-3 p-5 text-red-100">
            <CircleOff className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-black">Não foi possível consultar o sistema</p>
              <p className="mt-1 text-sm text-red-200/75">
                Confirme sua conexao e tente novamente antes de liberar o piloto.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {!readinessQuery.isPending && !readinessQuery.isError && !snapshot ? (
        <Card>
          <CardContent className="flex items-start gap-3 p-5">
            <CircleOff className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div>
              <p className="font-semibold text-foreground">Estado ainda nao disponivel</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Atualize a tela antes de liberar o piloto.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {snapshot ? (
        <>
          <ReadinessBanner snapshot={snapshot} />

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SignalCard
              icon={<Database className="h-5 w-5" />}
              title="Dados da loja"
              value={snapshot.database.reachable
                ? `${snapshot.migrations.applied}/${snapshot.migrations.expected}`
                : 'Indisponivel'}
              detail={snapshot.migrations.failed
                ? snapshot.migrations.failed === 1
                  ? '1 atualizacao incompleta'
                  : `${snapshot.migrations.failed} atualizacoes incompletas`
                : 'Sem atualizacao incompleta detectada'}
              danger={!snapshot.database.reachable || snapshot.migrations.applied !== snapshot.migrations.expected || Boolean(snapshot.migrations.failed)}
            />
            <SignalCard
              icon={<MessagesSquare className="h-5 w-5" />}
              title="Atendimento"
              value={(snapshot.queues?.outbound.pending ?? 0) === 1 ? '1 mensagem pendente' : `${snapshot.queues?.outbound.pending ?? 0} mensagens pendentes`}
              detail={`${snapshot.queues?.outbound.failed ?? 0} ${(snapshot.queues?.outbound.failed ?? 0) === 1 ? 'falha' : 'falhas'}; ${snapshot.operation?.waitingHuman ?? 0} aguardando atendente`}
              danger={Boolean(snapshot.queues?.outbound.failed)}
            />
            <SignalCard
              icon={<Printer className="h-5 w-5" />}
              title="Impressao"
              value={
                (snapshot.printingAgents?.online ?? 0) === 1
                  ? '1 computador conectado'
                  : `${snapshot.printingAgents?.online ?? 0} computadores conectados`
              }
              detail={`${snapshot.printingAgents?.offline ?? 0} ${
                (snapshot.printingAgents?.offline ?? 0) === 1 ? 'desconectado' : 'desconectados'
              }; ${snapshot.queues?.printing.failed ?? 0} ${
                (snapshot.queues?.printing.failed ?? 0) === 1 ? 'impressao com falha' : 'impressoes com falha'
              }`}
              danger={Boolean((snapshot.printingAgents?.offline ?? 0) + (snapshot.queues?.printing.failed ?? 0))}
            />
            <SignalCard
              icon={<Clock3 className="h-5 w-5" />}
              title="Loja"
              value={(snapshot.operation?.delayedOrders ?? 0) === 1 ? '1 pedido atrasado' : `${snapshot.operation?.delayedOrders ?? 0} pedidos atrasados`}
              detail={snapshot.metrics.activeRealtimeConnections === 1 ? '1 conexão ativa neste painel' : `${snapshot.metrics.activeRealtimeConnections} conexões ativas neste painel`}
              danger={Boolean(snapshot.operation?.delayedOrders)}
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
            <Card>
              <CardHeader>
                <CardTitle>Recursos ativados</CardTitle>
                <CardDescription>
                  Esta tela apenas mostra o estado; alteracoes exigem configuracao controlada.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                {Object.entries(snapshot.features).map(([feature, enabled]) => (
                  <div key={feature} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <span className="text-sm font-semibold text-slate-200">{featureLabels[feature] ?? feature}</span>
                    <Badge variant={enabled ? 'success' : 'default'}>{enabled ? 'Ativa' : 'Inativa'}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Sinais do servico</CardTitle>
                <CardDescription>
                  Indicadores para ajudar a equipe a identificar instabilidade.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3">
                <ProcessMetric label="Requisicoes" value={snapshot.metrics.requests} />
                <ProcessMetric label="Falhas" value={snapshot.metrics.failures} />
                <ProcessMetric label="Conflitos" value={snapshot.metrics.conflicts} />
                <ProcessMetric label="Tempo medio" value={`${snapshot.metrics.averageDurationMs} ms`} />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="flex flex-col gap-4 p-5 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-5 w-5 text-cyan-300" />
                <span>
                  Ambiente <strong className="text-white">{snapshot.appEnvironment}</strong> · versao <strong className="font-mono text-white">{snapshot.version}</strong>
                </span>
              </div>
              <span>Verificado em {new Date(snapshot.checkedAt).toLocaleString('pt-BR')}</span>
            </CardContent>
          </Card>
        </>
      ) : null}
    </PageShell>
  )
}

function ReadinessBanner({ snapshot }: { snapshot: ReadinessSnapshot }) {
  const blocked = snapshot.status === 'blocked'
  const attention = snapshot.status === 'attention'
  const Icon = blocked || attention ? AlertTriangle : CheckCircle2
  return (
    <section className={cn(
      'flex flex-col gap-4 rounded-3xl border p-5 sm:flex-row sm:items-center sm:justify-between',
      blocked
        ? 'border-red-400/25 bg-red-400/[0.07]'
        : attention
          ? 'border-amber-400/25 bg-amber-400/[0.07]'
          : 'border-emerald-400/25 bg-emerald-400/[0.07]',
    )}>
      <div className="flex items-start gap-4">
        <Icon className={cn('mt-1 h-6 w-6', blocked ? 'text-red-300' : attention ? 'text-amber-300' : 'text-emerald-300')} />
        <div>
          <p className="text-lg font-black text-white">
            {blocked ? 'Liberação bloqueada' : attention ? 'Pronto com pontos de atenção' : 'Sistema pronto'}
          </p>
          <p className="mt-1 text-sm leading-6 text-slate-300">
            {blocked
              ? 'Corrija banco ou migracoes antes de iniciar qualquer turno piloto.'
              : attention
                ? 'Ha filas, atrasos, computadores desconectados ou conversas que precisam de responsavel.'
                : 'Ainda sao obrigatorias as validacoes fisicas e externas do checklist do piloto.'}
          </p>
        </div>
      </div>
      <Badge variant={blocked ? 'danger' : attention ? 'warning' : 'success'}>{snapshot.status}</Badge>
    </section>
  )
}

function SignalCard({ icon, title, value, detail, danger }: {
  icon: ReactNode
  title: string
  value: string
  detail: string
  danger: boolean
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className={cn('grid h-10 w-10 place-items-center rounded-2xl', danger ? 'bg-red-400/10 text-red-300' : 'bg-cyan-400/10 text-cyan-300')}>{icon}</div>
        <p className="mt-4 text-xs font-black uppercase tracking-[0.14em] text-slate-500">{title}</p>
        <p className="mt-1 text-xl font-black text-white">{value}</p>
        <p className="mt-2 text-xs leading-5 text-slate-500">{detail}</p>
      </CardContent>
    </Card>
  )
}

function ProcessMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-black text-white">{value}</p>
    </div>
  )
}

function ReadinessSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-44 rounded-3xl" />)}
    </div>
  )
}
