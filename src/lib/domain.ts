import type {
  DriverAvailabilityStatus,
  OrderChannel,
  OrderStatus,
  PaymentMethod,
  ProductChannel,
  TableStatus,
  UserRole,
} from '@/types'

export const orderStatusMeta: Record<OrderStatus, { label: string; color: string }> = {
  in_analysis: { label: 'Novos', color: 'analysis' },
  in_preparation: { label: 'Em preparo', color: 'preparation' },
  ready: { label: 'Prontos', color: 'ready' },
  out_for_delivery: { label: 'Em rota', color: 'route' },
  completed: { label: 'Finalizado', color: 'finished' },
  cancelled: { label: 'Cancelado', color: 'danger' },
}

export const channelLabelMap: Record<OrderChannel | ProductChannel, string> = {
  delivery: 'Delivery',
  dine_in: 'Salão',
  counter: 'Balcão',
  pickup: 'Retirada',
  digital_menu: 'Cardápio digital',
  whatsapp: 'WhatsApp',
}

export const paymentLabelMap: Record<PaymentMethod, string> = {
  pix: 'Pix',
  credit_card: 'Crédito',
  debit_card: 'Débito',
  cash: 'Dinheiro',
  meal_voucher: 'Voucher',
  payment_link: 'Link',
}

export const tableStatusMeta: Record<TableStatus, { label: string; color: string }> = {
  free: { label: 'Livre', color: 'success' },
  occupied: { label: 'Ocupada', color: 'route' },
  reserved: { label: 'Reservada', color: 'warning' },
  closing: { label: 'Aguardando fechamento', color: 'analysis' },
  closed: { label: 'Conta fechada', color: 'finished' },
}

export const driverAvailabilityMeta: Record<
  DriverAvailabilityStatus,
  { label: string; color: string }
> = {
  available: { label: 'Disponível', color: 'success' },
  delivering: { label: 'Em entrega', color: 'route' },
  paused: { label: 'Pausado', color: 'warning' },
}

export const roleLabelMap: Record<UserRole, string> = {
  owner: 'Dono',
  manager: 'Gerente',
  attendant: 'Atendente',
  cashier: 'Caixa',
  kitchen: 'Cozinha',
  waiter: 'Garcom',
  driver: 'Motoboy',
  supervisor: 'Supervisor',
}
