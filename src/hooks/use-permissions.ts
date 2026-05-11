import type { AdminPermission } from '@/types'
import { useAuthStore } from '@/stores/auth-store'

export function useCan(permission: AdminPermission) {
  return useAuthStore((state) => state.user?.permissions.includes(permission) ?? false)
}

export function useCanAny(permissions: AdminPermission[]) {
  return useAuthStore((state) =>
    permissions.some((permission) => state.user?.permissions.includes(permission)),
  )
}

export function hasPermission(
  permissions: AdminPermission[] | undefined,
  permission: AdminPermission,
) {
  return permissions?.includes(permission) ?? false
}
