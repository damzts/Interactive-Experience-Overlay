import type { DesktopConfig } from '@ieom/shared'

export async function patchDesktopConfig(update: Partial<DesktopConfig>) {
  await fetch('/api/config/desktop', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(update),
  })
}