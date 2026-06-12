import type { RoomConfig, RoomStatus, PerRoomConfig } from '@ieomlabs/shared'
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

export async function getActiveRoomCode(): Promise<string | null> {
  const result = await apiFetch<{ roomCode: string | null }>('/api/online/active-room')
  return result.roomCode
}

export async function setActiveRoomCode(roomCode: string | null): Promise<{ ok: boolean; error?: string }> {
  return apiFetch<{ ok: boolean; error?: string }>('/api/online/active-room', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roomCode }),
  })
}

export async function updateCloudRoomConfig(
  roomCode: string,
  config: Partial<PerRoomConfig>,
): Promise<{ ok: boolean; config: PerRoomConfig }> {
  return apiFetch<{ ok: boolean; config: PerRoomConfig }>(`/api/online/rooms/${roomCode}/config`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  })
}

export async function setParticipantTransition(
  roomCode: string,
  participantId: string,
  transition: PerRoomConfig['transition'],
): Promise<{ ok: boolean; error?: string }> {
  return apiFetch<{ ok: boolean; error?: string }>(`/api/online/rooms/${roomCode}/participants/${participantId}/transition`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transition }),
  })
}

/** @deprecated Use getRoomConfig */
export const getOnlineConfig = getRoomConfig
/** @deprecated Use updateRoomConfig */
export const updateOnlineConfig = updateRoomConfig
/** @deprecated Use getRooms */
export const getOnlineRooms = getRooms
