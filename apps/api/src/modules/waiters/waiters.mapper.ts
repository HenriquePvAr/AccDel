import type {
  StoreUser,
  User,
  WaiterHistoryEntry,
  WaiterProfile,
} from '@prisma/client'

export function mapWaiter(params: {
  membership: StoreUser & {
    user: User
    waiterProfile:
      | (WaiterProfile & {
          history: WaiterHistoryEntry[]
        })
      | null
  }
}) {
  const { membership } = params
  const profile = membership.waiterProfile
  const totalOrders = profile?.totalOrders ?? 0
  const totalSales = profile?.totalSales.toNumber() ?? 0

  return {
    id: membership.userId,
    name: membership.user.name,
    email: membership.user.email,
    phone: membership.user.phone ?? '',
    active: membership.active && membership.user.status === 'active' && (profile?.active ?? true),
    status: profile?.status ?? 'available',
    totalOrders,
    totalSales,
    tablesServed: profile?.tablesServed ?? 0,
    cancellations: profile?.cancellations ?? 0,
    averageTicket: totalOrders ? Number((totalSales / totalOrders).toFixed(1)) : 0,
    lastActivityAt: profile?.lastActivityAt?.toISOString() ?? membership.updatedAt.toISOString(),
    history:
      profile?.history
        .slice()
        .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
        .slice(0, 8)
        .map((entry) => ({
          id: entry.id,
          label: entry.label,
          createdAt: entry.createdAt.toISOString(),
          value: entry.value?.toNumber(),
        })) ?? [],
  }
}
