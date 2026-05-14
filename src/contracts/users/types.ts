import type { ListResponse } from '@/contracts/common'
import type { UserRole, UserStatus } from '@/types'

export interface AdminUserListItem {
  id: string
  name: string
  email: string
  phone: string
  role: UserRole
  status: UserStatus
  active: boolean
  initials: string
  createdAt: string
  updatedAt: string
  lastLoginAt?: string
}

export type ListUsersResponse = ListResponse<AdminUserListItem>
