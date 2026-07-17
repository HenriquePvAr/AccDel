import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, CircleAlert, Info, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useToastStore } from '@/stores/toast-store'

const iconMap = {
  default: Info,
  success: CheckCircle2,
  warning: CircleAlert,
  danger: CircleAlert,
}

export function ToastViewport() {
  const toasts = useToastStore((state) => state.toasts)
  const removeToast = useToastStore((state) => state.removeToast)

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[80] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-3 sm:right-5 sm:top-5">
      <AnimatePresence>
        {toasts.map((toast) => {
          const Icon = iconMap[toast.variant ?? 'default']

          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: -16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.98 }}
              className={cn(
                'pointer-events-auto rounded-xl border border-border bg-white p-4 text-foreground shadow-panel',
                toast.variant === 'success' && 'border-status-success/20',
                toast.variant === 'warning' && 'border-status-warning/20',
                toast.variant === 'danger' && 'border-status-danger/20',
              )}
            >
              <div className="flex gap-3">
                <div
                  className={cn(
                    'mt-0.5 rounded-lg p-2',
                    toast.variant === 'success' && 'bg-status-success/10 text-status-success',
                    toast.variant === 'warning' && 'bg-status-warning/10 text-status-warning',
                    toast.variant === 'danger' && 'bg-status-danger/10 text-status-danger',
                    (!toast.variant || toast.variant === 'default') && 'bg-primary/10 text-primary',
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{toast.title}</p>
                  {toast.description ? (
                    <p className="mt-1 text-sm text-muted-foreground">{toast.description}</p>
                  ) : null}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-lg"
                  aria-label="Fechar notificacao"
                  onClick={() => removeToast(toast.id)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
