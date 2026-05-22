import type { DiningArea, DiningTable, TableSession } from '@/types'

export const diningAreasMock: DiningArea[] = [
  { id: 'area_hall', name: 'Sala principal', color: '#C65D2E', sortOrder: 1 },
  { id: 'area_balcony', name: 'Varanda', color: '#275D63', sortOrder: 2 },
]

export const tablesMock: DiningTable[] = [
  { id: 'tb_1', code: '01', areaId: 'area_hall', capacity: 2, status: 'free' },
  {
    id: 'tb_2',
    code: '02',
    areaId: 'area_hall',
    areaName: 'Sala principal',
    capacity: 4,
    status: 'occupied',
    guests: 3,
    waiterId: 'usr_waiter_sara',
    waiterName: 'Sara Vale',
    currentSessionId: 'session_2',
  },
  { id: 'tb_3', code: '03', areaId: 'area_hall', capacity: 6, status: 'reserved' },
  { id: 'tb_4', code: '04', areaId: 'area_balcony', capacity: 4, status: 'closing', guests: 4, currentSessionId: 'session_4' },
]

export const tableSessionsMock: TableSession[] = [
  {
    id: 'session_2',
    tableId: 'tb_2',
    tableCode: '02',
    waiterId: 'usr_waiter_sara',
    waiterName: 'Sara Vale',
    openedAt: '2026-04-22T18:10:00-04:00',
    guestCount: 3,
    subtotal: 86.7,
    discount: 0,
    serviceFee: 8.67,
    total: 95.37,
    status: 'open',
    items: [
      { id: 'tsi_1', productId: 'prod_prime', name: 'Cain Prime', quantity: 2, unitPrice: 36.9, totalPrice: 73.8, options: [] },
      { id: 'tsi_2', productId: 'prod_fries', name: 'Batata Rustica', quantity: 1, unitPrice: 12.9, totalPrice: 12.9, options: [] },
    ],
    timeline: [
      { id: 't_1', label: 'Mesa 02 aberta', actor: 'Operacao', at: '2026-04-22T18:10:00-04:00' },
    ],
  },
  {
    id: 'session_4',
    tableId: 'tb_4',
    tableCode: '04',
    waiterId: 'usr_waiter_bruno',
    waiterName: 'Bruno Melo',
    openedAt: '2026-04-22T17:44:00-04:00',
    guestCount: 4,
    subtotal: 142.7,
    discount: 12,
    serviceFee: 13.07,
    total: 143.77,
    status: 'awaiting_close',
    notes: 'Cliente pediu dividir em 2 cartoes.',
    items: [
      { id: 'tsi_4', productId: 'prod_duo', name: 'Combo Duo', quantity: 1, unitPrice: 79.9, totalPrice: 79.9, options: [] },
    ],
    timeline: [
      { id: 't_2', label: 'Mesa 04 aberta', actor: 'Operacao', at: '2026-04-22T17:44:00-04:00' },
      { id: 't_3', label: 'Mesa sinalizada para fechamento', actor: 'Caixa', at: '2026-04-22T18:30:00-04:00' },
    ],
  },
]
