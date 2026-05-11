import type { ReactNode } from 'react'

import { Card } from '@/components/ui/card'

interface MetricChartCardProps {
  title: string
  description: string
  children: ReactNode
}

export function MetricChartCard({ title, description, children }: MetricChartCardProps) {
  return (
    <Card className="p-5">
      <div className="mb-5">
        <h3 className="text-base font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </Card>
  )
}
