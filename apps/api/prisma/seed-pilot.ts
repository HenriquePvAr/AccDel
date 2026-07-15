import { createHash } from 'node:crypto'
import { chmodSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { hash } from 'bcryptjs'
import type { AdminRole, Prisma } from '@prisma/client'
import { PrismaClient } from '@prisma/client'

const MARKER = 'PILOT_DEMO_DATA'
const STORE_ID = 'store_main'
const channels = ['dine_in', 'delivery', 'digital_menu', 'counter'] as const
const prisma = new PrismaClient()

interface PilotUser {
  key: string
  name: string
  email: string
  role: AdminRole
  phone: string
  profile?: 'waiter' | 'driver'
}

const users: PilotUser[] = [
  { key: 'manager', name: 'Marina Piloto', email: 'pilot.manager@cain.invalid', role: 'manager', phone: '+55 92 90000-1001' },
  { key: 'cashier', name: 'Carlos Piloto', email: 'pilot.cashier@cain.invalid', role: 'cashier', phone: '+55 92 90000-1002' },
  { key: 'kitchen', name: 'Joana Piloto', email: 'pilot.kitchen@cain.invalid', role: 'kitchen', phone: '+55 92 90000-1003' },
  { key: 'waiter_1', name: 'Ana Garcom Piloto', email: 'pilot.waiter1@cain.invalid', role: 'waiter', phone: '+55 92 90000-1004', profile: 'waiter' },
  { key: 'waiter_2', name: 'Leo Garcom Piloto', email: 'pilot.waiter2@cain.invalid', role: 'waiter', phone: '+55 92 90000-1005', profile: 'waiter' },
  { key: 'driver_1', name: 'Rui Entrega Piloto', email: 'pilot.driver1@cain.invalid', role: 'driver', phone: '+55 92 90000-1006', profile: 'driver' },
  { key: 'driver_2', name: 'Bia Entrega Piloto', email: 'pilot.driver2@cain.invalid', role: 'driver', phone: '+55 92 90000-1007', profile: 'driver' },
]

const categorySeeds = [
  { key: 'burgers', name: 'Hamburgueres piloto', station: 'COZINHA', color: '#f97316' },
  { key: 'sides', name: 'Acompanhamentos piloto', station: 'COZINHA', color: '#eab308' },
  { key: 'drinks', name: 'Bebidas piloto', station: 'BAR', color: '#06b6d4' },
  { key: 'desserts', name: 'Sobremesas piloto', station: 'COZINHA', color: '#ec4899' },
  { key: 'combos', name: 'Combos piloto', station: 'COZINHA', color: '#8b5cf6' },
] as const

const productNames: Record<(typeof categorySeeds)[number]['key'], string[]> = {
  burgers: ['Burger Classico', 'Burger Queijo', 'Burger Bacon', 'Burger Salada', 'Burger Picante', 'Burger Veggie'],
  sides: ['Batata P', 'Batata G', 'Aneis de Cebola', 'Nuggets', 'Mandioca', 'Salada da Casa'],
  drinks: ['Agua', 'Agua com Gas', 'Refrigerante Cola', 'Refrigerante Guarana', 'Suco de Laranja', 'Cha Gelado'],
  desserts: ['Brownie', 'Pudim', 'Sorvete', 'Torta de Limao', 'Mousse', 'Cookie'],
  combos: ['Combo Individual', 'Combo Duplo', 'Combo Familia', 'Combo Veggie', 'Combo Kids', 'Combo Temporariamente Indisponivel'],
}

async function main() {
  const guard = assertPilotEnvironment(process.env)
  const passwordHash = await hash(guard.userPassword, 12)
  const agentTokenHash = createHash('sha256').update(guard.agentToken).digest('hex')

  const summary = await prisma.$transaction(async (tx) => {
    await seedStore(tx)
    const memberships = await seedUsers(tx, passwordHash)
    await seedPaymentsAndDelivery(tx)
    await seedDining(tx)
    const catalog = await seedCatalog(tx)
    await seedModifiers(tx, catalog.categoryIds)
    await seedPrinting(tx, agentTokenHash, guard.agentToken, catalog.categoryIds)
    return {
      users: memberships.length,
      areas: 3,
      tables: 15,
      categories: categorySeeds.length,
      products: catalog.productCount,
      stations: 4,
      printers: 4,
    }
  })

  writeCredentials(guard.credentialsOutput, guard.userPassword)
  console.log(JSON.stringify({
    event: 'pilot_seed_completed',
    marker: MARKER,
    storeId: STORE_ID,
    credentialsFile: guard.credentialsOutput,
    ...summary,
  }))
}

function assertPilotEnvironment(environment: NodeJS.ProcessEnv) {
  if (environment.APP_ENV === 'production') {
    throw new Error('Seed piloto bloqueado em APP_ENV=production.')
  }
  if (environment.ALLOW_PILOT_SEED !== 'true') {
    throw new Error('Defina ALLOW_PILOT_SEED=true explicitamente.')
  }
  const databaseUrl = new URL(environment.DATABASE_URL ?? '')
  const databaseName = databaseUrl.pathname.replace(/^\//, '')
  if (!/pilot|staging|test|demo/i.test(databaseName)) {
    throw new Error('O banco do seed deve conter pilot, staging, test ou demo no nome.')
  }
  if (!['postgres', 'localhost', '127.0.0.1'].includes(databaseUrl.hostname)) {
    throw new Error('O seed piloto aceita somente PostgreSQL local ou da stack Docker.')
  }
  const userPassword = environment.PILOT_USER_PASSWORD ?? ''
  const agentToken = environment.CAIN_PRINT_AGENT_TOKEN ?? ''
  if (userPassword.length < 20 || agentToken.length < 32) {
    throw new Error('Credenciais piloto devem ser geradas pelo comando de staging.')
  }
  return {
    userPassword,
    agentToken,
    credentialsOutput: environment.PILOT_CREDENTIALS_OUTPUT ?? '/pilot/seed-credentials.txt',
  }
}

async function seedStore(tx: Prisma.TransactionClient) {
  const data = {
    name: 'Cain Delivery Piloto',
    tradeName: 'Cain Bistro Ficticio',
    timezone: 'America/Manaus',
    city: 'Manaus',
    state: 'AM',
    brandAccent: '#f97316',
    phone: '+55 92 90000-0000',
    publicWhatsapp: null,
    addressLine: 'Rua Ficticia do Piloto, 100',
    neighborhood: 'Bairro Demonstracao',
    businessHours: 'Dados ficticios para piloto supervisionado',
    greetingMessage: 'Ambiente ficticio do piloto Cain Delivery.',
    outOfHoursMessage: 'Ambiente piloto indisponivel.',
    cancellationPolicy: 'Validar cancelamentos com o supervisor do piloto.',
    generalNotes: `${MARKER}: nenhum dado deste cadastro representa uma operacao real.`,
    latitude: -3.1019,
    longitude: -60.0217,
    defaultDeliveryFee: 8,
    minimumOrderAmount: 15,
    deliveryEnabled: true,
    pickupEnabled: true,
    counterEnabled: true,
    dineInEnabled: true,
    digitalMenuEnabled: true,
    whatsappAiEnabled: false,
    autoAcceptEnabled: false,
    estimatedPrepTimeMinutes: 25,
    estimatedDeliveryTimeMinutes: 45,
    estimatedDineInTimeMinutes: 35,
    estimatedCounterTimeMinutes: 20,
    estimatedPickupTimeMinutes: 25,
  }
  await tx.store.upsert({ where: { id: STORE_ID }, create: { id: STORE_ID, ...data }, update: data })
}

async function seedUsers(tx: Prisma.TransactionClient, passwordHash: string) {
  const memberships = []
  for (const user of users) {
    const userId = `pilot_demo_user_${user.key}`
    const membershipId = `pilot_demo_membership_${user.key}`
    await tx.user.upsert({
      where: { email: user.email },
      create: { id: userId, name: user.name, email: user.email, phone: user.phone, passwordHash, status: 'active' },
      update: { name: user.name, phone: user.phone, passwordHash, status: 'active' },
    })
    const membership = await tx.storeUser.upsert({
      where: { storeId_userId: { storeId: STORE_ID, userId } },
      create: { id: membershipId, storeId: STORE_ID, userId, role: user.role, active: true },
      update: { role: user.role, active: true },
    })
    memberships.push(membership)
    if (user.profile === 'waiter') {
      await tx.waiterProfile.upsert({
        where: { storeUserId: membership.id },
        create: { id: `pilot_demo_waiter_profile_${user.key}`, storeUserId: membership.id, active: true, status: 'available' },
        update: { active: true, status: 'available' },
      })
    }
    if (user.profile === 'driver') {
      await tx.driverProfile.upsert({
        where: { storeUserId: membership.id },
        create: { id: `pilot_demo_driver_profile_${user.key}`, storeUserId: membership.id, vehicle: `Moto virtual ${user.key}`, active: true, availability: 'available' },
        update: { vehicle: `Moto virtual ${user.key}`, active: true, availability: 'available' },
      })
    }
  }
  return memberships
}

async function seedPaymentsAndDelivery(tx: Prisma.TransactionClient) {
  const payments = [
    { id: 'pilot_demo_payment_cash', name: 'Dinheiro piloto', method: 'cash' as const, order: 1 },
    { id: 'pilot_demo_payment_pix', name: 'PIX manual piloto', method: 'pix' as const, order: 2 },
    { id: 'pilot_demo_payment_card', name: 'Cartao na entrega piloto', method: 'credit_card' as const, order: 3 },
  ]
  for (const payment of payments) {
    await tx.paymentMethodConfig.upsert({
      where: { storeId_name: { storeId: STORE_ID, name: payment.name } },
      create: { id: payment.id, storeId: STORE_ID, name: payment.name, method: payment.method, provider: 'manual', active: true, channels: [...channels], sortOrder: payment.order, externalEnabled: false },
      update: { method: payment.method, provider: 'manual', active: true, channels: [...channels], sortOrder: payment.order, externalEnabled: false },
    })
  }
  for (const [index, neighborhood] of ['Bairro Demonstracao', 'Zona Piloto Norte', 'Zona Piloto Sul'].entries()) {
    await tx.deliveryZone.upsert({
      where: { storeId_neighborhood: { storeId: STORE_ID, neighborhood } },
      create: { id: `pilot_demo_zone_${index + 1}`, storeId: STORE_ID, neighborhood, fee: 6 + index * 2, active: true, sortOrder: index, estimatedDeliveryTimeMinutes: 35 + index * 10 },
      update: { fee: 6 + index * 2, active: true, sortOrder: index, estimatedDeliveryTimeMinutes: 35 + index * 10 },
    })
  }
}

async function seedDining(tx: Prisma.TransactionClient) {
  const areas = [
    { id: 'pilot_demo_area_salao', name: 'Salao piloto', color: '#f97316' },
    { id: 'pilot_demo_area_varanda', name: 'Varanda piloto', color: '#06b6d4' },
    { id: 'pilot_demo_area_balcao', name: 'Balcao piloto', color: '#8b5cf6' },
  ]
  for (const [index, area] of areas.entries()) {
    await tx.diningArea.upsert({
      where: { id: area.id },
      create: { ...area, storeId: STORE_ID, sortOrder: index },
      update: { name: area.name, color: area.color, sortOrder: index },
    })
  }
  for (let index = 1; index <= 15; index += 1) {
    const code = String(index).padStart(2, '0')
    await tx.diningTable.upsert({
      where: { storeId_code: { storeId: STORE_ID, code } },
      create: { id: `pilot_demo_table_${code}`, storeId: STORE_ID, areaId: areas[Math.floor((index - 1) / 5)].id, code, capacity: index % 3 === 0 ? 6 : 4, status: 'free', notes: MARKER },
      update: { areaId: areas[Math.floor((index - 1) / 5)].id, capacity: index % 3 === 0 ? 6 : 4, notes: MARKER },
    })
  }
}

async function seedCatalog(tx: Prisma.TransactionClient) {
  const categoryIds: Record<string, string> = {}
  let productCount = 0
  for (const [categoryIndex, category] of categorySeeds.entries()) {
    const categoryId = `pilot_demo_category_${category.key}`
    categoryIds[category.key] = categoryId
    await tx.category.upsert({
      where: { id: categoryId },
      create: { id: categoryId, storeId: STORE_ID, name: category.name, description: `${MARKER}: categoria ficticia`, active: true, color: category.color, visibleOnPos: true, visibleOnDigitalMenu: true, sortOrder: categoryIndex },
      update: { name: category.name, description: `${MARKER}: categoria ficticia`, active: true, color: category.color, visibleOnPos: true, visibleOnDigitalMenu: true, sortOrder: categoryIndex },
    })
    for (const [productIndex, name] of productNames[category.key].entries()) {
      productCount += 1
      const productId = `pilot_demo_product_${String(productCount).padStart(2, '0')}`
      const data = { storeId: STORE_ID, categoryId, name, description: `${MARKER}: produto ficticio para validacao operacional`, price: 8 + categoryIndex * 5 + productIndex * 2, image: '', featured: productIndex === 0, active: true, preparationStation: category.station, tags: [MARKER, category.key], sortOrder: productIndex }
      await tx.product.upsert({ where: { id: productId }, create: { id: productId, ...data }, update: data })
      for (const channel of channels) {
        const soldOut = productCount === 30
        await tx.productChannelAvailability.upsert({
          where: { productId_channel: { productId, channel } },
          create: { id: `pilot_demo_availability_${productCount}_${channel}`, productId, channel, available: !soldOut, visible: true, soldOut },
          update: { available: !soldOut, visible: true, soldOut },
        })
      }
    }
  }
  return { categoryIds, productCount }
}

async function seedModifiers(tx: Prisma.TransactionClient, categoryIds: Record<string, string>) {
  const groups = [
    { id: 'pilot_demo_group_size', name: 'Tamanho piloto', options: [['Padrao', 0, true], ['Grande', 6, true]] as const },
    { id: 'pilot_demo_group_extras', name: 'Adicionais piloto', options: [['Queijo extra', 4, true], ['Bacon extra', 5, true], ['Molho picante indisponivel', 2, false]] as const },
  ]
  for (const [groupIndex, group] of groups.entries()) {
    await tx.productOptionGroup.upsert({
      where: { storeId_name: { storeId: STORE_ID, name: group.name } },
      create: { id: group.id, storeId: STORE_ID, name: group.name, description: MARKER, sortOrder: groupIndex },
      update: { description: MARKER, sortOrder: groupIndex },
    })
    for (const [optionIndex, [name, priceDelta, available]] of group.options.entries()) {
      await tx.productOption.upsert({
        where: { groupId_name: { groupId: group.id, name } },
        create: { id: `${group.id}_option_${optionIndex + 1}`, groupId: group.id, name, description: MARKER, priceDelta, active: true, available, soldOut: !available, sortOrder: optionIndex },
        update: { description: MARKER, priceDelta, active: true, available, soldOut: !available, sortOrder: optionIndex },
      })
    }
  }
  for (const categoryId of [categoryIds.burgers, categoryIds.combos]) {
    await tx.productOptionGroupCategoryLink.upsert({
      where: { categoryId_groupId: { categoryId, groupId: groups[1].id } },
      create: { categoryId, groupId: groups[1].id, required: false, minSelections: 0, maxSelections: 3, sortOrder: 1, description: MARKER, autoApply: true },
      update: { required: false, minSelections: 0, maxSelections: 3, sortOrder: 1, description: MARKER, autoApply: true },
    })
  }
}

async function seedPrinting(
  tx: Prisma.TransactionClient,
  tokenHash: string,
  rawToken: string,
  categoryIds: Record<string, string>,
) {
  const agent = await tx.printAgent.upsert({
    where: { id: 'pilot_demo_print_agent' },
    create: { id: 'pilot_demo_print_agent', storeId: STORE_ID, name: 'Agente virtual piloto', deviceName: 'docker-dry-run', version: '0.1.0-pilot', tokenHash, tokenPrefix: rawToken.slice(0, 18), enabled: true },
    update: { name: 'Agente virtual piloto', deviceName: 'docker-dry-run', version: '0.1.0-pilot', tokenPrefix: rawToken.slice(0, 18), enabled: true, revokedAt: null },
  })
  const stations = [
    { code: 'COZINHA', name: 'Cozinha piloto' },
    { code: 'BAR', name: 'Bar piloto' },
    { code: 'CAIXA', name: 'Caixa piloto' },
    { code: 'EXPEDICAO', name: 'Expedicao piloto' },
  ]
  const stationIds: Record<string, string> = {}
  for (const station of stations) {
    const stationId = `pilot_demo_station_${station.code.toLowerCase()}`
    stationIds[station.code] = stationId
    await tx.printerStation.upsert({
      where: { storeId_code: { storeId: STORE_ID, code: station.code } },
      create: { id: stationId, storeId: STORE_ID, code: station.code, name: station.name, enabled: true },
      update: { name: station.name, enabled: true },
    })
    await tx.printer.upsert({
      where: { storeId_name: { storeId: STORE_ID, name: `Virtual ${station.name}` } },
      create: { id: `pilot_demo_printer_${station.code.toLowerCase()}`, storeId: STORE_ID, stationId, agentId: agent.id, name: `Virtual ${station.name}`, connectionType: 'FILE_OR_VIRTUAL', address: `virtual://${station.code.toLowerCase()}`, paperWidth: 80, encoding: 'UTF-8', enabled: true, isDefault: true },
      update: { stationId, agentId: agent.id, connectionType: 'FILE_OR_VIRTUAL', address: `virtual://${station.code.toLowerCase()}`, paperWidth: 80, encoding: 'UTF-8', enabled: true, isDefault: true },
    })
  }
  await tx.printingSettings.upsert({
    where: { storeId: STORE_ID },
    create: { id: 'pilot_demo_printing_settings', storeId: STORE_ID, enabled: true, fallbackPolicy: 'DEFAULT_STATION', fallbackStationId: stationIds.COZINHA, printOrderReady: true, printPaymentConfirmed: true, printCancellation: true, customerReceiptEnabled: true, defaultMaxAttempts: 3, leaseDurationSeconds: 60 },
    update: { enabled: true, fallbackPolicy: 'DEFAULT_STATION', fallbackStationId: stationIds.COZINHA, printOrderReady: true, printPaymentConfirmed: true, printCancellation: true, customerReceiptEnabled: true, defaultMaxAttempts: 3, leaseDurationSeconds: 60 },
  })
  for (const [index, category] of categorySeeds.entries()) {
    await tx.printerRoutingRule.upsert({
      where: { id: `pilot_demo_route_${category.key}` },
      create: { id: `pilot_demo_route_${category.key}`, storeId: STORE_ID, scope: 'CATEGORY', categoryId: categoryIds[category.key], stationId: stationIds[category.station], priority: 10 - index, enabled: true },
      update: { categoryId: categoryIds[category.key], stationId: stationIds[category.station], priority: 10 - index, enabled: true },
    })
  }
}

function writeCredentials(output: string, password: string) {
  mkdirSync(dirname(output), { recursive: true })
  const content = [
    MARKER,
    'Ambiente local ficticio. Nao reutilize estas credenciais.',
    '',
    ...users.map((user) => `${user.role}: ${user.email}`),
    '',
    `Senha compartilhada do piloto: ${password}`,
    'Token do agente permanece somente em runtime.env.',
    '',
  ].join('\n')
  writeFileSync(output, content, { encoding: 'utf8', mode: 0o600 })
  try { chmodSync(output, 0o600) } catch { /* Windows ACLs remain authoritative. */ }
}

void main()
  .catch((error) => {
    console.error(JSON.stringify({
      event: 'pilot_seed_failed',
      errorType: error instanceof Error ? error.name : 'UnknownError',
      message: error instanceof Error ? error.message : 'Falha desconhecida',
    }))
    process.exitCode = 1
  })
  .finally(async () => prisma.$disconnect())
