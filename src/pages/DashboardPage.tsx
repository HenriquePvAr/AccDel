import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  Bike,
  Bot,
  ChefHat,
  Clock3,
  CreditCard,
  Crown,
  MessageSquare,
  Printer,
  RefreshCcw,
  Users,
  WalletCards,
} from 'lucide-react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { MetricChartCard } from '@/components/shared/MetricChartCard'
import { PageShell } from '@/components/shared/PageShell'
import { SectionHeader } from '@/components/shared/SectionHeader'
import { StatCard } from '@/components/shared/StatCard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  useCashRegisterQuery,
  useCustomerMetricsSummaryQuery,
  useDriversQuery,
  useKitchenQueueQuery,
  usePrintingOverviewQuery,
  useReportsQuery,
} from '@/hooks/queries'
import { useAiAttendantDashboardQuery, useConversationsQuery } from '@/hooks/queries/ai-attendant'
import { usePageTitle } from '@/hooks/use-page-title'
import { formatCurrency, formatPercent } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { PaymentMethod, ReportTableRow } from '@/types'

type DashboardPeriod = 'today' | '7d' | '30d'
type SignalTone = 'default' | 'success' | 'warning' | 'danger'

const periodOptions: Array<{ value: DashboardPeriod; label: string }> = [
  { value: 'today', label: 'Hoje' },
  { value: '7d', label: '7 dias' },
  { value: '30d', label: '30 dias' },
]

const paymentMethodLabels: Record<PaymentMethod, string> = {
  cash: 'Dinheiro',
  credit_card: 'Credito',
  debit_card: 'Debito',
  meal_voucher: 'Vale',
  payment_link: 'Link',
  pix: 'Pix',
}

export function DashboardPage() {
  usePageTitle('Dashboard operacional')
  const [period, setPeriod] = useState<DashboardPeriod>('today')

  const reportsQuery = useReportsQuery({ period })
  const kitchenQuery = useKitchenQueueQuery({ filters: { channel: 'all' } })
  const driversQuery = useDriversQuery()
  const cashQuery = useCashRegisterQuery()
  const crmSummaryQuery = useCustomerMetricsSummaryQuery()
  const aiDashboardQuery = useAiAttendantDashboardQuery()
  const printingQuery = usePrintingOverviewQuery()
  const conversationsQuery = useConversationsQuery()

  const snapshot = reportsQuery.data?.data
  const kitchenQueue = kitchenQuery.data?.data
  const cashRegister = cashQuery.data?.data
  const crmSummary = crmSummaryQuery.data?.data
  const aiDashboard = aiDashboardQuery.data
  const printing = printingQuery.data?.data
  const conversations = conversationsQuery.data ?? []
  const drivers = driversQuery.data?.data ?? []

  const activeDrivers = drivers.filter((driver) => driver.active !== false)
  const availableDrivers = activeDrivers.filter(
    (driver) => driver.availability === 'available',
  ).length
  const deliveringDrivers = activeDrivers.filter(
    (driver) => driver.availability === 'delivering' || driver.queue.length > 0,
  ).length
  const completedDeliveriesInPeriod =
    snapshot?.driverSummaries.reduce(
      (total, row) => total + (readLeadingInteger(row.primary) ?? 0),
      0,
    ) ?? null

  const cashEntries = cashRegister
    ? (Object.entries(cashRegister.entriesByMethod) as Array<[PaymentMethod, number]>)
    : []
  const topProducts = snapshot?.topProducts ?? []
  const topNeighborhoods = crmSummary?.topNeighborhoods ?? []
  const printingFailures =
    (printing?.jobCounts.FAILED ?? 0) + (printing?.jobCounts.PRINT_RESULT_UNKNOWN ?? 0)
  const conversationsWaiting = conversations.filter(
    (conversation) => conversation.status === 'waiting_human',
  ).length

  const isLoadingExecutive = reportsQuery.isLoading && !snapshot
  const operationalAlerts = [
    kitchenQueue?.summary.delayed
      ? {
          id: 'kitchen-delayed',
          label: `${kitchenQueue.summary.delayed} ${kitchenQueue.summary.delayed === 1 ? 'pedido atrasado' : 'pedidos atrasados'} no preparo`,
          to: '/orders',
          tone: 'danger' as const,
        }
      : null,
    cashQuery.isError
      ? { id: 'cash-unavailable', label: 'Caixa indisponivel', to: '/cash-register', tone: 'danger' as const }
      : null,
    driversQuery.isError
      ? { id: 'drivers-unavailable', label: 'Expedicao indisponivel', to: '/drivers/location', tone: 'danger' as const }
      : null,
    aiDashboardQuery.isError
      ? { id: 'ai-unavailable', label: 'Atendimento indisponivel', to: '/ai-attendant', tone: 'warning' as const }
      : null,
    printingFailures
      ? {
          id: 'printing-failures',
          label: printingFailures === 1 ? '1 impressao pede revisao' : `${printingFailures} impressoes pedem revisao`,
          to: '/settings/printing',
          tone: 'danger' as const,
        }
      : null,
    conversationsWaiting
      ? {
          id: 'conversations-waiting',
          label:
            conversationsWaiting === 1
              ? '1 conversa aguarda atendente'
              : `${conversationsWaiting} conversas aguardam atendente`,
          to: '/ai-attendant',
          tone: 'warning' as const,
        }
      : null,
  ].filter((alert): alert is NonNullable<typeof alert> => Boolean(alert))

  return (
    <PageShell>
      <SectionHeader
        eyebrow="Operacao"
        title="Dashboard operacional"
        description="Veja o que exige acao agora e entre direto na fila certa."
        actions={
          <div className="inline-flex rounded-lg bg-muted p-1">
            {periodOptions.map((option) => (
              <Button
                key={option.value}
                size="sm"
                variant={period === option.value ? 'default' : 'ghost'}
                onClick={() => setPeriod(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>
        }
      />

      <section className="flex flex-col gap-3 rounded-xl border border-border bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center" aria-label="Alertas operacionais">
        <div className="flex min-w-0 items-center gap-2 sm:w-52">
          <AlertTriangle className={cn('h-4 w-4 shrink-0', operationalAlerts.length ? 'text-red-700' : 'text-emerald-700')} />
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground">Precisa de atencao</h2>
            <p className="text-xs text-muted-foreground">Prioridades da operacao agora</p>
          </div>
        </div>
        <div className="flex min-w-0 flex-1 flex-wrap gap-2">
          {operationalAlerts.length ? (
            operationalAlerts.map((alert) => (
              <Link
                key={alert.id}
                to={alert.to}
                className={cn(
                  'inline-flex min-h-9 items-center rounded-lg px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  alert.tone === 'danger'
                    ? 'bg-red-50 text-red-800 hover:bg-red-100'
                    : 'bg-amber-50 text-amber-900 hover:bg-amber-100',
                )}
              >
                {alert.label}
              </Link>
            ))
          ) : (
            <p className="text-sm text-emerald-800">Nenhuma excecao critica nos dados disponiveis.</p>
          )}
        </div>
      </section>

      {isLoadingExecutive ? (
        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-[112px]" />
            ))}
          </div>
          <Skeleton className="h-[360px]" />
        </div>
      ) : (
        <>
          <section aria-labelledby="dashboard-now-title">
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">Agora</p>
                <h2 id="dashboard-now-title" className="mt-1 text-xl font-bold text-foreground">Fila operacional</h2>
              </div>
              <p className="hidden text-sm text-muted-foreground sm:block">Toque em um indicador para agir</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
              <PrioritySignalCard
                label="Atrasados"
                value={formatNullableNumber(kitchenQueue?.summary.delayed)}
                caption="resolver primeiro"
                to="/orders"
                tone={kitchenQueue?.summary.delayed ? 'danger' : 'success'}
                icon={<AlertTriangle className="h-5 w-5" />}
              />
              <PrioritySignalCard
                label="Aguardando aceite"
                value={formatNullableNumber(kitchenQueue?.summary.awaiting)}
                caption="novos pedidos"
                to="/orders"
                tone="info"
                icon={<Clock3 className="h-5 w-5" />}
              />
              <PrioritySignalCard
                label="Em preparo"
                value={formatNullableNumber(kitchenQueue?.summary.inProduction)}
                caption="na cozinha"
                to="/kitchen"
                tone="warning"
                icon={<ChefHat className="h-5 w-5" />}
              />
              <PrioritySignalCard
                label="Prontos"
                value={formatNullableNumber(kitchenQueue?.summary.ready)}
                caption="despachar ou retirar"
                to="/orders"
                tone="success"
                icon={<Bike className="h-5 w-5" />}
              />
              <PrioritySignalCard
                label="Falhas de impressao"
                value={printingQuery.isError ? 'Indisponivel' : String(printingFailures)}
                caption="tentar novamente"
                to="/settings/printing"
                tone={printingFailures ? 'danger' : 'success'}
                icon={<Printer className="h-5 w-5" />}
              />
              <PrioritySignalCard
                label="Conversas esperando"
                value={conversationsQuery.isError ? 'Indisponivel' : String(conversationsWaiting)}
                caption="assumir atendimento"
                to="/ai-attendant"
                tone={conversationsWaiting ? 'warning' : 'success'}
                icon={<MessageSquare className="h-5 w-5" />}
              />
            </div>
          </section>

          <div className="grid gap-4 xl:grid-cols-2">
            <OperationalSection
              icon={<ChefHat className="h-4 w-4" />}
              title="Cozinha"
              description="Fila de preparo em tempo real."
              status={
                kitchenQuery.isError
                  ? 'indisponivel'
                  : kitchenQueue
                    ? 'ao vivo'
                    : 'carregando'
              }
            >
              <SignalGrid>
                <SignalTile
                  title="Recebidos"
                  value={formatNullableNumber(kitchenQueue?.summary.awaiting)}
                  caption="aguardando cozinha"
                />
                <SignalTile
                  title="Em preparo"
                  value={formatNullableNumber(kitchenQueue?.summary.inProduction)}
                  caption="em producao agora"
                  tone="warning"
                />
                <SignalTile
                  title="Prontos"
                  value={formatNullableNumber(kitchenQueue?.summary.ready)}
                  caption="aguardando entrega/retirada"
                  tone="success"
                />
                <SignalTile
                  title="Atrasados"
                  value={formatNullableNumber(kitchenQueue?.summary.delayed)}
                  caption="fora do prazo"
                  tone={kitchenQueue?.summary.delayed ? 'danger' : 'default'}
                />
                <SignalTile
                  title="Tempo medio"
                  value={formatMinutes(kitchenQueue?.summary.averagePreparationMinutes)}
                  caption="preparo calculado"
                  icon={<Clock3 className="h-4 w-4" />}
                />
              </SignalGrid>
            </OperationalSection>

            <OperationalSection
              icon={<Bike className="h-4 w-4" />}
              title="Motoboys"
              description="Disponibilidade e desempenho no periodo selecionado."
              status={
                driversQuery.isError
                  ? 'indisponivel'
                  : driversQuery.isLoading
                    ? 'carregando'
                    : 'real'
              }
            >
              <SignalGrid>
                <SignalTile
                  title="Disponiveis"
                  value={formatNullableNumber(availableDrivers)}
                  caption="ativos para nova rota"
                  tone="success"
                />
                <SignalTile
                  title="Em entrega"
                  value={formatNullableNumber(deliveringDrivers)}
                  caption="com rota ou fila"
                  tone="warning"
                />
                <SignalTile
                  title="Concluidas"
                  value={formatNullableNumber(completedDeliveriesInPeriod)}
                  caption={resolvePeriodCaption(period)}
                />
                <SignalTile
                  title="Tempo medio"
                  value={formatMinutes(snapshot?.timeSummary.averageDeliveryMinutes ?? null)}
                  caption="entrega concluida"
                  icon={<Clock3 className="h-4 w-4" />}
                />
              </SignalGrid>
              <SummaryList
                title="Ranking do periodo"
                emptyMessage="Sem entregas concluidas no periodo."
                rows={snapshot?.driverSummaries.slice(0, 4).map((row) => ({
                  id: row.id,
                  label: row.name,
                  primary: row.primary,
                  secondary: row.secondary,
                }))}
              />
            </OperationalSection>
          </div>

          <section aria-labelledby="dashboard-results-title">
            <div className="mb-3">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">Abaixo da operacao</p>
              <h2 id="dashboard-results-title" className="mt-1 text-xl font-bold text-foreground">Resultado do periodo</h2>
            </div>
            {snapshot ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {snapshot.metrics.map((metric) => (
                  <StatCard key={metric.id} {...metric} />
                ))}
              </div>
            ) : (
              <UnavailablePanel
                title="Resultados indisponiveis"
                description="Nao foi possivel carregar o consolidado do periodo. Nenhum numero foi estimado."
              />
            )}
          </section>

          <div className="grid gap-4 xl:grid-cols-2">
            <OperationalSection
              icon={<WalletCards className="h-4 w-4" />}
              title="Caixa"
              description="Estado do caixa e recebimentos reais."
              status={
                cashQuery.isError
                  ? 'sem caixa'
                  : cashRegister
                    ? cashRegister.status
                    : 'carregando'
              }
            >
              <SignalGrid>
                <SignalTile
                  title="Status"
                  value={cashRegister ? cashRegisterLabel(cashRegister.status) : 'Indisponivel'}
                  caption={
                    cashQuery.isError
                      ? 'nenhum caixa encontrado'
                      : cashRegister
                        ? cashRegister.operatorName
                        : 'carregando'
                  }
                  tone={cashRegister?.status === 'open' ? 'success' : 'default'}
                />
                <SignalTile
                  title="Esperado"
                  value={
                    cashRegister ? formatCurrency(cashRegister.expectedAmount) : 'Indisponivel'
                  }
                  caption="caixa atual"
                />
                <SignalTile
                  title="Divergencia"
                  value={
                    cashRegister
                      ? formatCurrency(cashRegister.differenceAmount)
                      : 'Indisponivel'
                  }
                  caption="apos fechamento"
                  tone={cashRegister?.differenceAmount ? 'danger' : 'default'}
                />
                <SignalTile
                  title="Faturamento"
                  value={snapshot?.metrics.find((metric) => metric.id === 'gross_revenue')?.value ?? 'Indisponivel'}
                  caption={resolvePeriodCaption(period)}
                />
              </SignalGrid>
              <PaymentList
                title="Por forma de pagamento"
                cashEntries={cashEntries}
                reportRows={snapshot?.byPayment ?? []}
              />
            </OperationalSection>

            <OperationalSection
              icon={<Users className="h-4 w-4" />}
              title="Clientes"
              description="Recorrencia e relacionamento com a loja."
              status={
                crmSummaryQuery.isError
                  ? 'indisponivel'
                  : crmSummaryQuery.isLoading
                    ? 'carregando'
                    : 'real'
              }
            >
              <SignalGrid>
                <SignalTile
                  title="Novos"
                  value={formatNullableNumber(crmSummary?.segments.new)}
                  caption="clientes na base"
                />
                <SignalTile
                  title="Recorrentes"
                  value={formatNullableNumber(crmSummary?.segments.recurring)}
                  caption="voltaram a comprar"
                  tone="success"
                />
                <SignalTile
                  title="VIP"
                  value={formatNullableNumber(crmSummary?.segments.vip)}
                  caption="maior valor/frequencia"
                  tone="warning"
                  icon={<Crown className="h-4 w-4" />}
                />
                <SignalTile
                  title="Inativos"
                  value={formatNullableNumber(crmSummary?.segments.inactive)}
                  caption="sem compra recente"
                  tone="danger"
                />
                <SignalTile
                  title="Gasto total"
                  value={crmSummary ? formatCurrency(crmSummary.totalSpent) : 'Indisponivel'}
                  caption="clientes concluidos"
                />
                <SignalTile
                  title="Ticket medio"
                  value={crmSummary ? formatCurrency(crmSummary.averageTicket) : 'Indisponivel'}
                  caption="por pedido concluido"
                />
                <SignalTile
                  title="Frequencia"
                  value={formatDays(crmSummary?.averageFrequencyDays)}
                  caption="media entre compras"
                />
                <SignalTile
                  title="Cancelamentos"
                  value={formatNullableNumber(crmSummary?.cancellations)}
                  caption="historico dos clientes"
                  tone={crmSummary?.cancellations ? 'danger' : 'default'}
                />
              </SignalGrid>
              <SummaryList
                title="Bairros mais atendidos"
                emptyMessage="Sem bairros no periodo."
                rows={topNeighborhoods.slice(0, 4).map((row) => ({
                  id: row.id,
                  label: row.label,
                  primary: `${row.orders} pedidos`,
                  secondary: `${row.customers} clientes · ${formatCurrency(row.revenue)}`,
                }))}
              />
            </OperationalSection>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <OperationalSection
              icon={<Bot className="h-4 w-4" />}
              title="Atendimento automatico"
              description="Conversas, pedidos sugeridos e transferencias para a equipe."
              status={
                aiDashboardQuery.isError
                  ? 'indisponivel'
                  : aiDashboard
                    ? 'real'
                    : 'carregando'
              }
            >
              <SignalGrid>
                <SignalTile
                  title="Conversas hoje"
                  value={formatNullableNumber(aiDashboard?.kpis.attendancesToday)}
                  caption="atendimentos iniciados"
                />
                <SignalTile
                  title="Sugeridos"
                  value={formatNullableNumber(aiDashboard?.kpis.orderDraftsSuggested)}
                  caption="rascunhos de pedido"
                  tone="warning"
                />
                <SignalTile
                  title="Convertidos"
                  value={formatNullableNumber(aiDashboard?.kpis.orderDraftsConverted)}
                  caption="viraram pedido real"
                  tone="success"
                />
                <SignalTile
                  title="Humano"
                  value={formatNullableNumber(aiDashboard?.kpis.transfersToHuman)}
                  caption="transferencias"
                  tone="danger"
                />
                <SignalTile
                  title="Resolucao"
                  value={
                    aiDashboard ? formatPercent(aiDashboard.kpis.resolutionRate) : 'Indisponivel'
                  }
                  caption="sem transferencia"
                />
              </SignalGrid>
            </OperationalSection>

            <MetricChartCard
              title="Receita por periodo"
              description="Grafico gerado somente com pedidos reais do recorte selecionado."
            >
              {snapshot && snapshot.revenueSeries.length > 0 ? (
                <div className="h-[280px] min-w-0">
                  <ResponsiveContainer
                    width="100%"
                    height="100%"
                    minWidth={0}
                    initialDimension={{ width: 600, height: 280 }}
                  >
                    <LineChart data={snapshot.revenueSeries}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="label" stroke="#667078" tickLine={false} />
                      <YAxis stroke="#667078" tickLine={false} />
                      <Tooltip
                        contentStyle={{
                          background: '#ffffff',
                          border: '1px solid #dde2e5',
                          borderRadius: 8,
                          color: '#20262b',
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="revenue"
                        stroke="#EA6D2C"
                        strokeWidth={3}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyMetric
                  icon={<AlertTriangle className="h-4 w-4" />}
                  title="Sem dados no periodo"
                  description="O grafico aparece quando houver pedido ou conta de salao no recorte."
                />
              )}
            </MetricChartCard>
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <RankingCard
              title="Produtos mais vendidos"
              description="Itens reais dos pedidos e mesas."
              rows={topProducts.slice(0, 5)}
            />
            <RankingCard
              title="Categorias mais vendidas"
              description="Agregado pelo catalogo canonico."
              rows={snapshot?.topCategories.slice(0, 5) ?? []}
            />
            <RankingCard
              title="Sabores e opcoes"
              description="Opcoes escolhidas no checkout ou pedido."
              rows={snapshot?.topOptions.slice(0, 5) ?? []}
            />
          </div>
        </>
      )}
    </PageShell>
  )
}

interface OperationalSectionProps {
  icon: ReactNode
  title: string
  description: string
  status: string
  children: ReactNode
}

function PrioritySignalCard({
  label,
  value,
  caption,
  to,
  tone,
  icon,
}: {
  label: string
  value: string
  caption: string
  to: string
  tone: 'info' | 'success' | 'warning' | 'danger'
  icon: ReactNode
}) {
  const toneClasses = {
    info: 'border-blue-200 bg-blue-50 text-blue-700',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    warning: 'border-amber-200 bg-amber-50 text-amber-800',
    danger: 'border-red-200 bg-red-50 text-red-700',
  }[tone]

  return (
    <Link
      to={to}
      className={cn(
        'group flex min-h-[112px] items-center justify-between gap-4 rounded-xl border p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        toneClasses,
      )}
    >
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase tracking-[0.08em] opacity-80">{label}</p>
        <p className="mt-1 font-mono text-3xl font-bold tabular-nums text-current">{value}</p>
        <p className="mt-1 text-xs font-semibold opacity-80">{caption}</p>
      </div>
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/80 shadow-sm transition group-hover:scale-105">
        {icon}
      </span>
    </Link>
  )
}

function OperationalSection({
  icon,
  title,
  description,
  status,
  children,
}: OperationalSectionProps) {
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
            {icon}
          </div>
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </div>
        <Badge variant={status.includes('indisponivel') || status.includes('sem') ? 'warning' : 'success'}>
          {status}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  )
}

function SignalGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{children}</div>
}

interface SignalTileProps {
  title: string
  value: ReactNode
  caption: string
  tone?: SignalTone
  icon?: ReactNode
}

function SignalTile({ title, value, caption, tone = 'default', icon }: SignalTileProps) {
  return (
    <div
      className={cn(
        'rounded-lg border p-3',
        tone === 'default' && 'border-border bg-muted/45',
        tone === 'success' && 'border-emerald-200 bg-emerald-50',
        tone === 'warning' && 'border-amber-200 bg-amber-50',
        tone === 'danger' && 'border-red-200 bg-red-50',
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {title}
        </p>
        {icon ? <span className="text-muted-foreground">{icon}</span> : null}
      </div>
      <div className="mt-1.5 font-mono text-2xl font-bold text-foreground">{value}</div>
      <p className="mt-0.5 text-xs text-muted-foreground">{caption}</p>
    </div>
  )
}

interface SummaryListProps {
  title: string
  rows?: Array<{
    id: string
    label: string
    primary: string
    secondary: string
  }>
  emptyMessage: string
}

function SummaryList({ title, rows, emptyMessage }: SummaryListProps) {
  const safeRows = rows ?? []

  return (
    <div className="rounded-lg bg-muted/45 p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <RefreshCcw className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      {safeRows.length > 0 ? (
        <div className="space-y-2">
          {safeRows.map((row) => (
            <div key={row.id} className="flex items-center justify-between gap-3 text-sm">
              <div className="min-w-0">
                <p className="truncate font-semibold text-foreground">{row.label}</p>
                <p className="text-xs text-muted-foreground">{row.secondary}</p>
              </div>
              <span className="shrink-0 font-mono text-xs font-semibold text-primary">
                {row.primary}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      )}
    </div>
  )
}

interface PaymentListProps {
  title: string
  cashEntries: Array<[PaymentMethod, number]>
  reportRows: Array<{ label: string; revenue: number; orders: number }>
}

function PaymentList({ title, cashEntries, reportRows }: PaymentListProps) {
  const hasCashEntries = cashEntries.some(([, amount]) => amount > 0)
  const rows = hasCashEntries
    ? cashEntries
        .filter(([, amount]) => amount > 0)
        .map(([method, amount]) => ({
          id: method,
          label: paymentMethodLabels[method],
          value: formatCurrency(amount),
          caption: 'caixa atual',
        }))
    : reportRows.map((row) => ({
        id: row.label,
        label: row.label,
        value: formatCurrency(row.revenue),
        caption: `${row.orders} pedidos no periodo`,
      }))

  return (
    <div className="rounded-lg bg-muted/45 p-3">
      <div className="mb-3 flex items-center gap-2">
        <CreditCard className="h-4 w-4 text-muted-foreground" />
        <p className="text-sm font-semibold text-foreground">{title}</p>
      </div>
      {rows.length > 0 ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {rows.map((row) => (
            <div key={row.id} className="rounded-lg border border-border bg-white p-3">
              <p className="text-xs font-semibold text-muted-foreground">
                {row.label}
              </p>
              <p className="mt-1 font-mono text-lg font-bold text-foreground">{row.value}</p>
              <p className="text-xs text-muted-foreground">{row.caption}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Sem recebimentos no periodo.</p>
      )}
    </div>
  )
}

interface RankingCardProps {
  title: string
  description: string
  rows: ReportTableRow[]
}

function RankingCard({ title, description, rows }: RankingCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length > 0 ? (
          <div className="space-y-3">
            {rows.map((row) => (
              <div key={row.id} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-foreground">{row.label}</p>
                  <p className="text-xs text-muted-foreground">{row.orders} vendas</p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-sm font-bold text-foreground">
                    {formatCurrency(row.revenue)}
                  </p>
                  <p className="text-xs text-muted-foreground">{row.share}%</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyMetric
            icon={<AlertTriangle className="h-4 w-4" />}
            title="Sem dados no periodo"
            description="A lista aparece quando houver vendas reais no recorte."
          />
        )}
      </CardContent>
    </Card>
  )
}

interface EmptyMetricProps {
  icon: ReactNode
  title: string
  description: string
}

function EmptyMetric({ icon, title, description }: EmptyMetricProps) {
  return (
    <div className="grid min-h-[160px] place-items-center rounded-lg border border-dashed border-border bg-muted/35 p-6 text-center">
      <div>
        <div className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-lg bg-white text-muted-foreground shadow-sm">
          {icon}
        </div>
        <p className="font-semibold text-foreground">{title}</p>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}

function UnavailablePanel({ title, description }: { title: string; description: string }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <EmptyMetric icon={<AlertTriangle className="h-4 w-4" />} title={title} description={description} />
      </CardContent>
    </Card>
  )
}

function cashRegisterLabel(status: 'open' | 'closing' | 'closed') {
  const labels = {
    closed: 'Fechado',
    closing: 'Em fechamento',
    open: 'Aberto',
  }

  return labels[status]
}

function formatNullableNumber(value: number | null | undefined) {
  return typeof value === 'number' ? String(value) : 'Indisponivel'
}

function formatMinutes(value: number | null | undefined) {
  return typeof value === 'number' ? `${value} min` : 'Indisponivel'
}

function formatDays(value: number | null | undefined) {
  return typeof value === 'number' ? `${value} dias` : 'Indisponivel'
}

function resolvePeriodCaption(period: DashboardPeriod) {
  if (period === 'today') {
    return 'hoje'
  }

  if (period === '7d') {
    return 'ultimos 7 dias'
  }

  return 'ultimos 30 dias'
}

function readLeadingInteger(value: string) {
  const match = value.match(/^\d+/)

  return match ? Number(match[0]) : null
}
