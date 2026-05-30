import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fc from 'fast-check'
import { OnlineSessionManager } from '../session-manager.js'

// ── Test Setup ──────────────────────────────────────────────────────

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

// ── Generators ──────────────────────────────────────────────────────

/** Generate a valid display name (1-32 characters) */
const validDisplayName = fc.string({ minLength: 1, maxLength: 32 }).filter((s) => s.trim().length > 0)

/** Generate a valid maxActiveRooms config (1-10) */
const validMaxRooms = fc.integer({ min: 1, max: 10 })

/** Generate a valid maxPlayersPerRoom config (2-20) */
const validMaxPlayers = fc.integer({ min: 2, max: 20 })

/** Generate a fake socket ID */
const socketId = fc.uuid()

// ── Property Tests ──────────────────────────────────────────────────

describe('OnlineSessionManager Property Tests', () => {
  /**
   * Feature: browser-pov-online, Property 1: Room code validity and uniqueness
   *
   * For any sequence of room creation requests (up to the configured maximum),
   * every generated Room_Code SHALL be exactly 6 characters long, composed only
   * of uppercase letters and digits (A-Z, 0-9), and no two active rooms SHALL
   * share the same Room_Code.
   *
   * **Validates: Requirements 1.1, 1.2**
   */
  describe('Property 1: Room code validity and uniqueness', () => {
    it('all generated room codes are exactly 6 uppercase alphanumeric characters and unique among active rooms', () => {
      fc.assert(
        fc.property(
          validMaxRooms,
          (maxRooms) => {
            const manager = new OnlineSessionManager({
              maxActiveRooms: maxRooms,
              maxPlayersPerRoom: 10,
              idleTimeoutMs: 60000,
            })

            const codes: string[] = []

            for (let i = 0; i < maxRooms; i++) {
              const result = manager.createRoom()
              expect('roomCode' in result).toBe(true)
              if ('roomCode' in result) {
                const code = result.roomCode

                // Room code must be exactly 6 characters
                expect(code.length).toBe(6)

                // Room code must be composed only of uppercase letters and digits
                expect(code).toMatch(/^[A-Z0-9]{6}$/)

                codes.push(code)
              }
            }

            // All codes must be unique
            const uniqueCodes = new Set(codes)
            expect(uniqueCodes.size).toBe(codes.length)
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  /**
   * Feature: browser-pov-online, Property 2: Room and player capacity enforcement
   *
   * For any configured maximum room count (1-10) and maximum player count per room
   * (2-20), the system SHALL allow exactly that many rooms/players to be created/joined,
   * and any request beyond the limit SHALL be rejected with an appropriate error.
   *
   * **Validates: Requirements 1.3, 1.4, 1.5, 3.5**
   */
  describe('Property 2: Room and player capacity enforcement', () => {
    it('room creation is allowed up to maxActiveRooms and rejected beyond', () => {
      fc.assert(
        fc.property(
          validMaxRooms,
          (maxRooms) => {
            const manager = new OnlineSessionManager({
              maxActiveRooms: maxRooms,
              maxPlayersPerRoom: 10,
              idleTimeoutMs: 60000,
            })

            // Create exactly maxRooms rooms — all should succeed
            for (let i = 0; i < maxRooms; i++) {
              const result = manager.createRoom()
              expect('roomCode' in result).toBe(true)
            }

            // The next creation should be rejected
            const overflow = manager.createRoom()
            expect('error' in overflow).toBe(true)
            if ('error' in overflow) {
              expect(overflow.error).toBe('room_limit_reached')
            }
          }
        ),
        { numRuns: 100 }
      )
    })

    it('player join is allowed up to maxPlayersPerRoom and rejected beyond', () => {
      fc.assert(
        fc.property(
          validMaxPlayers,
          fc.array(validDisplayName, { minLength: 1, maxLength: 20 }),
          fc.array(socketId, { minLength: 20, maxLength: 20 }),
          (maxPlayers, names, sockets) => {
            const manager = new OnlineSessionManager({
              maxActiveRooms: 5,
              maxPlayersPerRoom: maxPlayers,
              idleTimeoutMs: 60000,
            })

            const roomResult = manager.createRoom()
            if (!('roomCode' in roomResult)) return // skip if room creation fails

            const roomCode = roomResult.roomCode

            // Join exactly maxPlayers players — all should succeed
            for (let i = 0; i < maxPlayers; i++) {
              const name = names[i % names.length]
              const sock = sockets[i % sockets.length] + `-${i}`
              const joinResult = manager.joinRoom(roomCode, name, sock)
              expect('participantId' in joinResult).toBe(true)
            }

            // The next join should be rejected with room_full
            const overflowJoin = manager.joinRoom(roomCode, 'Overflow', 'overflow-socket')
            expect('error' in overflowJoin).toBe(true)
            if ('error' in overflowJoin) {
              expect(overflowJoin.error).toBe('room_full')
            }
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  /**
   * Feature: browser-pov-online, Property 3: Participant count invariant
   *
   * For any sequence of join and leave operations on an online room, the reported
   * participant count SHALL always equal the actual number of participants with
   * `connectionStatus === 'connected'` in that room.
   *
   * **Validates: Requirements 2.4**
   */
  describe('Property 3: Participant count invariant', () => {
    it('reported participant count always equals the number of connected participants', () => {
      // Generate a sequence of join/leave operations
      const operation = fc.oneof(
        fc.record({ type: fc.constant('join' as const), name: validDisplayName, socket: socketId }),
        fc.record({ type: fc.constant('leave' as const) })
      )

      fc.assert(
        fc.property(
          fc.array(operation, { minLength: 1, maxLength: 30 }),
          (operations) => {
            const manager = new OnlineSessionManager({
              maxActiveRooms: 5,
              maxPlayersPerRoom: 20,
              idleTimeoutMs: 60000,
            })

            const roomResult = manager.createRoom()
            if (!('roomCode' in roomResult)) return
            const roomCode = roomResult.roomCode

            const joinedParticipants: string[] = []

            for (const op of operations) {
              if (op.type === 'join') {
                const result = manager.joinRoom(roomCode, op.name, op.socket + `-${joinedParticipants.length}`)
                if ('participantId' in result) {
                  joinedParticipants.push(result.participantId)
                }
              } else if (op.type === 'leave' && joinedParticipants.length > 0) {
                // Leave the first participant in the list
                const participantId = joinedParticipants.shift()!
                manager.leaveRoom(roomCode, participantId)
              }
            }

            // Check the invariant: reported count === actual connected count
            const status = manager.getRoomStatus(roomCode)
            expect(status).toBeDefined()
            if (status) {
              // Count participants with connectionStatus === 'connected'
              const room = manager.getRoom(roomCode)
              expect(room).toBeDefined()
              if (room) {
                let actualConnected = 0
                for (const participant of room.participants.values()) {
                  if (participant.connectionStatus === 'connected') {
                    actualConnected++
                  }
                }
                expect(status.participantCount).toBe(actualConnected)
              }
            }
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  /**
   * Feature: browser-pov-online, Property 4: Invalid room code rejection
   *
   * For any string that does not match an active room's Room_Code, a join request
   * with that code SHALL be rejected with a "room not found" error, and the system
   * state SHALL remain unchanged.
   *
   * **Validates: Requirements 3.4**
   */
  describe('Property 4: Invalid room code rejection', () => {
    it('join with any non-matching room code is rejected with room_not_found and state is unchanged', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 20 }),
          validDisplayName,
          socketId,
          (invalidCode, displayName, sock) => {
            const manager = new OnlineSessionManager({
              maxActiveRooms: 5,
              maxPlayersPerRoom: 10,
              idleTimeoutMs: 60000,
            })

            // Create a room so we have at least one active room
            const roomResult = manager.createRoom()
            if (!('roomCode' in roomResult)) return

            const activeRoomCode = roomResult.roomCode

            // Skip if the random string happens to match the active room code
            if (invalidCode === activeRoomCode) return

            // Capture state before the invalid join attempt
            const roomsBefore = manager.getActiveRooms().length
            const roomStatusBefore = manager.getRoomStatus(activeRoomCode)
            const participantCountBefore = roomStatusBefore?.participantCount ?? 0

            // Attempt to join with the invalid code
            const joinResult = manager.joinRoom(invalidCode, displayName, sock)

            // Should be rejected with room_not_found
            expect('error' in joinResult).toBe(true)
            if ('error' in joinResult) {
              expect(joinResult.error).toBe('room_not_found')
            }

            // System state should remain unchanged
            const roomsAfter = manager.getActiveRooms().length
            const roomStatusAfter = manager.getRoomStatus(activeRoomCode)
            const participantCountAfter = roomStatusAfter?.participantCount ?? 0

            expect(roomsAfter).toBe(roomsBefore)
            expect(participantCountAfter).toBe(participantCountBefore)
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  /**
   * Feature: browser-pov-online, Property 5: Participant ID uniqueness
   *
   * For any sequence of successful join operations across all active rooms, every
   * assigned participant ID SHALL be unique (no two participants, even across
   * different rooms, share the same ID).
   *
   * **Validates: Requirements 3.6**
   */
  describe('Property 5: Participant ID uniqueness', () => {
    it('all participant IDs are unique across all rooms', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 5 }),
          fc.integer({ min: 1, max: 10 }),
          fc.array(validDisplayName, { minLength: 1, maxLength: 50 }),
          (numRooms, playersPerRoom, names) => {
            const manager = new OnlineSessionManager({
              maxActiveRooms: numRooms,
              maxPlayersPerRoom: playersPerRoom,
              idleTimeoutMs: 60000,
            })

            const allParticipantIds: string[] = []
            const roomCodes: string[] = []

            // Create rooms
            for (let r = 0; r < numRooms; r++) {
              const result = manager.createRoom()
              if ('roomCode' in result) {
                roomCodes.push(result.roomCode)
              }
            }

            // Join players across all rooms
            let socketCounter = 0
            for (const roomCode of roomCodes) {
              for (let p = 0; p < playersPerRoom; p++) {
                const name = names[(socketCounter) % names.length]
                const joinResult = manager.joinRoom(roomCode, name, `socket-${socketCounter++}`)
                if ('participantId' in joinResult) {
                  allParticipantIds.push(joinResult.participantId)
                }
              }
            }

            // All participant IDs must be unique
            const uniqueIds = new Set(allParticipantIds)
            expect(uniqueIds.size).toBe(allParticipantIds.length)
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})
