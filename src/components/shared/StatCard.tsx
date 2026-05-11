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
    <Card className="text-slate-100">
      <CardHeader className="pb-2">
        <CardTitle className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex items-end justify-between">
        <div className="space-y-1">
          <div className="font-mono text-3xl font-black tracking-tight text-white">{value}</div>
          <div
            className={cn(
              'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em]',
              trendDirection === 'up' && 'text-status-success',
              trendDirection === 'up' && 'border-emerald-300/20 bg-emerald-400/10',
              trendDirection === 'down' && 'text-status-danger',
              trendDirection === 'down' && 'border-red-300/20 bg-red-400/10',
              trendDirection === 'neutral' && 'border-white/10 bg-white/[0.04] text-slate-400',
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
