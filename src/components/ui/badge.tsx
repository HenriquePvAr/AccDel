import { cva, type VariantProps } from 'class-variance-authority'
import type { HTMLAttributes } from 'react'

import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em]',
  {
    variants: {
      variant: {
        default: 'bg-secondary text-secondary-foreground',
        success: 'bg-status-success/15 text-status-success',
        warning: 'bg-status-warning/15 text-status-warning',
        danger: 'bg-status-danger/15 text-status-danger',
        analysis: 'bg-status-analysis/15 text-status-analysis',
        preparation: 'bg-status-preparation/15 text-status-preparation',
        ready: 'bg-status-ready/15 text-status-ready',
        route: 'bg-status-route/15 text-status-route',
        finished: 'bg-status-finished/15 text-status-finished',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

interface BadgeProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant, className }))} {...props} />
}
