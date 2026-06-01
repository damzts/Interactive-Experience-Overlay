function parsePort(value: string | undefined, fallback: string): string {
  return value && value.trim().length > 0 ? value.trim() : fallback
}

export function getDesktopServerPort(): number {
  return Number.parseInt(parsePort(process.env.IEOM_DESKTOP_SERVER_PORT, '3000'), 10)
}

export function getDesktopAdminUrl(): string {
  const explicitUrl = process.env.IEOM_DESKTOP_ADMIN_URL
  if (explicitUrl && explicitUrl.trim().length > 0) {
    return explicitUrl.trim()
  }

  return `http://localhost:${getDesktopServerPort()}/admin`
}

export function getAuthBackendUrl(): string {
  const explicitUrl = process.env.IEOM_BACKEND_URL
  if (explicitUrl && explicitUrl.trim().length > 0) {
    return explicitUrl.trim()
  }

  // Default to local backend during development. If you have a full
  // backend running locally for development, it should listen on port 3100.
  // Production builds can override this with `IEOM_BACKEND_URL`.
  return `http://localhost:3100`
}