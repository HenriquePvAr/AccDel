import { Text, View } from 'react-native'

import { theme } from '../lib/theme'

interface MetricChipProps {
  label: string
  value: string
  tone?: 'accent' | 'info' | 'success' | 'neutral' | 'warning'
}

const toneMap = {
  accent: {
    backgroundColor: theme.colors.accentMuted,
    textColor: theme.colors.accentStrong,
  },
  info: {
    backgroundColor: theme.colors.infoMuted,
    textColor: '#7AB1FF',
  },
  success: {
    backgroundColor: theme.colors.successMuted,
    textColor: '#79DE9A',
  },
  neutral: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    textColor: theme.colors.text,
  },
  warning: {
    backgroundColor: theme.colors.warningMuted,
    textColor: '#F8C56D',
  },
} as const

export function MetricChip({
  label,
  value,
  tone = 'neutral',
}: MetricChipProps) {
  const palette = toneMap[tone]

  return (
    <View
      style={{
        minWidth: 92,
        borderRadius: 18,
        paddingHorizontal: 12,
        paddingVertical: 10,
        backgroundColor: palette.backgroundColor,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        gap: 4,
      }}
    >
      <Text
        style={{
          color: theme.colors.textMuted,
          fontSize: 11,
          letterSpacing: 0.7,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          color: palette.textColor,
          fontSize: 16,
          fontWeight: '700',
        }}
      >
        {value}
      </Text>
    </View>
  )
}
