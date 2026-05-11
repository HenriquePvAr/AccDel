import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

interface SectionHeaderProps {
  eyebrow?: string
  title: string
  description: string
  actions?: ReactNode
  className?: string
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: SectionHeaderProps) {
  return (
    <div className={cn('flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between', className)}>
      <div className="space-y-2">
        {eyebrow ? (
          <p className="inline-flex rounded-full border border-orange-400/15 bg-orange-400/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] text-orange-200">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="max-w-4xl text-[30px] font-black tracking-[-0.04em] text-white sm:text-[34px]">
          {title}
        </h1>
        <p className="max-w-3xl text-sm leading-6 text-slate-400 sm:text-[15px]">{description}</p>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2.5">{actions}</div> : null}
    </div>
  )
}
