import type { HTMLAttributes } from 'react'

import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const alertVariants = cva(
  'relative rounded-lg border px-4 py-3 text-sm',
  {
    variants: {
      variant: {
        default: 'border-border bg-muted/70 text-foreground',
        success: 'border-emerald-700/20 bg-emerald-50 text-emerald-900',
        warning: 'border-amber-700/20 bg-amber-50 text-amber-950',
        danger: 'border-red-700/20 bg-red-50 text-red-950',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

interface AlertProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {}

export function Alert({ className, variant, ...props }: AlertProps) {
  return (
    <div
      role="status"
      className={cn(alertVariants({ variant, className }))}
      {...props}
    />
  )
}

export function AlertTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn('mb-1 flex items-center gap-2 text-sm font-bold text-current', className)}
      {...props}
    />
  )
}

export function AlertDescription({
  className,
  ...props
}: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-sm leading-6 text-current/82', className)} {...props} />
}
