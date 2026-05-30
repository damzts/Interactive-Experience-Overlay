import type { OnlineModeConfig, OnlineRoomStatus } from '@ieom/shared'
import { apiFetch } from './client.js'

export async function getOnlineConfig(): Promise<OnlineModeConfig> {
  return apiFetch<OnlineModeConfig>('/api/config/online')
}

export async function updateOnlineConfig(
  config: Partial<OnlineModeConfig>,
): Promise<{ ok: boolean; config: OnlineModeConfig }> {
  return apiFetch<{ ok: boolean; config: OnlineModeConfig }>('/api/config/online', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  })
}

export async function getOnlineRooms(): Promise<OnlineRoomStatus[]> {
  return apiFetch<OnlineRoomStatus[]>('/api/online/rooms')
}
