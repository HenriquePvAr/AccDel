import { ActivityIndicator, View } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { DriverHomeScreen } from './src/screens/driver-home-screen'
import { DriverLoginScreen } from './src/screens/driver-login-screen'
import { DriverAuthProvider } from './src/providers/auth-provider'
import { useDriverAuth } from './src/hooks/use-driver-auth'
import { theme } from './src/lib/theme'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 15_000,
      refetchOnReconnect: true,
    },
  },
})

export default function App() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <DriverAuthProvider>
          <StatusBar style="light" />
          <DriverRoot />
        </DriverAuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  )
}

function DriverRoot() {
  const status = useDriverAuth((state) => state.status)

  if (status === 'booting') {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: theme.colors.background,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator size="large" color={theme.colors.accent} />
      </View>
    )
  }

  if (status === 'authenticated') {
    return <DriverHomeScreen />
  }

  return <DriverLoginScreen />
}
