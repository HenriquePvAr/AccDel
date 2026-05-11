import { Text, View } from 'react-native'
import { Clock3, MapPin } from 'lucide-react-native'

import { formatDistance, formatEta } from '../lib/format'
import { theme } from '../lib/theme'
import type { DeliveryStop } from '../types/api'

interface DeliveryStopRowProps {
  stop: DeliveryStop
  isNext?: boolean
}

export function DeliveryStopRow({ stop, isNext = false }: DeliveryStopRowProps) {
  return (
    <View
      style={{
        borderRadius: 18,
        borderWidth: 1,
        borderColor: isNext ? 'rgba(224,103,46,0.22)' : theme.colors.border,
        backgroundColor: isNext ? 'rgba(224,103,46,0.08)' : 'rgba(255,255,255,0.03)',
        padding: 14,
        gap: 10,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <View style={{ flex: 1, gap: 4 }}>
          <Text
            style={{
              color: theme.colors.text,
              fontSize: 15,
              fontWeight: '700',
            }}
          >
            {stop.orderNumber} · {stop.customerName}
          </Text>
          <Text
            numberOfLines={1}
            style={{
              color: theme.colors.textMuted,
              fontSize: 13,
            }}
          >
            {stop.addressLabel}
          </Text>
        </View>
        <View
          style={{
            borderRadius: 999,
            backgroundColor: isNext ? theme.colors.accentMuted : 'rgba(255,255,255,0.08)',
            paddingHorizontal: 10,
            paddingVertical: 6,
          }}
        >
          <Text
            style={{
              color: isNext ? theme.colors.accentStrong : theme.colors.text,
              fontSize: 12,
              fontWeight: '700',
            }}
          >
            {isNext ? 'Proxima' : `Parada ${stop.finalSequence}`}
          </Text>
        </View>
      </View>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Clock3 size={14} color={theme.colors.textMuted} />
          <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>
            ETA {formatEta(stop.etaMinutes)}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <MapPin size={14} color={theme.colors.textMuted} />
          <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>
            {formatDistance(stop.distanceMeters)}
          </Text>
        </View>
      </View>
    </View>
  )
}
