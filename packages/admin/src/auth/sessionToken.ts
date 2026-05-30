import { getApiOrigin } from '../shared/runtimeUrls'

const AUTH_TOKEN_STORAGE_KEY = 'ieom_auth_token'

function isBrowser(): boolean {
  return typeof window !== 'undefined'
}

function readTokenFromParams(params: URLSearchParams): string | null {
  return params.get('token') ?? params.get('access_token')
}

export function getStoredAuthToken(): string | null {
  if (!isBrowser()) return null

  const token = window.sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY)
  return token && token.trim().length > 0 ? token : null
}

export function setStoredAuthToken(token: string): void {
  if (!isBrowser()) return
  const normalized = token.trim()
  if (!normalized) return
  window.sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, normalized)
}

export function clearStoredAuthToken(): void {
  if (!isBrowser()) return
  window.sessionStorage.removeItem(AUTH_TOKEN_STORAGE_KEY)
}

export function captureAuthTokenFromLocation(): string | null {
  if (!isBrowser()) return null

  const searchParams = new URLSearchParams(window.location.search)
  const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash
  const hashParams = hash ? new URLSearchParams(hash) : null
  const token = readTokenFromParams(searchParams) ?? (hashParams ? readTokenFromParams(hashParams) : null)

  if (!token || token.trim().length === 0) {
    return null
  }

  setStoredAuthToken(token)

  const url = new URL(window.location.href)
  url.searchParams.delete('token')
  url.searchParams.delete('access_token')
  url.hash = ''
  window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`)

  return token.trim()
}

export function getAuthOrigin(): string {
  return getApiOrigin()
}

export function resolveBackendUrl(path: string): string {
  return new URL(path, getAuthOrigin()).toString()
}
