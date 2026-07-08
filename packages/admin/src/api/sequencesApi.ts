import type { Sequence, SequenceStep } from '@ieomlabs/shared'
import { apiFetch, apiSend } from './client'

export async function fetchSequences(): Promise<Sequence[]> {
  const res = await apiFetch<{ sequences: Sequence[] }>('/api/sequences')
  return res.sequences
}

export async function createSequence(label: string, steps: SequenceStep[] = []): Promise<Sequence> {
  const res = await apiFetch<{ ok: boolean; sequence: Sequence }>('/api/sequences', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ label, steps }),
  })
  return res.sequence
}

export async function updateSequence(id: string, patch: { label?: string; steps?: SequenceStep[] }): Promise<Sequence> {
  const res = await apiFetch<{ ok: boolean; sequence: Sequence }>(`/api/sequences/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
  return res.sequence
}

export async function deleteSequence(id: string): Promise<void> {
  return apiSend(`/api/sequences/${id}`, 'DELETE')
}
