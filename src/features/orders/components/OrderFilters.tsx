import { SlidersHorizontal } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { SearchInput } from '@/components/shared/SearchInput'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { channelLabelMap, paymentLabelMap } from '@/lib/domain'
import { cn } from '@/lib/utils'
import type { OrderChannel, OrderStatus, PaymentMethod } from '@/types'

interface StatusTab {
  value: OrderStatus | 'all'
  label: string
  count: number
}

interface OrderFiltersProps {
  search: string
  source: OrderChannel | 'all'
  status: OrderStatus | 'all'
  paymentMethod: PaymentMethod | 'all'
  delayedOnly: boolean
  tabs: StatusTab[]
  onSearchChange: (value: string) => void
  onSourceChange: (value: OrderChannel | 'all') => void
  onStatusChange: (value: OrderStatus | 'all') => void
  onPaymentMethodChange: (value: PaymentMethod | 'all') => void
  onDelayedOnlyChange: (value: boolean) => void
}

export function OrderFilters({
  search,
  source,
  status,
  paymentMethod,
  delayedOnly,
  tabs,
  onSearchChange,
  onSourceChange,
  onStatusChange,
  onPaymentMethodChange,
  onDelayedOnlyChange,
}: OrderFiltersProps) {
  const [filtersOpen, setFiltersOpen] = useState(false)

  return (
    <section className="rounded-[20px] border border-white/10 bg-[#0a1b2e]/82 p-3 shadow-[0_20px_60px_rgba(0,0,0,0.16)] backdrop-blur-xl sm:p-4">
      <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
        <SearchInput
          value={search}
          onChange={onSearchChange}
          placeholder="Buscar por cliente, telefone ou numero do pedido..."
          inputClassName="h-12 rounded-xl border-white/10 bg-[#071525] pl-10 text-sm text-white placeholder:text-slate-500"
        />
        <Button
          variant="outline"
          className="h-12 rounded-xl border-white/10 bg-[#071525] px-5 text-slate-100 hover:bg-white/[0.08]"
          onClick={() => setFiltersOpen((current) => !current)}
        >
          <SlidersHorizontal className="h-5 w-5" />
          Filtros
        </Button>
      </div>

      {filtersOpen ? (
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <Select value={source} onValueChange={(value) => onSourceChange(value as OrderChannel | 'all')}>
            <SelectTrigger className="border-white/10 bg-[#071525] text-slate-100">
              <SelectValue placeholder="Canal" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os canais</SelectItem>
              {(
                ['delivery', 'dine_in', 'counter', 'pickup', 'digital_menu', 'whatsapp'] as OrderChannel[]
              ).map((entry) => (
                <SelectItem key={entry} value={entry}>
                  {channelLabelMap[entry]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={paymentMethod}
            onValueChange={(value) => onPaymentMethodChange(value as PaymentMethod | 'all')}
          >
            <SelectTrigger className="border-white/10 bg-[#071525] text-slate-100">
              <SelectValue placeholder="Pagamento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os pagamentos</SelectItem>
              {(
                ['pix', 'credit_card', 'debit_card', 'cash', 'meal_voucher', 'payment_link'] as PaymentMethod[]
              ).map((entry) => (
                <SelectItem key={entry} value={entry}>
                  {paymentLabelMap[entry]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <label className="flex h-11 items-center gap-3 rounded-xl border border-white/10 bg-[#071525] px-4 text-sm font-semibold text-slate-200">
            <Switch checked={delayedOnly} onCheckedChange={onDelayedOnlyChange} />
            Somente atrasados
          </label>
        </div>
      ) : null}

      <div className="mt-3 flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            type="button"
            className={cn(
              'flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition',
              status === tab.value
                ? 'border-orange-500/50 bg-orange-500/15 text-orange-300'
                : 'border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06] hover:text-white',
            )}
            onClick={() => onStatusChange(tab.value)}
          >
            {tab.label}
            {tab.value !== 'all' ? (
              <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[11px] text-slate-200">
                {tab.count}
              </span>
            ) : null}
          </button>
        ))}
      </div>
    </section>
  )
}
