import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { MapPin, MessageSquareText, Save, Store, Truck } from 'lucide-react'

import { PageShell } from '@/components/shared/PageShell'
import { SectionHeader } from '@/components/shared/SectionHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import type {
  DeliveryZoneConfig,
  SaveDeliveryZoneRequest,
  UpdateOperationalSettingsRequest,
} from '@/contracts'
import {
  useDeliveryZonesQuery,
  useSaveDeliveryZoneMutation,
  useStoreSettingsQuery,
  useUpdateOperationalSettingsMutation,
} from '@/hooks/queries'
import { useCan } from '@/hooks/use-permissions'
import { formatCurrency } from '@/lib/format'
import type { StoreProfile } from '@/types'

type StoreDraft = {
  name: string
  tradeName: string
  logoUrl: string
  phone: string
  publicWhatsapp: string
  addressLine: string
  city: string
  state: string
  neighborhood: string
  businessHours: string
  businessDays: string[]
  greetingMessage: string
  outOfHoursMessage: string
  cancellationPolicy: string
  generalNotes: string
  defaultDeliveryFee: number
  minimumOrderAmount: number
  deliveryEnabled: boolean
  pickupEnabled: boolean
  counterEnabled: boolean
  dineInEnabled: boolean
  digitalMenuEnabled: boolean
  whatsappAiEnabled: boolean
  autoAcceptEnabled: boolean
  estimatedPrepTimeMinutes: number
  estimatedDeliveryTimeMinutes: number
  estimatedDineInTimeMinutes: number
  estimatedCounterTimeMinutes: number
  estimatedPickupTimeMinutes: number
}

type ZoneDraft = SaveDeliveryZoneRequest

const dayOptions = [
  ['monday', 'Seg'],
  ['tuesday', 'Ter'],
  ['wednesday', 'Qua'],
  ['thursday', 'Qui'],
  ['friday', 'Sex'],
  ['saturday', 'Sab'],
  ['sunday', 'Dom'],
] as const

const emptyZoneDraft: ZoneDraft = {
  neighborhood: '',
  fee: 0,
  active: true,
  sortOrder: 0,
  estimatedDeliveryTimeMinutes: null,
}

export function StoreSettingsPage() {
  const settingsQuery = useStoreSettingsQuery()
  const zonesQuery = useDeliveryZonesQuery()
  const updateSettingsMutation = useUpdateOperationalSettingsMutation()
  const saveZoneMutation = useSaveDeliveryZoneMutation()
  const canManageStore = useCan('settings:store:manage')
  const settings = settingsQuery.data?.data
  const initialDraft = useMemo(() => buildDraft(settings), [settings])
  const [draft, setDraft] = useState<StoreDraft | null>(null)
  const [zoneDraft, setZoneDraft] = useState<ZoneDraft>(emptyZoneDraft)
  const effectiveDraft = draft ?? initialDraft

  function updateDraft<K extends keyof StoreDraft>(field: K, value: StoreDraft[K]) {
    setDraft((current) => ({
      ...(current ?? initialDraft),
      [field]: value,
    }))
  }

  function toggleDay(day: string) {
    const current = effectiveDraft.businessDays
    updateDraft(
      'businessDays',
      current.includes(day) ? current.filter((entry) => entry !== day) : [...current, day],
    )
  }

  function saveSettings() {
    updateSettingsMutation.mutate(toSettingsPayload(effectiveDraft), {
      onSuccess: () => setDraft(null),
    })
  }

  function editZone(zone: DeliveryZoneConfig) {
    setZoneDraft({
      id: zone.id,
      neighborhood: zone.neighborhood,
      fee: zone.fee,
      active: zone.active,
      sortOrder: zone.sortOrder,
      estimatedDeliveryTimeMinutes: zone.estimatedDeliveryTimeMinutes,
    })
  }

  function saveZone() {
    saveZoneMutation.mutate(zoneDraft, {
      onSuccess: () => setZoneDraft(emptyZoneDraft),
    })
  }

  return (
    <PageShell>
      <SectionHeader
        title="Configuracoes da loja"
        description="Dados usados pelo checkout público, atendimento automático, canais de venda e taxas."
        actions={
          canManageStore ? (
            <Button
              disabled={updateSettingsMutation.isPending || settingsQuery.isLoading}
              onClick={saveSettings}
            >
              <Save className="h-4 w-4" />
              {updateSettingsMutation.isPending ? 'Salvando...' : 'Salvar loja'}
            </Button>
          ) : null
        }
      />

      {settingsQuery.isLoading ? (
        <Skeleton className="h-[520px] rounded-[24px]" />
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(360px,0.7fr)]">
          <div className="space-y-5">
            <Card>
              <CardContent className="space-y-5 p-5">
                <PanelTitle icon={<Store className="h-4 w-4" />} title="Identidade e contato" />
                <div className="grid gap-4 md:grid-cols-2">
                  <TextField
                    label="Nome legal"
                    value={effectiveDraft.name}
                    disabled={!canManageStore}
                    onChange={(value) => updateDraft('name', value)}
                  />
                  <TextField
                    label="Nome no cardapio"
                    value={effectiveDraft.tradeName}
                    disabled={!canManageStore}
                    onChange={(value) => updateDraft('tradeName', value)}
                  />
                  <TextField
                    label="Telefone"
                    value={effectiveDraft.phone}
                    disabled={!canManageStore}
                    onChange={(value) => updateDraft('phone', value)}
                  />
                  <TextField
                    label="WhatsApp publico"
                    value={effectiveDraft.publicWhatsapp}
                    disabled={!canManageStore}
                    onChange={(value) => updateDraft('publicWhatsapp', value)}
                  />
                  <TextField
                    label="Cidade"
                    value={effectiveDraft.city}
                    disabled={!canManageStore}
                    onChange={(value) => updateDraft('city', value)}
                  />
                  <TextField
                    label="Estado"
                    value={effectiveDraft.state}
                    disabled={!canManageStore}
                    onChange={(value) => updateDraft('state', value)}
                  />
                </div>
                <TextField
                  label="Endereco da loja"
                  value={effectiveDraft.addressLine}
                  disabled={!canManageStore}
                  onChange={(value) => updateDraft('addressLine', value)}
                />
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-5 p-5">
                <PanelTitle icon={<Truck className="h-4 w-4" />} title="Canais e tempos" />
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <ToggleField
                    label="Delivery"
                    checked={effectiveDraft.deliveryEnabled}
                    disabled={!canManageStore}
                    onChange={(value) => updateDraft('deliveryEnabled', value)}
                  />
                  <ToggleField
                    label="Retirada"
                    checked={effectiveDraft.pickupEnabled}
                    disabled={!canManageStore}
                    onChange={(value) => updateDraft('pickupEnabled', value)}
                  />
                  <ToggleField
                    label="Balcao"
                    checked={effectiveDraft.counterEnabled}
                    disabled={!canManageStore}
                    onChange={(value) => updateDraft('counterEnabled', value)}
                  />
                  <ToggleField
                    label="Salao"
                    checked={effectiveDraft.dineInEnabled}
                    disabled={!canManageStore}
                    onChange={(value) => updateDraft('dineInEnabled', value)}
                  />
                  <ToggleField
                    label="Cardapio Digital"
                    checked={effectiveDraft.digitalMenuEnabled}
                    disabled={!canManageStore}
                    onChange={(value) => updateDraft('digitalMenuEnabled', value)}
                  />
                  <ToggleField
                    label="WhatsApp/IA"
                    checked={effectiveDraft.whatsappAiEnabled}
                    disabled={!canManageStore}
                    onChange={(value) => updateDraft('whatsappAiEnabled', value)}
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <NumberField
                    label="Preparo padrao"
                    value={effectiveDraft.estimatedPrepTimeMinutes}
                    disabled={!canManageStore}
                    onChange={(value) => updateDraft('estimatedPrepTimeMinutes', value)}
                  />
                  <NumberField
                    label="Delivery"
                    value={effectiveDraft.estimatedDeliveryTimeMinutes}
                    disabled={!canManageStore}
                    onChange={(value) => updateDraft('estimatedDeliveryTimeMinutes', value)}
                  />
                  <NumberField
                    label="Retirada"
                    value={effectiveDraft.estimatedPickupTimeMinutes}
                    disabled={!canManageStore}
                    onChange={(value) => updateDraft('estimatedPickupTimeMinutes', value)}
                  />
                  <NumberField
                    label="Balcao"
                    value={effectiveDraft.estimatedCounterTimeMinutes}
                    disabled={!canManageStore}
                    onChange={(value) => updateDraft('estimatedCounterTimeMinutes', value)}
                  />
                  <NumberField
                    label="Salao"
                    value={effectiveDraft.estimatedDineInTimeMinutes}
                    disabled={!canManageStore}
                    onChange={(value) => updateDraft('estimatedDineInTimeMinutes', value)}
                  />
                  <NumberField
                    label="Pedido minimo"
                    value={effectiveDraft.minimumOrderAmount}
                    disabled={!canManageStore}
                    onChange={(value) => updateDraft('minimumOrderAmount', value)}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-5 p-5">
                <PanelTitle
                  icon={<MessageSquareText className="h-4 w-4" />}
                  title="Horarios, mensagens e politicas"
                />
                <TextAreaField
                  label="Horario de funcionamento"
                  value={effectiveDraft.businessHours}
                  disabled={!canManageStore}
                  onChange={(value) => updateDraft('businessHours', value)}
                />
                <div className="flex flex-wrap gap-2">
                  {dayOptions.map(([day, label]) => (
                    <button
                      key={day}
                      type="button"
                      disabled={!canManageStore}
                      onClick={() => toggleDay(day)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                        effectiveDraft.businessDays.includes(day)
                          ? 'border-cyan-300/50 bg-cyan-400/15 text-cyan-100'
                          : 'border-white/10 bg-white/[0.03] text-muted-foreground'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <TextAreaField
                    label="Mensagem de saudacao"
                    value={effectiveDraft.greetingMessage}
                    disabled={!canManageStore}
                    onChange={(value) => updateDraft('greetingMessage', value)}
                  />
                  <TextAreaField
                    label="Mensagem fora do horario"
                    value={effectiveDraft.outOfHoursMessage}
                    disabled={!canManageStore}
                    onChange={(value) => updateDraft('outOfHoursMessage', value)}
                  />
                  <TextAreaField
                    label="Politica de cancelamento"
                    value={effectiveDraft.cancellationPolicy}
                    disabled={!canManageStore}
                    onChange={(value) => updateDraft('cancellationPolicy', value)}
                  />
                  <TextAreaField
                    label="Observacao geral"
                    value={effectiveDraft.generalNotes}
                    disabled={!canManageStore}
                    onChange={(value) => updateDraft('generalNotes', value)}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="space-y-5 p-5">
              <PanelTitle icon={<MapPin className="h-4 w-4" />} title="Entrega por bairro" />
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-sm font-semibold text-white">Taxa padrao</p>
                <NumberField
                  label="Valor"
                  value={effectiveDraft.defaultDeliveryFee}
                  disabled={!canManageStore}
                  onChange={(value) => updateDraft('defaultDeliveryFee', value)}
                />
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  Usada quando nenhum bairro ativo estiver cadastrado. Se houver bairros ativos,
                  o checkout exige um deles.
                </p>
              </div>

              <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <TextField
                  label="Bairro"
                  value={zoneDraft.neighborhood}
                  disabled={!canManageStore}
                  onChange={(value) => setZoneDraft((current) => ({ ...current, neighborhood: value }))}
                />
                <div className="grid grid-cols-2 gap-3">
                  <NumberField
                    label="Taxa"
                    value={zoneDraft.fee}
                    disabled={!canManageStore}
                    onChange={(value) => setZoneDraft((current) => ({ ...current, fee: value }))}
                  />
                  <NumberField
                    label="ETA min"
                    value={zoneDraft.estimatedDeliveryTimeMinutes ?? 0}
                    disabled={!canManageStore}
                    onChange={(value) =>
                      setZoneDraft((current) => ({
                        ...current,
                        estimatedDeliveryTimeMinutes: value > 0 ? value : null,
                      }))
                    }
                  />
                </div>
                <ToggleField
                  label="Bairro atendido"
                  checked={zoneDraft.active}
                  disabled={!canManageStore}
                  onChange={(value) => setZoneDraft((current) => ({ ...current, active: value }))}
                />
                <Button
                  type="button"
                  className="w-full"
                  disabled={!canManageStore || !zoneDraft.neighborhood.trim() || saveZoneMutation.isPending}
                  onClick={saveZone}
                >
                  {saveZoneMutation.isPending ? 'Salvando...' : zoneDraft.id ? 'Atualizar bairro' : 'Adicionar bairro'}
                </Button>
              </div>

              <div className="space-y-2">
                {zonesQuery.isLoading ? (
                  <Skeleton className="h-24 rounded-2xl" />
                ) : zonesQuery.data?.data.length ? (
                  zonesQuery.data.data.map((zone) => (
                    <button
                      key={zone.id}
                      type="button"
                      className="w-full rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-left transition hover:border-cyan-300/30"
                      onClick={() => editZone(zone)}
                    >
                      <span className="flex items-center justify-between gap-3">
                        <span className="font-semibold text-white">{zone.neighborhood}</span>
                        <span className={zone.active ? 'text-emerald-200' : 'text-red-200'}>
                          {zone.active ? 'Ativo' : 'Inativo'}
                        </span>
                      </span>
                      <span className="mt-1 block text-sm text-muted-foreground">
                        {formatCurrency(zone.fee)}
                        {zone.estimatedDeliveryTimeMinutes
                          ? ` - ${zone.estimatedDeliveryTimeMinutes} min`
                          : ''}
                      </span>
                    </button>
                  ))
                ) : (
                  <p className="rounded-2xl border border-dashed border-white/10 px-3 py-6 text-sm text-muted-foreground">
                    Nenhum bairro especifico cadastrado. O checkout usa a taxa padrao da loja.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </PageShell>
  )
}

function buildDraft(settings?: StoreProfile): StoreDraft {
  return {
    name: settings?.name ?? 'Cain Delivery',
    tradeName: settings?.tradeName ?? settings?.name ?? 'Cain Delivery',
    logoUrl: settings?.logoUrl ?? '',
    phone: settings?.phone ?? '',
    publicWhatsapp: settings?.publicWhatsapp ?? '',
    addressLine: settings?.addressLine ?? '',
    city: settings?.city ?? 'Manaus',
    state: settings?.state ?? 'AM',
    neighborhood: settings?.neighborhood ?? '',
    businessHours: settings?.businessHours ?? '',
    businessDays: settings?.businessDays ?? dayOptions.map(([day]) => day),
    greetingMessage: settings?.greetingMessage ?? '',
    outOfHoursMessage: settings?.outOfHoursMessage ?? '',
    cancellationPolicy: settings?.cancellationPolicy ?? '',
    generalNotes: settings?.generalNotes ?? '',
    defaultDeliveryFee: settings?.defaultDeliveryFee ?? 0,
    minimumOrderAmount: settings?.minimumOrderAmount ?? 0,
    deliveryEnabled: settings?.deliveryEnabled ?? true,
    pickupEnabled: settings?.pickupEnabled ?? true,
    counterEnabled: settings?.counterEnabled ?? true,
    dineInEnabled: settings?.dineInEnabled ?? true,
    digitalMenuEnabled: settings?.digitalMenuEnabled ?? true,
    whatsappAiEnabled: settings?.whatsappAiEnabled ?? true,
    autoAcceptEnabled: settings?.autoAcceptEnabled ?? false,
    estimatedPrepTimeMinutes: settings?.estimatedPrepTimeMinutes ?? 30,
    estimatedDeliveryTimeMinutes: settings?.estimatedDeliveryTimeMinutes ?? 90,
    estimatedDineInTimeMinutes: settings?.estimatedDineInTimeMinutes ?? 50,
    estimatedCounterTimeMinutes: settings?.estimatedCounterTimeMinutes ?? 20,
    estimatedPickupTimeMinutes: settings?.estimatedPickupTimeMinutes ?? 24,
  }
}

function toSettingsPayload(draft: StoreDraft): UpdateOperationalSettingsRequest {
  return {
    ...draft,
    logoUrl: blankToNull(draft.logoUrl),
    phone: blankToNull(draft.phone),
    publicWhatsapp: blankToNull(draft.publicWhatsapp),
    addressLine: blankToNull(draft.addressLine),
    neighborhood: blankToNull(draft.neighborhood),
    businessHours: blankToNull(draft.businessHours),
    greetingMessage: blankToNull(draft.greetingMessage),
    outOfHoursMessage: blankToNull(draft.outOfHoursMessage),
    cancellationPolicy: blankToNull(draft.cancellationPolicy),
    generalNotes: blankToNull(draft.generalNotes),
  }
}

function blankToNull(value: string) {
  const trimmed = value.trim()
  return trimmed.length ? trimmed : null
}

function PanelTitle({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="grid h-8 w-8 place-items-center rounded-xl bg-cyan-400/10 text-cyan-100">
        {icon}
      </span>
      <h2 className="font-semibold text-white">{title}</h2>
    </div>
  )
}

function TextField({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string
  value: string
  disabled: boolean
  onChange: (value: string) => void
}) {
  return (
    <label className="space-y-2">
      <span className="text-sm font-medium">{label}</span>
      <Input
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  )
}

function NumberField({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string
  value: number
  disabled: boolean
  onChange: (value: number) => void
}) {
  return (
    <label className="space-y-2">
      <span className="text-sm font-medium">{label}</span>
      <Input
        value={String(value)}
        disabled={disabled}
        inputMode="decimal"
        onChange={(event) => onChange(Number(event.target.value.replace(',', '.')) || 0)}
      />
    </label>
  )
}

function TextAreaField({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string
  value: string
  disabled: boolean
  onChange: (value: string) => void
}) {
  return (
    <label className="space-y-2">
      <span className="text-sm font-medium">{label}</span>
      <textarea
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-24 w-full resize-none rounded-2xl border border-border/70 bg-white/[0.03] px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary/60 focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-60"
      />
    </label>
  )
}

function ToggleField({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string
  checked: boolean
  disabled: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3 text-sm">
      <span className="font-medium text-white">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 accent-cyan-300"
      />
    </label>
  )
}
