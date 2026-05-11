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
import { Skeleton } from '@/components/ui/skeleton'
import { useReportsQuery } from '@/hooks/queries'
import { usePageTitle } from '@/hooks/use-page-title'

export function DashboardPage() {
  usePageTitle('Dashboard')
  const reportsQuery = useReportsQuery({ period: 'today' })
  const snapshot = reportsQuery.data?.data

  return (
    <PageShell>
      <SectionHeader
        title="Dashboard"
        description="Visão executiva enxuta, com foco em indicadores que ajudam a calibrar operação, delivery e salão."
      />

      {reportsQuery.isLoading || !snapshot ? (
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
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {snapshot.metrics.map((metric) => (
              <StatCard key={metric.id} {...metric} />
            ))}
          </div>

          <MetricChartCard
            title="Receita por hora"
            description="Leitura rápida do pulso operacional do turno atual."
          >
            <div className="h-[360px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={snapshot.revenueSeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e6e1d7" />
                  <XAxis dataKey="label" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="revenue" stroke="#C65D2E" strokeWidth={3} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </MetricChartCard>
        </>
      )}
    </PageShell>
  )
}
