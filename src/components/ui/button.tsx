import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import type { ButtonHTMLAttributes } from 'react'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg border text-sm font-semibold transition-[background-color,border-color,color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:pointer-events-none disabled:opacity-55',
  {
    variants: {
      variant: {
        default:
          'border-primary bg-primary text-primary-foreground shadow-sm hover:border-[#e94a22] hover:bg-[#e94a22]',
        secondary:
          'border-border bg-secondary text-secondary-foreground shadow-sm hover:border-border/80 hover:bg-muted',
        ghost:
          'border-transparent bg-transparent text-foreground hover:bg-muted hover:text-foreground',
        outline:
          'border-border bg-white text-foreground shadow-sm hover:border-border/80 hover:bg-muted/70',
        danger:
          'border-destructive bg-destructive text-destructive-foreground shadow-sm hover:bg-[#9f302f]',
      },
      size: {
        default: 'h-[42px] px-4 py-2',
        sm: 'h-9 px-3 text-xs',
        lg: 'h-11 px-5 text-sm',
        icon: 'h-[42px] w-[42px] px-0',
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
