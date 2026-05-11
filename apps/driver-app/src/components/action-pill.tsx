import { Pressable, Text } from 'react-native'
import type { LucideIcon } from 'lucide-react-native'

import { theme } from '../lib/theme'

interface ActionPillProps {
  label: string
  active?: boolean
  tone?: 'accent' | 'neutral' | 'success'
  icon?: LucideIcon
  onPress?: () => void
  disabled?: boolean
}

export function ActionPill({
  label,
  active = false,
  tone = 'neutral',
  icon: Icon,
  onPress,
  disabled,
}: ActionPillProps) {
  const palette =
    tone === 'accent'
      ? {
          background: active ? theme.colors.accent : 'rgba(224,103,46,0.14)',
          border: active ? theme.colors.accent : 'rgba(224,103,46,0.24)',
          text: active ? theme.colors.white : theme.colors.accentStrong,
        }
      : tone === 'success'
        ? {
            background: active ? theme.colors.success : 'rgba(51,178,111,0.14)',
            border: active ? theme.colors.success : 'rgba(51,178,111,0.24)',
            text: active ? theme.colors.white : '#8BE7AB',
          }
        : {
            background: active ? theme.colors.surfaceMuted : 'rgba(255,255,255,0.04)',
            border: theme.colors.border,
            text: theme.colors.text,
          }

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        minHeight: 44,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: palette.border,
        backgroundColor: disabled ? 'rgba(255,255,255,0.04)' : palette.background,
        paddingHorizontal: 16,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {Icon ? <Icon size={16} color={palette.text} /> : null}
      <Text
        style={{
          color: palette.text,
          fontSize: 14,
          fontWeight: '700',
        }}
      >
        {label}
      </Text>
    </Pressable>
  )
}
