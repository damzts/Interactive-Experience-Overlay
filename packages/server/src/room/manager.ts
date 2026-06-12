/**
 * RoomManager — in-memory state for rooms and config.
 * Coordinates room lifecycle, participant tracking, and POV switching.
 */

import type { RoomConfig, RoomStatus, ParticipantInfo, SwitchMode } from '@ieomlabs/shared'
import { DEFAULT_ROOM_CONFIG } from '@ieomlabs/shared'
import type { RoomSignaling } from '../transport/webrtc/room-signaling.js'
import type { POVOrchestrator } from '../kernel/managers/pov.js'
import { CircuitBreaker } from '../lib/cloud-circuit-breaker.js'
import logger from '../lib/logger.js'

export interface Room {
  roomCode: string
  createdAt: number
  mode: SwitchMode
  participants: Map<string, ParticipantInfo>
  activePlayerId: string | null
  idleTimer: ReturnType<typeof setTimeout> | null
}

export interface RoomManagerOptions {
  cloudUrl?: string
  getToken?: () => string | null
}

export type RoomEventCallback = (event: string, payload: unknown) => void

export class RoomManager {
  private rooms = new Map<string, Room>()
  private config: RoomConfig = { ...DEFAULT_ROOM_CONFIG }
  private eventCallbacks: RoomEventCallback[] = []
  private cloudUrl: string
  private getToken: () => string | null
  private hubRoomId: string | null = null

  private circuitBreaker = new CircuitBreaker({
    failureThreshold: 3,
    resetTimeoutMs: 15_000,
    requestTimeoutMs: 8_000,
  })

  constructor(
    private roomSignaling: RoomSignaling,
    private pov: POVOrchestrator,
    opts?: RoomManagerOptions,
  ) {
    this.cloudUrl = opts?.cloudUrl ?? process.env['IEOM_CLOUD_URL'] ?? 'https://ieom.danhub.dev'
    this.getToken = opts?.getToken ?? (() => null)

    this.pov.onSwitch((prev, next, timestamp, reason) => {
      for (const room of this.rooms.values()) {
        if (room.participants.has(next)) {
          room.activePlayerId = next
          this.emit('pov-online:switch', {
            roomCode: room.roomCode,
            previousId: prev,
            newId: next,
            timestamp,
            reason,
          })
          break
        }
      }
    })

    this.pov.scoreProcessor.onScoresUpdated((scores) => {
      for (const room of this.rooms.values()) {
        const roomScores: Array<{ participantId: string; score: number }> = []
        for (const [id, score] of scores) {
          if (room.participants.has(id)) {
            const p = room.participants.get(id)!
            p.activityScore = score
            roomScores.push({ participantId: id, score })
          }
        }
        if (roomScores.length > 0) {
          this.emit('pov-online:scores', {
            roomCode: room.roomCode,
            scores: roomScores,
            timestamp: Date.now(),
          })
        }
      }
    })

    this.roomSignaling.onStatus((status) => {
      if (!status.roomId) return
      logger.info(`[room] onStatus: roomId=${status.roomId}, participants=${status.participants.length}, rooms=${[...this.rooms.keys()].join(',')}`)
      let targetRoom: Room | undefined
      for (const room of this.rooms.values()) {
        if (room.roomCode === status.roomId) {
          targetRoom = room
          break
        }
      }
      if (!targetRoom && this.rooms.size === 1 && status.connected) {
        targetRoom = this.rooms.values().next().value
        logger.info(`[room] onStatus: using fallback room ${targetRoom?.roomCode}`)
      }
      if (targetRoom) {
        this.syncParticipants(targetRoom, status.participants, status.participantNames)
      } else {
        logger.info(`[room] onStatus: no matching room found for ${status.roomId}`)
      }
    })
  }

  onEvent(cb: RoomEventCallback): void {
    this.eventCallbacks.push(cb)
  }

  setToken(token: string): void {
    logger.info({ tokenLength: token.length }, '[room] Token set')
    this.getToken = () => token
  }

  private emit(event: string, payload: unknown): void {
    for (const cb of this.eventCallbacks) { try { cb(event, payload) } catch {} }
  }

  getConfig(): RoomConfig {
    return { ...this.config }
  }

  updateConfig(partial: Partial<RoomConfig>): RoomConfig {
    Object.assign(this.config, partial)
    this.pov.scoreProcessor.stop()
    this.pov.scoreProcessor.start({
      rollingWindowMs: this.config.rollingWindowMs,
      reportIntervalMs: this.config.audioReportIntervalMs,
      emitIntervalMs: this.config.scoreEmitIntervalMs,
    })
    this.pov.switcher.updateConfig({
      cooldownMs: this.config.cooldownMs,
      activityThreshold: this.config.activityThreshold,
      silenceThreshold: this.config.silenceThreshold,
    })
    return { ...this.config }
  }

  async createRoom(): Promise<{ ok: true; roomCode: string } | { ok: false; error: string }> {
    if (this.rooms.size >= this.config.maxActiveRooms) {
      return { ok: false, error: 'max_rooms_reached' }
    }

    let token = this.getToken()
    if (!token) {
      try {
        const res = await fetch(`${this.cloudUrl}/api/auth/guest-token`, { method: 'GET' })
        if (res.ok) {
          const data = await res.json() as { token: string }
          token = data.token
          this.setToken(token)
          logger.info('[room] obtained fresh guest token for hub connection')
        }
      } catch (e) {
        logger.warn({ err: e }, '[room] failed to get guest token')
      }
    }
    if (!token) {
      return { ok: false, error: 'not_authenticated' }
    }

    let roomCode: string
    try {
      logger.info({ value: this.cloudUrl }, '[room] Creating room on cloud')
      const res = await this.circuitBreaker.call(`${this.cloudUrl}/api/rooms`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        logger.info({ status: res.status, body }, '[room] Cloud error')
        return { ok: false, error: body.error ?? `cloud_error_${res.status}` }
      }
      const data = await res.json() as { room?: { id: string }; roomId?: string }
      roomCode = data.room?.id ?? data.roomId ?? ''
      if (!roomCode) return { ok: false, error: 'invalid_cloud_response' }
      logger.info({ err: roomCode }, '[room] Room created on cloud')
    } catch (e: any) {
      if (e.name === 'CircuitOpenError') {
        logger.warn('[room] Circuit open, skipping cloud room creation')
        return { ok: false, error: 'cloud_unreachable_circuit_open' }
      }
      logger.error('[room] Failed to create room:', e.message, e.cause ?? '')
      return { ok: false, error: e.name === 'AbortError' ? 'cloud_timeout' : (e.message ?? 'cloud_unreachable') }
    }

    this.hubRoomId = roomCode
    try {
      await this.roomSignaling.connect({ cloudUrl: this.cloudUrl, token, roomId: roomCode })
    } catch (e: any) {
      this.hubRoomId = null
      logger.error({ err: e?.message ?? e }, '[room] Hub connect failed after room creation')
      return { ok: false, error: 'hub_connect_failed' }
    }

    const room: Room = {
      roomCode,
      createdAt: Date.now(),
      mode: 'automatic',
      participants: new Map(),
      activePlayerId: null,
      idleTimer: null,
    }
    this.rooms.set(roomCode, room)
    this.emit('pov-online:room:created', {
      roomCode,
      joinUrl: `${this.cloudUrl}/room/${roomCode}`,
      createdAt: room.createdAt,
    })
    return { ok: true, roomCode }
  }

  closeRoom(roomCode: string): void {
    const room = this.rooms.get(roomCode)
    if (!room) return
    if (room.idleTimer) clearTimeout(room.idleTimer)
    for (const id of room.participants.keys()) {
      this.pov.removeParticipant(id)
    }
    this.rooms.delete(roomCode)
    this.hubRoomId = null
    this.roomSignaling.disconnect()
    this.emit('pov-online:room:closed', { roomCode })

    const token = this.getToken()
    if (token) {
      this.circuitBreaker.tryOrFallback(
        () => this.circuitBreaker.call(`${this.cloudUrl}/api/rooms/${roomCode}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` },
        }).then(() => {}),
        undefined,
      )
    }
  }

  setMode(roomCode: string, mode: SwitchMode): void {
    const room = this.rooms.get(roomCode)
    if (!room) return
    room.mode = mode
    this.pov.switcher.setMode(mode)
  }

  async rejoinRoom(roomCode: string): Promise<{ ok: boolean; error?: string }> {
    const room = this.rooms.get(roomCode)
    if (!room) return { ok: false, error: 'room_not_found' }

    let token = this.getToken()
    if (!token) {
      try {
        const res = await fetch(`${this.cloudUrl}/api/auth/guest-token`, { method: 'GET' })
        if (res.ok) {
          const data = await res.json() as { token: string }
          token = data.token
          this.setToken(token)
          logger.info('[room] obtained fresh guest token for rejoin')
        }
      } catch (e) {
        logger.warn({ err: e }, '[room] failed to get guest token for rejoin')
      }
    }
    if (!token) return { ok: false, error: 'not_authenticated' }

    if (this.hubRoomId === roomCode && this.roomSignaling.isConnected()) {
      return { ok: true }
    }

    if (this.hubRoomId && this.hubRoomId !== roomCode) {
      this.roomSignaling.disconnect()
    }

    this.hubRoomId = roomCode
    try {
      await this.roomSignaling.connect({ cloudUrl: this.cloudUrl, token, roomId: roomCode })
    } catch (e: any) {
      this.hubRoomId = null
      logger.error({ err: e?.message ?? e }, '[room] Rejoin room failed')
      return { ok: false, error: 'hub_connect_failed' }
    }
    logger.info({ err: roomCode }, '[room] Rejoined room as hub')
    this.emit('pov-online:status', this.toStatus(room))
    return { ok: true }
  }

  selectParticipant(roomCode: string, participantId: string): { ok: boolean; error?: string } {
    const room = this.rooms.get(roomCode)
    if (!room) return { ok: false, error: 'room_not_found' }
    if (!room.participants.has(participantId)) return { ok: false, error: 'participant_not_found' }
    return this.pov.switcher.manualSelect(participantId)
  }

  getRooms(): RoomStatus[] {
    return [...this.rooms.values()].map((r) => this.toStatus(r))
  }

  async syncFromCloud(): Promise<void> {
    let token = this.getToken()
    if (!token) {
      try {
        const res = await fetch(`${this.cloudUrl}/api/auth/guest-token`, { method: 'GET' })
        if (res.ok) {
          const data = await res.json() as { token: string }
          token = data.token
          this.setToken(token)
        }
      } catch { /* ignore */ }
    }
    if (!token) { logger.info('[room] syncFromCloud: no token'); return }
    try {
      const res = await this.circuitBreaker.call(`${this.cloudUrl}/api/rooms`, {
        headers: { 'Authorization': `Bearer ${token}` },
      })
      if (!res.ok) { logger.info({ value: res.status }, '[room] syncFromCloud: cloud returned'); return }
      const cloudRooms = await res.json() as Array<{ id: string; createdAt: string; participantCount: number; hubConnected: boolean }>
      logger.info({ count: cloudRooms.length }, '[room] syncFromCloud: found rooms')

      for (const [code] of this.rooms) {
        if (!cloudRooms.some((cr) => cr.id === code)) {
          this.rooms.delete(code)
        }
      }

      for (const cr of cloudRooms) {
        if (!this.rooms.has(cr.id)) {
          const room: Room = {
            roomCode: cr.id,
            createdAt: new Date(cr.createdAt).getTime(),
            mode: 'automatic',
            participants: new Map(),
            activePlayerId: null,
            idleTimer: null,
          }
          this.rooms.set(cr.id, room)
        }
      }

      if (!this.hubRoomId && cloudRooms.length > 0) {
        const firstRoom = cloudRooms[0]
        this.hubRoomId = firstRoom.id
        try {
          await this.roomSignaling.connect({ cloudUrl: this.cloudUrl, token, roomId: firstRoom.id })
          const room = this.rooms.get(firstRoom.id)
          if (room) this.emit('pov-online:status', this.toStatus(room))
        } catch (e: any) {
          this.hubRoomId = null
          logger.info({ err: e?.message ?? e }, '[room] syncFromCloud: hub reconnect failed')
        }
      }
    } catch (e: any) { logger.info({ err: e.message }, '[room] syncFromCloud error') }
  }

  getRoom(roomCode: string): RoomStatus | undefined {
    const room = this.rooms.get(roomCode)
    return room ? this.toStatus(room) : undefined
  }

  addParticipant(roomCode: string, id: string, displayName: string): void {
    const room = this.rooms.get(roomCode)
    if (!room) return
    if (room.participants.size >= this.config.maxPlayersPerRoom) return
    logger.info(`[room] addParticipant: ${id} (${displayName}) → room ${roomCode}`)
    const participant: ParticipantInfo = {
      id,
      displayName,
      connectionStatus: 'connected',
      activityScore: 0,
      joinedAt: Date.now(),
    }
    room.participants.set(id, participant)
    this.pov.addParticipant(id, displayName)
    if (room.idleTimer) { clearTimeout(room.idleTimer); room.idleTimer = null }
    this.emit('pov-online:participant:joined', { roomCode, participant })
  }

  removeParticipant(roomCode: string, participantId: string): void {
    const room = this.rooms.get(roomCode)
    if (!room) return
    room.participants.delete(participantId)
    this.pov.removeParticipant(participantId)
    if (room.activePlayerId === participantId) room.activePlayerId = null
    this.emit('pov-online:participant:left', { roomCode, participantId })
    if (room.participants.size === 0) {
      room.idleTimer = setTimeout(() => {
        this.emit('pov-online:room:idle', { roomCode })
      }, this.config.idleTimeoutMs)
    }
  }

  emitKick(roomCode: string, participantId: string): void {
    this.emit('pov-online:participant:kicked', { roomCode, participantId })
    this.roomSignaling.kickParticipant(participantId)
  }

  private syncParticipants(room: Room, participantIds: string[], names?: Map<string, string>): void {
    const currentIds = new Set(room.participants.keys())
    const newIds = new Set(participantIds)
    for (const id of newIds) {
      if (!currentIds.has(id)) {
        const displayName = names?.get(id) ?? id
        this.addParticipant(room.roomCode, id, displayName)
      }
    }
    for (const id of currentIds) {
      if (!newIds.has(id)) this.removeParticipant(room.roomCode, id)
    }
  }

  private toStatus(room: Room): RoomStatus {
    return {
      roomCode: room.roomCode,
      createdAt: room.createdAt,
      status: room.participants.size > 0 ? 'active' : 'idle',
      maxPlayers: this.config.maxPlayersPerRoom,
      participantCount: room.participants.size,
      participants: [...room.participants.values()],
      activePlayerId: room.activePlayerId,
      mode: room.mode,
      hubConnected: this.hubRoomId === room.roomCode && this.roomSignaling.isConnected(),
    }
  }
}

/** @deprecated Use RoomManager */
export { RoomManager as OnlineRoomManager }
/** @deprecated Use Room */
export type { Room as OnlineRoom }
/** @deprecated Use RoomManagerOptions */
export type { RoomManagerOptions as OnlineRoomManagerOptions }
