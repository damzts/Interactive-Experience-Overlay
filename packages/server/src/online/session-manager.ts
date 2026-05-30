/**
 * OnlineSessionManager — central coordinator for online rooms.
 * Creates/destroys rooms, manages participant lifecycle, and wires
 * audio scores to per-room POVSwitcher instances.
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 2.5,
 *              3.3, 3.4, 3.5, 3.6, 6.1, 6.2, 6.3, 6.4, 6.5,
 *              7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7
 */

import crypto from 'node:crypto'
import type { SwitchMode } from '@ieom/shared'
import type { OnlineModeConfig } from '@ieom/shared'
import { POVSwitcher } from '../pov/switcher.js'
import type { SwitchReason } from '../pov/switcher.js'
import { ParticipantRegistry } from './participant-registry.js'
import type { Participant } from './participant-registry.js'
import { createAudioScoreProcessor } from './audio-score-processor.js'
import type { AudioScoreProcessor } from './audio-score-processor.js'

// ── Types ────────────────────────────────────────────────────────

export interface OnlineRoomConfig {
  maxPlayersPerRoom: number
  maxActiveRooms: number
  audioReportIntervalMs: number
  rollingWindowMs: number
  cooldownMs: number
  activityThreshold: number
  silenceThreshold: number
  scoreEmitIntervalMs: number
  idleTimeoutMs: number
}

export interface OnlineRoom {
  roomCode: string
  userId: string | null
  createdAt: number
  maxPlayers: number
  participants: Map<string, Participant>
  switcher: POVSwitcher
  registry: ParticipantRegistry
  scoreProcessor: AudioScoreProcessor
  status: 'active' | 'idle'
  idleTimer: ReturnType<typeof setTimeout> | null
}

/** Event types emitted by the session manager */
export type SessionEvent =
  | { type: 'room:created'; roomCode: string; joinUrl: string; createdAt: number }
  | { type: 'room:closed'; roomCode: string }
  | { type: 'room:idle'; roomCode: string }
  | { type: 'participant:joined'; roomCode: string; participant: ParticipantInfo }
  | { type: 'participant:left'; roomCode: string; participantId: string }
  | { type: 'scores'; roomCode: string; scores: Array<{ participantId: string; score: number }>; timestamp: number }
  | { type: 'switch'; roomCode: string; previousId: string | null; newId: string; timestamp: number; reason: SwitchReason }
  | { type: 'mode:changed'; roomCode: string; mode: SwitchMode }
  | { type: 'status'; roomCode: string; status: OnlineRoomStatusInfo }

export interface ParticipantInfo {
  id: string
  displayName: string
  connectionStatus: 'connected' | 'disconnected'
  activityScore: number
  joinedAt: number
}

export interface OnlineRoomStatusInfo {
  roomCode: string
  createdAt: number
  status: 'active' | 'idle'
  maxPlayers: number
  participantCount: number
  participants: ParticipantInfo[]
  activePlayerId: string | null
  mode: SwitchMode
}

export type SessionEventCallback = (event: SessionEvent) => void

// ── Interface ────────────────────────────────────────────────────

export interface IOnlineSessionManager {
  createRoom(userId?: string): { roomCode: string; joinUrl: string } | { error: string }
  closeRoom(roomCode: string): void
  getRoom(roomCode: string): OnlineRoom | undefined
  getActiveRooms(): OnlineRoom[]
  joinRoom(roomCode: string, displayName: string, socketId: string): { participantId: string } | { error: string }
  leaveRoom(roomCode: string, participantId: string): void
  handleAudioReport(roomCode: string, participantId: string, level: number): void
  manualSelect(roomCode: string, participantId: string): { ok: boolean; error?: string }
  setMode(roomCode: string, mode: SwitchMode): void
  updateConfig(config: Partial<OnlineRoomConfig>): void
  onEvent(callback: SessionEventCallback): void
  offEvent(callback: SessionEventCallback): void
  getRoomStatus(roomCode: string): OnlineRoomStatusInfo | undefined
}

// ── Constants ────────────────────────────────────────────────────

const ROOM_CODE_LENGTH = 6
const ROOM_CODE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

const DEFAULT_CONFIG: OnlineRoomConfig = {
  maxPlayersPerRoom: 10,
  maxActiveRooms: 5,
  audioReportIntervalMs: 100,
  rollingWindowMs: 2000,
  cooldownMs: 3000,
  activityThreshold: 0.15,
  silenceThreshold: 0.05,
  scoreEmitIntervalMs: 500,
  idleTimeoutMs: 60000,
}

// ── Implementation ───────────────────────────────────────────────

export class OnlineSessionManager implements IOnlineSessionManager {
  private rooms: Map<string, OnlineRoom> = new Map()
  private config: OnlineRoomConfig
  private eventCallbacks: SessionEventCallback[] = []

  constructor(config?: Partial<OnlineRoomConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  // ── Room Creation ────────────────────────────────────────────

  createRoom(userId?: string): { roomCode: string; joinUrl: string } | { error: string } {
    // Enforce max active rooms limit (Req 1.4, 1.5)
    if (this.rooms.size >= this.config.maxActiveRooms) {
      return { error: 'room_limit_reached' }
    }

    // Generate unique room code (Req 1.1, 1.2)
    const roomCode = this.generateUniqueRoomCode()

    // Initialize room with per-room instances
    const participants = new Map<string, Participant>()
    const registry = new ParticipantRegistry(participants)
    // POVSwitcher accepts CameraRegistry structurally — ParticipantRegistry is compatible
    const switcher = new POVSwitcher(registry as any, {
      cooldownMs: this.config.cooldownMs,
      activityThreshold: this.config.activityThreshold,
      silenceThreshold: this.config.silenceThreshold,
    })
    const scoreProcessor = createAudioScoreProcessor()

    const room: OnlineRoom = {
      roomCode,
      userId: userId ?? null,
      createdAt: Date.now(),
      maxPlayers: this.config.maxPlayersPerRoom,
      participants,
      switcher,
      registry,
      scoreProcessor,
      status: 'active',
      idleTimer: null,
    }

    // Wire AudioScoreProcessor score updates → ParticipantRegistry → POVSwitcher
    scoreProcessor.onScoresUpdated((scores: Map<string, number>) => {
      // Update activity scores in the registry
      for (const [participantId, score] of scores) {
        registry.updateActivityScore(participantId, score)
      }

      // Feed scores into the switcher for evaluation
      switcher.evaluateScores(scores)

      // Emit scores event
      this.emit({
        type: 'scores',
        roomCode,
        scores: Array.from(scores.entries()).map(([participantId, score]) => ({
          participantId,
          score,
        })),
        timestamp: Date.now(),
      })
    })

    // Wire POVSwitcher switch events
    switcher.onSwitch((prev, next, timestamp, reason) => {
      this.emit({
        type: 'switch',
        roomCode,
        previousId: prev,
        newId: next,
        timestamp,
        reason,
      })
    })

    // Wire POVSwitcher mode change events
    switcher.onModeChange((mode) => {
      this.emit({
        type: 'mode:changed',
        roomCode,
        mode,
      })
    })

    // Start the score processor
    scoreProcessor.start({
      rollingWindowMs: this.config.rollingWindowMs,
      reportIntervalMs: this.config.audioReportIntervalMs,
      emitIntervalMs: this.config.scoreEmitIntervalMs,
    })

    this.rooms.set(roomCode, room)

    const joinUrl = `/online/room/${roomCode}`

    // Emit room created event
    this.emit({
      type: 'room:created',
      roomCode,
      joinUrl,
      createdAt: room.createdAt,
    })

    return { roomCode, joinUrl }
  }

  // ── Room Closure ─────────────────────────────────────────────

  closeRoom(roomCode: string): void {
    const room = this.rooms.get(roomCode)
    if (!room) return

    // Clear idle timer if running
    if (room.idleTimer !== null) {
      clearTimeout(room.idleTimer)
      room.idleTimer = null
    }

    // Stop the score processor
    room.scoreProcessor.stop()

    // Mark all participants as disconnected (Req 2.1)
    for (const participant of room.participants.values()) {
      participant.connectionStatus = 'disconnected'
    }

    // Remove room from active rooms
    this.rooms.delete(roomCode)

    // Emit room closed event
    this.emit({ type: 'room:closed', roomCode })
  }

  // ── Room Access ──────────────────────────────────────────────

  getRoom(roomCode: string): OnlineRoom | undefined {
    return this.rooms.get(roomCode)
  }

  getActiveRooms(): OnlineRoom[] {
    return Array.from(this.rooms.values())
  }

  // ── Player Join ──────────────────────────────────────────────

  joinRoom(
    roomCode: string,
    displayName: string,
    socketId: string,
  ): { participantId: string } | { error: string } {
    // Validate room code (Req 3.4)
    const room = this.rooms.get(roomCode)
    if (!room || room.status !== 'active') {
      return { error: 'room_not_found' }
    }

    // Validate display name (1-32 characters)
    if (!displayName || displayName.length === 0) {
      return { error: 'invalid_name' }
    }
    if (displayName.length > 32) {
      return { error: 'invalid_name' }
    }

    // Check capacity (Req 3.5)
    const connectedCount = this.getConnectedParticipantCount(room)
    if (connectedCount >= room.maxPlayers) {
      return { error: 'room_full' }
    }

    // Assign unique participant ID (Req 3.6)
    const participantId = crypto.randomUUID()

    const participant: Participant = {
      id: participantId,
      displayName,
      socketId,
      joinedAt: Date.now(),
      connectionStatus: 'connected',
      lastAudioReport: 0,
      activityScore: 0,
    }

    room.participants.set(participantId, participant)

    // Cancel idle timer if room was idle (Req 2.2)
    if (room.idleTimer !== null) {
      clearTimeout(room.idleTimer)
      room.idleTimer = null
      room.status = 'active'
    }

    // Emit participant joined event (Req 3.6)
    this.emit({
      type: 'participant:joined',
      roomCode,
      participant: {
        id: participantId,
        displayName,
        connectionStatus: 'connected',
        activityScore: 0,
        joinedAt: participant.joinedAt,
      },
    })

    return { participantId }
  }

  // ── Player Leave ─────────────────────────────────────────────

  leaveRoom(roomCode: string, participantId: string): void {
    const room = this.rooms.get(roomCode)
    if (!room) return

    const participant = room.participants.get(participantId)
    if (!participant) return

    // Remove participant from the room
    room.participants.delete(participantId)

    // Remove from score processor tracking
    room.scoreProcessor.removeParticipant(participantId)

    // Handle active player disconnect — notify switcher for fallback (Req 7.6)
    if (room.switcher.activeCameraId === participantId) {
      room.switcher.handleDisconnect(participantId)
    }

    // Emit participant left event
    this.emit({
      type: 'participant:left',
      roomCode,
      participantId,
    })

    // Start idle timer if room is now empty (Req 2.2)
    if (this.getConnectedParticipantCount(room) === 0) {
      this.startIdleTimer(room)
    }
  }

  // ── Audio Report Handling ────────────────────────────────────

  handleAudioReport(roomCode: string, participantId: string, level: number): void {
    const room = this.rooms.get(roomCode)
    if (!room) return

    const participant = room.participants.get(participantId)
    if (!participant) return

    // Update last audio report timestamp
    participant.lastAudioReport = Date.now()

    // Feed level into the room's AudioScoreProcessor (Req 6.1)
    room.scoreProcessor.reportLevel(participantId, level, Date.now())
  }

  // ── Manual Selection ─────────────────────────────────────────

  manualSelect(roomCode: string, participantId: string): { ok: boolean; error?: string } {
    const room = this.rooms.get(roomCode)
    if (!room) {
      return { ok: false, error: 'room_not_found' }
    }

    // Delegate to room's POVSwitcher (Req 7.5)
    const result = room.switcher.manualSelect(participantId)

    // Manual select also sets mode to manual
    if (result.ok) {
      room.switcher.setMode('manual')
    }

    return result
  }

  // ── Mode Setting ─────────────────────────────────────────────

  setMode(roomCode: string, mode: SwitchMode): void {
    const room = this.rooms.get(roomCode)
    if (!room) return

    room.switcher.setMode(mode)
  }

  // ── Configuration Update ─────────────────────────────────────

  updateConfig(config: Partial<OnlineRoomConfig>): void {
    // Merge new config values
    if (config.maxPlayersPerRoom !== undefined) {
      this.config.maxPlayersPerRoom = config.maxPlayersPerRoom
    }
    if (config.maxActiveRooms !== undefined) {
      this.config.maxActiveRooms = config.maxActiveRooms
    }
    if (config.audioReportIntervalMs !== undefined) {
      this.config.audioReportIntervalMs = config.audioReportIntervalMs
    }
    if (config.rollingWindowMs !== undefined) {
      this.config.rollingWindowMs = config.rollingWindowMs
    }
    if (config.cooldownMs !== undefined) {
      this.config.cooldownMs = config.cooldownMs
    }
    if (config.activityThreshold !== undefined) {
      this.config.activityThreshold = config.activityThreshold
    }
    if (config.silenceThreshold !== undefined) {
      this.config.silenceThreshold = config.silenceThreshold
    }
    if (config.scoreEmitIntervalMs !== undefined) {
      this.config.scoreEmitIntervalMs = config.scoreEmitIntervalMs
    }
    if (config.idleTimeoutMs !== undefined) {
      this.config.idleTimeoutMs = config.idleTimeoutMs
    }

    // Apply updated config to all active rooms
    for (const room of this.rooms.values()) {
      // Update POVSwitcher config
      room.switcher.updateConfig({
        cooldownMs: this.config.cooldownMs,
        activityThreshold: this.config.activityThreshold,
        silenceThreshold: this.config.silenceThreshold,
      })

      // Restart score processor with new config
      room.scoreProcessor.stop()
      room.scoreProcessor.start({
        rollingWindowMs: this.config.rollingWindowMs,
        reportIntervalMs: this.config.audioReportIntervalMs,
        emitIntervalMs: this.config.scoreEmitIntervalMs,
      })

      // Update room max players
      room.maxPlayers = this.config.maxPlayersPerRoom
    }
  }

  // ── Event Registration ───────────────────────────────────────

  onEvent(callback: SessionEventCallback): void {
    this.eventCallbacks.push(callback)
  }

  offEvent(callback: SessionEventCallback): void {
    const idx = this.eventCallbacks.indexOf(callback)
    if (idx !== -1) this.eventCallbacks.splice(idx, 1)
  }

  // ── Room Status ──────────────────────────────────────────────

  getRoomStatus(roomCode: string): OnlineRoomStatusInfo | undefined {
    const room = this.rooms.get(roomCode)
    if (!room) return undefined

    return {
      roomCode: room.roomCode,
      createdAt: room.createdAt,
      status: room.status,
      maxPlayers: room.maxPlayers,
      participantCount: this.getConnectedParticipantCount(room),
      participants: this.getParticipantInfoList(room),
      activePlayerId: room.switcher.activeCameraId,
      mode: room.switcher.mode,
    }
  }

  // ── Private Helpers ──────────────────────────────────────────

  /**
   * Generate a unique 6-character uppercase alphanumeric room code.
   * Retries if the generated code collides with an existing active room.
   */
  private generateUniqueRoomCode(): string {
    let code: string
    let attempts = 0
    const maxAttempts = 100

    do {
      code = ''
      for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
        const randomIndex = crypto.randomInt(ROOM_CODE_CHARS.length)
        code += ROOM_CODE_CHARS[randomIndex]
      }
      attempts++
    } while (this.rooms.has(code) && attempts < maxAttempts)

    return code
  }

  /**
   * Get the count of connected participants in a room.
   */
  private getConnectedParticipantCount(room: OnlineRoom): number {
    let count = 0
    for (const participant of room.participants.values()) {
      if (participant.connectionStatus === 'connected') {
        count++
      }
    }
    return count
  }

  /**
   * Get participant info list for a room.
   */
  private getParticipantInfoList(room: OnlineRoom): ParticipantInfo[] {
    const list: ParticipantInfo[] = []
    for (const participant of room.participants.values()) {
      list.push({
        id: participant.id,
        displayName: participant.displayName,
        connectionStatus: participant.connectionStatus,
        activityScore: participant.activityScore,
        joinedAt: participant.joinedAt,
      })
    }
    return list
  }

  /**
   * Start the idle timer for a room. After the configured timeout,
   * the room is marked as idle and a notification is emitted. (Req 2.2)
   */
  private startIdleTimer(room: OnlineRoom): void {
    if (room.idleTimer !== null) {
      clearTimeout(room.idleTimer)
    }

    room.idleTimer = setTimeout(() => {
      room.status = 'idle'
      room.idleTimer = null

      this.emit({ type: 'room:idle', roomCode: room.roomCode })
    }, this.config.idleTimeoutMs)
  }

  /**
   * Emit an event to all registered callbacks.
   */
  private emit(event: SessionEvent): void {
    for (const callback of this.eventCallbacks) {
      try {
        callback(event)
      } catch {
        // Ignore callback errors
      }
    }
  }
}
