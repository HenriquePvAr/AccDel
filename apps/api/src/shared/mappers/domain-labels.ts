import type { OrderChannel, OrderStatus } from '@prisma/client'

export const channelLabelMap: Record<OrderChannel, string> = {
  delivery: 'Delivery',
  dine_in: 'Salão',
  counter: 'Balcão',
  pickup: 'Retirada',
  digital_menu: 'Cardápio digital',
  whatsapp: 'WhatsApp',
}

export const statusLabelMap: Record<OrderStatus, string> = {
  in_analysis: 'Aguardando análise',
  in_preparation: 'Produção iniciada',
  ready: 'Pedido pronto',
  out_for_delivery: 'Saiu para entrega',
  completed: 'Pedido finalizado',
  cancelled: 'Pedido cancelado',
}
