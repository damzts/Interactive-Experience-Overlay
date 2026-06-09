import type { WidgetWire, WidgetIntentManifest } from '@ieomlabs/shared'
import { apiFetch } from './client.js'

export async function fetchWires(): Promise<WidgetWire[]> {
  return apiFetch<WidgetWire[]>('/api/wires')
}

export async function fetchWireManifests(): Promise<WidgetIntentManifest[]> {
  return apiFetch<WidgetIntentManifest[]>('/api/wires/manifests')
}

export async function createWire(wire: Omit<WidgetWire, 'id'>): Promise<WidgetWire> {
  const result = await apiFetch<{ ok: boolean; wire: WidgetWire }>('/api/wires', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(wire),
  })
  return result.wire
}

export async function patchWire(id: string, patch: Partial<WidgetWire>): Promise<WidgetWire> {
  const result = await apiFetch<{ ok: boolean; wire: WidgetWire }>(`/api/wires/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
  return result.wire
}

export async function deleteWire(id: string): Promise<void> {
  await apiFetch(`/api/wires/${id}`, { method: 'DELETE' })
}
