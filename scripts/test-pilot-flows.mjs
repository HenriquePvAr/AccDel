import { randomBytes } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const MARKER = 'PILOT_DEMO_DATA'
const apiUrl = new URL(process.env.PILOT_API_URL ?? 'http://127.0.0.1:3333')
const credentialsPath = resolve(
  process.env.PILOT_CREDENTIALS_FILE ?? '.pilot/validation-seed-credentials.txt',
)

assert(
  ['127.0.0.1', 'localhost'].includes(apiUrl.hostname),
  'O teste integrado aceita somente uma API local.',
)

const credentials = await readFile(credentialsPath, 'utf8')
assert(credentials.includes(MARKER), 'O arquivo de credenciais nao pertence ao seed piloto.')
const password = credentials.match(/^Senha compartilhada do piloto:\s*(.+)$/m)?.[1]?.trim()
assert(password && password.length >= 20, 'Senha piloto ausente ou invalida.')

const runId = `${Date.now().toString(36)}-${randomBytes(4).toString('hex')}`
let correlationSequence = 0

const actors = Object.fromEntries(
  await Promise.all(
    [
      ['manager', 'pilot.manager@cain.invalid'],
      ['cashier', 'pilot.cashier@cain.invalid'],
      ['kitchen', 'pilot.kitchen@cain.invalid'],
      ['waiter1', 'pilot.waiter1@cain.invalid'],
      ['waiter2', 'pilot.waiter2@cain.invalid'],
      ['driver1', 'pilot.driver1@cain.invalid'],
      ['driver2', 'pilot.driver2@cain.invalid'],
    ].map(async ([role, email]) => [role, await login(email)]),
  ),
)

await request('/ready', { expectedStatuses: [401] })
await request('/auth/me', {
  token: 'token-piloto-invalido',
  expectedStatuses: [401],
})

const restaurant = await runRestaurantFlow()
const delivery = await runDeliveryFlow()
const readiness = await request('/ready', { token: actors.manager.token })

assert(readiness.json.status === 'ready', 'A prontidao final nao retornou ready.')
assert(readiness.json.queues?.printing?.pending === 0, 'Restaram impressoes pendentes.')
assert(readiness.json.queues?.printing?.failed === 0, 'Existem impressoes falhas.')
assert(
  readiness.json.integrations?.whatsapp?.provider === 'disabled' &&
    readiness.json.integrations?.whatsapp?.enabled === false,
  'WhatsApp nao esta desativado.',
)
assert(
  readiness.json.integrations?.ai?.provider === 'disabled' &&
    readiness.json.integrations?.ai?.enabled === false,
  'IA nao esta desativada.',
)

console.log(
  JSON.stringify(
    {
      event: 'pilot_integrated_flows_passed',
      marker: MARKER,
      restaurant,
      delivery,
      readiness: {
        status: readiness.json.status,
        migrations: readiness.json.migrations,
        printing: readiness.json.queues?.printing,
        printAgents: readiness.json.printingAgents,
        realtime: readiness.json.metrics?.realtime,
        integrations: readiness.json.integrations,
      },
    },
    null,
    2,
  ),
)

async function runRestaurantFlow() {
  const bootstrap = await request('/waiter/bootstrap', { token: actors.waiter1.token })
  const freeTable = bootstrap.json.data.room.tables.find((table) => table.status === 'free')
  assert(freeTable, 'Nenhuma mesa ficticia livre para o fluxo integrado.')

  const products = bootstrap.json.data.menu.categories.flatMap((category) => category.products)
  const configurable = products.find(
    (product) =>
      product.orderable &&
      product.optionGroups.some((group) => group.options.some((option) => option.orderable)),
  )
  const unavailable = products.find((product) => !product.orderable)
  assert(configurable, 'Produto ficticio configuravel nao encontrado.')
  assert(unavailable, 'Produto ficticio indisponivel nao encontrado.')
  const group = configurable.optionGroups.find((entry) =>
    entry.options.some((option) => option.orderable),
  )
  const option = group.options.find((entry) => entry.orderable)

  const opened = await request(`/waiter/tables/${freeTable.id}/sessions`, {
    method: 'POST',
    token: actors.waiter1.token,
    idempotencyKey: key('restaurant-open'),
    body: { guestCount: 3, expectedTableVersion: freeTable.version },
    expectedStatuses: [201],
  })
  let session = opened.json.data

  const initialBody = {
    expectedVersion: session.version,
    items: [
      { productId: configurable.id, quantity: 1, options: [] },
      {
        productId: configurable.id,
        quantity: 1,
        options: [{ groupId: group.id, optionId: option.id, quantity: 1 }],
      },
    ],
  }
  const initialKey = key('restaurant-initial')
  const initial = await request(`/waiter/sessions/${session.id}/items`, {
    method: 'POST',
    token: actors.waiter1.token,
    idempotencyKey: initialKey,
    body: initialBody,
    expectedStatuses: [201],
  })
  session = initial.json.data

  const replay = await request(`/waiter/sessions/${session.id}/items`, {
    method: 'POST',
    token: actors.waiter1.token,
    idempotencyKey: initialKey,
    body: initialBody,
    expectedStatuses: [201],
  })
  assert(replay.json.data.id === session.id, 'Replay idempotente retornou outra sessao.')
  assert(replay.json.data.items.length === 2, 'Replay idempotente duplicou itens.')

  const basePrice = configurable.price
  assert(session.items[0].unitPrice === basePrice, 'O preco simples nao veio do backend.')
  assert(
    session.items[1].unitPrice === basePrice + option.priceDelta,
    'O adicional nao foi precificado pelo backend.',
  )

  await request(`/waiter/sessions/${session.id}/items`, {
    method: 'POST',
    token: actors.waiter1.token,
    idempotencyKey: key('restaurant-unavailable'),
    body: {
      expectedVersion: session.version,
      items: [{ productId: unavailable.id, quantity: 1, options: [] }],
    },
    expectedStatuses: [404],
  })
  await request(`/waiter/sessions/${session.id}/items`, {
    method: 'POST',
    token: actors.waiter2.token,
    idempotencyKey: key('restaurant-ownership'),
    body: {
      expectedVersion: session.version,
      items: [{ productId: configurable.id, quantity: 1, options: [] }],
    },
    expectedStatuses: [403],
  })

  const additionPath = `/waiter/sessions/${session.id}/items`
  const concurrentBodies = [
    {
      expectedVersion: session.version,
      items: [{ productId: configurable.id, quantity: 1, options: [] }],
    },
    {
      expectedVersion: session.version,
      items: [
        {
          productId: configurable.id,
          quantity: 1,
          options: [{ groupId: group.id, optionId: option.id, quantity: 1 }],
        },
      ],
    },
  ]
  const concurrent = await Promise.all(
    concurrentBodies.map((body, index) =>
      request(additionPath, {
        method: 'POST',
        token: actors.waiter1.token,
        idempotencyKey: key(`restaurant-device-${index + 1}`),
        body,
        expectedStatuses: [201, 409],
      }),
    ),
  )
  assert(
    concurrent.filter((result) => result.status === 201).length === 1 &&
      concurrent.filter((result) => result.status === 409).length === 1,
    'A concorrencia de dispositivos nao produziu um sucesso e um conflito.',
  )
  session = concurrent.find((result) => result.status === 201).json.data
  assert(session.items.length === 3, 'A concorrencia adicionou uma quantidade inesperada de itens.')

  const orderIds = [...new Set(session.items.map((item) => item.productionOrderId))]
  assert(orderIds.length === 2, 'O lote adicional nao gerou uma ordem de producao separada.')

  for (const orderId of orderIds) {
    await request(`/kitchen/orders/${orderId}/ready`, {
      method: 'PATCH',
      token: actors.kitchen.token,
      body: {},
    })
    await request(`/kitchen/orders/${orderId}/ready`, {
      method: 'PATCH',
      token: actors.kitchen.token,
      body: {},
    })
  }

  const refreshed = await request(`/waiter/tables/${freeTable.id}`, {
    token: actors.waiter1.token,
  })
  session = refreshed.json.data.session
  for (const item of session.items) {
    const delivered = await request(`/waiter/sessions/${session.id}/items/${item.id}/deliver`, {
      method: 'POST',
      token: actors.waiter1.token,
      idempotencyKey: key(`restaurant-deliver-${item.id}`),
      body: { expectedVersion: session.version },
      expectedStatuses: [201],
    })
    session = delivered.json.data.session
  }
  assert(session.items.every((item) => item.deliveredAt), 'Nem todos os itens foram entregues.')

  const closeRequested = await request(`/waiter/sessions/${session.id}/request-close`, {
    method: 'POST',
    token: actors.waiter1.token,
    idempotencyKey: key('restaurant-request-close'),
    body: { expectedVersion: session.version },
    expectedStatuses: [201],
  })
  session = closeRequested.json.data
  assert(session.status === 'awaiting_close', 'A mesa nao entrou em aguardando fechamento.')

  const paymentRace = await Promise.all(
    [actors.cashier, actors.manager].map((actor, index) =>
      request(`/orders/${orderIds[0]}/payment`, {
        method: 'PATCH',
        token: actor.token,
        idempotencyKey: key(`restaurant-payment-race-${index + 1}`),
        body: { status: 'paid', externalReference: `${MARKER}-${runId}` },
        expectedStatuses: [200, 409],
      }),
    ),
  )
  assert(paymentRace.some((result) => result.status === 200), 'Nenhum caixa confirmou o pagamento.')

  for (const orderId of orderIds.slice(1)) {
    await request(`/orders/${orderId}/payment`, {
      method: 'PATCH',
      token: actors.cashier.token,
      idempotencyKey: key(`restaurant-payment-${orderId}`),
      body: { status: 'paid', externalReference: `${MARKER}-${runId}` },
    })
  }

  for (const orderId of orderIds) {
    const order = await request(`/orders/${orderId}`, { token: actors.manager.token })
    assert(order.json.data.paymentStatus === 'paid', 'Pagamento de salao nao confirmado.')
    assert(
      order.json.data.timeline.filter((entry) =>
        entry.label.toLowerCase().includes('pagamento atualizado para paid'),
      ).length === 1,
      'O pagamento de salao registrou mais de uma transicao logica.',
    )
  }

  const closeRace = await Promise.all(
    [actors.cashier, actors.manager].map((actor, index) =>
      request(`/dining/sessions/${session.id}/close`, {
        method: 'POST',
        token: actor.token,
        body: { paymentMethod: 'cash', actor: `Caixa piloto ${index + 1}` },
        expectedStatuses: [201, 400, 409],
      }),
    ),
  )
  assert(
    closeRace.filter((result) => result.status === 201).length === 1,
    'O fechamento concorrente da mesa nao teve exatamente um vencedor.',
  )

  const closedTable = await request(`/dining/tables/${freeTable.id}`, {
    token: actors.manager.token,
  })
  assert(closedTable.json.data.session === null, 'A mesa permaneceu com sessao ativa.')

  const jobSummaries = []
  for (const [index, orderId] of orderIds.entries()) {
    const expectedType = index === 0 ? 'ORDER_INITIAL' : 'ORDER_ADDITION'
    const jobs = await waitForPrintedJobs(orderId, [
      expectedType,
      'DISPATCH_ORDER',
      'CASHIER_RECEIPT',
      'CUSTOMER_RECEIPT',
    ])
    assert(countType(jobs, expectedType) === 1, `${expectedType} foi duplicado.`)
    assert(countType(jobs, 'DISPATCH_ORDER') === 1, 'Via de expedicao foi duplicada.')
    assert(countType(jobs, 'CASHIER_RECEIPT') === 1, 'Via do caixa foi duplicada.')
    assert(countType(jobs, 'CUSTOMER_RECEIPT') === 1, 'Via do cliente foi duplicada.')
    jobSummaries.push(summarizeJobs(jobs))
  }

  return {
    table: freeTable.code,
    sessionClosed: true,
    serverPricedItems: 3,
    productionOrders: orderIds.length,
    idempotentReplay: true,
    unavailableProductRejected: true,
    crossWaiterAccessRejected: true,
    concurrentDevices: { success: 1, conflict: 1 },
    concurrentCashiers: { logicalPaymentTransitions: 1, sessionCloseWinners: 1 },
    printing: jobSummaries,
  }
}

async function runDeliveryFlow() {
  const bootstrap = await request('/waiter/bootstrap', { token: actors.waiter1.token })
  const products = bootstrap.json.data.menu.categories.flatMap((category) => category.products)
  const product = products.find((entry) => entry.orderable)
  assert(product, 'Produto ficticio disponivel nao encontrado para delivery.')

  const publicOrder = await request('/public/orders', {
    method: 'POST',
    idempotencyKey: key('delivery-public-order'),
    body: {
      customerName: 'Cliente Delivery Piloto',
      customerPhone: `+55 92 90000-${String(Date.now()).slice(-4)}`,
      address: 'Rua Ficticia de Validacao, 200',
      neighborhood: 'Bairro Demonstracao',
      complement: 'Ponto ficticio',
      reference: MARKER,
      notes: `${MARKER}: entrega integrada local`,
      orderMode: 'delivery',
      paymentMethodId: 'pilot_demo_payment_cash',
      items: [{ productId: product.id, quantity: 2, selectedOptions: [] }],
    },
    expectedStatuses: [201],
  })
  const order = publicOrder.json.data
  const trackingPath = publicOrder.json.tracking?.path
  assert(/^\/tracking\/[A-Za-z0-9_-]{40,80}$/.test(trackingPath), 'Token opaco nao gerado.')

  await request(`/kitchen/orders/${order.id}/ready`, {
    method: 'PATCH',
    token: actors.kitchen.token,
    body: {},
  })
  await request(`/orders/${order.id}/payment`, {
    method: 'PATCH',
    token: actors.cashier.token,
    idempotencyKey: key('delivery-payment'),
    body: { status: 'paid', externalReference: `${MARKER}-${runId}` },
  })
  await request(`/orders/${order.id}/status`, {
    method: 'PATCH',
    token: actors.manager.token,
    idempotencyKey: key('delivery-dispatch'),
    body: { action: 'dispatch', driverId: actors.driver1.user.id },
  })

  await request('/drivers/me/delivery/start', {
    method: 'POST',
    token: actors.driver1.token,
    idempotencyKey: key('delivery-start'),
    body: {},
    expectedStatuses: [201],
  })
  await request('/drivers/me/delivery/start', {
    method: 'POST',
    token: actors.driver2.token,
    idempotencyKey: key('delivery-wrong-start'),
    body: {},
    expectedStatuses: [400],
  })
  await request('/drivers/me/location', {
    method: 'POST',
    token: actors.driver1.token,
    idempotencyKey: key('delivery-location'),
    body: {
      latitude: -3.102,
      longitude: -60.022,
      accuracyMeters: 25,
      speedKmh: 18,
      heading: 90,
      source: 'simulator',
      currentOrderId: order.id,
    },
    expectedStatuses: [201],
  })

  const tracking = await request(trackingPath)
  const publicKeys = Object.keys(tracking.json).sort()
  assert(
    publicKeys.every((entry) =>
      ['etaMinutes', 'location', 'message', 'orderNumber', 'status', 'updatedAt'].includes(entry),
    ),
    'Tracking publico expos campos adicionais.',
  )
  assert(tracking.json.status === 'out_for_delivery', 'Tracking nao refletiu a entrega em rota.')
  assert(
    decimalPlaces(tracking.json.location.latitude) <= 3 &&
      decimalPlaces(tracking.json.location.longitude) <= 3,
    'Tracking publico expos coordenada com precisao excessiva.',
  )

  await request('/drivers/me/delivery/complete', {
    method: 'POST',
    token: actors.driver2.token,
    idempotencyKey: key('delivery-wrong-complete'),
    body: {},
    expectedStatuses: [400],
  })
  const completed = await request('/drivers/me/delivery/complete', {
    method: 'POST',
    token: actors.driver1.token,
    idempotencyKey: key('delivery-complete'),
    body: {},
    expectedStatuses: [201],
  })
  assert(completed.json.data.currentDelivery === null, 'O motoboy permaneceu com entrega ativa.')
  await request(trackingPath, { expectedStatuses: [404] })

  const finalOrder = await request(`/orders/${order.id}`, { token: actors.manager.token })
  assert(finalOrder.json.data.status === 'completed', 'Delivery nao foi concluido.')
  assert(finalOrder.json.data.driverId === actors.driver1.user.id, 'Atribuicao do motoboy divergiu.')

  const jobs = await waitForPrintedJobs(order.id, [
    'ORDER_INITIAL',
    'DISPATCH_ORDER',
    'CASHIER_RECEIPT',
    'CUSTOMER_RECEIPT',
  ])
  for (const type of ['ORDER_INITIAL', 'DISPATCH_ORDER', 'CASHIER_RECEIPT', 'CUSTOMER_RECEIPT']) {
    assert(countType(jobs, type) === 1, `${type} do delivery foi duplicado.`)
  }

  return {
    status: finalOrder.json.data.status,
    assignedDriverOnly: true,
    wrongDriverRejected: true,
    opaqueTrackingToken: true,
    trackingFields: publicKeys,
    publicCoordinatePrecision: 3,
    trackingRevokedOnCompletion: true,
    externalProvidersCalled: false,
    printing: summarizeJobs(jobs),
  }
}

async function login(email) {
  const response = await request('/auth/login', {
    method: 'POST',
    body: { email, password },
    expectedStatuses: [201],
  })
  return { token: response.json.data.accessToken, user: response.json.data.user }
}

async function waitForPrintedJobs(orderId, expectedTypes) {
  const deadline = Date.now() + 20_000
  let jobs = []
  while (Date.now() < deadline) {
    const response = await request(
      `/printing/jobs?orderId=${encodeURIComponent(orderId)}&pageSize=100`,
      { token: actors.manager.token },
    )
    jobs = response.json.data
    const hasTypes = expectedTypes.every((type) => jobs.some((job) => job.jobType === type))
    if (hasTypes && jobs.every((job) => job.status === 'PRINTED')) return jobs
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 250))
  }
  throw new Error(
    `Timeout aguardando dry-run: ${summarizeJobs(jobs).map((item) => `${item.type}:${item.status}`).join(', ')}`,
  )
}

async function request(
  path,
  { method = 'GET', token, body, idempotencyKey, expectedStatuses = [200] } = {},
) {
  const headers = {
    accept: 'application/json',
    'x-correlation-id': `pilot-flow-${runId}-${++correlationSequence}`,
  }
  if (token) headers.authorization = `Bearer ${token}`
  if (body !== undefined) headers['content-type'] = 'application/json'
  if (idempotencyKey) headers['idempotency-key'] = idempotencyKey

  const response = await fetch(new URL(path, apiUrl), {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await response.text()
  let json = null
  if (text) {
    try {
      json = JSON.parse(text)
    } catch {
      json = { message: 'Resposta nao JSON.' }
    }
  }
  if (!expectedStatuses.includes(response.status)) {
    throw new Error(`${method} ${path.split('?')[0]} retornou ${response.status}: ${safeMessage(json)}`)
  }
  return { status: response.status, json }
}

function countType(jobs, type) {
  return jobs.filter((job) => job.jobType === type).length
}

function summarizeJobs(jobs) {
  return jobs
    .map((job) => ({ type: job.jobType, status: job.status }))
    .sort((left, right) => left.type.localeCompare(right.type))
}

function decimalPlaces(value) {
  const text = String(value)
  return text.includes('.') ? text.split('.')[1].length : 0
}

function key(scope) {
  return `pilot-${scope}-${runId}`
}

function safeMessage(json) {
  const message = Array.isArray(json?.message)
    ? json.message.join('; ')
    : typeof json?.message === 'string'
      ? json.message
      : typeof json?.error?.message === 'string'
        ? json.error.message
        : 'falha sem detalhe seguro'
  return message.replace(/[\r\n]+/g, ' ').slice(0, 240)
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}
