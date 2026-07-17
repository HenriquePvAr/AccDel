export class ApiClientError extends Error {
  readonly status: number
  readonly details?: unknown

  constructor(message: string, status: number, details?: unknown) {
    super(message)
    this.name = 'ApiClientError'
    this.status = status
    this.details = details
  }
}

export const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL ??
  import.meta.env.VITE_API_URL ??
  'http://localhost:3333'
const tokenStorageKey = 'cain-admin.access-token'
const storeIdStorageKey = 'cain-admin.store-id'
export const authUnauthorizedEvent = 'cain-admin.auth.unauthorized'

export const shouldUseApi = import.meta.env.VITE_DATA_SOURCE !== 'mock'

let accessToken = readStoredAccessToken()
let currentStoreId = readStoredStoreId()

export function buildQueryString(params: object) {
  const search = new URLSearchParams()

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') {
      continue
    }

    if (typeof value === 'boolean' && value === false) {
      continue
    }

    search.set(key, String(value))
  }

  const query = search.toString()
  return query ? `?${query}` : ''
}

export const apiClient = {
  get<TResponse>(path: string, init?: RequestInit & ApiRequestOptions) {
    return request<TResponse>(path, init)
  },

  post<TResponse, TBody = unknown>(
    path: string,
    body?: TBody,
    init?: RequestInit & ApiRequestOptions,
  ) {
    return request<TResponse>(path, {
      ...init,
      method: 'POST',
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  },

  patch<TResponse, TBody = unknown>(
    path: string,
    body?: TBody,
    init?: RequestInit & ApiRequestOptions,
  ) {
    return request<TResponse>(path, {
      ...init,
      method: 'PATCH',
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  },

  delete<TResponse>(path: string, init?: RequestInit & ApiRequestOptions) {
    return request<TResponse>(path, {
      ...init,
      method: 'DELETE',
    })
  },
}

interface ApiRequestOptions {
  skipAuth?: boolean
  retryUnauthorized?: boolean
}

async function request<TResponse>(
  path: string,
  init?: RequestInit & ApiRequestOptions,
): Promise<TResponse> {
  if (shouldUseApi && !init?.skipAuth) {
    const token = getApiAccessToken()
    if (token) {
      const nextHeaders = new Headers(init?.headers)
      nextHeaders.set('Authorization', `Bearer ${token}`)
      init = {
        ...init,
        headers: nextHeaders,
      }
    }
  }

  const headers = new Headers(init?.headers)
  const storeId = getApiStoreId()

  if (
    init?.method &&
    ['POST', 'PATCH', 'PUT', 'DELETE'].includes(init.method.toUpperCase()) &&
    !headers.has('Idempotency-Key')
  ) {
    headers.set('Idempotency-Key', createIdempotencyKey())
  }

  if (storeId && shouldUseApi) {
    headers.set('x-cain-store-id', storeId)
  }

  if (init?.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  let response: Response

  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      ...init,
      headers,
    })
  } catch (error) {
    throw new ApiClientError(
      `Nao foi possivel conectar a API em ${apiBaseUrl}. Verifique se o backend esta rodando com npm run api:dev e se o CORS permite a origem atual.`,
      0,
      {
        cause: error instanceof Error ? error.message : String(error),
        path,
      },
    )
  }
  const payload = await safeJson(response)

  if (response.status === 401 && shouldUseApi && !init?.skipAuth) {
    clearApiAccessToken()
    notifyUnauthorized()
  }

  if (!response.ok) {
    const message =
      isApiErrorPayload(payload) ? payload.error.message : 'Falha ao chamar a API.'

    throw new ApiClientError(message, response.status, payload)
  }

  return payload as TResponse
}

function createIdempotencyKey() {
  return `web-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`
}

async function safeJson(response: Response) {
  try {
    return await response.json()
  } catch {
    return null
  }
}

function isApiErrorPayload(payload: unknown): payload is { error: { message: string } } {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'error' in payload &&
    typeof (payload as { error?: unknown }).error === 'object' &&
    (payload as { error: { message?: unknown } }).error !== null &&
    typeof (payload as { error: { message?: unknown } }).error.message === 'string'
  )
}

function readStoredAccessToken() {
  if (typeof window === 'undefined') {
    return null
  }

  return window.localStorage.getItem(tokenStorageKey)
}

function readStoredStoreId() {
  if (typeof window === 'undefined') {
    return null
  }

  return window.localStorage.getItem(storeIdStorageKey)
}

export function getApiAccessToken() {
  return accessToken
}

export function setApiAccessToken(token: string) {
  accessToken = token

  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(tokenStorageKey, token)
}

export function getApiStoreId() {
  return currentStoreId
}

export function setApiStoreId(storeId: string) {
  currentStoreId = storeId

  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(storeIdStorageKey, storeId)
}

export function clearApiStoreId() {
  currentStoreId = null

  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.removeItem(storeIdStorageKey)
}

export function clearApiAccessToken() {
  accessToken = null
  clearApiStoreId()

  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.removeItem(tokenStorageKey)
}

function notifyUnauthorized() {
  if (typeof window === 'undefined') {
    return
  }

  window.dispatchEvent(new CustomEvent(authUnauthorizedEvent))
}
