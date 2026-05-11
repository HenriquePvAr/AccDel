import type { ReactNode } from 'react'

import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface FilterBarProps {
  className?: string
  children: ReactNode
}

export function FilterBar({ className, children }: FilterBarProps) {
  return (
    <Card className={cn('grid gap-3 rounded-[22px] border-white/10 bg-[#07111f]/88 p-4', className)}>
      {children}
    </Card>
  )
}
