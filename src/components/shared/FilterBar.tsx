import type { ReactNode } from 'react'

import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface FilterBarProps {
  className?: string
  children: ReactNode
}

export function FilterBar({ className, children }: FilterBarProps) {
  return (
    <Card className={cn('grid gap-3 p-4 shadow-none', className)}>
      {children}
    </Card>
  )
}
