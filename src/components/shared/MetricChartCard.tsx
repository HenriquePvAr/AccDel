import type { ReactNode } from 'react'

import { Card } from '@/components/ui/card'

interface MetricChartCardProps {
  title: string
  description: string
  children: ReactNode
}

export function MetricChartCard({ title, description, children }: MetricChartCardProps) {
  return (
    <Card className="min-w-0 p-5">
      <div className="mb-5 min-w-0">
        <h3 className="text-base font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="min-h-0 min-w-0">{children}</div>
    </Card>
  )
}
