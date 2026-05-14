import type { StoreUser, User } from '@prisma/client'

export function mapUser(membership: StoreUser & { user: User }) {
  const active = membership.active && membership.user.status === 'active'

  return {
    id: membership.userId,
    name: membership.user.name,
    email: membership.user.email,
    phone: membership.user.phone ?? '',
    role: membership.role,
    status: active ? 'active' : 'inactive',
    active,
    initials: buildInitials(membership.user.name),
    createdAt: membership.createdAt.toISOString(),
    updatedAt: membership.updatedAt.toISOString(),
    lastLoginAt: membership.user.lastLoginAt?.toISOString(),
  }
}

function buildInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((chunk) => chunk[0]?.toUpperCase() ?? '')
    .join('')
}
