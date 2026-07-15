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
  aiAttendant: 'Atendente IA',
  printing: 'Impressao',
  waiterPwa: 'PWA do garcom',
  publicTracking: 'Rastreio publico',
  orderNotifications: 'Notificacoes de pedido',
}

export function OperationalReadinessPage() {
  usePageTitle('Prontidao operacional')
  const readinessQuery = useReadinessQuery()
  const snapshot = readinessQuery.data

  return (
    <PageShell>
      <SectionHeader
        eyebrow="Piloto supervisionado"
        title="Prontidao operacional"
        description="Leitura consolidada e restrita da API, banco, migracoes, filas, agentes, flags e sinais que exigem intervencao humana."
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
              <p className="font-black">Nao foi possivel consultar /ready</p>
              <p className="mt-1 text-sm text-red-200/75">
                Confirme a API, a sessao e a permissao dashboard:view antes de liberar o piloto.
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
              title="Banco e migracoes"
              value={snapshot.database.reachable
                ? `${snapshot.migrations.applied}/${snapshot.migrations.expected}`
                : 'Indisponivel'}
              detail={snapshot.migrations.failed
                ? `${snapshot.migrations.failed} migracao(oes) incompleta(s)`
                : 'Sem migracao incompleta detectada'}
              danger={!snapshot.database.reachable || snapshot.migrations.applied !== snapshot.migrations.expected || Boolean(snapshot.migrations.failed)}
            />
            <SignalCard
              icon={<MessagesSquare className="h-5 w-5" />}
              title="Mensageria"
              value={`${snapshot.queues?.outbound.pending ?? 0} pendente(s)`}
              detail={`${snapshot.queues?.outbound.failed ?? 0} falha(s); ${snapshot.operation?.waitingHuman ?? 0} aguardando humano`}
              danger={Boolean(snapshot.queues?.outbound.failed)}
            />
            <SignalCard
              icon={<Printer className="h-5 w-5" />}
              title="Impressao"
              value={`${snapshot.printingAgents?.online ?? 0} agente(s) online`}
              detail={`${snapshot.printingAgents?.offline ?? 0} offline; ${snapshot.queues?.printing.failed ?? 0} job(s) falho(s)`}
              danger={Boolean((snapshot.printingAgents?.offline ?? 0) + (snapshot.queues?.printing.failed ?? 0))}
            />
            <SignalCard
              icon={<Clock3 className="h-5 w-5" />}
              title="Operacao"
              value={`${snapshot.operation?.delayedOrders ?? 0} atrasado(s)`}
              detail={`${snapshot.metrics.activeRealtimeConnections} conexao(oes) realtime neste processo`}
              danger={Boolean(snapshot.operation?.delayedOrders)}
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
            <Card>
              <CardHeader>
                <CardTitle>Flags efetivas no servidor</CardTitle>
                <CardDescription>
                  O frontend apenas exibe o estado. Alteracoes exigem configuracao controlada e reinicio da API.
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
                <CardTitle>Processo local da API</CardTitle>
                <CardDescription>
                  Metricas em memoria; em mais de uma replica, cada processo deve ser observado separadamente.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3">
                <ProcessMetric label="Requisicoes" value={snapshot.metrics.requests} />
                <ProcessMetric label="Falhas HTTP" value={snapshot.metrics.failures} />
                <ProcessMetric label="Conflitos" value={snapshot.metrics.conflicts} />
                <ProcessMetric label="Latencia media" value={`${snapshot.metrics.averageDurationMs} ms`} />
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
            {blocked ? 'Liberacao bloqueada' : attention ? 'Pronto com atencao operacional' : 'Sinais de software prontos'}
          </p>
          <p className="mt-1 text-sm leading-6 text-slate-300">
            {blocked
              ? 'Corrija banco ou migracoes antes de iniciar qualquer turno piloto.'
              : attention
                ? 'Ha filas, atrasos, agentes offline ou handoffs que precisam de responsavel.'
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
