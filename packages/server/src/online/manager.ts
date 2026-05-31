/**
 * OnlineRoomManager — in-memory state for online rooms and config.
 * Coordinates room lifecycle, participant tracking, and POV switching.
 */

import type { OnlineModeConfig, OnlineRoomStatus, ParticipantInfo, SwitchMode } from '@ieom/shared'
import { DEFAULT_ONLINE_MODE_CONFIG } from '@ieom/shared'
import type { CloudSignaling } from '../room/cloud-signaling.js'
import type { POVOrchestrator } from '../pov/index.js'
import crypto from 'node:crypto'

export interface OnlineRoom {
  roomCode: string
  createdAt: number
  mode: SwitchMode
  participants: Map<string, ParticipantInfo>
  activePlayerId: string | null
  idleTimer: ReturnType<typeof setTimeout> | null
}

export interface OnlineRoomManagerOptions {
  cloudUrl?: string
  getToken?: () => string | null
}

export type RoomEventCallback = (event: string, payload: unknown) => void

export class OnlineRoomManager {
  private rooms = new Map<string, OnlineRoom>()
  private config: OnlineModeConfig = { ...DEFAULT_ONLINE_MODE_CONFIG }
  private eventCallbacks: RoomEventCallback[] = []
  private cloudUrl: string
  private getToken: () => string | null
  private hubRoomId: string | null = null

  constructor(
    private cloudSignaling: CloudSignaling,
    private pov: POVOrchestrator,
    opts?: OnlineRoomManagerOptions,
  ) {
    this.cloudUrl = opts?.cloudUrl ?? process.env['IEOM_CLOUD_URL'] ?? 'https://ieom.danhub.dev'
    this.getToken = opts?.getToken ?? (() => null)

    // Listen for POV switches from the orchestrator
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

    // Listen for score updates
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

    // Listen for participant join/leave from cloud signaling
    this.cloudSignaling.onStatus((status) => {
      for (const room of this.rooms.values()) {
        if (room.roomCode === status.roomId) {
          this.syncParticipants(room, status.participants)
        }
      }
    })
  }

  onEvent(cb: RoomEventCallback): void {
    this.eventCallbacks.push(cb)
  }

  setToken(token: string): void {
    console.log('[online] Token set (length:', token.length, ')')
    this.getToken = () => token
  }

  private emit(event: string, payload: unknown): void {
    for (const cb of this.eventCallbacks) { try { cb(event, payload) } catch {} }
  }

  getConfig(): OnlineModeConfig {
    return { ...this.config }
  }

  updateConfig(partial: Partial<OnlineModeConfig>): OnlineModeConfig {
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

    const token = this.getToken()
    if (!token) {
      return { ok: false, error: 'not_authenticated' }
    }

    // Create room on cloud API
    let roomCode: string
    try {
      console.log('[online] Creating room on cloud:', this.cloudUrl)
      const res = await fetch(`${this.cloudUrl}/api/rooms`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        console.log('[online] Cloud error:', res.status, body)
        return { ok: false, error: body.error ?? `cloud_error_${res.status}` }
      }
      const data = await res.json() as { room?: { id: string }; roomId?: string }
      roomCode = data.room?.id ?? data.roomId ?? ''
      if (!roomCode) return { ok: false, error: 'invalid_cloud_response' }
      console.log('[online] Room created on cloud:', roomCode)
    } catch (e: any) {
      console.error('[online] Failed to create room:', e.message, e.cause ?? '')
      return { ok: false, error: e.name === 'AbortError' ? 'cloud_timeout' : (e.message ?? 'cloud_unreachable') }
    }

    // Connect as hub
    this.hubRoomId = roomCode
    await this.cloudSignaling.connect({ cloudUrl: this.cloudUrl, token, roomId: roomCode })

    const room: OnlineRoom = {
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
      joinUrl: `/online/room/${roomCode}`,
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
    this.cloudSignaling.disconnect()
    this.emit('pov-online:room:closed', { roomCode })
  }

  setMode(roomCode: string, mode: SwitchMode): void {
    const room = this.rooms.get(roomCode)
    if (!room) return
    room.mode = mode
    this.pov.switcher.setMode(mode)
  }

  selectParticipant(roomCode: string, participantId: string): { ok: boolean; error?: string } {
    const room = this.rooms.get(roomCode)
    if (!room) return { ok: false, error: 'room_not_found' }
    if (!room.participants.has(participantId)) return { ok: false, error: 'participant_not_found' }
    return this.pov.switcher.manualSelect(participantId)
  }

  getRooms(): OnlineRoomStatus[] {
    return [...this.rooms.values()].map((r) => this.toStatus(r))
  }

  async syncFromCloud(): Promise<void> {
    const token = this.getToken()
    if (!token) { console.log('[online] syncFromCloud: no token'); return }
    try {
      const res = await fetch(`${this.cloudUrl}/api/rooms`, {
        headers: { 'Authorization': `Bearer ${token}` },
      })
      if (!res.ok) { console.log('[online] syncFromCloud: cloud returned', res.status); return }
      const cloudRooms = await res.json() as Array<{ id: string; createdAt: string; participantCount: number; hubConnected: boolean }>
      console.log('[online] syncFromCloud: found', cloudRooms.length, 'rooms')
      for (const cr of cloudRooms) {
        if (!this.rooms.has(cr.id)) {
          const room: OnlineRoom = {
            roomCode: cr.id,
            createdAt: new Date(cr.createdAt).getTime(),
            mode: 'automatic',
            participants: new Map(),
            activePlayerId: null,
            idleTimer: null,
          }
          this.rooms.set(cr.id, room)
        }
        // Reconnect as hub if not already connected
        if (!this.hubRoomId) {
          this.hubRoomId = cr.id
          await this.cloudSignaling.connect({ cloudUrl: this.cloudUrl, token, roomId: cr.id })
        }
      }
    } catch (e: any) { console.log('[online] syncFromCloud error:', e.message) }
  }

  getRoom(roomCode: string): OnlineRoomStatus | undefined {
    const room = this.rooms.get(roomCode)
    return room ? this.toStatus(room) : undefined
  }

  addParticipant(roomCode: string, id: string, displayName: string): void {
    const room = this.rooms.get(roomCode)
    if (!room) return
    if (room.participants.size >= this.config.maxPlayersPerRoom) return
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

  private syncParticipants(room: OnlineRoom, participantIds: string[]): void {
    const currentIds = new Set(room.participants.keys())
    const newIds = new Set(participantIds)
    for (const id of newIds) {
      if (!currentIds.has(id)) this.addParticipant(room.roomCode, id, id)
    }
    for (const id of currentIds) {
      if (!newIds.has(id)) this.removeParticipant(room.roomCode, id)
    }
  }

  private toStatus(room: OnlineRoom): OnlineRoomStatus {
    return {
      roomCode: room.roomCode,
      createdAt: room.createdAt,
      status: room.participants.size > 0 ? 'active' : 'idle',
      maxPlayers: this.config.maxPlayersPerRoom,
      participantCount: room.participants.size,
      participants: [...room.participants.values()],
      activePlayerId: room.activePlayerId,
      mode: room.mode,
    }
  }
}
