import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState } from 'react-native'
import * as Location from 'expo-location'
import { useQueryClient } from '@tanstack/react-query'

import { driverApi } from '../api/driver'
import { driverQueryKeys } from './use-driver-state'

interface TrackingSchedulerOptions {
  enabled: boolean
  intervalSeconds: number
  currentOrderId?: string | null
  currentAssignmentId?: string | null
}

export function useTrackingScheduler(options: TrackingSchedulerOptions) {
  const queryClient = useQueryClient()
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null)
  const [lastSentAt, setLastSentAt] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSending, setIsSending] = useState(false)

  const sendCurrentLocation = useCallback(async () => {
    try {
      setIsSending(true)
      setErrorMessage(null)

      const permission = await Location.requestForegroundPermissionsAsync()
      const granted = permission.status === 'granted'
      setPermissionGranted(granted)

      if (!granted) {
        setErrorMessage('Permissao de localizacao negada no dispositivo.')
        return
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      })
      const speedKmh =
        typeof position.coords.speed === 'number' && position.coords.speed >= 0
          ? Number((position.coords.speed * 3.6).toFixed(1))
          : undefined
      const heading =
        typeof position.coords.heading === 'number' && position.coords.heading >= 0
          ? Number(position.coords.heading.toFixed(1))
          : undefined

      await driverApi.sendLocation({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        speedKmh,
        heading,
        accuracyMeters: position.coords.accuracy ?? undefined,
        capturedAt: new Date(position.timestamp).toISOString(),
        source: 'app',
        currentOrderId: options.currentOrderId ?? undefined,
        currentAssignmentId: options.currentAssignmentId ?? undefined,
      })

      const nextSentAt = new Date().toISOString()
      setLastSentAt(nextSentAt)
      await queryClient.invalidateQueries({
        queryKey: driverQueryKeys.appState,
      })
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Nao foi possivel enviar a localizacao.'
      setErrorMessage(message)
    } finally {
      setIsSending(false)
    }
  }, [
    options.currentAssignmentId,
    options.currentOrderId,
    queryClient,
  ])

  useEffect(() => {
    if (!options.enabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    const bootstrapTimer = setTimeout(() => {
      void sendCurrentLocation()
    }, 0)
    intervalRef.current = setInterval(() => {
      void sendCurrentLocation()
    }, Math.max(15, options.intervalSeconds) * 1000)

    return () => {
      clearTimeout(bootstrapTimer)
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [options.enabled, options.intervalSeconds, sendCurrentLocation])

  useEffect(() => {
    let resumeTimer: ReturnType<typeof setTimeout> | null = null
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && options.enabled) {
        resumeTimer = setTimeout(() => {
          void sendCurrentLocation()
        }, 0)
      }
    })

    return () => {
      if (resumeTimer) {
        clearTimeout(resumeTimer)
      }
      subscription.remove()
    }
  }, [options.enabled, sendCurrentLocation])

  return {
    permissionGranted,
    lastSentAt,
    errorMessage,
    isSending,
    sendCurrentLocation,
  }
}
