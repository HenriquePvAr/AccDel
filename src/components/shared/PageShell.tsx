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
        'mx-auto w-full max-w-[1720px] space-y-6 px-4 pb-10 pt-5 sm:px-6 lg:px-8 xl:px-10',
        className,
      )}
    >
      {children}
    </div>
  )
}
