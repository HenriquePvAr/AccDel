import type { ReactNode } from 'react'
import { View, type StyleProp, type ViewStyle } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'

import { theme } from '../lib/theme'

interface SectionCardProps {
  children: ReactNode
  style?: StyleProp<ViewStyle>
}

export function SectionCard({ children, style }: SectionCardProps) {
  return (
    <LinearGradient
      colors={['rgba(255,255,255,0.02)', 'rgba(255,255,255,0.01)']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        {
          borderRadius: theme.radius.lg,
          borderWidth: 1,
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.surface,
          overflow: 'hidden',
          shadowColor: '#000000',
          shadowOpacity: 0.16,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 10 },
          elevation: 3,
        },
        style,
      ]}
    >
      <View
        style={{
          padding: theme.spacing.lg,
          gap: theme.spacing.md,
        }}
      >
        {children}
      </View>
    </LinearGradient>
  )
}
