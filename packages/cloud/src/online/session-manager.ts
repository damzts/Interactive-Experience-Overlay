/**
 * Simplified room manager — tracks rooms, participants, and hub presence.
 * No media processing, no POV switching, no audio scoring.
 */

import crypto from 'node:crypto'

export interface RoomParticipant {
  userId: string
  displayName: string
  socketId: string
  joinedAt: number
}

export interface Room {
  roomId: string
  ownerId: string
  createdAt: number
  hubSocketId: string | null
  participants: Map<string, RoomParticipant>
}

export type RoomEventCallback = (event: RoomEvent) => void
export type RoomEvent =
  | { type: 'room:created'; roomId: string }
  | { type: 'room:closed'; roomId: string }
  | { type: 'hub:connected'; roomId: string; socketId: string }
  | { type: 'hub:disconnected'; roomId: string }
  | { type: 'participant:joined'; roomId: string; participant: RoomParticipant }
  | { type: 'participant:left'; roomId: string; userId: string }

const ROOM_CODE_LENGTH = 6
const ROOM_CODE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
const MAX_ROOMS = 10
const MAX_PARTICIPANTS = 10

export class RoomManager {
  private rooms = new Map<string, Room>()
  private callbacks: RoomEventCallback[] = []

  createRoom(ownerId: string): { roomId: string } | { error: string } {
    if (this.rooms.size >= MAX_ROOMS) return { error: 'room_limit_reached' }
    const roomId = this.generateCode()
    const room: Room = { roomId, ownerId, createdAt: Date.now(), hubSocketId: null, participants: new Map() }
    this.rooms.set(roomId, room)
    this.emit({ type: 'room:created', roomId })
    return { roomId }
  }

  closeRoom(roomId: string): void {
    if (!this.rooms.has(roomId)) return
    this.rooms.delete(roomId)
    this.emit({ type: 'room:closed', roomId })
  }

  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId)
  }

  getRooms(): Room[] {
    return [...this.rooms.values()]
  }

  setHub(roomId: string, socketId: string): boolean {
    const room = this.rooms.get(roomId)
    if (!room) return false
    room.hubSocketId = socketId
    this.emit({ type: 'hub:connected', roomId, socketId })
    return true
  }

  removeHub(roomId: string): void {
    const room = this.rooms.get(roomId)
    if (!room) return
    room.hubSocketId = null
    this.emit({ type: 'hub:disconnected', roomId })
  }

  addParticipant(roomId: string, userId: string, displayName: string, socketId: string): { ok: boolean; error?: string } {
    const room = this.rooms.get(roomId)
    if (!room) return { ok: false, error: 'room_not_found' }
    if (room.participants.size >= MAX_PARTICIPANTS) return { ok: false, error: 'room_full' }
    const participant: RoomParticipant = { userId, displayName, socketId, joinedAt: Date.now() }
    room.participants.set(userId, participant)
    this.emit({ type: 'participant:joined', roomId, participant })
    return { ok: true }
  }

  removeParticipant(roomId: string, userId: string): void {
    const room = this.rooms.get(roomId)
    if (!room) return
    room.participants.delete(userId)
    this.emit({ type: 'participant:left', roomId, userId })
  }

  findRoomBySocket(socketId: string): { room: Room; role: 'hub' | 'participant'; userId?: string } | null {
    for (const room of this.rooms.values()) {
      if (room.hubSocketId === socketId) return { room, role: 'hub' }
      for (const p of room.participants.values()) {
        if (p.socketId === socketId) return { room, role: 'participant', userId: p.userId }
      }
    }
    return null
  }

  onEvent(cb: RoomEventCallback): void {
    this.callbacks.push(cb)
  }

  private emit(event: RoomEvent): void {
    for (const cb of this.callbacks) { try { cb(event) } catch {} }
  }

  private generateCode(): string {
    let code: string
    do {
      code = ''
      for (let i = 0; i < ROOM_CODE_LENGTH; i++) code += ROOM_CODE_CHARS[crypto.randomInt(ROOM_CODE_CHARS.length)]
    } while (this.rooms.has(code))
    return code
  }
}
