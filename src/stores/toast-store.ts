import { create } from 'zustand'

export interface ToastItem {
  id: string
  title: string
  description?: string
  variant?: 'default' | 'success' | 'warning' | 'danger'
}

interface ToastState {
  toasts: ToastItem[]
  pushToast: (toast: Omit<ToastItem, 'id'>) => void
  removeToast: (id: string) => void
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  pushToast: (toast) => {
    const id = crypto.randomUUID()
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id }],
    }))

    window.setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((entry) => entry.id !== id),
      }))
    }, 3200)
  },
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((entry) => entry.id !== id),
    })),
}))
