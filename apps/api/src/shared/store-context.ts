import { AsyncLocalStorage } from 'node:async_hooks'

import type { FastifyRequest } from 'fastify'

export const DEFAULT_STORE_ID = 'store_main'
export const STORE_ID_HEADER = 'x-cain-store-id'

export type StoreContextSource = 'auth' | 'header' | 'subdomain' | 'webhook' | 'public' | 'default'

export interface StoreContextState {
  storeId: string
  source: StoreContextSource
  host?: string
}

interface RequestAuthUser {
  storeId?: string
  store?: {
    id?: string
  }
}

export interface StoreScopedRequest extends FastifyRequest {
  authUser?: RequestAuthUser
  storeId?: string
  storeContext?: StoreContextState
}

export class StoreContextResolutionError extends Error {
  constructor() {
    super('Loja nao resolvida para a requisicao.')
    this.name = 'StoreContextResolutionError'
  }
}

const storeContextStorage = new AsyncLocalStorage<StoreContextState>()

export function runWithStoreContext<T>(context: StoreContextState, callback: () => T): T {
  return storeContextStorage.run(context, callback)
}

export function enterStoreContext(context: StoreContextState) {
  storeContextStorage.enterWith(context)
}

export function getStoreContext() {
  return storeContextStorage.getStore() ?? buildDefaultStoreContext()
}

export function getCurrentStoreId() {
  return getStoreContext().storeId
}

export function resolveStoreContextFromRequest(
  request: StoreScopedRequest,
): StoreContextState {
  const authStoreId = request.authUser?.storeId ?? request.authUser?.store?.id
  const headerStoreId = readHeader(request, STORE_ID_HEADER)
  const host = readHost(request)
  const subdomainStoreId = resolveStoreIdFromSubdomain(host)
  const webhookStoreId = resolveWebhookStoreId(request)
  const publicEndpointStoreId = resolvePublicEndpoint(request)

  // Public provider/token routes must never accept tenant selection from caller headers.
  if (webhookStoreId) {
    return {
      storeId: webhookStoreId,
      source: 'webhook',
      ...(host ? { host } : {}),
    }
  }

  if (publicEndpointStoreId) {
    return {
      storeId: publicEndpointStoreId,
      source: 'public',
      ...(host ? { host } : {}),
    }
  }

  if (authStoreId) {
    return {
      storeId: authStoreId,
      source: 'auth',
      ...(host ? { host } : {}),
    }
  }

  if (headerStoreId) {
    return {
      storeId: headerStoreId,
      source: 'header',
      ...(host ? { host } : {}),
    }
  }

  if (subdomainStoreId) {
    return {
      storeId: subdomainStoreId,
      source: 'subdomain',
      ...(host ? { host } : {}),
    }
  }

  return buildDefaultStoreContext(host ?? undefined)
}

function resolvePublicEndpoint(request: FastifyRequest) {
  const path = request.url.split('?')[0]
  return path.startsWith('/tracking/') ? 'public-tracking-token' : null
}

function resolveWebhookStoreId(request: FastifyRequest) {
  const path = request.url.split('?')[0]
  if (path !== '/webhooks/whatsapp') {
    return null
  }

  const storeId = process.env.WHATSAPP_STORE_ID?.trim()
  return storeId || null
}

function buildDefaultStoreContext(host?: string): StoreContextState {
  if (!isDefaultStoreFallbackAllowed()) {
    throw new StoreContextResolutionError()
  }

  return {
    storeId: DEFAULT_STORE_ID,
    source: 'default',
    ...(host ? { host } : {}),
  }
}

function isDefaultStoreFallbackAllowed() {
  return process.env.NODE_ENV !== 'production'
}

function readHeader(request: FastifyRequest, header: string) {
  const value = request.headers[header]

  if (typeof value === 'string' && value.trim()) {
    return value.trim()
  }

  if (Array.isArray(value)) {
    return value.find((entry) => entry.trim())?.trim() ?? null
  }

  return null
}

function readHost(request: FastifyRequest) {
  const host = readHeader(request, 'x-forwarded-host') ?? readHeader(request, 'host')
  return host?.split(',')[0]?.trim().toLowerCase() ?? null
}

function resolveStoreIdFromSubdomain(host: string | null) {
  if (!host) {
    return null
  }

  const hostname = host.split(':')[0]

  if (
    !hostname ||
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.endsWith('.local')
  ) {
    return null
  }

  const parts = hostname.split('.').filter(Boolean)
  const subdomain = parts.length > 2 ? parts[0] : null

  if (!subdomain || ['www', 'app', 'admin'].includes(subdomain)) {
    return null
  }

  return subdomain
}
