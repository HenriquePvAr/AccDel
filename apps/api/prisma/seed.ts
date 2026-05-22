import { loadEnvFile } from 'node:process'
import { hash } from 'bcryptjs'
import type {
  DriverAvailabilityStatus,
  DriverLocationSource,
  OrderStatus,
  PaymentMethod,
  TableSessionStatus,
  WaiterOperationalStatus,
} from '@prisma/client'
import { PrismaClient } from '@prisma/client'

import { seedCatalog } from './seed-catalog'

loadEnvFile('.env')

const prisma = new PrismaClient()

const storeId = 'store_main'
const defaultPassword = 'Demo@123456'
const channels = ['dine_in', 'delivery', 'digital_menu', 'counter'] as const

async function seed() {
  await prisma.etaSnapshot.deleteMany()
  await prisma.deliveryAssignment.deleteMany()
  await prisma.driverLocation.deleteMany()
  await prisma.cashMovement.deleteMany()
  await prisma.cashRegister.deleteMany()
  await prisma.orderStatusHistory.deleteMany()
  await prisma.orderItem.deleteMany()
  await prisma.order.deleteMany()
  await prisma.tableSessionEvent.deleteMany()
  await prisma.tableSessionItem.deleteMany()
  await prisma.tableSession.deleteMany()
  await prisma.diningTable.deleteMany()
  await prisma.diningArea.deleteMany()
  await prisma.productOptionGroupLink.deleteMany()
  await prisma.productOption.deleteMany()
  await prisma.productOptionGroup.deleteMany()
  await prisma.productChannelAvailability.deleteMany()
  await prisma.product.deleteMany()
  await prisma.category.deleteMany()
  await prisma.customerAddress.deleteMany()
  await prisma.customer.deleteMany()
  await prisma.driverProfile.deleteMany()
  await prisma.waiterHistoryEntry.deleteMany()
  await prisma.waiterProfile.deleteMany()
  await prisma.storeUser.deleteMany()
  await prisma.user.deleteMany()
  await prisma.paymentMethodConfig.deleteMany()
  await prisma.store.deleteMany()

  await prisma.store.create({
    data: {
      id: storeId,
      name: 'Cain Delivery',
      tradeName: 'Cain Burger House',
      timezone: 'America/Manaus',
      city: 'Manaus',
      state: 'AM',
      brandAccent: '#C65D2E',
      latitude: -3.1019,
      longitude: -60.0217,
      autoAcceptEnabled: false,
      estimatedPrepTimeMinutes: 32,
      estimatedDeliveryTimeMinutes: 90,
      estimatedDineInTimeMinutes: 50,
      estimatedCounterTimeMinutes: 20,
      estimatedPickupTimeMinutes: 24,
    },
  })

  await seedPaymentMethodConfigs()

  await createUser({
    id: 'usr_owner',
    name: 'Henrique Araujo',
    email: 'owner@cain.local',
    phone: '+55 92 99990-0001',
    role: 'owner',
  })
  await createUser({
    id: 'usr_manager',
    name: 'Bruna Mota',
    email: 'manager@cain.local',
    phone: '+55 92 99990-0002',
    role: 'manager',
  })
  await createUser({
    id: 'usr_attendant',
    name: 'Lia Costa',
    email: 'attendant@cain.local',
    phone: '+55 92 99211-3300',
    role: 'attendant',
  })
  await createUser({
    id: 'usr_cashier',
    name: 'Raul Souza',
    email: 'cashier@cain.local',
    phone: '+55 92 99110-2200',
    role: 'cashier',
  })
  await createUser({
    id: 'usr_kitchen',
    name: 'Caio Lima',
    email: 'kitchen@cain.local',
    phone: '+55 92 99044-1280',
    role: 'kitchen',
  })
  await createUser({
    id: 'usr_waiter_sara',
    name: 'Sara Vale',
    email: 'waiter@cain.local',
    phone: '+55 92 99901-4400',
    role: 'waiter',
    waiterProfile: {
      active: true,
      status: 'serving',
      totalOrders: 42,
      totalSales: 3940,
      tablesServed: 28,
      cancellations: 2,
      lastActivityAt: new Date(Date.now() - 18 * 60 * 1000),
      history: [
        {
          label: 'Mesa 08 atendida',
          value: 186.4,
          createdAt: new Date(Date.now() - 18 * 60 * 1000),
        },
        {
          label: 'Pedido lancado no salao',
          value: 122.4,
          createdAt: new Date(Date.now() - 44 * 60 * 1000),
        },
      ],
    },
  })
  await createUser({
    id: 'usr_waiter_bruno',
    name: 'Bruno Melo',
    email: 'bruno.waiter@cain.local',
    phone: '+55 92 99141-5510',
    role: 'waiter',
    waiterProfile: {
      active: true,
      status: 'available',
      totalOrders: 31,
      totalSales: 2520,
      tablesServed: 21,
      cancellations: 1,
      lastActivityAt: new Date(Date.now() - 32 * 60 * 1000),
      history: [
        {
          label: 'Mesa 03 fechada',
          value: 164.2,
          createdAt: new Date(Date.now() - 32 * 60 * 1000),
        },
        {
          label: 'Mesa 05 aberta',
          value: 0,
          createdAt: new Date(Date.now() - 58 * 60 * 1000),
        },
      ],
    },
  })
  await createUser({
    id: 'usr_driver_diego',
    name: 'Diego Paz',
    email: 'driver@cain.local',
    phone: '+55 92 99810-1200',
    role: 'driver',
    driverProfile: {
      vehicle: 'Moto',
      active: true,
      availability: 'delivering',
      lastActivityAt: new Date(Date.now() - 6 * 60 * 1000),
    },
  })
  await createUser({
    id: 'usr_driver_ana',
    name: 'Ana Vela',
    email: 'ana.driver@cain.local',
    phone: '+55 92 99600-4400',
    role: 'driver',
    driverProfile: {
      vehicle: 'Moto',
      active: true,
      availability: 'available',
      lastActivityAt: new Date(Date.now() - 10 * 60 * 1000),
    },
  })
  await createUser({
    id: 'usr_driver_igo',
    name: 'Igo Moreira',
    email: 'igo.driver@cain.local',
    phone: '+55 92 99414-1110',
    role: 'driver',
    driverProfile: {
      vehicle: 'Bike',
      active: true,
      availability: 'paused',
      lastActivityAt: new Date(Date.now() - 42 * 60 * 1000),
    },
  })
  await createUser({
    id: 'usr_driver_rafa',
    name: 'Rafa Diniz',
    email: 'rafa.driver@cain.local',
    phone: '+55 92 99222-3131',
    role: 'driver',
    driverProfile: {
      vehicle: 'Moto',
      active: false,
      availability: 'paused',
      lastActivityAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
    },
  })
  await createUser({
    id: 'usr_supervisor',
    name: 'Joao Prado',
    email: 'supervisor@cain.local',
    phone: '+55 92 99001-0055',
    role: 'supervisor',
  })

  await createDriverLocation({
    driverId: 'usr_driver_diego',
    latitude: -3.0971,
    longitude: -60.0235,
    speedKmh: 26,
    heading: 74,
    capturedMinutesAgo: 4,
    source: 'simulator',
  })
  await createDriverLocation({
    driverId: 'usr_driver_ana',
    latitude: -3.1051,
    longitude: -60.0188,
    speedKmh: 0,
    heading: 10,
    capturedMinutesAgo: 8,
    source: 'admin',
  })
  await createDriverLocation({
    driverId: 'usr_driver_igo',
    latitude: -3.1082,
    longitude: -60.0274,
    speedKmh: 0,
    heading: 120,
    capturedMinutesAgo: 40,
    source: 'admin',
  })

  await prisma.customer.create({
    data: {
      id: 'cus_1',
      storeId,
      name: 'Marina Costa',
      phone: '+55 92 99901-1020',
      tags: ['VIP', 'Sem cebola'],
      addresses: {
        create: [
          {
            id: 'addr_1',
            label: 'Casa',
            street: 'Rua Rio Madeira',
            number: '220',
            district: 'Vieiralves',
            city: 'Manaus',
            state: 'AM',
            reference: 'Portao grafite',
            latitude: -3.1028,
            longitude: -60.0207,
          },
        ],
      },
    },
  })

  await prisma.customer.create({
    data: {
      id: 'cus_2',
      storeId,
      name: 'Rafael Nogueira',
      phone: '+55 92 98114-7780',
      tags: ['Recorrente'],
      addresses: {
        create: [
          {
            id: 'addr_2',
            label: 'Apartamento',
            street: 'Av. Djalma Batista',
            number: '1500',
            district: 'Chapada',
            complement: 'Apto 904',
            city: 'Manaus',
            state: 'AM',
            latitude: -3.0948,
            longitude: -60.033,
          },
        ],
      },
    },
  })

  await prisma.customer.create({
    data: {
      id: 'cus_3',
      storeId,
      name: 'Carlos Menezes',
      phone: '+55 92 98800-1220',
      tags: ['Corporativo'],
      addresses: {
        create: [
          {
            id: 'addr_3',
            label: 'Escritorio',
            street: 'Rua Salvador',
            number: '550',
            district: 'Vieiralves',
            city: 'Manaus',
            state: 'AM',
            latitude: -3.0934,
            longitude: -60.0202,
          },
        ],
      },
    },
  })

  await seedCatalog(prisma, storeId, channels)

  await prisma.diningArea.createMany({
    data: [
      {
        id: 'area_hall',
        storeId,
        name: 'Sala principal',
        color: '#C65D2E',
        sortOrder: 1,
      },
      {
        id: 'area_balcony',
        storeId,
        name: 'Varanda',
        color: '#275D63',
        sortOrder: 2,
      },
      {
        id: 'area_lounge',
        storeId,
        name: 'Lounge',
        color: '#1F252B',
        sortOrder: 3,
      },
    ],
  })

  await prisma.diningTable.createMany({
    data: [
      { id: 'table_01', storeId, areaId: 'area_hall', code: '01', capacity: 4, status: 'free' },
      {
        id: 'table_02',
        storeId,
        areaId: 'area_hall',
        code: '02',
        capacity: 4,
        status: 'occupied',
        guests: 2,
        waiterId: 'usr_waiter_sara',
      },
      {
        id: 'table_03',
        storeId,
        areaId: 'area_hall',
        code: '03',
        capacity: 6,
        status: 'reserved',
      },
      {
        id: 'table_04',
        storeId,
        areaId: 'area_balcony',
        code: '04',
        capacity: 4,
        status: 'closing',
        guests: 3,
        waiterId: 'usr_waiter_bruno',
      },
      { id: 'table_05', storeId, areaId: 'area_balcony', code: '05', capacity: 2, status: 'free' },
      {
        id: 'table_06',
        storeId,
        areaId: 'area_balcony',
        code: '06',
        capacity: 4,
        status: 'closed',
      },
      {
        id: 'table_07',
        storeId,
        areaId: 'area_lounge',
        code: '07',
        capacity: 6,
        status: 'occupied',
        guests: 4,
      },
      { id: 'table_08', storeId, areaId: 'area_lounge', code: '08', capacity: 4, status: 'free' },
    ],
  })

  await createTableSession({
    id: 'session_02',
    tableId: 'table_02',
    waiterId: 'usr_waiter_sara',
    guestCount: 2,
    status: 'open',
    items: [
      { productId: 'prod_prime', quantity: 2 },
      { productId: 'prod_fries', quantity: 1 },
    ],
    createdMinutesAgo: 26,
    attachAsCurrent: true,
  })

  await createTableSession({
    id: 'session_04',
    tableId: 'table_04',
    waiterId: 'usr_waiter_bruno',
    guestCount: 3,
    status: 'awaiting_close',
    serviceFee: 8.87,
    items: [
      { productId: 'prod_smash', quantity: 2 },
      { productId: 'prod_fries', quantity: 1 },
    ],
    createdMinutesAgo: 48,
    attachAsCurrent: true,
  })

  await createTableSession({
    id: 'session_06',
    tableId: 'table_06',
    waiterId: 'usr_waiter_bruno',
    guestCount: 2,
    status: 'closed',
    paymentMethod: 'credit_card',
    items: [
      { productId: 'prod_smash', quantity: 1 },
      { productId: 'prod_fries', quantity: 1 },
    ],
    createdMinutesAgo: 90,
    closedMinutesAgo: 40,
  })

  await createTableSession({
    id: 'session_07',
    tableId: 'table_07',
    guestCount: 4,
    status: 'open',
    items: [{ productId: 'prod_duo', quantity: 1 }],
    createdMinutesAgo: 20,
    attachAsCurrent: true,
  })

  await createOrder({
    id: 'ord_1001',
    number: '#1001',
    customerId: 'cus_1',
    customerName: 'Marina Costa',
    customerPhone: '+55 92 99901-1020',
    source: 'delivery',
    paymentMethod: 'pix',
    status: 'in_analysis',
    items: [
      { productId: 'prod_prime', name: 'Madeiro', quantity: 1, unitPrice: 32 },
      { productId: 'prod_fries', name: 'Batata Frita Média', quantity: 1, unitPrice: 25 },
    ],
    addressLabel: 'Casa',
    addressText: 'Rua Rio Madeira, 220 - Vieiralves',
    deliveryLatitude: -3.1028,
    deliveryLongitude: -60.0207,
    tags: ['Delivery', 'Prioritario'],
    createdMinutesAgo: 12,
    estimatedPrepTimeMinutes: 32,
    estimatedDeliveryTimeMinutes: 90,
  })

  await createOrder({
    id: 'ord_1002',
    number: '#1002',
    customerId: 'cus_2',
    customerName: 'Rafael Nogueira',
    customerPhone: '+55 92 98114-7780',
    source: 'delivery',
    paymentMethod: 'credit_card',
    status: 'in_preparation',
    items: [{ productId: 'prod_duo', name: 'Combo X-Salada', quantity: 1, unitPrice: 29.9 }],
    addressLabel: 'Apartamento',
    addressText: 'Av. Djalma Batista, 1500 - Chapada',
    deliveryLatitude: -3.0948,
    deliveryLongitude: -60.033,
    tags: ['Delivery'],
    createdMinutesAgo: 28,
    estimatedPrepTimeMinutes: 32,
    estimatedDeliveryTimeMinutes: 90,
  })

  await createOrder({
    id: 'ord_1003',
    number: '#1003',
    customerId: 'cus_3',
    customerName: 'Carlos Menezes',
    customerPhone: '+55 92 98800-1220',
    source: 'counter',
    paymentMethod: 'debit_card',
    status: 'ready',
    items: [{ productId: 'prod_smash', name: 'Pinguim Tradicional', quantity: 2, unitPrice: 19.9 }],
    tags: ['Balcao'],
    createdMinutesAgo: 36,
    estimatedPrepTimeMinutes: 20,
    estimatedTotalTimeMinutes: 20,
  })

  await createOrder({
    id: 'ord_1004',
    number: '#1004',
    customerId: 'cus_3',
    customerName: 'Carlos Menezes',
    customerPhone: '+55 92 98800-1220',
    source: 'delivery',
    paymentMethod: 'pix',
    status: 'out_for_delivery',
    driverId: 'usr_driver_diego',
    items: [{ productId: 'prod_duo', name: 'Combo X-Salada', quantity: 1, unitPrice: 29.9 }],
    addressLabel: 'Escritorio',
    addressText: 'Rua Salvador, 550 - Vieiralves',
    deliveryLatitude: -3.0934,
    deliveryLongitude: -60.0202,
    tags: ['Em rota'],
    createdMinutesAgo: 54,
    estimatedPrepTimeMinutes: 32,
    estimatedDeliveryTimeMinutes: 90,
  })

  await createOrder({
    id: 'ord_1005',
    number: '#1005',
    customerId: 'cus_1',
    customerName: 'Marina Costa',
    customerPhone: '+55 92 99901-1020',
    source: 'delivery',
    paymentMethod: 'pix',
    status: 'completed',
    driverId: 'usr_driver_ana',
    items: [{ productId: 'prod_smash', name: 'Pinguim Tradicional', quantity: 1, unitPrice: 19.9 }],
    addressLabel: 'Casa',
    addressText: 'Rua Rio Madeira, 220 - Vieiralves',
    deliveryLatitude: -3.1028,
    deliveryLongitude: -60.0207,
    tags: ['Recente'],
    createdMinutesAgo: 130,
    estimatedPrepTimeMinutes: 32,
    estimatedDeliveryTimeMinutes: 90,
  })

  await createDeliveryAssignment({
    id: 'assign_1004_diego',
    orderId: 'ord_1004',
    driverId: 'usr_driver_diego',
    plannedSequence: 1,
    finalSequence: 1,
  })

  await prisma.cashRegister.create({
    data: {
      id: 'cash_today',
      storeId,
      status: 'open',
      operatorName: 'Caixa Principal',
      openingAmount: 200,
      expectedAmount: 512.4,
      countedAmount: 0,
      differenceAmount: 0,
      movements: {
        create: [
          {
            id: 'cash_mov_1',
            type: 'supply',
            method: null,
            amount: 200,
            label: 'Abertura do caixa',
            userName: 'Gerente',
          },
          {
            id: 'cash_mov_2',
            type: 'sale',
            method: 'pix',
            amount: 70.3,
            label: 'Pedido #1001',
            userName: 'Sistema',
          },
          {
            id: 'cash_mov_3',
            type: 'sale',
            method: 'credit_card',
            amount: 79.9,
            label: 'Pedido #1002',
            userName: 'Sistema',
          },
          {
            id: 'cash_mov_4',
            type: 'sale',
            method: 'debit_card',
            amount: 69.8,
            label: 'Pedido #1003',
            userName: 'Sistema',
          },
          {
            id: 'cash_mov_5',
            type: 'withdrawal',
            method: null,
            amount: 35.4,
            label: 'Retirada operacional',
            userName: 'Gerente',
          },
          {
            id: 'cash_mov_6',
            type: 'sale',
            method: 'credit_card',
            amount: 53.8,
            label: 'Mesa 06',
            userName: 'Salao',
          },
        ],
      },
    },
  })
}

async function seedPaymentMethodConfigs() {
  await prisma.paymentMethodConfig.createMany({
    data: [
      {
        id: 'pay_cash',
        storeId,
        name: 'Dinheiro',
        method: 'cash',
        provider: 'manual',
        active: true,
        fixed: true,
        autoCashEntry: true,
        sortOrder: 1,
        channels: ['delivery', 'counter', 'dine_in', 'digital_menu'],
      },
      {
        id: 'pay_credit_card',
        storeId,
        name: 'Cartao de credito',
        method: 'credit_card',
        provider: 'manual',
        active: true,
        fixed: true,
        autoCashEntry: true,
        sortOrder: 2,
        channels: ['delivery', 'counter', 'dine_in', 'digital_menu'],
      },
      {
        id: 'pay_debit_card',
        storeId,
        name: 'Cartao de debito',
        method: 'debit_card',
        provider: 'manual',
        active: true,
        fixed: true,
        autoCashEntry: true,
        sortOrder: 3,
        channels: ['delivery', 'counter', 'dine_in', 'digital_menu'],
      },
      {
        id: 'pay_pix',
        storeId,
        name: 'Pix',
        method: 'pix',
        provider: 'pix',
        active: true,
        fixed: true,
        autoCashEntry: true,
        sortOrder: 4,
        channels: ['delivery', 'counter', 'dine_in', 'digital_menu'],
      },
      {
        id: 'pay_voucher',
        storeId,
        name: 'Voucher',
        method: 'meal_voucher',
        provider: 'manual',
        active: true,
        autoCashEntry: true,
        sortOrder: 5,
        channels: ['counter', 'dine_in'],
      },
      {
        id: 'pay_picpay',
        storeId,
        name: 'PicPay',
        method: 'payment_link',
        provider: 'picpay',
        active: false,
        requiresReceipt: true,
        autoCashEntry: false,
        externalEnabled: false,
        sortOrder: 6,
        channels: ['delivery', 'digital_menu'],
      },
      {
        id: 'pay_other',
        storeId,
        name: 'Outro',
        method: null,
        provider: 'manual',
        active: false,
        autoCashEntry: false,
        sortOrder: 7,
        channels: ['counter', 'dine_in'],
      },
    ],
  })
}

async function createUser(data: {
  id: string
  name: string
  email: string
  phone?: string
  role:
    | 'owner'
    | 'manager'
    | 'attendant'
    | 'cashier'
    | 'kitchen'
    | 'waiter'
    | 'driver'
    | 'supervisor'
  driverProfile?: {
    vehicle: string
    active: boolean
    availability: DriverAvailabilityStatus
    lastActivityAt?: Date
  }
  waiterProfile?: {
    active: boolean
    status: WaiterOperationalStatus
    totalOrders?: number
    totalSales?: number
    tablesServed?: number
    cancellations?: number
    lastActivityAt?: Date
    history?: Array<{
      label: string
      value?: number
      createdAt?: Date
    }>
  }
}) {
  const passwordHash = await hash(defaultPassword, 12)

  await prisma.user.create({
    data: {
      id: data.id,
      name: data.name,
      email: data.email,
      phone: data.phone,
      passwordHash,
      status: 'active',
      stores: {
        create: {
          storeId,
          role: data.role,
          active: true,
          ...(data.driverProfile
            ? {
                driverProfile: {
                  create: data.driverProfile,
                },
              }
            : {}),
          ...(data.waiterProfile
            ? {
                waiterProfile: {
                  create: {
                    active: data.waiterProfile.active,
                    status: data.waiterProfile.status,
                    totalOrders: data.waiterProfile.totalOrders ?? 0,
                    totalSales: data.waiterProfile.totalSales ?? 0,
                    tablesServed: data.waiterProfile.tablesServed ?? 0,
                    cancellations: data.waiterProfile.cancellations ?? 0,
                    lastActivityAt: data.waiterProfile.lastActivityAt,
                    history: data.waiterProfile.history?.length
                      ? {
                          create: data.waiterProfile.history.map((entry) => ({
                            label: entry.label,
                            value: entry.value ?? null,
                            createdAt: entry.createdAt ?? new Date(),
                          })),
                        }
                      : undefined,
                  },
                },
              }
            : {}),
        },
      },
    },
  })
}

async function createTableSession(data: {
  id: string
  tableId: string
  waiterId?: string
  guestCount: number
  status: TableSessionStatus
  items: Array<{
    productId: string
    quantity: number
    notes?: string
  }>
  createdMinutesAgo: number
  closedMinutesAgo?: number
  attachAsCurrent?: boolean
  paymentMethod?: PaymentMethod
  discount?: number
  serviceFee?: number
}) {
  const table = await prisma.diningTable.findUniqueOrThrow({
    where: {
      id: data.tableId,
    },
  })
  const products = await prisma.product.findMany({
    where: {
      id: {
        in: data.items.map((item) => item.productId),
      },
    },
  })
  const openedAt = new Date(Date.now() - data.createdMinutesAgo * 60 * 1000)
  const closedAt =
    data.status === 'closed'
      ? new Date(Date.now() - (data.closedMinutesAgo ?? Math.max(5, data.createdMinutesAgo - 10)) * 60 * 1000)
      : null
  const mappedItems = data.items.map((entry) => {
    const product = products.find((item) => item.id === entry.productId)

    if (!product) {
      throw new Error(`Produto ${entry.productId} nao encontrado para sessao de mesa.`)
    }

    return {
      productId: product.id,
      name: product.name,
      quantity: entry.quantity,
      unitPrice: product.price.toNumber(),
      totalPrice: product.price.toNumber() * entry.quantity,
      notes: entry.notes,
    }
  })
  const subtotal = mappedItems.reduce((sum, item) => sum + item.totalPrice, 0)
  const discount = data.discount ?? 0
  const serviceFee = data.serviceFee ?? 0
  const total = subtotal - discount + serviceFee

  await prisma.tableSession.create({
    data: {
      id: data.id,
      storeId,
      tableId: data.tableId,
      waiterId: data.waiterId,
      guestCount: data.guestCount,
      subtotal,
      discount,
      serviceFee,
      total,
      paymentMethod: data.status === 'closed' ? (data.paymentMethod ?? 'cash') : null,
      status: data.status,
      openedAt,
      closedAt,
      items: {
        create: mappedItems.map((item) => ({
          productId: item.productId,
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
          notes: item.notes,
          createdByName: data.waiterId ? 'Garcom' : 'Operacao',
        })),
      },
      events: {
        create: [
          {
            type: 'opened',
            label: `Mesa ${table.code} aberta`,
            actor: data.waiterId ? 'Garcom' : 'Operacao',
            metadata: {},
            createdAt: openedAt,
          },
          ...(data.waiterId
            ? [
                {
                  type: 'waiter_assigned' as const,
                  label: 'Garcom atribuido a sessao',
                  actor: 'Operacao',
                  metadata: {
                    waiterId: data.waiterId,
                  },
                  createdAt: new Date(openedAt.getTime() + 2 * 60 * 1000),
                },
              ]
            : []),
          ...(data.status === 'awaiting_close'
            ? [
                {
                  type: 'awaiting_close' as const,
                  label: 'Mesa sinalizada para fechamento',
                  actor: 'Caixa',
                  metadata: {},
                  createdAt: new Date(openedAt.getTime() + 12 * 60 * 1000),
                },
              ]
            : []),
          ...(data.status === 'closed' && closedAt
            ? [
                {
                  type: 'closed' as const,
                  label: `Conta fechada em Mesa ${table.code}`,
                  actor: 'Caixa',
                  metadata: {
                    paymentMethod: data.paymentMethod ?? 'cash',
                    total,
                  },
                  createdAt: closedAt,
                },
              ]
            : []),
        ],
      },
    },
  })

  if (data.attachAsCurrent) {
    await prisma.diningTable.update({
      where: {
        id: data.tableId,
      },
      data: {
        currentSessionId: data.id,
        status: data.status === 'awaiting_close' ? 'closing' : 'occupied',
        guests: data.guestCount,
        waiterId: data.waiterId,
      },
    })
  }
}

async function createDriverLocation(data: {
  driverId: string
  latitude: number
  longitude: number
  speedKmh: number
  heading: number
  capturedMinutesAgo: number
  source: DriverLocationSource
}) {
  const membership = await prisma.storeUser.findFirstOrThrow({
    where: {
      storeId,
      userId: data.driverId,
      role: 'driver',
    },
    include: {
      driverProfile: true,
    },
  })

  if (!membership.driverProfile) {
    return
  }

  const capturedAt = new Date(Date.now() - data.capturedMinutesAgo * 60 * 1000)

  await prisma.driverLocation.create({
    data: {
      storeId,
      driverId: data.driverId,
      driverProfileId: membership.driverProfile.id,
      latitude: data.latitude,
      longitude: data.longitude,
      speedKmh: data.speedKmh,
      heading: data.heading,
      accuracyMeters: data.speedKmh > 0 ? 18 : 35,
      capturedAt,
      source: data.source,
      isActive: true,
    },
  })
}

async function createDeliveryAssignment(data: {
  id: string
  orderId: string
  driverId: string
  plannedSequence: number
  finalSequence: number
}) {
  const membership = await prisma.storeUser.findFirstOrThrow({
    where: {
      storeId,
      userId: data.driverId,
      role: 'driver',
    },
  })

  await prisma.deliveryAssignment.create({
    data: {
      id: data.id,
      storeId,
      orderId: data.orderId,
      driverId: data.driverId,
      storeUserId: membership.id,
      plannedSequence: data.plannedSequence,
      finalSequence: data.finalSequence,
      status: 'active',
    },
  })
}

async function createOrder(data: {
  id: string
  number: string
  customerId: string
  customerName: string
  customerPhone: string
  source: 'delivery' | 'counter'
  paymentMethod: 'pix' | 'credit_card' | 'debit_card'
  status: OrderStatus
  driverId?: string
  items: Array<{
    productId: string
    name: string
    quantity: number
    unitPrice: number
  }>
  addressLabel?: string
  addressText?: string
  deliveryLatitude?: number
  deliveryLongitude?: number
  tags: string[]
  createdMinutesAgo: number
  estimatedPrepTimeMinutes: number
  estimatedDeliveryTimeMinutes?: number
  estimatedTotalTimeMinutes?: number
}) {
  const createdAt = new Date(Date.now() - data.createdMinutesAgo * 60 * 1000)
  const subtotal = data.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
  const deliveryFee = data.source === 'delivery' ? 8.5 : 0
  const estimatedTotalTimeMinutes =
    data.estimatedTotalTimeMinutes ??
    data.estimatedPrepTimeMinutes +
      (data.source === 'delivery' ? (data.estimatedDeliveryTimeMinutes ?? 90) : 0)

  await prisma.order.create({
    data: {
      id: data.id,
      storeId,
      number: data.number,
      customerId: data.customerId,
      customerName: data.customerName,
      customerPhone: data.customerPhone,
      source: data.source,
      serviceType: data.source,
      status: data.status,
      paymentMethod: data.paymentMethod,
      paymentStatus: data.paymentMethod === 'cash' ? 'pending' : 'paid',
      subtotal,
      deliveryFee,
      discount: 0,
      total: subtotal + deliveryFee,
      dueAt: new Date(createdAt.getTime() + estimatedTotalTimeMinutes * 60 * 1000),
      estimatedPrepTimeMinutes: data.estimatedPrepTimeMinutes,
      estimatedDeliveryTimeMinutes:
        data.source === 'delivery' ? (data.estimatedDeliveryTimeMinutes ?? 90) : null,
      estimatedTotalTimeMinutes,
      delayed: false,
      priority: data.tags.includes('Prioritario') ? 'priority' : 'normal',
      tags: data.tags,
      addressLabel: data.addressLabel,
      addressText: data.addressText,
      deliveryLatitude: data.deliveryLatitude,
      deliveryLongitude: data.deliveryLongitude,
      driverId: data.driverId,
      createdAt,
      items: {
        create: data.items.map((item) => ({
          productId: item.productId,
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          options: [],
        })),
      },
      history: {
        create: buildHistory(data.id, data.status, createdAt, data.driverId),
      },
    },
  })
}

function buildHistory(
  orderId: string,
  status: OrderStatus,
  createdAt: Date,
  driverId?: string,
) {
  const entries = [
    {
      id: `${orderId}_hist_created`,
      status: 'in_analysis' as const,
      label: 'Pedido criado',
      actor: 'Sistema',
      createdAt,
    },
  ]

  if (status !== 'in_analysis') {
    entries.push({
      id: `${orderId}_hist_current`,
      status,
      label: statusLabel(status),
      actor: driverId ? 'Despacho' : 'Operacao',
      createdAt: new Date(createdAt.getTime() + 3 * 60 * 1000),
    })
  }

  return entries
}

function statusLabel(status: OrderStatus) {
  switch (status) {
    case 'in_preparation':
      return 'Producao iniciada'
    case 'ready':
      return 'Pedido pronto'
    case 'out_for_delivery':
      return 'Saiu para entrega'
    case 'completed':
      return 'Pedido finalizado'
    case 'cancelled':
      return 'Pedido cancelado'
    default:
      return 'Aguardando analise'
  }
}

seed()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (error) => {
    console.error(error)
    await prisma.$disconnect()
    process.exit(1)
  })
