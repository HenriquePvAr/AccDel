import type { InputHTMLAttributes } from 'react'

import { cn } from '@/lib/utils'

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'flex h-10 w-full rounded-xl border border-white/10 bg-[#071525] px-3 py-2 text-sm text-slate-100 shadow-sm outline-none transition placeholder:text-slate-500 focus:border-primary/70 focus:ring-2 focus:ring-primary/20',
        className,
      )}
      {...props}
    />
  )
}
