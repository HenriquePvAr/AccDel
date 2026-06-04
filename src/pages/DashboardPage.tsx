import { useState, type ReactNode } from 'react'
import {
  AlertTriangle,
  Bike,
  Bot,
  ChefHat,
  Clock3,
  CreditCard,
  Crown,
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
  useReportsQuery,
} from '@/hooks/queries'
import { useAiAttendantDashboardQuery } from '@/hooks/queries/ai-attendant'
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

  const snapshot = reportsQuery.data?.data
  const kitchenQueue = kitchenQuery.data?.data
  const cashRegister = cashQuery.data?.data
  const crmSummary = crmSummaryQuery.data?.data
  const aiDashboard = aiDashboardQuery.data
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

  const isLoadingExecutive = reportsQuery.isLoading && !snapshot

  return (
    <PageShell>
      <SectionHeader
        eyebrow="Operacao"
        title="Dashboard operacional"
        description="Pulso unico de cozinha, entregas, caixa, clientes e IA usando dados reais da loja atual."
        actions={
          <div className="inline-flex rounded-2xl border border-white/10 bg-white/[0.04] p-1">
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

      {isLoadingExecutive ? (
        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-[124px] rounded-[24px]" />
            ))}
          </div>
          <Skeleton className="h-[420px] rounded-[24px]" />
        </div>
      ) : (
        <>
          {snapshot ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {snapshot.metrics.map((metric) => (
                <StatCard key={metric.id} {...metric} />
              ))}
            </div>
          ) : (
            <UnavailablePanel
              title="Relatorios indisponiveis"
              description="Nao foi possivel carregar o consolidado do periodo. Nenhum numero foi estimado."
            />
          )}

          <div className="grid gap-4 xl:grid-cols-2">
            <OperationalSection
              icon={<ChefHat className="h-4 w-4" />}
              title="KDS"
              description="Fila de preparo sem dados financeiros."
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
                  caption="marcados pelo KDS"
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
              title="CRM"
              description="Segmentos vindos do cadastro e historico real."
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
              title="Atendente IA"
              description="Conversas, conversoes e transferencias sem estimativa artificial."
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
                  caption="orderDrafts criados"
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
                <div className="h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={snapshot.revenueSeries}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                      <XAxis dataKey="label" stroke="#94a3b8" tickLine={false} />
                      <YAxis stroke="#94a3b8" tickLine={false} />
                      <Tooltip
                        contentStyle={{
                          background: '#071525',
                          border: '1px solid rgba(255,255,255,0.12)',
                          borderRadius: 14,
                          color: '#f8fafc',
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
          <div className="grid h-10 w-10 place-items-center rounded-2xl border border-orange-300/15 bg-orange-400/10 text-orange-200">
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
  return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{children}</div>
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
        'rounded-2xl border bg-white/[0.035] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]',
        tone === 'default' && 'border-white/10',
        tone === 'success' && 'border-emerald-300/20 bg-emerald-400/10',
        tone === 'warning' && 'border-amber-300/20 bg-amber-400/10',
        tone === 'danger' && 'border-red-300/20 bg-red-400/10',
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
          {title}
        </p>
        {icon ? <span className="text-slate-400">{icon}</span> : null}
      </div>
      <div className="mt-2 font-mono text-2xl font-black text-white">{value}</div>
      <p className="mt-1 text-xs text-slate-400">{caption}</p>
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
    <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-white">{title}</p>
        <RefreshCcw className="h-3.5 w-3.5 text-slate-500" />
      </div>
      {safeRows.length > 0 ? (
        <div className="space-y-2">
          {safeRows.map((row) => (
            <div key={row.id} className="flex items-center justify-between gap-3 text-sm">
              <div className="min-w-0">
                <p className="truncate font-semibold text-slate-100">{row.label}</p>
                <p className="text-xs text-slate-500">{row.secondary}</p>
              </div>
              <span className="shrink-0 font-mono text-xs font-bold text-orange-200">
                {row.primary}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-500">{emptyMessage}</p>
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
    <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
      <div className="mb-3 flex items-center gap-2">
        <CreditCard className="h-4 w-4 text-slate-400" />
        <p className="text-sm font-semibold text-white">{title}</p>
      </div>
      {rows.length > 0 ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {rows.map((row) => (
            <div key={row.id} className="rounded-xl border border-white/8 bg-black/10 p-3">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                {row.label}
              </p>
              <p className="mt-1 font-mono text-lg font-black text-white">{row.value}</p>
              <p className="text-xs text-slate-500">{row.caption}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-500">Sem recebimentos no periodo.</p>
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
                  <p className="truncate font-semibold text-slate-100">{row.label}</p>
                  <p className="text-xs text-slate-500">{row.orders} vendas</p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-sm font-black text-white">
                    {formatCurrency(row.revenue)}
                  </p>
                  <p className="text-xs text-slate-500">{row.share}%</p>
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
    <div className="grid min-h-[180px] place-items-center rounded-2xl border border-dashed border-white/12 bg-white/[0.025] p-6 text-center">
      <div>
        <div className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-2xl border border-white/10 text-slate-400">
          {icon}
        </div>
        <p className="font-semibold text-slate-100">{title}</p>
        <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>
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
