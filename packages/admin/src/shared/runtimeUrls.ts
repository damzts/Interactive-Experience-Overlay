function getWindowLocation(): Location | null {
  return typeof window !== 'undefined' ? window.location : null
}

function buildOrigin(port: string): string {
  const location = getWindowLocation()
  const protocol = location?.protocol ?? 'http:'
  const hostname = location?.hostname ?? 'localhost'
  return `${protocol}//${hostname}:${port}`
}

export function getApiOrigin(): string {
  // In dev mode, use same-origin so requests go through the vite proxy (avoids CORS issues)
  if (import.meta.env.DEV) {
    const location = getWindowLocation()
    return location?.origin ?? 'http://localhost:3002'
  }
  if (import.meta.env.VITE_API_ORIGIN) return import.meta.env.VITE_API_ORIGIN
  const location = getWindowLocation()
  if (location && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
    return location.origin
  }
  return buildOrigin(import.meta.env.VITE_API_PORT || '3100')
}

export function getOverlayRuntimeOrigin(): string {
  return import.meta.env.VITE_OVERLAY_RUNTIME_ORIGIN || buildOrigin(import.meta.env.VITE_OVERLAY_RUNTIME_PORT || '3000')
}

export function getOverlayDevOrigin(): string {
  return import.meta.env.VITE_OVERLAY_DEV_ORIGIN || buildOrigin(import.meta.env.VITE_OVERLAY_DEV_PORT || '3001')
}

export function getAdminOrigin(): string {
  return import.meta.env.VITE_ADMIN_ORIGIN || buildOrigin(import.meta.env.VITE_ADMIN_PORT || '3002')
}