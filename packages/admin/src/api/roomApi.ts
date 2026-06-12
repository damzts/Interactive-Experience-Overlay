import type { RoomConfig, RoomStatus } from '@ieomlabs/shared'
import { apiFetch } from './client.js'
import { getStoredAuthToken } from '../auth/sessionToken.js'

export async function provideAuthToken(): Promise<void> {
  const token = getStoredAuthToken()
  if (!token) return
  await apiFetch('/api/online/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  }).catch(() => {})
}

export async function getRoomConfig(): Promise<RoomConfig> {
  return apiFetch<RoomConfig>('/api/config/online')
}

export async function updateRoomConfig(
  config: Partial<RoomConfig>,
): Promise<{ ok: boolean; config: RoomConfig }> {
  return apiFetch<{ ok: boolean; config: RoomConfig }>('/api/config/online', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  })
}

export async function getRooms(): Promise<RoomStatus[]> {
  return apiFetch<RoomStatus[]>('/api/online/rooms')
}

/** @deprecated Use getRoomConfig */
export const getOnlineConfig = getRoomConfig
/** @deprecated Use updateRoomConfig */
export const updateOnlineConfig = updateRoomConfig
/** @deprecated Use getRooms */
export const getOnlineRooms = getRooms
