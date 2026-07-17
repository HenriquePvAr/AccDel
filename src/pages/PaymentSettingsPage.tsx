import { useMemo, useState, type ReactNode } from 'react'
import { Banknote, Check, CreditCard, Link2, QrCode, ReceiptText, Settings2 } from 'lucide-react'

import { EmptyState } from '@/components/shared/EmptyState'
import { PageShell } from '@/components/shared/PageShell'
import { SectionHeader } from '@/components/shared/SectionHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import type { SavePaymentMethodConfigRequest } from '@/contracts'
import { usePaymentMethodsQuery, useSavePaymentMethodMutation } from '@/hooks/queries'
import { usePageTitle } from '@/hooks/use-page-title'
import { useCan } from '@/hooks/use-permissions'
import { channelLabelMap, paymentLabelMap } from '@/lib/domain'
import { cn } from '@/lib/utils'
import type { PaymentMethod, PaymentMethodConfig, PaymentProvider, ProductChannel } from '@/types'

const channelOptions: Array<{
  value: ProductChannel
  label: string
  description: string
}> = [
  { value: 'delivery', label: 'Delivery', description: 'Pedidos para entrega.' },
  { value: 'digital_menu', label: 'Cardapio digital', description: 'Pedidos feitos pelo cliente online.' },
  { value: 'counter', label: 'Balcao', description: 'Pedidos presenciais no balcao.' },
  { value: 'dine_in', label: 'Salao / Mesas', description: 'Comandas e atendimento de mesa.' },
]

const methodOptions: Array<{ value: PaymentMethod | 'custom'; label: string }> = [
  { value: 'cash', label: 'Dinheiro' },
  { value: 'credit_card', label: 'Cartao de credito' },
  { value: 'debit_card', label: 'Cartao de debito' },
  { value: 'pix', label: 'Pix' },
  { value: 'meal_voucher', label: 'Voucher' },
  { value: 'payment_link', label: 'Link de pagamento' },
  { value: 'custom', label: 'Personalizada' },
]

const providerOptions: Array<{ value: PaymentProvider; label: string; description: string }> = [
  { value: 'manual', label: 'Manual', description: 'Recebimento conferido pela equipe.' },
  { value: 'pix', label: 'Pix', description: 'Base preparada para cobranca Pix.' },
  { value: 'picpay', label: 'PicPay', description: 'Servico preparado; integracao real pendente.' },
]

function emptyDraft(sortOrder: number): SavePaymentMethodConfigRequest {
  return {
    name: '',
    method: null,
    provider: 'manual',
    active: true,
    fixed: false,
    requiresReceipt: false,
    autoCashEntry: true,
    channels: ['delivery', 'counter', 'dine_in'],
    sortOrder,
    externalEnabled: false,
  }
}

function draftFromMethod(method: PaymentMethodConfig): SavePaymentMethodConfigRequest {
  return {
    id: method.id,
    name: method.name,
    method: method.method ?? null,
    provider: method.provider,
    active: method.active,
    fixed: method.fixed,
    requiresReceipt: method.requiresReceipt,
    autoCashEntry: method.autoCashEntry,
    channels: method.channels,
    sortOrder: method.sortOrder,
    externalEnabled: method.externalEnabled,
  }
}

export function PaymentSettingsPage() {
  usePageTitle('Pagamentos')
  const paymentMethodsQuery = usePaymentMethodsQuery()
  const savePaymentMethod = useSavePaymentMethodMutation()
  const canManage = useCan('settings:preferences:manage')
  const methods = useMemo(
    () => paymentMethodsQuery.data?.data ?? [],
    [paymentMethodsQuery.data?.data],
  )
  const [draft, setDraft] = useState<SavePaymentMethodConfigRequest | null>(null)

  const sortedMethods = useMemo(
    () => methods.slice().sort((left, right) => left.sortOrder - right.sortOrder),
    [methods],
  )
  const activeMethods = sortedMethods.filter((method) => method.active)

  return (
    <PageShell>
      <SectionHeader
        title="Pagamentos"
        description="Defina quais formas de pagamento aparecem no delivery, balcao, salao e cardapio digital."
        actions={
          canManage ? (
            <Button onClick={() => setDraft(emptyDraft(sortedMethods.length + 1))}>
              Nova forma
            </Button>
          ) : null
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <PaymentStat label="Ativas" value={String(activeMethods.length)} />
        <PaymentStat
          label="Canais cobertos"
          value={String(new Set(activeMethods.flatMap((method) => method.channels)).size)}
        />
        <PaymentStat
          label="Pix / PicPay"
          value={String(activeMethods.filter((method) => method.provider !== 'manual').length)}
        />
      </div>

      {paymentMethodsQuery.isLoading ? (
        <Skeleton className="h-[420px] rounded-[24px]" />
      ) : paymentMethodsQuery.isError ? (
        <EmptyState
          icon={<CreditCard className="h-5 w-5" />}
          title="Falha ao carregar pagamentos"
          description="Nenhuma forma de pagamento esta disponivel para a loja."
        />
      ) : sortedMethods.length ? (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="min-w-full text-sm">
              <thead className="border-b border-white/10 bg-white/[0.04] text-left text-xs uppercase tracking-[0.16em] text-muted-foreground">
                <tr>
                  <th className="px-5 py-4">Forma</th>
                  <th className="px-5 py-4">Canais</th>
                  <th className="px-5 py-4">Recebimento</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {sortedMethods.map((method) => (
                  <tr key={method.id} className="border-b border-white/10">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <PaymentIcon provider={method.provider} />
                        <div>
                          <p className="font-semibold text-slate-100">{method.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {method.method ? paymentLabelMap[method.method] : 'Personalizada'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-1.5">
                        {method.channels.map((channel) => (
                          <Badge key={channel} variant="default">
                            {channelLabelMap[channel]}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-muted-foreground">
                      {method.provider === 'picpay'
                        ? 'PicPay preparado, sem cobranca automatica'
                        : method.provider === 'pix'
                          ? 'Pix base'
                          : 'Manual'}
                    </td>
                    <td className="px-5 py-4">
                      <Badge variant={method.active ? 'success' : 'default'}>
                        {method.active ? 'Ativa' : 'Inativa'}
                      </Badge>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex gap-2">
                        <Button size="sm" variant="secondary" onClick={() => setDraft(draftFromMethod(method))}>
                          Editar
                        </Button>
                        {canManage ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={savePaymentMethod.isPending}
                            onClick={() =>
                              savePaymentMethod.mutate({
                                ...draftFromMethod(method),
                                active: !method.active,
                              })
                            }
                          >
                            {method.active ? 'Inativar' : 'Ativar'}
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ) : (
        <EmptyState
          icon={<CreditCard className="h-5 w-5" />}
          title="Nenhuma forma de pagamento cadastrada"
          description="Cadastre as formas reais usadas pela loja para liberar exibicao nos fluxos operacionais."
        />
      )}

      <PaymentMethodDrawer
        draft={draft}
        open={Boolean(draft)}
        busy={savePaymentMethod.isPending}
        canManage={canManage}
        onChange={setDraft}
        onOpenChange={(open) => {
          if (!open) {
            setDraft(null)
          }
        }}
        onSave={(nextDraft) =>
          savePaymentMethod.mutate(nextDraft, {
            onSuccess: () => setDraft(null),
          })
        }
      />
    </PageShell>
  )
}

function PaymentStat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-2 font-mono text-3xl font-semibold text-slate-100">{value}</p>
      </CardContent>
    </Card>
  )
}

function PaymentIcon({ provider }: { provider: PaymentProvider }) {
  const Icon = provider === 'pix' ? QrCode : provider === 'picpay' ? Link2 : Banknote

  return (
    <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/[0.06] text-primary ring-1 ring-white/10">
      <Icon className="h-5 w-5" />
    </span>
  )
}

function PaymentMethodDrawer({
  draft,
  open,
  busy,
  canManage,
  onChange,
  onOpenChange,
  onSave,
}: {
  draft: SavePaymentMethodConfigRequest | null
  open: boolean
  busy: boolean
  canManage: boolean
  onChange: (draft: SavePaymentMethodConfigRequest | null) => void
  onOpenChange: (open: boolean) => void
  onSave: (draft: SavePaymentMethodConfigRequest) => void
}) {
  if (!draft) {
    return null
  }

  const currentDraft = draft
  const canSave = currentDraft.name.trim().length >= 2 && currentDraft.channels.length > 0

  function update(next: Partial<SavePaymentMethodConfigRequest>) {
    onChange({
      ...currentDraft,
      ...next,
    })
  }

  function toggleChannel(channel: ProductChannel) {
    update({
      channels: currentDraft.channels.includes(channel)
        ? currentDraft.channels.filter((entry) => entry !== channel)
        : [...currentDraft.channels, channel],
    })
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="max-w-[760px] overflow-y-auto">
        <SheetHeader className="pr-10">
          <SheetTitle>{draft.id ? 'Editar pagamento' : 'Nova forma de pagamento'}</SheetTitle>
          <SheetDescription>
            Configure nome, canais e comportamento sem expor termos tecnicos para a operacao.
          </SheetDescription>
        </SheetHeader>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
          <div className="space-y-4">
            <Card>
              <CardContent className="space-y-4 p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-slate-100">Informacoes</h3>
                    <p className="text-sm text-muted-foreground">Nome simples para a equipe escolher na hora de receber.</p>
                  </div>
                  <label className="flex items-center gap-3 text-sm">
                    <span>Ativa</span>
                    <Switch
                      checked={draft.active}
                      disabled={!canManage}
                      onCheckedChange={(checked) => update({ active: checked })}
                    />
                  </label>
                </div>
                <Input
                  value={draft.name}
                  disabled={!canManage}
                  placeholder="Ex.: Pix, Dinheiro, PicPay"
                  onChange={(event) => update({ name: event.target.value })}
                />
                <div className="grid gap-3 md:grid-cols-2">
                  <Select
                    value={draft.method ?? 'custom'}
                    disabled={!canManage}
                    onValueChange={(value) =>
                      update({ method: value === 'custom' ? null : (value as PaymentMethod) })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      {methodOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    min={0}
                    value={draft.sortOrder}
                    disabled={!canManage}
                    onChange={(event) => update({ sortOrder: Number(event.target.value) || 0 })}
                    placeholder="Ordem"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-4 p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-slate-100">Canais onde aparece</h3>
                    <p className="text-sm text-muted-foreground">Escolha pelo menos um canal.</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={!canManage}
                      onClick={() => update({ channels: channelOptions.map((option) => option.value) })}
                    >
                      Todos
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!canManage}
                      onClick={() => update({ channels: [] })}
                    >
                      Limpar
                    </Button>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {channelOptions.map((option) => {
                    const selected = draft.channels.includes(option.value)

                    return (
                      <button
                        key={option.value}
                        type="button"
                        disabled={!canManage}
                        onClick={() => toggleChannel(option.value)}
                        className={cn(
                          'rounded-2xl border p-4 text-left transition',
                          selected
                            ? 'border-cyan-300/50 bg-cyan-400/10 text-cyan-50'
                            : 'border-white/10 bg-white/[0.04] text-slate-100 hover:border-white/20',
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold">{option.label}</p>
                            <p className="mt-1 text-sm text-muted-foreground">{option.description}</p>
                          </div>
                          {selected ? <Check className="h-5 w-5 text-cyan-200" /> : null}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-4 p-5">
                <h3 className="font-semibold text-slate-100">Recebimento e integracao</h3>
                <div className="grid gap-3">
                  {providerOptions.map((provider) => (
                    <button
                      key={provider.value}
                      type="button"
                      disabled={!canManage}
                      onClick={() =>
                        update({
                          provider: provider.value,
                          externalEnabled: provider.value !== 'manual' ? draft.externalEnabled : false,
                        })
                      }
                      className={cn(
                        'rounded-2xl border p-4 text-left transition',
                        draft.provider === provider.value
                          ? 'border-orange-300/50 bg-orange-400/10'
                          : 'border-white/10 bg-white/[0.04]',
                      )}
                    >
                      <p className="font-semibold text-slate-100">{provider.label}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{provider.description}</p>
                    </button>
                  ))}
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <ToggleRow
                    icon={<ReceiptText className="h-4 w-4" />}
                    label="Exige comprovante"
                    checked={draft.requiresReceipt}
                    disabled={!canManage}
                    onChange={(checked) => update({ requiresReceipt: checked })}
                  />
                  <ToggleRow
                    icon={<Settings2 className="h-4 w-4" />}
                    label="Entra no caixa"
                    checked={draft.autoCashEntry}
                    disabled={!canManage}
                    onChange={(checked) => update({ autoCashEntry: checked })}
                  />
                </div>
                {draft.provider === 'picpay' ? (
                  <p className="rounded-2xl border border-amber-300/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
                    PicPay esta preparado como servico, mas a cobranca por QR Code ainda nao foi ativada.
                  </p>
                ) : null}
              </CardContent>
            </Card>
          </div>

          <aside className="h-fit rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <p className="text-sm font-semibold text-slate-100">Resumo</p>
            <div className="mt-4 space-y-3 text-sm">
              <SummaryLine label="Nome" value={draft.name || 'Sem nome'} />
              <SummaryLine label="Tipo" value={draft.method ? paymentLabelMap[draft.method] : 'Personalizada'} />
              <SummaryLine label="Status" value={draft.active ? 'Ativa' : 'Inativa'} />
              <SummaryLine label="Canais" value={draft.channels.map((channel) => channelLabelMap[channel]).join(', ') || 'Nenhum'} />
              <SummaryLine label="Recebimento" value={providerOptions.find((provider) => provider.value === draft.provider)?.label ?? 'Manual'} />
            </div>
            <div className="mt-5 space-y-2">
              <Button
                className="w-full"
                disabled={!canManage || busy || !canSave}
                onClick={() => onSave({ ...draft, name: draft.name.trim() })}
              >
                {busy ? 'Salvando...' : 'Salvar pagamento'}
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
            </div>
          </aside>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function ToggleRow({
  icon,
  label,
  checked,
  disabled,
  onChange,
}: {
  icon: ReactNode
  label: string
  checked: boolean
  disabled?: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm">
      <span className="flex items-center gap-2 text-slate-100">
        {icon}
        {label}
      </span>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onChange} />
    </label>
  )
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-slate-100">{value}</p>
    </div>
  )
}
