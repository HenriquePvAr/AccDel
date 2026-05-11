import { Flame, Pencil, Power } from 'lucide-react'

import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { formatCurrency } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Product, ProductChannel } from '@/types'

interface ProductCardProps {
  product: Product
  onEdit: (productId: string) => void
  onToggleSoldOut: (productId: string) => void
  onToggleActive: (productId: string) => void
  onToggleChannelAvailability: (
    productId: string,
    channel: ProductChannel,
    available: boolean,
  ) => void
  canManage?: boolean
}

export function ProductCard({
  product,
  onEdit,
  onToggleSoldOut,
  onToggleActive,
  onToggleChannelAvailability,
  canManage = true,
}: ProductCardProps) {
  const deliveryChannel = product.availability.find((entry) => entry.channel === 'delivery')

  return (
    <Card className="overflow-hidden text-slate-100">
      <div className="relative aspect-[16/10] overflow-hidden">
        <img
          src={product.image}
          alt={product.name}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(4,11,21,0.05),rgba(4,11,21,0.72))]" />
        <div className="absolute left-4 top-4 flex flex-wrap gap-2">
          {product.featured ? <StatusBadge channel="digital_menu" /> : null}
          {!product.active ? (
            <span className="rounded-full bg-red-500/15 px-2.5 py-1 text-[11px] font-bold text-red-200 ring-1 ring-red-400/20">
              Inativo
            </span>
          ) : null}
        </div>
        <div className="absolute inset-x-4 bottom-4 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-orange-200/90">
              {product.preparationStation}
            </p>
            <h3 className="truncate text-lg font-black text-white">{product.name}</h3>
          </div>
          <div className="rounded-2xl border border-white/10 bg-[#081423]/80 px-3 py-2 text-right shadow-[0_12px_28px_rgba(0,0,0,0.24)] backdrop-blur-md">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
              Preco
            </p>
            <p className="font-mono text-base font-black text-white">
              {formatCurrency(product.price)}
            </p>
          </div>
        </div>
      </div>
      <div className="space-y-4 p-4">
        <p className="line-clamp-2 text-sm leading-6 text-slate-400">{product.description}</p>

        <div className="flex flex-wrap gap-2">
          {product.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-semibold text-slate-300"
            >
              {tag}
            </span>
          ))}
        </div>

        <div className="rounded-[22px] border border-white/10 bg-[#081523]/78 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
              Canais
            </span>
            <span className="font-mono text-sm font-black text-white">
              {formatCurrency(product.price)}
            </span>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            {product.availability.map((entry) => (
              <button
                key={entry.channel}
                type="button"
                disabled={!canManage}
                onClick={() =>
                  onToggleChannelAvailability(product.id, entry.channel, !entry.available)
                }
                className={cn(
                  'rounded-2xl px-3 py-2 text-left transition disabled:cursor-not-allowed disabled:opacity-70',
                  entry.available && !entry.soldOut
                    ? 'border border-white/10 bg-white/[0.04] text-slate-100 hover:border-white/16 hover:bg-white/[0.07]'
                    : 'border border-amber-300/18 bg-amber-300/8 text-amber-200 hover:bg-amber-300/14',
                )}
              >
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                  {entry.channel}
                </p>
                <p className="mt-1 text-sm font-semibold">
                  {entry.soldOut ? 'Esgotado' : entry.available ? 'Disponivel' : 'Oculto'}
                </p>
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <Button
            variant="secondary"
            className="w-full"
            disabled={!canManage}
            onClick={() => onEdit(product.id)}
          >
            <Pencil className="h-4 w-4" />
            Editar
          </Button>
          <Button
            variant={deliveryChannel?.soldOut ? 'default' : 'outline'}
            className="w-full"
            disabled={!canManage}
            onClick={() => onToggleSoldOut(product.id)}
          >
            <Flame className="h-4 w-4" />
            {deliveryChannel?.soldOut ? 'Reativar' : 'Esgotar'}
          </Button>
          <Button
            variant="outline"
            className="w-full sm:col-span-2"
            disabled={!canManage}
            onClick={() => onToggleActive(product.id)}
          >
            <Power className="h-4 w-4" />
            {product.active ? 'Desativar produto' : 'Ativar produto'}
          </Button>
        </div>
      </div>
    </Card>
  )
}
