import type { PaymentStatus } from '@prisma/client'

export const allowedPaymentTransitions: Record<PaymentStatus, PaymentStatus[]> = {
  pending: ['paid', 'failed', 'cancelled'],
  failed: ['paid', 'cancelled'],
  paid: ['refunded'],
  cancelled: [],
  refunded: [],
}

export function canTransitionPayment(current: PaymentStatus, requested: PaymentStatus) {
  return current === requested || allowedPaymentTransitions[current].includes(requested)
}
