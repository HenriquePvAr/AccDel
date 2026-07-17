const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL ?? import.meta.env.VITE_API_URL ?? 'http://localhost:3333'
const storeId = import.meta.env.VITE_STORE_ID ?? 'store_main'
const tokenKey = 'cain-waiter.access-token'

let accessToken = sessionStorage.getItem(tokenKey)

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export function setAccessToken(token: string | null) {
  accessToken = token
  if (token) sessionStorage.setItem(tokenKey, token)
  else sessionStorage.removeItem(tokenKey)
}

export function getAccessToken() {
  return accessToken
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit & { public?: boolean; idempotencyKey?: string } = {},
) {
  const headers = new Headers(init.headers)
  headers.set('Accept', 'application/json')
  headers.set('x-cain-store-id', storeId)
  if (init.body !== undefined) headers.set('Content-Type', 'application/json')
  if (!init.public && accessToken) headers.set('Authorization', `Bearer ${accessToken}`)
  if (init.idempotencyKey) headers.set('Idempotency-Key', init.idempotencyKey)

  let response: Response
  try {
    response = await fetch(`${apiBaseUrl}${path}`, { ...init, headers })
  } catch (cause) {
    throw new ApiError('Sem conexão com o Cain Delivery. Verifique a rede e tente novamente.', 0, cause)
  }

  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    const message = readErrorMessage(payload) ?? 'Não foi possível concluir esta ação.'
    if (response.status === 401) {
      setAccessToken(null)
      window.dispatchEvent(new Event('cain-waiter:unauthorized'))
    }
    throw new ApiError(message, response.status, payload)
  }
  return payload as T
}

export function createIdempotencyKey(operation: string) {
  return `waiter:${operation}:${crypto.randomUUID()}`
}

export function waiterStreamUrl() {
  return `${apiBaseUrl}/waiter/stream`
}

function readErrorMessage(payload: unknown) {
  if (!payload || typeof payload !== 'object') return null
  if ('error' in payload) {
    const error = (payload as { error?: { message?: unknown } }).error
    if (typeof error?.message === 'string') return error.message
  }
  if ('message' in payload && typeof (payload as { message?: unknown }).message === 'string') {
    return (payload as { message: string }).message
  }
  return null
}
