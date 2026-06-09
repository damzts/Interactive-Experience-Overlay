import type { ReactiveChain, WidgetIntentManifest } from '@ieomlabs/shared'
import { apiFetch } from './client.js'

export async function fetchWires(): Promise<ReactiveChain[]> {
  return apiFetch<ReactiveChain[]>('/api/wires')
}

export async function fetchWireManifests(): Promise<WidgetIntentManifest[]> {
  return apiFetch<WidgetIntentManifest[]>('/api/wires/manifests')
}

export async function createWire(wire: Omit<ReactiveChain, 'id'>): Promise<ReactiveChain> {
  const result = await apiFetch<{ ok: boolean; chain: ReactiveChain }>('/api/wires', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(wire),
  })
  return result.chain
}

export async function patchWire(id: string, patch: Partial<ReactiveChain>): Promise<ReactiveChain> {
  const result = await apiFetch<{ ok: boolean; chain: ReactiveChain }>(`/api/wires/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
  return result.chain
}

export async function deleteWire(id: string): Promise<void> {
  await apiFetch(`/api/wires/${id}`, { method: 'DELETE' })
}
