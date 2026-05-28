import type { HTMLAttributes } from 'react'

import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const alertVariants = cva(
  'relative overflow-hidden rounded-[22px] border px-4 py-3 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] before:pointer-events-none before:absolute before:inset-x-5 before:top-0 before:h-px before:bg-white/14 before:content-[""]',
  {
    variants: {
      variant: {
        default: 'border-white/10 bg-white/[0.04] text-slate-200',
        success: 'border-emerald-300/18 bg-emerald-400/10 text-emerald-100',
        warning: 'border-amber-300/18 bg-amber-400/10 text-amber-100',
        danger: 'border-red-300/18 bg-red-400/10 text-red-100',
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
      className={cn('mb-1 flex items-center gap-2 text-sm font-black tracking-[-0.01em] text-white', className)}
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
