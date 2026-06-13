/**
 * RoomManager — in-memory state for rooms and config.
 * Coordinates room lifecycle, participant tracking, and POV switching.
 */

import type { RoomConfig, RoomStatus, ParticipantInfo, SwitchMode, PerRoomConfig } from '@ieomlabs/shared'
import { DEFAULT_ROOM_CONFIG, DEFAULT_PER_ROOM_CONFIG } from '@ieomlabs/shared'
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
  closing?: boolean
}

export interface RoomManagerOptions {
  cloudUrl?: string
  getToken?: () => string | null
}

export type RoomEventCallback = (event: string, payload: unknown) => void

export class RoomManager {
  private rooms = new Map<string, Room>()
  private config: RoomConfig = { ...DEFAULT_ROOM_CONFIG }
  private roomConfigs = new Map<string, PerRoomConfig>()
  private participantTransitions = new Map<string, Map<string, PerRoomConfig['transition']>>()  // roomCode → participantId → transition
  private eventCallbacks: RoomEventCallback[] = []
  private cloudUrl: string
  private getToken: () => string | null
  private hubRoomId: string | null = null
  private activeRoomCode: string | null = null  // Room whose POV is relayed to overlay

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
          const participant = room.participants.get(next)
          if (participant) {
            const participantTransitionMap = this.participantTransitions.get(room.roomCode)
            const transition = participantTransitionMap?.get(next) ?? this.roomConfigs.get(room.roomCode)?.transition ?? DEFAULT_PER_ROOM_CONFIG.transition
            this.emit('pov-online:participant:selected', {
              roomCode: room.roomCode,
              participantId: next,
              displayName: participant.displayName,
              transition,
              timestamp,
            })
          }
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
      if (this.roomSignaling.intentionalClose) return
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
    if (partial.motionWeight !== undefined) {
      this.pov.updateMotionWeight(partial.motionWeight)
    }
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

    // Register the room BEFORE connecting signaling so that the onStatus
    // callback (fired immediately on WebSocket open) can find it.
    const room: Room = {
      roomCode,
      createdAt: Date.now(),
      mode: 'automatic',
      participants: new Map(),
      activePlayerId: null,
      idleTimer: null,
      closing: false,
    }
    this.rooms.set(roomCode, room)
    this.roomConfigs.set(roomCode, { ...DEFAULT_PER_ROOM_CONFIG })
    this.participantTransitions.set(roomCode, new Map())

    try {
      await this.roomSignaling.connect({ cloudUrl: this.cloudUrl, token, roomId: roomCode })
    } catch (e: any) {
      // Rollback: remove room from local state if signaling fails
      this.rooms.delete(roomCode)
      this.roomConfigs.delete(roomCode)
      this.participantTransitions.delete(roomCode)
      this.hubRoomId = null
      logger.error({ err: e?.message ?? e }, '[room] Hub connect failed after room creation')
      return { ok: false, error: 'hub_connect_failed' }
    }

    this.emit('pov-online:room:created', {
      roomCode,
      joinUrl: `${this.cloudUrl}/room/${roomCode}`,
      createdAt: room.createdAt,
    })
    return { ok: true, roomCode }
  }

  async closeRoom(roomCode: string): Promise<void> {
    const room = this.rooms.get(roomCode)
    if (!room) return

    // Mark as closing to prevent sync/status handlers from interfering
    room.closing = true

    if (room.idleTimer) clearTimeout(room.idleTimer)
    for (const id of room.participants.keys()) {
      this.pov.removeParticipant(id)
    }
    this.roomConfigs.delete(roomCode)
    this.participantTransitions.delete(roomCode)
    this.hubRoomId = null
    this.roomSignaling.disconnect()

    // Await DELETE from cloud (no longer fire-and-forget)
    const token = this.getToken()
    if (token) {
      try {
        await this.circuitBreaker.call(`${this.cloudUrl}/api/rooms/${roomCode}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` },
        })
      } catch (e: any) {
        logger.warn({ err: e?.message ?? e }, '[room] closeRoom: DELETE failed, continuing')
      }
    }

    this.rooms.delete(roomCode)
    this.emit('pov-online:room:closed', { roomCode })
  }

  setMode(roomCode: string, mode: SwitchMode): void {
    const room = this.rooms.get(roomCode)
    if (!room) return
    room.mode = mode
    this.pov.switcher.setMode(mode)
  }

  updateRoomConfig(roomCode: string, partial: Partial<PerRoomConfig>): RoomStatus | null {
    const room = this.rooms.get(roomCode)
    if (!room) return null
    const current = this.roomConfigs.get(roomCode) ?? { ...DEFAULT_PER_ROOM_CONFIG }
    const updated = { ...current, ...partial, transition: partial.transition ?? current.transition }
    this.roomConfigs.set(roomCode, updated)
    // If this is the active room, apply auto-mode fields to the orchestrator
    if (this.activeRoomCode === roomCode) {
      this.pov.switcher.updateConfig({
        cooldownMs: updated.cooldownMs,
        activityThreshold: updated.activityThreshold,
        silenceThreshold: updated.silenceThreshold,
      })
      this.pov.updateMotionWeight(updated.motionWeight)
      // Restart scoreProcessor if rollingWindowMs changed
      this.pov.scoreProcessor.stop()
      this.pov.scoreProcessor.start({
        rollingWindowMs: updated.rollingWindowMs,
        reportIntervalMs: this.config.audioReportIntervalMs,
        emitIntervalMs: this.config.scoreEmitIntervalMs,
      })
    }
    return this.toStatus(room)
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
    const participant = room.participants.get(participantId)
    if (participant) {
      const participantTransitionMap = this.participantTransitions.get(roomCode)
      const transition = participantTransitionMap?.get(participantId) ?? this.roomConfigs.get(roomCode)?.transition ?? DEFAULT_PER_ROOM_CONFIG.transition
      this.emit('pov-online:participant:selected', {
        roomCode,
        participantId,
        displayName: participant.displayName,
        transition,
        timestamp: Date.now(),
      })
    }
    return this.pov.switcher.manualSelect(participantId)
  }

  setParticipantTransition(roomCode: string, participantId: string, transition: PerRoomConfig['transition']): boolean {
    if (!this.participantTransitions.has(roomCode)) return false
    const map = this.participantTransitions.get(roomCode)!
    map.set(participantId, transition)
    return true
  }

  getParticipantTransition(roomCode: string, participantId: string): PerRoomConfig['transition'] | null {
    const map = this.participantTransitions.get(roomCode)
    if (!map) return null
    return map.get(participantId) ?? null
  }

  getRooms(): RoomStatus[] {
    return [...this.rooms.values()].map((r) => this.toStatus(r))
  }

  getActiveRoomCode(): string | null {
    return this.activeRoomCode
  }

  setActiveRoomCode(roomCode: string | null): { ok: boolean; error?: string } {
    if (roomCode && !this.rooms.has(roomCode)) {
      return { ok: false, error: 'room_not_found' }
    }
    const prev = this.activeRoomCode
    this.activeRoomCode = roomCode
    if (prev !== roomCode) {
      this.emit('pov-online:active-room', { roomCode })
      logger.info(`[room] active room changed: ${prev ?? 'none'} → ${roomCode ?? 'none'}`)
      // Apply the new room's config to the POV orchestrator
      if (roomCode) {
        const roomConfig = this.roomConfigs.get(roomCode) ?? { ...DEFAULT_PER_ROOM_CONFIG }
        this.pov.switcher.updateConfig({
          cooldownMs: roomConfig.cooldownMs,
          activityThreshold: roomConfig.activityThreshold,
          silenceThreshold: roomConfig.silenceThreshold,
        })
        this.pov.updateMotionWeight(roomConfig.motionWeight)
        this.pov.scoreProcessor.stop()
        this.pov.scoreProcessor.start({
          rollingWindowMs: roomConfig.rollingWindowMs,
          reportIntervalMs: this.config.audioReportIntervalMs,
          emitIntervalMs: this.config.scoreEmitIntervalMs,
        })
      }
    }
    return { ok: true }
  }

  async syncFromCloud(): Promise<void> {
    let token = this.getToken()
    const hasUserToken = !!token
    if (!token) {
      try {
        const res = await fetch(`${this.cloudUrl}/api/auth/guest-token`, { method: 'GET' })
        if (res.ok) {
          const data = await res.json() as { token: string }
          token = data.token
          this.setToken(token)
          logger.info('[room] syncFromCloud: obtained guest token')
        }
      } catch { /* ignore */ }
    }
    if (!token) {
      logger.warn('[room] syncFromCloud: no token available (user not authenticated, guest token failed)')
      return
    }
    try {
      const res = await this.circuitBreaker.call(`${this.cloudUrl}/api/rooms`, {
        headers: { 'Authorization': `Bearer ${token}` },
      })
      if (!res.ok) {
        logger.warn({ status: res.status, hasUserToken }, '[room] syncFromCloud: cloud API error')
        return
      }
      const cloudRooms = await res.json() as Array<{ id: string; createdAt: string; participantCount: number; hubConnected: boolean }>
      logger.info({ count: cloudRooms.length, hasUserToken }, '[room] syncFromCloud: found rooms')

      for (const [code] of this.rooms) {
        if (!cloudRooms.some((cr) => cr.id === code) && code !== this.hubRoomId) {
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
        // NO reconectar si la room está en proceso de cierre
        if (this.rooms.get(firstRoom.id)?.closing) {
          logger.info({ roomId: firstRoom.id }, '[room] syncFromCloud: skipping reconnect for closing room')
          return
        }
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
    if (!room || !room.participants.has(participantId)) return
    room.participants.delete(participantId)
    this.pov.removeParticipant(participantId)
    if (room.activePlayerId === participantId) room.activePlayerId = null
    const transitionMap = this.participantTransitions.get(roomCode)
    if (transitionMap) transitionMap.delete(participantId)
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
      config: this.roomConfigs.get(room.roomCode) ?? { ...DEFAULT_PER_ROOM_CONFIG },
    }
  }
}

/** @deprecated Use RoomManager */
export { RoomManager as OnlineRoomManager }
/** @deprecated Use Room */
export type { Room as OnlineRoom }
/** @deprecated Use RoomManagerOptions */
export type { RoomManagerOptions as OnlineRoomManagerOptions }
