import type { SendDriverLocationRequest } from '../types/api'

const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:3333'

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

let accessToken: string | null = null

export function setApiAccessToken(token: string | null) {
  accessToken = token
}

export function getApiAccessToken() {
  return accessToken
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
}

interface ApiRequestOptions {
  skipAuth?: boolean
}

async function request<TResponse>(
  path: string,
  init?: RequestInit & ApiRequestOptions,
): Promise<TResponse> {
  const headers = new Headers(init?.headers)

  if (!init?.skipAuth) {
    const token = getApiAccessToken()
    if (token) {
      headers.set('Authorization', `Bearer ${token}`)
    }
  }

  if (init?.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers,
  })
  const payload = await safeJson(response)

  if (!response.ok) {
    const message =
      typeof payload === 'object' &&
      payload !== null &&
      'error' in payload &&
      typeof (payload as { error?: { message?: unknown } }).error?.message === 'string'
        ? (payload as { error: { message: string } }).error.message
        : 'Nao foi possivel completar a requisicao.'

    throw new ApiClientError(message, response.status, payload)
  }

  return payload as TResponse
}

async function safeJson(response: Response) {
  try {
    return await response.json()
  } catch {
    return null
  }
}

export function buildLocationPayload(
  payload: SendDriverLocationRequest,
): SendDriverLocationRequest {
  return {
    latitude: payload.latitude,
    longitude: payload.longitude,
    speedKmh: payload.speedKmh,
    heading: payload.heading,
    accuracyMeters: payload.accuracyMeters,
    capturedAt: payload.capturedAt,
    source: payload.source ?? 'app',
    currentOrderId: payload.currentOrderId,
    currentAssignmentId: payload.currentAssignmentId,
  }
}
