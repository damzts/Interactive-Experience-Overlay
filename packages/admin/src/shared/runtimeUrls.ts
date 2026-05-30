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
  return import.meta.env.VITE_API_ORIGIN || buildOrigin(import.meta.env.VITE_API_PORT || '3100')
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