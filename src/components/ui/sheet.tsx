import type { ComponentPropsWithoutRef, HTMLAttributes } from 'react'

import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'

import { cn } from '@/lib/utils'

export const Sheet = DialogPrimitive.Root
export const SheetTrigger = DialogPrimitive.Trigger
export const SheetClose = DialogPrimitive.Close

export function SheetContent({
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<typeof DialogPrimitive.Content>) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-graphite/30 backdrop-blur-sm" />
      <DialogPrimitive.Content
        className={cn(
          'fixed right-0 top-0 z-50 flex h-full w-full max-w-[520px] flex-col gap-4 border-l border-white/10 bg-[#07111f] p-6 text-slate-100 shadow-panel',
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close className="absolute right-4 top-4 rounded-full bg-white/[0.06] p-2 text-muted-foreground transition hover:bg-white/[0.1] hover:text-white">
          <X className="h-4 w-4" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}

export const SheetHeader = ({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col gap-1', className)} {...props} />
)

export const SheetTitle = ({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof DialogPrimitive.Title>) => (
  <DialogPrimitive.Title className={cn('text-lg font-semibold', className)} {...props} />
)

export const SheetDescription = ({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof DialogPrimitive.Description>) => (
  <DialogPrimitive.Description
    className={cn('text-sm text-muted-foreground', className)}
    {...props}
  />
)
