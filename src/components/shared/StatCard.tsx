import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface StatCardProps {
  label: string
  value: string
  trendLabel: string
  trendDirection: 'up' | 'down' | 'neutral'
}

const iconByTrend = {
  up: ArrowUpRight,
  down: ArrowDownRight,
  neutral: ArrowRight,
}

export function StatCard({ label, value, trendLabel, trendDirection }: StatCardProps) {
  const TrendIcon = iconByTrend[trendDirection]

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex items-end justify-between">
        <div className="space-y-1">
          <div className="font-mono text-3xl font-bold tracking-tight text-foreground">{value}</div>
          <div
            className={cn(
              'inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold',
              trendDirection === 'up' && 'text-status-success',
              trendDirection === 'up' && 'bg-emerald-50',
              trendDirection === 'down' && 'text-status-danger',
              trendDirection === 'down' && 'bg-red-50',
              trendDirection === 'neutral' && 'bg-muted text-muted-foreground',
            )}
          >
            <TrendIcon className="h-3.5 w-3.5" />
            {trendLabel}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
