import { useMemo, useState } from 'react'

import { PageShell } from '@/components/shared/PageShell'
import { SectionHeader } from '@/components/shared/SectionHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  useStoreSettingsQuery,
  useUpdateOperationalSettingsMutation,
} from '@/hooks/queries'
import { useCan } from '@/hooks/use-permissions'

export function StoreSettingsPage() {
  const settingsQuery = useStoreSettingsQuery()
  const updateSettingsMutation = useUpdateOperationalSettingsMutation()
  const canManageStore = useCan('settings:store:manage')
  const settings = settingsQuery.data?.data
  const initialDraft = useMemo(
    () => ({
      autoAcceptEnabled: settings?.autoAcceptEnabled ?? false,
      estimatedPrepTimeMinutes: settings?.estimatedPrepTimeMinutes ?? 30,
      estimatedDeliveryTimeMinutes: settings?.estimatedDeliveryTimeMinutes ?? 90,
      estimatedDineInTimeMinutes: settings?.estimatedDineInTimeMinutes ?? 50,
      estimatedCounterTimeMinutes: settings?.estimatedCounterTimeMinutes ?? 20,
      estimatedPickupTimeMinutes: settings?.estimatedPickupTimeMinutes ?? 24,
    }),
    [settings],
  )
  const [draft, setDraft] = useState<null | typeof initialDraft>(null)
  const effectiveDraft = draft ?? initialDraft

  return (
    <PageShell>
      <SectionHeader
        title="Configuracoes da loja"
        description="Tempos operacionais e parametros basicos que alimentam a previsao interna do pedido."
        actions={
          canManageStore ? (
            <Button
              disabled={updateSettingsMutation.isPending}
              onClick={() => updateSettingsMutation.mutate(effectiveDraft)}
            >
              {updateSettingsMutation.isPending ? 'Salvando...' : 'Salvar estimativas'}
            </Button>
          ) : null
        }
      />

      {settingsQuery.isLoading ? (
        <Skeleton className="h-[360px] rounded-[24px]" />
      ) : (
        <Card>
          <CardContent className="grid gap-5 p-5 xl:grid-cols-[1fr_1.4fr]">
            <div className="space-y-4">
              <div className="rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/10">
                <p className="text-sm text-muted-foreground">Loja</p>
                <p className="font-semibold">{settings?.tradeName}</p>
              </div>
              <div className="rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/10">
                <p className="text-sm text-muted-foreground">Cidade</p>
                <p className="font-semibold">
                  {settings?.city} / {settings?.state}
                </p>
              </div>
              <div className="rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/10">
                <p className="text-sm text-muted-foreground">Autoaceite atual</p>
                <p className="font-semibold">{effectiveDraft.autoAcceptEnabled ? 'Ativo' : 'Manual'}</p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field
                label="Preparo padrao"
                value={effectiveDraft.estimatedPrepTimeMinutes}
                disabled={!canManageStore}
                onChange={(value) =>
                  setDraft((state) => ({
                    ...(state ?? initialDraft),
                    estimatedPrepTimeMinutes: value,
                  }))
                }
              />
              <Field
                label="Delivery"
                value={effectiveDraft.estimatedDeliveryTimeMinutes}
                disabled={!canManageStore}
                onChange={(value) =>
                  setDraft((state) => ({
                    ...(state ?? initialDraft),
                    estimatedDeliveryTimeMinutes: value,
                  }))
                }
              />
              <Field
                label="Salao"
                value={effectiveDraft.estimatedDineInTimeMinutes}
                disabled={!canManageStore}
                onChange={(value) =>
                  setDraft((state) => ({
                    ...(state ?? initialDraft),
                    estimatedDineInTimeMinutes: value,
                  }))
                }
              />
              <Field
                label="Balcao"
                value={effectiveDraft.estimatedCounterTimeMinutes}
                disabled={!canManageStore}
                onChange={(value) =>
                  setDraft((state) => ({
                    ...(state ?? initialDraft),
                    estimatedCounterTimeMinutes: value,
                  }))
                }
              />
              <Field
                label="Retirada"
                value={effectiveDraft.estimatedPickupTimeMinutes}
                disabled={!canManageStore}
                onChange={(value) =>
                  setDraft((state) => ({
                    ...(state ?? initialDraft),
                    estimatedPickupTimeMinutes: value,
                  }))
                }
              />
              <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] p-4">
                <p className="text-sm font-medium">Como isso reflete no pedido</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  O pedido passa a carregar estimativa interna e prazo previsto no drawer. Delivery
                  soma preparo + rota; canais de balcao, retirada e salao usam o tempo especifico.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </PageShell>
  )
}

function Field({
  label,
  value,
  disabled = false,
  onChange,
}: {
  label: string
  value: number
  disabled?: boolean
  onChange: (value: number) => void
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">{label}</label>
      <Input
        value={String(value)}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value.replace(',', '.')) || 0)}
      />
    </div>
  )
}
