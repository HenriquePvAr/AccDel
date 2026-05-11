import type { ReportsSnapshot } from '@/types'

export const reportsSnapshotMock: ReportsSnapshot = {
  metrics: [
    {
      id: 'm_1',
      label: 'Faturamento bruto',
      value: 'R$ 12.480',
      trendLabel: '+8% vs ontem',
      trendDirection: 'up',
    },
    {
      id: 'm_2',
      label: 'Pedidos hoje',
      value: '184',
      trendLabel: '+11 pedidos',
      trendDirection: 'up',
    },
    {
      id: 'm_3',
      label: 'Ticket medio',
      value: 'R$ 67',
      trendLabel: '+3% estabilidade',
      trendDirection: 'up',
    },
    {
      id: 'm_4',
      label: 'Tempo medio entrega',
      value: '29 min',
      trendLabel: '-2 min',
      trendDirection: 'up',
    },
  ],
  revenueSeries: [
    { label: '15h', revenue: 980, orders: 14, averageTicket: 70 },
    { label: '16h', revenue: 1350, orders: 19, averageTicket: 71 },
    { label: '17h', revenue: 2140, orders: 28, averageTicket: 76 },
    { label: '18h', revenue: 2890, orders: 39, averageTicket: 74 },
    { label: '19h', revenue: 3210, orders: 44, averageTicket: 73 },
    { label: '20h', revenue: 1910, orders: 27, averageTicket: 70 },
  ],
  byChannel: [
    { label: 'Delivery', revenue: 6450, orders: 88 },
    { label: 'Salao', revenue: 3320, orders: 41 },
    { label: 'Balcao', revenue: 1710, orders: 36 },
    { label: 'Cardapio digital', revenue: 1000, orders: 19 },
  ],
  byPayment: [
    { label: 'Pix', revenue: 5210, orders: 72 },
    { label: 'Credito', revenue: 3880, orders: 51 },
    { label: 'Dinheiro', revenue: 1900, orders: 33 },
  ],
  ordersByStatus: [
    { id: 'completed', label: 'Finalizado', orders: 154 },
    { id: 'out_for_delivery', label: 'Em rota', orders: 9 },
    { id: 'in_preparation', label: 'Em preparo', orders: 15 },
    { id: 'cancelled', label: 'Cancelado', orders: 6 },
  ],
  topProducts: [
    { id: 'rp_1', label: 'Cain Prime', revenue: 2840, orders: 77, share: 23 },
    { id: 'rp_2', label: 'Combo Duo', revenue: 2120, orders: 26, share: 17 },
    { id: 'rp_3', label: 'Smash da Casa', revenue: 1560, orders: 54, share: 13 },
  ],
  topCategories: [
    { id: 'rc_1', label: 'Burgers', revenue: 5410, orders: 108, share: 43 },
    { id: 'rc_2', label: 'Combos', revenue: 2620, orders: 31, share: 21 },
    { id: 'rc_3', label: 'Bebidas', revenue: 1320, orders: 84, share: 11 },
  ],
  cancellations: [
    {
      id: 'cr_1',
      orderNumber: '#1044',
      customerName: 'Elisa Ramos',
      note: 'Endereco fora da area',
      value: 180,
    },
    {
      id: 'cr_2',
      orderNumber: '#1040',
      customerName: 'Marcos Lima',
      note: 'Item indisponivel',
      value: 140,
    },
  ],
  driverSummaries: [
    {
      id: 'drv_1',
      name: 'Jean Freitas',
      primary: '36 concluidas',
      secondary: '2 em andamento',
      value: 2180,
    },
    {
      id: 'drv_2',
      name: 'Camila Rosa',
      primary: '28 concluidas',
      secondary: '1 em andamento',
      value: 1640,
    },
  ],
  waiterSummaries: [
    {
      id: 'wtr_1',
      name: 'Sara Vale',
      primary: '42 pedidos',
      secondary: '28 mesas',
      value: 3940,
    },
    {
      id: 'wtr_2',
      name: 'Bruno Melo',
      primary: '31 pedidos',
      secondary: '21 mesas',
      value: 2520,
    },
  ],
  tablesSummary: {
    free: 8,
    occupied: 11,
    reserved: 3,
    closing: 2,
    openSessions: 11,
    closedSessions: 18,
    diningRevenue: 3320,
  },
}
