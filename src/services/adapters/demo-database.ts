import {
  cashRegisterMock,
  categoriesMock,
  couponsMock,
  customersMock,
  diningAreasMock,
  driverLocationsMock,
  driversMock,
  ordersMock,
  productsMock,
  promotionsMock,
  reportsSnapshotMock,
  storeMock,
  tableSessionsMock,
  tablesMock,
} from '@/mocks'
import { readStorage, writeStorage } from '@/lib/storage'
import type {
  CashRegister,
  Category,
  Coupon,
  Customer,
  DiningArea,
  DiningTable,
  Driver,
  DriverLocation,
  Order,
  Product,
  Promotion,
  ReportsSnapshot,
  StoreProfile,
  TableSession,
} from '@/types'

export interface DemoDatabase {
  store: StoreProfile
  customers: Customer[]
  orders: Order[]
  dining: {
    areas: DiningArea[]
    tables: DiningTable[]
    sessions: TableSession[]
  }
  catalog: {
    categories: Category[]
    products: Product[]
    promotions: Promotion[]
    coupons: Coupon[]
  }
  drivers: {
    drivers: Driver[]
    locations: DriverLocation[]
  }
  cash: {
    currentRegister: CashRegister
  }
  reports: ReportsSnapshot
}

const STORAGE_KEY = 'cain-delivery-admin-demo-db'

const initialDatabase: DemoDatabase = {
  store: structuredClone(storeMock),
  customers: structuredClone(customersMock),
  orders: structuredClone(ordersMock),
  dining: {
    areas: structuredClone(diningAreasMock),
    tables: structuredClone(tablesMock),
    sessions: structuredClone(tableSessionsMock),
  },
  catalog: {
    categories: structuredClone(categoriesMock),
    products: structuredClone(productsMock),
    promotions: structuredClone(promotionsMock),
    coupons: structuredClone(couponsMock),
  },
  drivers: {
    drivers: structuredClone(driversMock),
    locations: structuredClone(driverLocationsMock),
  },
  cash: {
    currentRegister: structuredClone(cashRegisterMock),
  },
  reports: structuredClone(reportsSnapshotMock),
}

export function getDemoDatabase(): DemoDatabase {
  const stored = readStorage<DemoDatabase>(STORAGE_KEY)

  if (stored) {
    return stored
  }

  writeStorage(STORAGE_KEY, initialDatabase)
  return structuredClone(initialDatabase)
}

export function saveDemoDatabase(database: DemoDatabase) {
  writeStorage(STORAGE_KEY, database)
  return database
}

export function mutateDemoDatabase(mutator: (database: DemoDatabase) => DemoDatabase) {
  const current = getDemoDatabase()
  const next = mutator(structuredClone(current))
  return saveDemoDatabase(next)
}

export function getNextOrderNumber(orders: Order[]) {
  const max = orders.reduce((highest, order) => {
    const value = Number(order.number.replace('#', ''))
    return Number.isFinite(value) ? Math.max(highest, value) : highest
  }, 1000)

  return `#${max + 1}`
}
