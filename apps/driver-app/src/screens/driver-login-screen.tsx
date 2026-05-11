import { useState } from 'react'
import {
  ActivityIndicator,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Eye, EyeOff, KeyRound, Mail, ShieldCheck, UserRound } from 'lucide-react-native'

import loginPanel from '../../assets/brand/login-brand-panel.png'
import { useDriverAuth } from '../hooks/use-driver-auth'
import { theme } from '../lib/theme'

const demoAccounts = [
  { label: 'Diego Paz', email: 'driver@cain.local' },
  { label: 'Ana Vela', email: 'ana.driver@cain.local' },
  { label: 'Igo Moreira', email: 'igo.driver@cain.local' },
]

export function DriverLoginScreen() {
  const login = useDriverAuth((state) => state.login)
  const [email, setEmail] = useState('driver@cain.local')
  const [password, setPassword] = useState('Demo@123456')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const handleSubmit = async () => {
    try {
      setLoading(true)
      setErrorMessage('')
      await login(email.trim(), password)
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Nao foi possivel entrar no app.',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={styles.screen}>
      <ImageBackground source={loginPanel} resizeMode="cover" style={styles.hero}>
        <LinearGradient
          colors={['rgba(7,17,31,0.08)', 'rgba(7,17,31,0.78)', '#07111F']}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={styles.brandBlock}>
          <Text style={styles.brandTitle}>Cain Driver</Text>
          <Text style={styles.brandSubtitle}>
            Login rapido, rastreamento ativo e entrega sob controle.
          </Text>
        </View>
      </ImageBackground>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.formWrap}
      >
        <ScrollView
          contentContainerStyle={styles.formScroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.formCard}>
            <View style={styles.avatarBadge}>
              <UserRound size={26} color={theme.colors.accentStrong} />
            </View>

            <Text style={styles.eyebrow}>Sessao do motoboy</Text>
            <Text style={styles.title}>Entre para iniciar sua rota</Text>
            <Text style={styles.subtitle}>
              O tracking automatico so liga durante entrega ativa.
            </Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email</Text>
              <View style={styles.inputShell}>
                <Mail size={18} color={theme.colors.textMuted} />
                <TextInput
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  placeholder="motoboy@cain.local"
                  placeholderTextColor={theme.colors.textSoft}
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Senha</Text>
              <View style={styles.inputShell}>
                <KeyRound size={18} color={theme.colors.textMuted} />
                <TextInput
                  autoCapitalize="none"
                  autoCorrect={false}
                  secureTextEntry={!showPassword}
                  placeholder="Sua senha"
                  placeholderTextColor={theme.colors.textSoft}
                  style={[styles.input, { paddingRight: 8 }]}
                  value={password}
                  onChangeText={setPassword}
                />
                <Pressable onPress={() => setShowPassword((value) => !value)}>
                  {showPassword ? (
                    <EyeOff size={18} color={theme.colors.textMuted} />
                  ) : (
                    <Eye size={18} color={theme.colors.textMuted} />
                  )}
                </Pressable>
              </View>
            </View>

            {errorMessage ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}

            <Pressable
              disabled={loading}
              onPress={() => void handleSubmit()}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed ? styles.primaryButtonPressed : null,
                loading ? styles.buttonDisabled : null,
              ]}
            >
              <LinearGradient
                colors={['#E0672E', '#C74B1F']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.primaryButtonGradient}
              >
                {loading ? (
                  <ActivityIndicator color={theme.colors.white} />
                ) : (
                  <Text style={styles.primaryButtonText}>Entrar no app</Text>
                )}
              </LinearGradient>
            </Pressable>

            <View style={styles.quickAccessBlock}>
              <Text style={styles.quickAccessTitle}>Acesso rapido de demo</Text>
              <View style={styles.quickAccessList}>
                {demoAccounts.map((account) => (
                  <Pressable
                    key={account.email}
                    onPress={() => {
                      setEmail(account.email)
                      setPassword('Demo@123456')
                      setErrorMessage('')
                    }}
                    style={({ pressed }) => [
                      styles.quickAccessChip,
                      pressed ? styles.quickAccessChipPressed : null,
                    ]}
                  >
                    <Text style={styles.quickAccessChipLabel}>{account.label}</Text>
                    <Text style={styles.quickAccessChipValue}>{account.email}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.securityRow}>
              <ShieldCheck size={16} color={theme.colors.textMuted} />
              <Text style={styles.securityText}>
                Sessao protegida e tracking controlado por entrega ativa.
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  hero: {
    height: 320,
    justifyContent: 'flex-end',
    paddingHorizontal: 24,
    paddingBottom: 28,
  },
  brandBlock: {
    gap: 8,
  },
  brandTitle: {
    color: theme.colors.text,
    fontSize: 34,
    fontWeight: '900',
  },
  brandSubtitle: {
    color: theme.colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    maxWidth: 280,
  },
  formWrap: {
    flex: 1,
    marginTop: -28,
  },
  formScroll: {
    paddingBottom: 32,
  },
  formCard: {
    marginHorizontal: 18,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    backgroundColor: '#0B1526',
    paddingHorizontal: 22,
    paddingTop: 26,
    paddingBottom: 24,
    gap: 18,
    shadowColor: '#000000',
    shadowOpacity: 0.22,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 16 },
    elevation: 8,
  },
  avatarBadge: {
    alignSelf: 'center',
    height: 64,
    width: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(224,103,46,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(224,103,46,0.18)',
  },
  eyebrow: {
    color: theme.colors.accentStrong,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.1,
  },
  title: {
    color: theme.colors.text,
    fontSize: 28,
    fontWeight: '900',
    lineHeight: 34,
  },
  subtitle: {
    color: theme.colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  inputShell: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 16,
  },
  input: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 15,
  },
  errorBox: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(242,100,100,0.18)',
    backgroundColor: 'rgba(242,100,100,0.1)',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  errorText: {
    color: '#FFC2C2',
    fontSize: 13,
    lineHeight: 18,
  },
  primaryButton: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#E0672E',
    shadowOpacity: 0.32,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },
  primaryButtonPressed: {
    transform: [{ scale: 0.99 }],
  },
  primaryButtonGradient: {
    minHeight: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  primaryButtonText: {
    color: theme.colors.white,
    fontSize: 16,
    fontWeight: '800',
  },
  buttonDisabled: {
    opacity: 0.72,
  },
  quickAccessBlock: {
    gap: 12,
  },
  quickAccessTitle: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  quickAccessList: {
    gap: 10,
  },
  quickAccessChip: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: 'rgba(255,255,255,0.03)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
  },
  quickAccessChipPressed: {
    borderColor: 'rgba(224,103,46,0.26)',
    backgroundColor: 'rgba(224,103,46,0.08)',
  },
  quickAccessChipLabel: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  quickAccessChipValue: {
    color: theme.colors.textMuted,
    fontSize: 12,
  },
  securityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 4,
  },
  securityText: {
    flex: 1,
    color: theme.colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
})
