export const queryKeys = {
  auth: {
    me: ['auth', 'me'] as const,
  },
  orders: {
    all: ['orders'] as const,
    list: (filters?: unknown) => ['orders', 'list', filters] as const,
    detail: (orderId: string | null) => ['orders', 'detail', orderId] as const,
    tracking: (orderId: string | null) => ['orders', 'tracking', orderId] as const,
    customers: ['orders', 'customers'] as const,
  },
  kitchen: {
    all: ['kitchen'] as const,
    queue: (filters?: unknown) => ['kitchen', 'queue', filters] as const,
  },
  dining: {
    tables: ['dining', 'tables'] as const,
  },
  catalog: {
    categories: ['catalog', 'categories'] as const,
    products: (filters?: unknown) => ['catalog', 'products', filters] as const,
    promotions: ['catalog', 'promotions'] as const,
    coupons: ['catalog', 'coupons'] as const,
  },
  drivers: {
    list: ['drivers', 'list'] as const,
    detail: (driverId: string | null) => ['drivers', 'detail', driverId] as const,
    locations: ['drivers', 'locations'] as const,
    route: (driverId: string | null) => ['drivers', 'route', driverId] as const,
    routePreview: (driverId: string | null, payload?: unknown) =>
      ['drivers', 'route-preview', driverId, payload] as const,
    dispatchCandidates: (driverId: string | null) =>
      ['drivers', 'dispatch-candidates', driverId] as const,
  },
  waiters: {
    list: ['waiters', 'list'] as const,
    detail: (waiterId: string | null) => ['waiters', 'detail', waiterId] as const,
  },
  cash: {
    current: ['cash', 'current'] as const,
  },
  settings: {
    store: ['settings', 'store'] as const,
  },
  users: {
    list: ['users', 'list'] as const,
  },
  reports: {
    snapshot: (filters?: unknown) => ['reports', 'snapshot', filters] as const,
  },
} as const
