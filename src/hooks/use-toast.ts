import { useToastStore } from '@/stores/toast-store'

export function useToast() {
  const pushToast = useToastStore((state) => state.pushToast)

  return {
    success: (title: string, description?: string) =>
      pushToast({ title, description, variant: 'success' }),
    warning: (title: string, description?: string) =>
      pushToast({ title, description, variant: 'warning' }),
    danger: (title: string, description?: string) =>
      pushToast({ title, description, variant: 'danger' }),
    default: (title: string, description?: string) =>
      pushToast({ title, description, variant: 'default' }),
  }
}
