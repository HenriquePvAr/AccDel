import type {
  AdminRole,
  OrderChannel,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from '@prisma/client'

import type { UpdateOrderStatusPayload } from '@/contracts/orders.contract'

export interface OrderTransitionContext {
  currentStatus: OrderStatus
  action: UpdateOrderStatusPayload['action']
  source: OrderChannel
  paymentMethod: PaymentMethod
  paymentStatus: PaymentStatus
  assignedDriverId: string | null
  requestedDriverId?: string
  actor: {
    userId: string
    role: AdminRole
  }
  dueAt: Date
}

export class OrderTransitionError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'OrderTransitionError'
  }
}

const actionTarget: Record<UpdateOrderStatusPayload['action'], OrderStatus> = {
  accept: 'in_preparation',
  start_preparation: 'in_preparation',
  ready: 'ready',
  dispatch: 'out_for_delivery',
  complete: 'completed',
  cancel: 'cancelled',
}

export const allowedOrderTransitions: Record<OrderStatus, OrderStatus[]> = {
  in_analysis: ['in_preparation', 'cancelled'],
  in_preparation: ['ready', 'cancelled'],
  ready: ['out_for_delivery', 'completed', 'cancelled'],
  out_for_delivery: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
}

export function resolveOrderTransition(context: OrderTransitionContext) {
  const nextStatus = actionTarget[context.action]

  if (Number.isNaN(context.dueAt.getTime())) {
    throw new OrderTransitionError(
      'INVALID_ORDER_TIMESTAMPS',
      'O pedido possui timestamps invalidos e precisa ser revisado.',
    )
  }

  if (context.actor.role === 'driver') {
    if (context.action !== 'complete') {
      throw new OrderTransitionError(
        'DRIVER_ACTION_FORBIDDEN',
        'O motoboy nao pode executar esta transicao.',
      )
    }

    if (context.assignedDriverId !== context.actor.userId) {
      throw new OrderTransitionError(
        'DRIVER_NOT_ASSIGNED',
        'Somente o motoboy atribuido pode concluir esta entrega.',
      )
    }
  }

  if (
    context.actor.role === 'kitchen' &&
    !['accept', 'start_preparation', 'ready'].includes(context.action)
  ) {
    throw new OrderTransitionError(
      'KITCHEN_ACTION_FORBIDDEN',
      'A cozinha nao pode executar esta transicao.',
    )
  }

  if (context.currentStatus === nextStatus) {
    if (
      nextStatus === 'out_for_delivery' &&
      context.requestedDriverId &&
      context.assignedDriverId !== context.requestedDriverId
    ) {
      throw new OrderTransitionError(
        'DELIVERY_ALREADY_ASSIGNED',
        'A entrega ja foi iniciada com outro motoboy.',
      )
    }

    return { nextStatus, idempotent: true }
  }

  if (!allowedOrderTransitions[context.currentStatus].includes(nextStatus)) {
    throw new OrderTransitionError(
      'INVALID_ORDER_TRANSITION',
      `Transicao de ${context.currentStatus} para ${nextStatus} nao permitida.`,
    )
  }

  if (context.action === 'dispatch') {
    if (context.source !== 'delivery') {
      throw new OrderTransitionError(
        'NON_DELIVERY_DISPATCH',
        'Somente pedidos de delivery podem ser despachados.',
      )
    }

    if (!context.requestedDriverId) {
      throw new OrderTransitionError(
        'DRIVER_REQUIRED',
        'Selecione um motoboy para despachar o pedido.',
      )
    }
  }

  if (context.action === 'complete') {
    if (context.source === 'delivery' && context.currentStatus !== 'out_for_delivery') {
      throw new OrderTransitionError(
        'DELIVERY_NOT_STARTED',
        'A entrega precisa estar em rota antes de ser concluida.',
      )
    }

    if (context.source !== 'delivery' && context.currentStatus !== 'ready') {
      throw new OrderTransitionError(
        'ORDER_NOT_READY',
        'O pedido precisa estar pronto antes de ser concluido.',
      )
    }
  }

  if (
    ['dispatch', 'complete'].includes(context.action) &&
    context.paymentMethod !== 'cash' &&
    context.paymentStatus !== 'paid'
  ) {
    throw new OrderTransitionError(
      'PAYMENT_NOT_CONFIRMED',
      'Confirme o pagamento antes de concluir a operacao.',
    )
  }

  if (
    context.currentStatus === 'out_for_delivery' &&
    context.action === 'cancel' &&
    !['owner', 'manager', 'supervisor'].includes(context.actor.role)
  ) {
    throw new OrderTransitionError(
      'CANCELLATION_REQUIRES_APPROVAL',
      'Cancelar uma entrega em rota exige aprovacao gerencial.',
    )
  }

  return { nextStatus, idempotent: false }
}
