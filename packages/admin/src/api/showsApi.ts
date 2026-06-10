import type { ShowDefinition } from '@ieomlabs/shared'
import { apiFetch, apiSend } from './client'

export async function fetchShows(): Promise<ShowDefinition[]> {
  const res = await apiFetch<{ shows: ShowDefinition[] }>('/api/shows')
  return res.shows
}

export async function fetchRunningShowIds(): Promise<string[]> {
  const res = await apiFetch<{ running: string[] }>('/api/shows/running')
  return res.running
}

export async function runShow(id: string): Promise<void> {
  return apiSend(`/api/shows/${id}/run`, 'POST')
}

export async function cancelShow(id: string): Promise<void> {
  return apiSend(`/api/shows/${id}/cancel`, 'POST')
}
