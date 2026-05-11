import { useMemo } from 'react'
import {
  ActivityIndicator,
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import {
  Bike,
  Clock3,
  Gauge,
  LocateFixed,
  LogOut,
  MapPin,
  PackageCheck,
  PauseCircle,
  Play,
  Route,
} from 'lucide-react-native'

import loginPanel from '../../assets/brand/login-brand-panel.png'
import { ActionPill } from '../components/action-pill'
import { DeliveryStopRow } from '../components/delivery-stop-row'
import { MetricChip } from '../components/metric-chip'
import { SectionCard } from '../components/section-card'
import { useDriverAuth } from '../hooks/use-driver-auth'
import { useDriverActions, useDriverAppStateQuery } from '../hooks/use-driver-state'
import { useTrackingScheduler } from '../hooks/use-tracking-scheduler'
import {
  formatClock,
  formatCurrency,
  formatDistance,
  formatEta,
  formatTimeAgo,
  toInitials,
} from '../lib/format'
import { theme } from '../lib/theme'

export function DriverHomeScreen() {
  const user = useDriverAuth((state) => state.user)
  const logout = useDriverAuth((state) => state.logout)
  const appStateQuery = useDriverAppStateQuery(Boolean(user))
  const actions = useDriverActions()
  const appState = appStateQuery.data?.data
  const currentDelivery = appState?.currentDelivery ?? null
  const trackingEnabled =
    Boolean(currentDelivery) &&
    appState?.driver.availability === 'delivering' &&
    appState.trackingPolicy.trackingEnabled

  const tracking = useTrackingScheduler({
    enabled: trackingEnabled,
    intervalSeconds: appState?.trackingPolicy.intervalSeconds ?? 60,
    currentOrderId: currentDelivery?.orderId ?? null,
    currentAssignmentId: currentDelivery?.assignmentId ?? null,
  })

  const mutationPending =
    actions.startDelivery.isPending ||
    actions.completeDelivery.isPending ||
    actions.updateStatus.isPending

  const statusTone = useMemo(() => {
    if (!appState) {
      return 'neutral' as const
    }

    if (appState.driver.availability === 'delivering') {
      return 'accent' as const
    }

    if (appState.driver.availability === 'paused') {
      return 'warning' as const
    }

    return 'success' as const
  }, [appState])

  const lastUpdateLabel = tracking.lastSentAt
    ? `Enviado ${formatTimeAgo(tracking.lastSentAt)}`
    : formatTimeAgo(appState?.currentLocation?.capturedAt)

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <ImageBackground source={loginPanel} resizeMode="cover" style={styles.hero}>
          <View style={styles.heroOverlay} />
          <View style={styles.heroHeader}>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={styles.eyebrow}>Painel do motoboy</Text>
              <Text style={styles.heroTitle}>Sua entrega em tempo real</Text>
              <Text style={styles.heroSubtitle}>
                Login persistido, ETA operacional e tracking automatico a cada 1 minuto.
              </Text>
            </View>

            <Pressable style={styles.logoutButton} onPress={() => void logout()}>
              <LogOut size={18} color={theme.colors.text} />
            </Pressable>
          </View>

          <View style={styles.driverIdentity}>
            <View style={styles.driverAvatar}>
              <Text style={styles.driverAvatarText}>{toInitials(user?.name ?? 'DR')}</Text>
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.driverName}>{user?.name ?? 'Motoboy'}</Text>
              <Text style={styles.driverRole}>
                {appState?.driver.vehicle ?? 'Moto'} · {user?.store.tradeName ?? 'Cain'}
              </Text>
            </View>
            <View
              style={[
                styles.statusBadge,
                statusTone === 'accent'
                  ? styles.statusBadgeAccent
                  : statusTone === 'warning'
                    ? styles.statusBadgeWarning
                    : styles.statusBadgeSuccess,
              ]}
            >
              <Text style={styles.statusBadgeText}>
                {appState?.driver.availability === 'delivering'
                  ? 'Em entrega'
                  : appState?.driver.availability === 'paused'
                    ? 'Pausado'
                    : 'Disponivel'}
              </Text>
            </View>
          </View>
        </ImageBackground>

        <View style={styles.metricRow}>
          <MetricChip
            label="Tracking"
            value={trackingEnabled ? 'Ativo' : 'Inativo'}
            tone={trackingEnabled ? 'accent' : 'neutral'}
          />
          <MetricChip
            label="Proxima entrega"
            value={formatEta(currentDelivery?.etaMinutes)}
            tone="info"
          />
          <MetricChip
            label="Distancia"
            value={formatDistance(currentDelivery?.distanceMeters)}
            tone="success"
          />
        </View>

        {appStateQuery.isLoading ? (
          <View style={styles.loadingBlock}>
            <ActivityIndicator size="large" color={theme.colors.accent} />
          </View>
        ) : null}

        {appStateQuery.isError ? (
          <SectionCard>
            <Text style={styles.sectionTitle}>Nao foi possivel carregar a entrega atual</Text>
            <Text style={styles.sectionMuted}>
              Atualize a sessao ou confira se a API esta online.
            </Text>
          </SectionCard>
        ) : null}

        {appState ? (
          <>
            <SectionCard>
              <View style={styles.sectionHeader}>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={styles.sectionTitle}>Estado operacional</Text>
                  <Text style={styles.sectionMuted}>
                    {appState.trackingPolicy.reason}
                  </Text>
                </View>
                <ActionPill
                  label="Atualizar agora"
                  icon={LocateFixed}
                  onPress={() => void tracking.sendCurrentLocation()}
                  disabled={!currentDelivery || tracking.isSending}
                />
              </View>

              <View style={styles.statusActions}>
                <ActionPill
                  label="Disponivel"
                  active={appState.driver.availability === 'available'}
                  tone="success"
                  onPress={() => actions.updateStatus.mutate('available')}
                  disabled={mutationPending}
                />
                <ActionPill
                  label="Pausado"
                  active={appState.driver.availability === 'paused'}
                  tone="neutral"
                  icon={PauseCircle}
                  onPress={() => actions.updateStatus.mutate('paused')}
                  disabled={mutationPending}
                />
              </View>

              <View style={styles.statsGrid}>
                <View style={styles.miniStat}>
                  <Gauge size={18} color={theme.colors.textMuted} />
                  <Text style={styles.miniStatLabel}>Velocidade</Text>
                  <Text style={styles.miniStatValue}>
                    {`${Math.round(appState.currentLocation?.speedKmh ?? 0)} km/h`}
                  </Text>
                </View>
                <View style={styles.miniStat}>
                  <Clock3 size={18} color={theme.colors.textMuted} />
                  <Text style={styles.miniStatLabel}>Ultimo update</Text>
                  <Text style={styles.miniStatValue}>{lastUpdateLabel}</Text>
                </View>
                <View style={styles.miniStat}>
                  <Route size={18} color={theme.colors.textMuted} />
                  <Text style={styles.miniStatLabel}>Paradas ativas</Text>
                  <Text style={styles.miniStatValue}>
                    {String(appState.route.stops.length)}
                  </Text>
                </View>
              </View>

              {tracking.errorMessage ? (
                <View style={styles.warningBox}>
                  <Text style={styles.warningText}>{tracking.errorMessage}</Text>
                </View>
              ) : null}
            </SectionCard>

            <SectionCard>
              <View style={styles.sectionHeader}>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={styles.sectionTitle}>Entrega atual</Text>
                  <Text style={styles.sectionMuted}>
                    {currentDelivery
                      ? `${currentDelivery.orderNumber} · ${currentDelivery.customerName}`
                      : 'Sem entrega ativa no momento.'}
                  </Text>
                </View>
                {currentDelivery ? (
                  <View style={styles.orderTotalBubble}>
                    <Text style={styles.orderTotalLabel}>Total</Text>
                    <Text style={styles.orderTotalValue}>
                      {formatCurrency(currentDelivery.total)}
                    </Text>
                  </View>
                ) : null}
              </View>

              {currentDelivery ? (
                <>
                  <View style={styles.deliveryMetaRow}>
                    <View style={styles.deliveryMetaItem}>
                      <MapPin size={16} color={theme.colors.textMuted} />
                      <Text style={styles.deliveryMetaText} numberOfLines={2}>
                        {currentDelivery.addressText || currentDelivery.addressLabel}
                      </Text>
                    </View>
                    <View style={styles.deliveryMetaItem}>
                      <Bike size={16} color={theme.colors.textMuted} />
                      <Text style={styles.deliveryMetaText}>
                        ETA {formatEta(currentDelivery.etaMinutes)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.deliveryMetaRow}>
                    <View style={styles.deliveryMetaItem}>
                      <PackageCheck size={16} color={theme.colors.textMuted} />
                      <Text style={styles.deliveryMetaText}>
                        {currentDelivery.itemCount} item(ns) · {currentDelivery.paymentMethod}
                      </Text>
                    </View>
                    <View style={styles.deliveryMetaItem}>
                      <Clock3 size={16} color={theme.colors.textMuted} />
                      <Text style={styles.deliveryMetaText}>
                        Tracking {trackingEnabled ? 'ativo' : 'parado'}
                      </Text>
                    </View>
                  </View>

                  {currentDelivery.notes ? (
                    <View style={styles.noteBox}>
                      <Text style={styles.noteTitle}>Observacao operacional</Text>
                      <Text style={styles.noteText}>{currentDelivery.notes}</Text>
                    </View>
                  ) : null}

                  <View style={styles.primaryActions}>
                    <ActionPill
                      label={
                        appState.driver.availability === 'delivering'
                          ? 'Finalizar entrega'
                          : 'Iniciar entrega'
                      }
                      icon={appState.driver.availability === 'delivering' ? PackageCheck : Play}
                      tone={appState.driver.availability === 'delivering' ? 'success' : 'accent'}
                      onPress={() =>
                        appState.driver.availability === 'delivering'
                          ? actions.completeDelivery.mutate()
                          : actions.startDelivery.mutate()
                      }
                      disabled={mutationPending}
                    />
                  </View>
                </>
              ) : (
                <Text style={styles.sectionMuted}>
                  Assim que a operacao despachar um pedido para voce, a rota aparece aqui.
                </Text>
              )}
            </SectionCard>

            <SectionCard>
              <View style={styles.sectionHeader}>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={styles.sectionTitle}>Rota atual</Text>
                  <Text style={styles.sectionMuted}>
                    Atualizada em {formatClock(appState.route.updatedAt)}
                  </Text>
                </View>
              </View>

              {appState.route.stops.length ? (
                <View style={{ gap: 10 }}>
                  {appState.route.stops.map((stop, index) => (
                    <DeliveryStopRow
                      key={`${stop.orderId}-${stop.finalSequence}`}
                      stop={stop}
                      isNext={index === 0}
                    />
                  ))}
                </View>
              ) : (
                <Text style={styles.sectionMuted}>
                  Sem paradas em rota. Voce pode ficar disponivel enquanto aguarda novo despacho.
                </Text>
              )}
            </SectionCard>
          </>
        ) : null}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    paddingBottom: 36,
    gap: 16,
  },
  hero: {
    minHeight: 250,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 22,
    justifyContent: 'space-between',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(7,17,31,0.68)',
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    zIndex: 1,
  },
  logoutButton: {
    height: 44,
    width: 44,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  eyebrow: {
    color: theme.colors.accentStrong,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: theme.colors.text,
    fontSize: 34,
    fontWeight: '900',
    lineHeight: 40,
  },
  heroSubtitle: {
    color: theme.colors.textMuted,
    fontSize: 14,
    lineHeight: 22,
    maxWidth: 320,
  },
  driverIdentity: {
    zIndex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(10,22,39,0.72)',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  driverAvatar: {
    height: 52,
    width: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.accentMuted,
    borderWidth: 1,
    borderColor: 'rgba(224,103,46,0.2)',
  },
  driverAvatarText: {
    color: theme.colors.accentStrong,
    fontSize: 18,
    fontWeight: '900',
  },
  driverName: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  driverRole: {
    color: theme.colors.textMuted,
    fontSize: 13,
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  statusBadgeAccent: {
    backgroundColor: theme.colors.accentMuted,
  },
  statusBadgeWarning: {
    backgroundColor: theme.colors.warningMuted,
  },
  statusBadgeSuccess: {
    backgroundColor: theme.colors.successMuted,
  },
  statusBadgeText: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  metricRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 18,
    marginTop: -14,
    zIndex: 2,
  },
  loadingBlock: {
    paddingTop: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  sectionMuted: {
    color: theme.colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
  },
  statusActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  miniStat: {
    minWidth: 110,
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: 'rgba(255,255,255,0.03)',
    padding: 14,
    gap: 6,
  },
  miniStatLabel: {
    color: theme.colors.textMuted,
    fontSize: 12,
  },
  miniStatValue: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  warningBox: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(241,164,60,0.18)',
    backgroundColor: 'rgba(241,164,60,0.1)',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  warningText: {
    color: '#FFD796',
    fontSize: 13,
    lineHeight: 18,
  },
  orderTotalBubble: {
    alignItems: 'flex-end',
    gap: 4,
  },
  orderTotalLabel: {
    color: theme.colors.textMuted,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  orderTotalValue: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  deliveryMetaRow: {
    gap: 10,
  },
  deliveryMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  deliveryMetaText: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  noteBox: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: 'rgba(255,255,255,0.03)',
    padding: 14,
    gap: 6,
  },
  noteTitle: {
    color: theme.colors.textMuted,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  noteText: {
    color: theme.colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  primaryActions: {
    paddingTop: 4,
  },
})
