import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

interface PageShellProps {
  children: ReactNode
  className?: string
}

export function PageShell({ children, className }: PageShellProps) {
  return (
    <div
      className={cn(
        'mx-auto w-full max-w-[1600px] space-y-6 px-4 pb-[calc(104px+env(safe-area-inset-bottom))] pt-6 sm:px-6 lg:px-8 xl:pb-10',
        className,
      )}
    >
      {children}
    </div>
  )
}
