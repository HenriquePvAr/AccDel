import { Bike, CheckCircle2, Clock3, ClipboardList } from 'lucide-react'

import { cn } from '@/lib/utils'

interface OrderSummaryCardsProps {
  stats: {
    totalOpen: number
    delayed: number
    ready: number
    routing: number
  }
}

const cards = [
  {
    key: 'totalOpen',
    label: 'Em aberto',
    hint: 'Aguardando acao',
    icon: ClipboardList,
    tone: 'blue',
  },
  {
    key: 'delayed',
    label: 'Atrasados',
    hint: 'Requer atencao',
    icon: Clock3,
    tone: 'orange',
  },
  {
    key: 'ready',
    label: 'Prontos',
    hint: 'Aguardando despacho',
    icon: CheckCircle2,
    tone: 'green',
  },
  {
    key: 'routing',
    label: 'Em rota',
    hint: 'Em andamento',
    icon: Bike,
    tone: 'blue',
  },
] as const

const toneClasses = {
  blue: 'bg-blue-500/15 text-blue-300 shadow-blue-500/10',
  orange: 'bg-orange-500/20 text-orange-200 shadow-orange-500/10',
  green: 'bg-emerald-500/15 text-emerald-300 shadow-emerald-500/10',
}

const hintClasses = {
  blue: 'text-blue-300',
  orange: 'text-red-300',
  green: 'text-emerald-300',
}

export function OrderSummaryCards({ stats }: OrderSummaryCardsProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon
        const value = stats[card.key]

        return (
          <article
            key={card.key}
            className="rounded-[20px] border border-white/10 bg-[#0d2137]/76 p-4 shadow-[0_18px_55px_rgba(0,0,0,0.16)] backdrop-blur-xl"
          >
            <div className="flex items-center gap-4">
              <div
                className={cn(
                  'flex h-11 w-11 items-center justify-center rounded-xl shadow-lg',
                  toneClasses[card.tone],
                )}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-slate-300">{card.label}</p>
                <p className="text-2xl font-black leading-tight text-white">{value}</p>
                <p className={cn('mt-1 text-xs font-semibold', hintClasses[card.tone])}>
                  {card.hint}
                </p>
              </div>
            </div>
          </article>
        )
      })}
    </div>
  )
}
