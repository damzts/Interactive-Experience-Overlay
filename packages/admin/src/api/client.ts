// ---------------------------------------------------------------------------
// API client — cookie auth plus optional bearer token support
// ---------------------------------------------------------------------------

import { clearStoredAuthToken, getStoredAuthToken, resolveBackendUrl } from '../auth/sessionToken.js'

// ---------------------------------------------------------------------------
// Error class
// ---------------------------------------------------------------------------

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

// ---------------------------------------------------------------------------
// CSRF token helper
// ---------------------------------------------------------------------------

/**
 * Reads the `csrf_token` value from `document.cookie`.
 * Returns null if the cookie is not present.
 */
export function getCsrfToken(): string | null {
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith('csrf_token='))
  if (!match) return null
  return match.split('=')[1] ?? null
}

// ---------------------------------------------------------------------------
// Token refresh logic (deduplicated)
// ---------------------------------------------------------------------------

let refreshPromise: Promise<boolean> | null = null

async function attemptTokenRefresh(): Promise<boolean> {
  // Deduplicate concurrent refresh attempts
  if (refreshPromise) return refreshPromise

  refreshPromise = (async () => {
    try {
      const res = await fetch(resolveBackendUrl('/api/auth/refresh'), {
        method: 'POST',
        credentials: 'include',
      })
      return res.ok
    } catch {
      return false
    } finally {
      refreshPromise = null
    }
  })()

  return refreshPromise
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mergeHeaders(
  existing: HeadersInit | undefined,
  extra: Record<string, string>,
): HeadersInit {
  const merged = new Headers(existing)
  for (const [key, value] of Object.entries(extra)) {
    merged.set(key, value)
  }
  return merged
}

async function isTokenExpiredResponse(res: Response): Promise<boolean> {
  if (res.status !== 401) return false
  try {
    const body = (await res.clone().json()) as { error?: string }
    return body.error === 'token_expired'
  } catch {
    return false
  }
}

function isStateChangingMethod(method: string | undefined): boolean {
  if (!method) return false
  const upper = method.toUpperCase()
  return upper === 'POST' || upper === 'PUT' || upper === 'PATCH' || upper === 'DELETE'
}

function buildHeaders(existing: HeadersInit | undefined, extra: Record<string, string>): HeadersInit | undefined {
  const merged = Object.keys(extra).length > 0 ? mergeHeaders(existing, extra) : existing
  const token = getStoredAuthToken()

  if (!token) {
    return merged
  }

  return mergeHeaders(merged, { Authorization: `Bearer ${token}` })
}

// ---------------------------------------------------------------------------
// Public API functions
// ---------------------------------------------------------------------------

/**
 * Generic fetch wrapper that includes credentials (cookies) on every request.
 * Attaches X-CSRF-Token header on non-GET requests.
 * Handles token_expired by attempting a refresh and retrying once.
 */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const extra: Record<string, string> = {}
  const method = init?.method?.toUpperCase() ?? 'GET'

  // Include CSRF token on state-changing requests
  if (isStateChangingMethod(method)) {
    const csrf = getCsrfToken()
    if (csrf) {
      extra['X-CSRF-Token'] = csrf
    }
  }

  const requestUrl = resolveBackendUrl(path)
  const headers = buildHeaders(init?.headers, extra)

  let res = await fetch(requestUrl, { ...init, headers, credentials: 'include' })

  // Handle token_expired: attempt refresh and retry once
  if (await isTokenExpiredResponse(res)) {
    const refreshed = await attemptTokenRefresh()
    if (refreshed) {
      // After refresh, CSRF token cookie may have been updated
      const retryExtra: Record<string, string> = {}
      if (isStateChangingMethod(method)) {
        const csrf = getCsrfToken()
        if (csrf) {
          retryExtra['X-CSRF-Token'] = csrf
        }
      }
      const retryHeaders = buildHeaders(init?.headers, retryExtra)

      res = await fetch(requestUrl, { ...init, headers: retryHeaders, credentials: 'include' })
    } else {
      clearStoredAuthToken()
      throw new ApiError('token_expired', 401)
    }
  }

  if (!res.ok) {
    let message = `${path} → ${res.status}`
    try {
      const body = (await res.json()) as { error?: string }
      if (body.error) message = body.error
    } catch {
      /* ignore */
    }
    throw new ApiError(message, res.status)
  }
  return res.json() as Promise<T>
}

/**
 * Sends a state-changing request (POST/PUT/PATCH/DELETE) with credentials
 * and CSRF token. Does not return a body.
 */
export async function apiSend(
  path: string,
  method: string,
  body?: unknown,
): Promise<void> {
  const extra: Record<string, string> = {}

  // Always include CSRF token on mutations
  const csrf = getCsrfToken()
  if (csrf) {
    extra['X-CSRF-Token'] = csrf
  }

  if (body !== undefined) {
    extra['Content-Type'] = 'application/json'
  }

  const requestUrl = resolveBackendUrl(path)
  const headers = buildHeaders(undefined, extra)

  let res = await fetch(requestUrl, {
    method,
    headers,
    credentials: 'include',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  // Handle token_expired: attempt refresh and retry once
  if (await isTokenExpiredResponse(res)) {
    const refreshed = await attemptTokenRefresh()
    if (refreshed) {
      // After refresh, CSRF token cookie may have been updated
      const retryHeaders: Record<string, string> = {}
      const retryCsrf = getCsrfToken()
      if (retryCsrf) {
        retryHeaders['X-CSRF-Token'] = retryCsrf
      }
      if (body !== undefined) {
        retryHeaders['Content-Type'] = 'application/json'
      }
      res = await fetch(requestUrl, {
        method,
        headers: buildHeaders(retryHeaders, {}),
        credentials: 'include',
        body: body !== undefined ? JSON.stringify(body) : undefined,
      })
    } else {
      clearStoredAuthToken()
      throw new ApiError('token_expired', 401)
    }
  }

  if (!res.ok) {
    let message = `${path} → ${res.status}`
    try {
      const json = (await res.json()) as { error?: string }
      if (json.error) message = json.error
    } catch {
      /* ignore */
    }
    throw new ApiError(message, res.status)
  }
}

// ---------------------------------------------------------------------------
// Logout
// ---------------------------------------------------------------------------

/**
 * Calls the server logout endpoint with credentials and CSRF token.
 * Always stays on the current admin shell and only clears auth state.
 */
export async function logout(): Promise<void> {
  try {
    clearStoredAuthToken()
    const headers: Record<string, string> = {}
    const csrf = getCsrfToken()
    if (csrf) {
      headers['X-CSRF-Token'] = csrf
    }

    await fetch(resolveBackendUrl('/api/auth/logout'), {
      method: 'POST',
      headers,
      credentials: 'include',
    })
  } catch {
    // Best-effort: even if the server call fails, stay on the admin shell
  } finally {
    // No navigation: the UI should remain usable without login.
  }
}
