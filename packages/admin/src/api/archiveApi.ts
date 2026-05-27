import { apiFetch, apiSend } from './client.js'

export interface ArchiveStats {
  wins: number
  losses: number
  deaths: number
  revives: number
  sessions: number
}

export interface ArchiveLogEntry {
  id: number
  date: string
  event: string
  detail: string | null
}

export async function getArchiveStats(): Promise<ArchiveStats> {
  return apiFetch<ArchiveStats>('/api/archive/stats')
}

export async function getArchiveLog(): Promise<ArchiveLogEntry[]> {
  return apiFetch<ArchiveLogEntry[]>('/api/archive/log')
}

export async function resetArchiveStats(): Promise<void> {
  return apiSend('/api/archive/reset', 'POST')
}

export async function incrementArchiveStat(field: keyof ArchiveStats): Promise<void> {
  return apiSend('/api/archive/increment', 'POST', { field })
}
