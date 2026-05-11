import { Badge } from '@/components/ui/badge'
import { channelLabelMap, driverAvailabilityMeta, orderStatusMeta, tableStatusMeta } from '@/lib/domain'
import type { DriverAvailabilityStatus, OrderChannel, OrderStatus, TableStatus } from '@/types'

interface StatusBadgeProps {
  status?: OrderStatus | TableStatus | DriverAvailabilityStatus
  channel?: OrderChannel
}

export function StatusBadge({ status, channel }: StatusBadgeProps) {
  if (channel) {
    return <Badge variant="default">{channelLabelMap[channel]}</Badge>
  }

  if (!status) {
    return null
  }

  if (status in orderStatusMeta) {
    const meta = orderStatusMeta[status as OrderStatus]
    return <Badge variant={meta.color as never}>{meta.label}</Badge>
  }

  if (status in tableStatusMeta) {
    const meta = tableStatusMeta[status as TableStatus]
    return <Badge variant={meta.color as never}>{meta.label}</Badge>
  }

  const meta = driverAvailabilityMeta[status as DriverAvailabilityStatus]
  return <Badge variant={meta.color as never}>{meta.label}</Badge>
}
