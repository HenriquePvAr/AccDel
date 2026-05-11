import type { Category, Coupon, PreviewCartItem, Product, Promotion } from '@/types'

export const categoriesMock: Category[] = [
  { id: 'cat_burgers', name: 'Burgers', description: 'Linha principal da casa', sortOrder: 1 },
  { id: 'cat_combos', name: 'Combos', description: 'Combinações para share e ticket', sortOrder: 2 },
  { id: 'cat_drinks', name: 'Bebidas', description: 'Refrigerantes e autorais', sortOrder: 3 },
  { id: 'cat_desserts', name: 'Sobremesas', description: 'Fechamento premium', sortOrder: 4 },
]

export const productsMock: Product[] = [
  {
    id: 'prd_1',
    categoryId: 'cat_burgers',
    name: 'Cain Prime',
    description: 'Blend 180g, cheddar inglês, cebola caramelizada e aioli.',
    price: 36.9,
    image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&q=80',
    featured: true,
    active: true,
    preparationStation: 'grill',
    tags: ['Mais vendido', 'Premium'],
    availability: [
      { channel: 'dine_in', available: true, visible: true, soldOut: false },
      { channel: 'delivery', available: true, visible: true, soldOut: false },
      { channel: 'digital_menu', available: true, visible: true, soldOut: false },
      { channel: 'counter', available: true, visible: true, soldOut: false },
    ],
  },
  {
    id: 'prd_2',
    categoryId: 'cat_burgers',
    name: 'Smash da Casa',
    description: 'Duplo smash, queijo prato e molho de picles.',
    price: 28.9,
    image: 'https://images.unsplash.com/photo-1550317138-10000687a72b?auto=format&fit=crop&w=800&q=80',
    featured: false,
    active: true,
    preparationStation: 'grill',
    tags: ['Smash'],
    availability: [
      { channel: 'dine_in', available: true, visible: true, soldOut: false },
      { channel: 'delivery', available: true, visible: true, soldOut: false },
      { channel: 'digital_menu', available: true, visible: true, soldOut: false },
      { channel: 'counter', available: true, visible: true, soldOut: false },
    ],
  },
  {
    id: 'prd_3',
    categoryId: 'cat_combos',
    name: 'Combo Duo',
    description: '2 burgers, 2 fritas trufadas e 2 refris.',
    price: 79.9,
    image: 'https://images.unsplash.com/photo-1512152272829-e3139592d56f?auto=format&fit=crop&w=800&q=80',
    featured: true,
    active: true,
    preparationStation: 'assembly',
    tags: ['Combo'],
    availability: [
      { channel: 'dine_in', available: true, visible: true, soldOut: false },
      { channel: 'delivery', available: true, visible: true, soldOut: false },
      { channel: 'digital_menu', available: true, visible: true, soldOut: false },
      { channel: 'counter', available: true, visible: true, soldOut: false },
    ],
  },
  {
    id: 'prd_4',
    categoryId: 'cat_drinks',
    name: 'Limonada Carbonatada',
    description: 'Limonada artesanal com toque de hortelã.',
    price: 11.5,
    image: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=800&q=80',
    featured: false,
    active: true,
    preparationStation: 'bar',
    tags: ['Assinatura'],
    availability: [
      { channel: 'dine_in', available: true, visible: true, soldOut: false },
      { channel: 'delivery', available: true, visible: true, soldOut: true },
      { channel: 'digital_menu', available: true, visible: true, soldOut: true },
      { channel: 'counter', available: true, visible: true, soldOut: false },
    ],
  },
  {
    id: 'prd_5',
    categoryId: 'cat_desserts',
    name: 'Cookie com gelato',
    description: 'Cookie quente com creme gelado de baunilha.',
    price: 18.9,
    image: 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?auto=format&fit=crop&w=800&q=80',
    featured: true,
    active: true,
    preparationStation: 'dessert',
    tags: ['Sobremesa'],
    availability: [
      { channel: 'dine_in', available: true, visible: true, soldOut: false },
      { channel: 'delivery', available: true, visible: true, soldOut: false },
      { channel: 'digital_menu', available: true, visible: true, soldOut: false },
      { channel: 'counter', available: false, visible: false, soldOut: false },
    ],
  },
]

export const promotionsMock: Promotion[] = [
  {
    id: 'promo_1',
    name: 'Happy Smash',
    label: 'Smash + refri até 18h',
    type: 'happy_hour',
    channel: 'all',
    startsAt: '2026-04-22T15:00:00-04:00',
    endsAt: '2026-04-22T18:00:00-04:00',
    status: 'active',
  },
  {
    id: 'promo_2',
    name: 'Combo Duo em destaque',
    label: '10% no delivery',
    type: 'automatic',
    channel: 'delivery',
    startsAt: '2026-04-22T00:00:00-04:00',
    endsAt: '2026-04-30T23:59:59-04:00',
    status: 'active',
  },
]

export const couponsMock: Coupon[] = [
  {
    id: 'coupon_1',
    code: 'CAIN10',
    type: 'percent',
    value: 10,
    minOrderAmount: 40,
    channel: 'delivery',
    validUntil: '2026-04-30T23:59:59-04:00',
    uses: 42,
    status: 'active',
  },
  {
    id: 'coupon_2',
    code: 'SALAO15',
    type: 'fixed',
    value: 15,
    minOrderAmount: 90,
    channel: 'dine_in',
    validUntil: '2026-05-10T23:59:59-04:00',
    uses: 14,
    status: 'scheduled',
  },
]

export const previewCartMock: PreviewCartItem[] = [
  { id: 'pc_1', productId: 'prd_1', name: 'Cain Prime', quantity: 1, price: 36.9 },
  { id: 'pc_2', productId: 'prd_4', name: 'Limonada Carbonatada', quantity: 2, price: 11.5 },
]
