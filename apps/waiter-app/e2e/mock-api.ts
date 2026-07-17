import type { Page, Route } from '@playwright/test'

interface MockOptions {
  occupied?: boolean
  ready?: boolean
  sendFailure?: 'unavailable' | 'conflict'
}

export async function installMockApi(page: Page, options: MockOptions = {}) {
  let table = buildTable(options.occupied ?? false)
  let session = options.occupied ? buildSession(options.ready ?? false) : null
  let lastSendItems: unknown[] = []

  await page.route('**/auth/**', async (route) => {
    if (route.request().url().endsWith('/auth/login')) {
      await json(route, { data: { accessToken: ['e2e', 'not-a-secret'].join('.'), user: sessionUser } })
      return
    }
    await json(route, { data: sessionUser })
  })

  await page.route('**/waiter/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname

    if (path === '/waiter/stream') {
      await route.fulfill({ status: 200, contentType: 'text/event-stream', body: 'event: ping\ndata: {}\n\n' })
      return
    }
    if (path === '/waiter/menu') {
      await json(route, { data: menu })
      return
    }
    if (path === '/waiter/profile') {
      await json(route, { data: profile })
      return
    }
    if (path === '/waiter/tables' && request.method() === 'GET') {
      await json(route, room(table, session))
      return
    }
    if (path === '/waiter/tables/table-01' && request.method() === 'GET') {
      await json(route, { data: { table, session } })
      return
    }
    if (path === '/waiter/tables/table-01/sessions' && request.method() === 'POST') {
      table = { ...table, status: 'occupied', currentSessionId: 'session-01', guests: 2, waiterId: 'waiter-01', waiterName: 'Ana', version: table.version + 1 }
      session = buildSession(false)
      await json(route, { data: session })
      return
    }
    if (path === '/waiter/sessions/session-01/items' && request.method() === 'POST') {
      const body = request.postDataJSON() as { items: unknown[] }
      lastSendItems = body.items
      if (options.sendFailure === 'unavailable') {
        await json(route, { error: { message: 'Um ou mais produtos estão indisponíveis para o salão.' } }, 404)
        return
      }
      if (options.sendFailure === 'conflict') {
        if (session) session = { ...session, version: session.version + 1 }
        await json(route, { error: { message: 'A comanda mudou em outro dispositivo.' } }, 409)
        return
      }
      if (session) {
        session = { ...session, version: session.version + 1, items: [...session.items, sentItem], subtotal: session.subtotal + 28, total: session.total + 28 }
      }
      await json(route, { data: session })
      return
    }
    if (path === '/waiter/sessions/session-01/request-close' && request.method() === 'POST') {
      if (session) session = { ...session, version: session.version + 1, status: 'awaiting_close' }
      table = { ...table, status: 'closing', version: table.version + 1 }
      await json(route, { data: session })
      return
    }
    if (path.includes('/deliver') && request.method() === 'POST') {
      if (session) session = { ...session, version: session.version + 1, items: session.items.map((item) => ({ ...item, deliveredAt: new Date().toISOString(), productionStatus: 'completed' })) }
      await json(route, { data: { table, session } })
      return
    }
    await json(route, { error: { message: `Mock sem rota para ${path}` } }, 404)
  })

  return { getLastSendItems: () => lastSendItems }
}

export async function login(page: Page) {
  await page.goto('/login')
  await page.getByLabel('E-mail').fill('garcom@cain.test')
  await page.getByLabel('Senha', { exact: true }).fill('senha-segura')
  await page.getByRole('button', { name: 'Entrar no salão' }).click()
  await page.getByRole('heading', { name: 'Mesas' }).waitFor()
}

export async function openTable(page: Page) {
  await page.getByRole('link', { name: /Mesa 01/ }).click()
  await page.getByRole('button', { name: 'Abrir para 2 pessoas' }).click()
  await page.getByRole('button', { name: 'Adicionar produtos' }).waitFor()
}

export async function addSimpleProduct(page: Page) {
  await page.getByRole('button', { name: 'Adicionar produtos' }).click()
  await page.getByRole('button', { name: /Burger Cain/ }).click()
  await page.getByRole('button', { name: 'Voltar para comanda' }).click()
}

const sessionUser = {
  id: 'waiter-01', name: 'Ana Souza', email: 'garcom@cain.test', role: 'waiter', initials: 'AS', permissions: ['waiter:tables:view'],
  store: { id: 'store-test', name: 'Cain Teste', tradeName: 'Cain Teste' },
}

const profile = {
  id: 'waiter-01', name: 'Ana Souza', email: 'garcom@cain.test', role: 'waiter', operationalStatus: 'serving', tablesServed: 42, totalOrders: 128,
  store: { id: 'store-test', name: 'Cain Teste', tradeName: 'Cain Teste' },
}

function buildTable(occupied: boolean) {
  return { id: 'table-01', code: '01', areaId: 'area-main', areaName: 'Salão principal', capacity: 4, status: occupied ? 'occupied' : 'free', version: 1, ...(occupied ? { currentSessionId: 'session-01', guests: 2, waiterId: 'waiter-01', waiterName: 'Ana Souza' } : {}) }
}

function buildSession(ready: boolean) {
  return {
    id: 'session-01', tableId: 'table-01', tableCode: '01', waiterId: 'waiter-01', waiterName: 'Ana Souza', openedAt: new Date(Date.now() - 18 * 60_000).toISOString(), guestCount: 2,
    subtotal: ready ? 28 : 0, discount: 0, serviceFee: 0, total: ready ? 28 : 0, status: 'open', version: 1,
    items: ready ? [{ ...sentItem, productionStatus: 'ready' }] : [], timeline: [],
  }
}

const sentItem = {
  id: 'item-01', productId: 'burger', name: 'Burger Cain', quantity: 1, unitPrice: 28, totalPrice: 28, notes: 'Sem cebola', options: [], createdAt: new Date().toISOString(),
  productionOrderId: 'order-01', productionOrderNumber: '#1042', productionStatus: 'in_preparation', printStatus: 'confirmed',
}

function room(primaryTable: ReturnType<typeof buildTable>, currentSession: ReturnType<typeof buildSession> | null) {
  const extra = Array.from({ length: 11 }, (_, index) => ({ id: `table-${index + 2}`, code: String(index + 2).padStart(2, '0'), areaId: index > 6 ? 'area-deck' : 'area-main', areaName: index > 6 ? 'Deck' : 'Salão principal', capacity: 4, status: index % 3 === 0 ? 'occupied' : 'free', version: 1, ...(index % 3 === 0 ? { currentSessionId: `session-${index + 2}`, guests: 3, waiterName: 'João' } : {}) }))
  return { data: { areas: [{ id: 'area-main', name: 'Salão principal', color: '#7538d8', sortOrder: 1 }, { id: 'area-deck', name: 'Deck', color: '#087f67', sortOrder: 2 }], tables: [primaryTable, ...extra], sessions: currentSession ? [currentSession] : [] } }
}

const menu = {
  generatedAt: new Date().toISOString(), store: { id: 'store-test', name: 'Cain Teste' },
  categories: [
    { id: 'burgers', name: 'Burguers', description: '', sortOrder: 1, available: true, products: [
      { id: 'burger', categoryId: 'burgers', name: 'Burger Cain', description: 'Pão brioche, carne e queijo', price: 28, featured: true, orderable: true, optionGroups: [] },
      { id: 'combo', categoryId: 'burgers', name: 'Combo da Casa', description: 'Burger, acompanhamento e bebida', price: 42, featured: true, orderable: true, optionGroups: [{ id: 'side', name: 'Acompanhamento', required: true, minSelections: 1, maxSelections: 1, options: [{ id: 'fries', name: 'Batata frita', priceDelta: 0, orderable: true }, { id: 'salad', name: 'Salada', priceDelta: 2, orderable: true }] }] },
      { id: 'shake', categoryId: 'burgers', name: 'Milkshake', description: 'Chocolate', price: 18, featured: false, orderable: false, unavailableReason: 'Esgotado', optionGroups: [] },
    ] },
    { id: 'drinks', name: 'Bebidas', description: '', sortOrder: 2, available: true, products: [{ id: 'water', categoryId: 'drinks', name: 'Água com gás', description: '350 ml', price: 7, featured: false, orderable: true, optionGroups: [] }] },
  ],
}

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
}
