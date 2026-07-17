import type { ReactNode } from 'react'
import {
  Activity,
  Bot,
  Clock3,
  MessageSquare,
  ShoppingCart,
  TrendingUp,
  UserCheck,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useAiAttendantDashboardQuery } from '@/hooks/queries/ai-attendant'

import { formatRelativeDate, integrationLogTypeLabels, whatsappStatusLabels } from './ai-attendant-labels'

export function AiDashboardTab() {
  const { data: dashboard, isLoading } = useAiAttendantDashboardQuery()

  if (isLoading) {
    return <Skeleton className="h-[680px]" />
  }

  if (!dashboard) {
    return (
      <Alert variant="danger">
        <AlertTitle>Resumo indisponível</AlertTitle>
        <AlertDescription>Os indicadores do atendimento nao ficaram disponiveis.</AlertDescription>
      </Alert>
    )
  }

  const productChartData = dashboard.topProducts.map((item) => ({
    name: item.productName,
    quantidade: item.quantity,
    aprovados: item.approved,
  }))
  const optionChartData = dashboard.topOptions.map((item) => ({
    name: item.optionName,
    quantidade: item.quantity,
    aprovados: item.approved,
  }))
  const categoryChartData = dashboard.topCategories.map((item) => ({
    name: item.categoryName,
    quantidade: item.quantity,
    aprovados: item.approved,
  }))
  const districtChartData = dashboard.topDistricts.map((item) => ({
    name: item.district,
    atendimentos: item.count,
  }))

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={<MessageSquare className="h-5 w-5" />}
          label="Atendimentos hoje"
          value={dashboard.kpis.attendancesToday}
          description={`${dashboard.kpis.attendancesWeek} na semana`}
        />
        <MetricCard
          icon={<Bot className="h-5 w-5" />}
          label="Respostas automáticas"
          value={dashboard.kpis.messagesSentToday}
          description={`${dashboard.kpis.messagesReceivedToday} recebidas hoje`}
        />
        <MetricCard
          icon={<ShoppingCart className="h-5 w-5" />}
          label="Pedidos sugeridos"
          value={dashboard.kpis.orderDraftsSuggested}
          description={`${dashboard.kpis.orderDraftsApproved} aprovados`}
        />
        <MetricCard
          icon={<UserCheck className="h-5 w-5" />}
          label="Transferencias"
          value={dashboard.kpis.transfersToHuman}
          description={`${formatPercent(dashboard.kpis.resolutionRate)} resolucao`}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Produtos mais pedidos
            </CardTitle>
            <CardDescription>
              Agregado a partir de orderDrafts reais da ultima semana.
            </CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            {productChartData.length ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <BarChart data={productChartData}>
                  <CartesianGrid stroke="rgba(148,163,184,0.14)" vertical={false} />
                  <XAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                  <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip
                    cursor={{ fill: 'rgba(249,115,22,0.08)' }}
                    contentStyle={{
                      background: '#071525',
                      border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: 12,
                      color: '#e2e8f0',
                    }}
                  />
                  <Bar dataKey="quantidade" fill="#f97316" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="aprovados" fill="#22c55e" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyDashboardCopy text="Ainda não há pedidos suficientes para mostrar os produtos mais pedidos." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock3 className="h-5 w-5 text-primary" />
              Tempo de resposta
            </CardTitle>
            <CardDescription>Calculado a partir de mensagens e assuncoes reais.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <OperationalLine
              label="Resposta automática"
              value={formatDuration(dashboard.kpis.averageResponseMs)}
            />
            <OperationalLine
              label="Ate humano assumir"
              value={formatDuration(dashboard.kpis.averageHumanTakeoverMs)}
            />
            <OperationalLine
              label="Pedidos convertidos"
              value={String(dashboard.kpis.orderDraftsConverted)}
            />
            <p className="rounded-xl border border-amber-300/20 bg-amber-300/10 p-3 text-xs leading-5 text-amber-100">
              Conversao final ainda depende do vinculo entre orderDraft e pedido criado no Novo Pedido.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <RankedBarCard
          title="Sabores e opcoes mais pedidos"
          description="Opções presentes nos pedidos sugeridos."
          data={optionChartData}
          emptyText="Ainda nao ha sabores ou opcoes suficientes nos orderDrafts."
          primaryColor="#06b6d4"
          secondaryColor="#22c55e"
        />
        <RankedBarCard
          title="Categorias mais pedidas"
          description="Resolvido contra produtos/categorias reais do catalogo."
          data={categoryChartData}
          emptyText="Ainda nao ha categorias resolvidas nos orderDrafts."
          primaryColor="#f97316"
          secondaryColor="#22c55e"
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Bairros mais atendidos</CardTitle>
            <CardDescription>Baseado nos enderecos reais dos clientes vinculados.</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            {districtChartData.length ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <BarChart data={districtChartData} layout="vertical">
                  <CartesianGrid stroke="rgba(148,163,184,0.14)" horizontal={false} />
                  <XAxis type="number" stroke="#94a3b8" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    stroke="#94a3b8"
                    tick={{ fontSize: 11 }}
                    width={110}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(34,197,94,0.08)' }}
                    contentStyle={{
                      background: '#071525',
                      border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: 12,
                      color: '#e2e8f0',
                    }}
                  />
                  <Bar dataKey="atendimentos" fill="#22c55e" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyDashboardCopy text="Nenhum bairro com cliente/endereco vinculado ainda." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Servico e ultimos eventos
            </CardTitle>
            <CardDescription>Status seguro, sem tokens ou segredos.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {dashboard.provider.whatsapp ? (
              <div className="rounded-[18px] border border-white/10 bg-white/[0.04] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {dashboard.provider.whatsapp.provider === 'whatsapp_cloud'
                        ? 'WhatsApp oficial'
                        : dashboard.provider.whatsapp.provider === 'unconfigured'
                          ? 'Nao configurado'
                          : 'Servico conectado'}
                    </p>
                    <p className="text-xs text-slate-500">
                      {dashboard.provider.whatsapp.displayName ??
                        dashboard.provider.whatsapp.phoneNumber ??
                        'Numero nao conectado'}
                    </p>
                  </div>
                  <Badge>{whatsappStatusLabels[dashboard.provider.whatsapp.status]}</Badge>
                </div>
                {dashboard.provider.whatsapp.lastError ? (
                  <p className="mt-3 text-xs leading-5 text-red-200">
                    {dashboard.provider.whatsapp.lastError}
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="rounded-[18px] border border-white/10 bg-white/[0.04] p-4 text-sm leading-6 text-slate-400">
                Nenhuma sessao WhatsApp criada no banco.
              </p>
            )}

            <div className="space-y-2">
              {dashboard.provider.lastLogs.length ? (
                dashboard.provider.lastLogs.slice(0, 6).map((log) => (
                  <div key={log.id} className="rounded-xl bg-white/[0.04] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant={log.status === 'error' ? 'danger' : 'default'}>{integrationLogTypeLabels[log.type]}</Badge>
                      <span className="text-[11px] text-slate-500">
                        {formatRelativeDate(log.createdAt)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-300">{log.message}</p>
                  </div>
                ))
              ) : (
                <EmptyDashboardCopy text="Nenhuma atualização registrada hoje." />
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function RankedBarCard({
  title,
  description,
  data,
  emptyText,
  primaryColor,
  secondaryColor,
}: {
  title: string
  description: string
  data: {
    name: string
    quantidade: number
    aprovados: number
  }[]
  emptyText: string
  primaryColor: string
  secondaryColor: string
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="h-72">
        {data.length ? (
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <BarChart data={data} layout="vertical">
              <CartesianGrid stroke="rgba(148,163,184,0.14)" horizontal={false} />
              <XAxis type="number" stroke="#94a3b8" tick={{ fontSize: 11 }} allowDecimals={false} />
              <YAxis
                type="category"
                dataKey="name"
                stroke="#94a3b8"
                tick={{ fontSize: 11 }}
                width={120}
              />
              <Tooltip
                cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                contentStyle={{
                  background: '#071525',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 12,
                  color: '#e2e8f0',
                }}
              />
              <Bar dataKey="quantidade" fill={primaryColor} radius={[0, 6, 6, 0]} />
              <Bar dataKey="aprovados" fill={secondaryColor} radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyDashboardCopy text={emptyText} />
        )}
      </CardContent>
    </Card>
  )
}

function MetricCard({
  icon,
  label,
  value,
  description,
}: {
  icon: ReactNode
  label: string
  value: number
  description: string
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
              {label}
            </p>
            <p className="mt-3 text-3xl font-black text-white">{value}</p>
            <p className="mt-2 text-xs leading-5 text-slate-400">{description}</p>
          </div>
          <div className="grid h-10 w-10 place-items-center rounded-xl border border-primary/30 bg-primary/10 text-primary">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function OperationalLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.04] p-3">
      <span className="text-sm text-slate-400">{label}</span>
      <span className="font-semibold text-white">{value}</span>
    </div>
  )
}

function EmptyDashboardCopy({ text }: { text: string }) {
  return (
    <div className="grid h-full place-items-center rounded-[18px] border border-white/10 bg-white/[0.03] p-6 text-center text-sm leading-6 text-slate-400">
      {text}
    </div>
  )
}

function formatDuration(value: number | null) {
  if (value === null) {
    return 'Sem dados'
  }

  if (value < 1000) {
    return `${value}ms`
  }

  const seconds = Math.round(value / 1000)
  if (seconds < 60) {
    return `${seconds}s`
  }

  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}min ${remainingSeconds}s`
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`
}
