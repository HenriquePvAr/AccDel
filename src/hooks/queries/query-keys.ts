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
  customers: {
    all: ['customers'] as const,
    list: (filters?: unknown) => ['customers', 'list', filters] as const,
    detail: (customerId: string | null) => ['customers', 'detail', customerId] as const,
    metricsSummary: ['customers', 'metrics-summary'] as const,
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
    menuSource: (filters?: unknown) => ['catalog', 'menu-source', filters] as const,
    optionGroups: ['catalog', 'option-groups'] as const,
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
    payments: ['settings', 'payments'] as const,
    deliveryZones: ['settings', 'delivery-zones'] as const,
  },
  users: {
    list: ['users', 'list'] as const,
  },
  reports: {
    snapshot: (filters?: unknown) => ['reports', 'snapshot', filters] as const,
  },
  aiAttendant: {
    overview: ['ai-attendant', 'overview'] as const,
    dashboard: ['ai-attendant', 'dashboard'] as const,
    settings: ['ai-attendant', 'settings'] as const,
    knowledge: ['ai-attendant', 'knowledge'] as const,
    whatsappSession: ['ai-attendant', 'whatsapp-session'] as const,
    whatsappQr: ['ai-attendant', 'whatsapp-qr'] as const,
    whatsappStatus: ['ai-attendant', 'whatsapp-status'] as const,
    whatsappLogs: ['ai-attendant', 'whatsapp-logs'] as const,
    conversations: ['ai-attendant', 'conversations'] as const,
    conversationDetail: (id: string) => ['ai-attendant', 'conversation', id] as const,
    orderDrafts: ['ai-attendant', 'order-drafts'] as const,
  },
} as const
