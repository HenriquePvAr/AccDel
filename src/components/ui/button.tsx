import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import type { ButtonHTMLAttributes } from 'react'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
  "relative isolate inline-flex items-center justify-center gap-2 overflow-hidden whitespace-nowrap rounded-xl border text-sm font-semibold tracking-[-0.01em] transition-[transform,box-shadow,background-color,border-color,color] duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#040b15] disabled:pointer-events-none disabled:opacity-60 active:translate-y-0",
  {
    variants: {
      variant: {
        default:
          "border-[rgba(255,178,132,0.18)] bg-[linear-gradient(180deg,rgba(234,109,44,0.98),rgba(189,73,19,0.98))] text-primary-foreground shadow-[0_18px_34px_rgba(198,93,46,0.26),inset_0_1px_0_rgba(255,255,255,0.18)] before:absolute before:inset-x-5 before:top-0 before:h-px before:bg-white/45 before:content-[''] after:absolute after:inset-0 after:-z-10 after:rounded-[inherit] after:bg-[radial-gradient(circle_at_center,rgba(246,133,76,0.32),transparent_68%)] after:opacity-0 after:transition-opacity after:duration-300 hover:-translate-y-0.5 hover:shadow-[0_24px_44px_rgba(198,93,46,0.34),inset_0_1px_0_rgba(255,255,255,0.24)] hover:after:opacity-100",
        secondary:
          "border-white/10 bg-[linear-gradient(180deg,rgba(15,29,46,0.96),rgba(9,20,34,0.96))] text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] hover:-translate-y-0.5 hover:border-white/16 hover:bg-[#0d2238] hover:text-white",
        ghost:
          'border-transparent bg-transparent text-slate-200 hover:-translate-y-0.5 hover:border-white/10 hover:bg-white/[0.06] hover:text-white',
        outline:
          'border-white/12 bg-[#071525]/82 text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] hover:-translate-y-0.5 hover:border-white/20 hover:bg-[#0d2238] hover:text-white',
        danger:
          "border-red-300/18 bg-[linear-gradient(180deg,rgba(185,64,64,0.98),rgba(143,34,34,0.98))] text-destructive-foreground shadow-[0_18px_34px_rgba(127,29,29,0.26),inset_0_1px_0_rgba(255,255,255,0.14)] before:absolute before:inset-x-5 before:top-0 before:h-px before:bg-white/35 before:content-[''] hover:-translate-y-0.5 hover:shadow-[0_24px_44px_rgba(127,29,29,0.34),inset_0_1px_0_rgba(255,255,255,0.18)]",
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-lg px-3.5 text-xs',
        lg: 'h-11 rounded-2xl px-5 text-sm',
        icon: 'h-10 w-10 rounded-2xl px-0',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

export function Button({ className, variant, size, asChild, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : 'button'

  return <Comp className={cn(buttonVariants({ variant, size, className }))} {...props} />
}

export { buttonVariants }
