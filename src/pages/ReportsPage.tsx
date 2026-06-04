import { useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { EmptyState } from '@/components/shared/EmptyState'
import { FilterBar } from '@/components/shared/FilterBar'
import { MetricChartCard } from '@/components/shared/MetricChartCard'
import { PageShell } from '@/components/shared/PageShell'
import { SectionHeader } from '@/components/shared/SectionHeader'
import { StatCard } from '@/components/shared/StatCard'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useReportsQuery } from '@/hooks/queries'
import { usePageTitle } from '@/hooks/use-page-title'
import { channelLabelMap } from '@/lib/domain'
import { formatCompactCurrency } from '@/lib/format'
import type { OrderChannel, OrderStatus } from '@/types'
import { AlertTriangle, BarChart3, RefreshCcw } from 'lucide-react'

type PeriodFilter = 'today' | '7d' | '30d'

export function ReportsPage() {
  usePageTitle('Relatorios')
  const [period, setPeriod] = useState<PeriodFilter>('today')
  const [channel, setChannel] = useState<OrderChannel | 'all'>('all')
  const [status, setStatus] = useState<OrderStatus | 'all'>('all')
  const reportsQuery = useReportsQuery({
    period,
    channel,
    status,
  })
  const snapshot = reportsQuery.data?.data

  return (
    <PageShell>
      <SectionHeader
        title="Relatorios"
        description="Central operacional com leitura real de pedidos, motoboys, garcons, canais e mix de vendas."
      />

      <FilterBar className="grid gap-3 lg:grid-cols-[1.2fr_1.3fr_1.5fr_auto]">
        <div className="flex flex-wrap gap-2 rounded-2xl bg-white/[0.04] p-2 ring-1 ring-white/10">
          {([
            { key: 'today', label: 'Hoje' },
            { key: '7d', label: '7 dias' },
            { key: '30d', label: '30 dias' },
          ] as const).map((entry) => (
            <Button
              key={entry.key}
              variant={period === entry.key ? 'default' : 'secondary'}
              onClick={() => setPeriod(entry.key)}
            >
              {entry.label}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 rounded-2xl bg-white/[0.04] p-2 ring-1 ring-white/10">
          {(['all', 'delivery', 'dine_in', 'counter', 'pickup', 'digital_menu', 'whatsapp'] as const).map(
            (entry) => (
              <Button
                key={entry}
                variant={channel === entry ? 'default' : 'secondary'}
                onClick={() => setChannel(entry)}
              >
                {entry === 'all' ? 'Todos os canais' : channelLabelMap[entry]}
              </Button>
            ),
          )}
        </div>
        <div className="flex flex-wrap gap-2 rounded-2xl bg-white/[0.04] p-2 ring-1 ring-white/10">
          {(
            [
              'all',
              'in_analysis',
              'in_preparation',
              'ready',
              'out_for_delivery',
              'completed',
              'cancelled',
            ] as const
          ).map((entry) => (
            <Button
              key={entry}
              variant={status === entry ? 'default' : 'secondary'}
              onClick={() => setStatus(entry)}
            >
              {entry === 'all' ? 'Todos os status' : statusLabelMap[entry]}
            </Button>
          ))}
        </div>
        <Button variant="outline" onClick={() => reportsQuery.refetch()} disabled={reportsQuery.isFetching}>
          {reportsQuery.isFetching ? 'Atualizando...' : 'Atualizar'}
        </Button>
      </FilterBar>

      {reportsQuery.isLoading ? (
        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-[124px] rounded-[24px]" />
            ))}
          </div>
          <div className="grid gap-5 xl:grid-cols-2">
            <Skeleton className="h-[360px] rounded-[24px]" />
            <Skeleton className="h-[360px] rounded-[24px]" />
          </div>
        </div>
      ) : reportsQuery.isError ? (
        <Card className="border-dashed border-white/10 bg-white/[0.03]">
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/15 text-primary">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-semibold">Falha ao carregar relatorios</h3>
              <p className="max-w-md text-sm text-muted-foreground">
                A API nao retornou a consolidacao operacional. Revise o backend ou tente novamente.
              </p>
            </div>
            <Button onClick={() => reportsQuery.refetch()}>
              <RefreshCcw className="h-4 w-4" />
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      ) : snapshot ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {snapshot.metrics.map((metric) => (
              <StatCard key={metric.id} {...metric} />
            ))}
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <MetricChartCard
              title="Vendas por canal"
              description="Receita consolidada por origem do pedido no periodo filtrado."
            >
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={snapshot.byChannel}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e6e1d7" />
                    <XAxis dataKey="label" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="revenue" fill="#1F252B" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </MetricChartCard>

            <MetricChartCard
              title="Formas de pagamento"
              description="Composicao financeira do periodo filtrado."
            >
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={snapshot.byPayment}
                      dataKey="revenue"
                      nameKey="label"
                      innerRadius={64}
                      outerRadius={96}
                      fill="#C65D2E"
                    />
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </MetricChartCard>
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <SummaryTable
              title="Itens mais vendidos"
              rows={snapshot.topProducts}
              emptyLabel="Sem produtos vendidos no periodo."
            />
            <SummaryTable
              title="Categorias mais vendidas"
              rows={snapshot.topCategories}
              emptyLabel="Sem categorias movimentadas no periodo."
            />
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <SummaryTable
              title="Sabores e opcoes mais vendidos"
              rows={snapshot.topOptions}
              emptyLabel="Sem opcoes registradas nos pedidos do periodo."
            />
            <SummaryTable
              title="Bairros mais atendidos"
              rows={snapshot.topNeighborhoods}
              emptyLabel="Sem bairros identificados nos pedidos do periodo."
            />
          </div>

          <div className="grid gap-5 xl:grid-cols-3">
            <CompactTable
              title="Pedidos por status"
              rows={snapshot.ordersByStatus.map((row) => ({
                id: row.id,
                label: row.label,
                primary: `${row.orders} pedidos`,
              }))}
              emptyLabel="Sem status consolidados."
            />
            <CompactTable
              title="Motoboys"
              rows={snapshot.driverSummaries.map((row) => ({
                id: row.id,
                label: row.name,
                primary: row.primary,
                value: formatCompactCurrency(row.value),
              }))}
              emptyLabel="Sem motoboys cadastrados."
            />
            <CompactTable
              title="Garcons"
              rows={snapshot.waiterSummaries.map((row) => ({
                id: row.id,
                label: row.name,
                primary: row.primary,
                value: formatCompactCurrency(row.value),
              }))}
              emptyLabel="Sem garcons cadastrados."
            />
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <CompactTable
              title="IA comercial"
              rows={[
                {
                  id: 'drafts_suggested',
                  label: 'OrderDrafts sugeridos',
                  primary: 'Rascunhos criados pela IA no periodo',
                  value: String(snapshot.aiSummary.orderDraftsSuggested),
                },
                {
                  id: 'drafts_converted',
                  label: 'OrderDrafts convertidos',
                  primary: 'Rascunhos que viraram pedido real',
                  value: String(snapshot.aiSummary.orderDraftsConverted),
                },
                {
                  id: 'ai_conversion',
                  label: 'Conversao da IA',
                  primary: 'Baseada em rascunhos convertidos',
                  value: `${snapshot.aiSummary.conversionRate}%`,
                },
                {
                  id: 'human_transfers',
                  label: 'Transferencias para humano',
                  primary: 'Acionamentos registrados no Atendente IA',
                  value: String(snapshot.aiSummary.transfersToHuman),
                },
              ]}
              emptyLabel="Sem dados da IA no periodo."
            />
            <CompactTable
              title="Tempos reais"
              rows={[
                {
                  id: 'prep_time',
                  label: 'Tempo medio de preparo',
                  primary: snapshot.timeSummary.averagePreparationMinutes === null
                    ? 'Historico insuficiente'
                    : 'Calculado pelo historico do pedido',
                  value: snapshot.timeSummary.averagePreparationMinutes === null
                    ? 'Indisponivel'
                    : `${snapshot.timeSummary.averagePreparationMinutes} min`,
                },
                {
                  id: 'delivery_time',
                  label: 'Tempo medio de entrega',
                  primary: snapshot.timeSummary.averageDeliveryMinutes === null
                    ? 'Historico insuficiente'
                    : 'Da saida para entrega ate conclusao',
                  value: snapshot.timeSummary.averageDeliveryMinutes === null
                    ? 'Indisponivel'
                    : `${snapshot.timeSummary.averageDeliveryMinutes} min`,
                },
              ]}
              emptyLabel="Sem tempos calculaveis."
            />
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <CompactTable
              title="Cancelamentos"
              rows={snapshot.cancellations.map((row) => ({
                id: row.id,
                label: `${row.orderNumber} · ${row.customerName}`,
                primary: row.note,
                value: formatCompactCurrency(row.value),
              }))}
              emptyLabel="Sem cancelamentos no periodo."
            />
            <Card>
              <CardContent className="space-y-4 p-5">
                <h3 className="text-base font-semibold">Mesas</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <MetricTile label="Livres" value={String(snapshot.tablesSummary.free)} />
                  <MetricTile
                    label="Ocupadas"
                    value={String(snapshot.tablesSummary.occupied)}
                  />
                  <MetricTile
                    label="Reservadas"
                    value={String(snapshot.tablesSummary.reserved)}
                  />
                  <MetricTile
                    label="Fechando"
                    value={String(snapshot.tablesSummary.closing)}
                  />
                  <MetricTile
                    label="Sessoes abertas"
                    value={String(snapshot.tablesSummary.openSessions)}
                  />
                  <MetricTile
                    label="Sessoes fechadas"
                    value={String(snapshot.tablesSummary.closedSessions)}
                  />
                  <MetricTile
                    label="Vendas salao"
                    value={formatCompactCurrency(snapshot.tablesSummary.diningRevenue)}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  O bloco de mesas agora reflete o salao real e serve como base para a evolucao de
                  ocupacao, giro e fechamento.
                </p>
              </CardContent>
            </Card>
          </div>
        </>
      ) : (
        <EmptyState
          icon={<BarChart3 className="h-5 w-5" />}
          title="Relatorios sem dados"
          description="Quando os pedidos comecarem a variar, os indicadores e tabelas aparecem aqui."
        />
      )}
    </PageShell>
  )
}

const statusLabelMap: Record<OrderStatus, string> = {
  in_analysis: 'Em analise',
  in_preparation: 'Em preparo',
  ready: 'Pronto',
  out_for_delivery: 'Em rota',
  completed: 'Finalizado',
  cancelled: 'Cancelado',
}

function SummaryTable({
  title,
  rows,
  emptyLabel,
}: {
  title: string
  rows: Array<{ id: string; label: string; revenue: number; orders: number; share: number }>
  emptyLabel: string
}) {
  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <h3 className="text-base font-semibold">{title}</h3>
        {rows.length ? (
          rows.map((row) => (
            <div
              key={row.id}
              className="flex items-center justify-between rounded-2xl bg-white/[0.04] px-4 py-3 ring-1 ring-white/10"
            >
              <div>
                <p className="font-medium">{row.label}</p>
                <p className="text-sm text-muted-foreground">{row.orders} unidades</p>
              </div>
              <div className="text-right">
                <p className="font-mono font-semibold">{formatCompactCurrency(row.revenue)}</p>
                <p className="text-xs text-muted-foreground">{row.share}% share</p>
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">{emptyLabel}</p>
        )}
      </CardContent>
    </Card>
  )
}

function CompactTable({
  title,
  rows,
  emptyLabel,
}: {
  title: string
  rows: Array<{ id: string; label: string; primary: string; value?: string }>
  emptyLabel: string
}) {
  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <h3 className="text-base font-semibold">{title}</h3>
        {rows.length ? (
          rows.map((row) => (
            <div
              key={row.id}
              className="flex items-center justify-between rounded-2xl bg-white/[0.04] px-4 py-3 ring-1 ring-white/10"
            >
              <div>
                <p className="font-medium">{row.label}</p>
                <p className="text-sm text-muted-foreground">{row.primary}</p>
              </div>
              {row.value ? <div className="font-mono text-sm font-semibold">{row.value}</div> : null}
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">{emptyLabel}</p>
        )}
      </CardContent>
    </Card>
  )
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/[0.04] p-3 ring-1 ring-white/10">
      <p className="text-muted-foreground">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  )
}
