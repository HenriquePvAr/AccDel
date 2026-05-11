import type { CashRegister } from '@/types'

export const cashRegisterMock: CashRegister = {
  id: 'cash_1',
  status: 'open',
  openedAt: '2026-04-22T16:00:00-04:00',
  operatorName: 'Raul Souza',
  openingAmount: 300,
  expectedAmount: 2584.9,
  countedAmount: 2584.9,
  differenceAmount: 0,
  entriesByMethod: {
    cash: 420,
    pix: 980.5,
    credit_card: 760.4,
    debit_card: 324,
    meal_voucher: 100,
    payment_link: 0,
  },
  movements: [
    {
      id: 'cm_1',
      type: 'supply',
      method: 'internal',
      amount: 150,
      label: 'Suprimento para troco',
      createdAt: '2026-04-22T16:05:00-04:00',
      userName: 'Raul Souza',
    },
    {
      id: 'cm_2',
      type: 'withdrawal',
      method: 'internal',
      amount: 80,
      label: 'Retirada para fornecedor',
      createdAt: '2026-04-22T17:40:00-04:00',
      userName: 'Raul Souza',
    },
    {
      id: 'cm_3',
      type: 'sale',
      method: 'cash',
      amount: 64.8,
      label: 'Venda balcão #0978',
      createdAt: '2026-04-22T18:20:00-04:00',
      userName: 'Sistema',
    },
  ],
}
