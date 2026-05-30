import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fc from 'fast-check'
import { POVSwitcher } from '../../pov/switcher.js'
import { ParticipantRegistry } from '../participant-registry.js'
import type { Participant } from '../participant-registry.js'
import { OnlineSessionManager } from '../session-manager.js'
import type { SessionEvent } from '../session-manager.js'

// ── Test Setup ──────────────────────────────────────────────────────

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

// ── Generators ──────────────────────────────────────────────────────

/** Generate a valid participant ID */
const participantId = fc.uuid()

/** Generate a valid display name (1-32 characters) */
const validDisplayName = fc.string({ minLength: 1, maxLength: 32 }).filter((s) => s.trim().length > 0)

/** Generate a valid activity score (0-1) */
const activityScore = fc.double({ min: 0, max: 1, noNaN: true })

/** Generate a score map with 2-6 participants */
const scoreMap = fc.array(
  fc.tuple(participantId, activityScore),
  { minLength: 2, maxLength: 6 }
).map((entries) => {
  // Ensure unique participant IDs
  const seen = new Set<string>()
  const unique: Array<[string, number]> = []
  for (const [id, score] of entries) {
    if (!seen.has(id)) {
      seen.add(id)
      unique.push([id, score])
    }
  }
  return new Map(unique)
}).filter((m) => m.size >= 2)

/** Generate a SwitchMode */
const switchMode = fc.constantFrom('automatic' as const, 'manual' as const)

/** Generate a fake socket ID */
const socketId = fc.uuid()

// ── Helper Functions ────────────────────────────────────────────────

function createParticipantMap(ids: string[]): Map<string, Participant> {
  const map = new Map<string, Participant>()
  for (const id of ids) {
    map.set(id, {
      id,
      displayName: `Player-${id.slice(0, 4)}`,
      socketId: `socket-${id}`,
      joinedAt: Date.now(),
      connectionStatus: 'connected',
      lastAudioReport: 0,
      activityScore: 0,
    })
  }
  return map
}

// ── Property Tests ──────────────────────────────────────────────────

describe('POVSwitcher Property Tests', () => {
  /**
   * Feature: browser-pov-online, Property 14: POVSwitcher instance isolation
   *
   * For any two separate POVSwitcher instances (one for LAN, one for an online room),
   * evaluating scores on one instance SHALL not affect the active camera, mode, or
   * last switch timestamp of the other instance.
   *
   * **Validates: Requirements 12.2, 12.4**
   */
  describe('Property 14: POVSwitcher instance isolation', () => {
    it('evaluating scores on instance A does not affect instance B state', () => {
      fc.assert(
        fc.property(
          scoreMap,
          (scores) => {
            // Create two separate ParticipantRegistry instances with separate participant maps
            const idsA = Array.from(scores.keys())
            const idsB = [`b-${idsA[0]}`, `b-${idsA[1]}`]

            const participantsA = createParticipantMap(idsA)
            const participantsB = createParticipantMap(idsB)

            const registryA = new ParticipantRegistry(participantsA)
            const registryB = new ParticipantRegistry(participantsB)

            const switcherA = new POVSwitcher(registryA as any, {
              cooldownMs: 3000,
              activityThreshold: 0.15,
              silenceThreshold: 0.05,
            })
            const switcherB = new POVSwitcher(registryB as any, {
              cooldownMs: 3000,
              activityThreshold: 0.15,
              silenceThreshold: 0.05,
            })

            // Capture instance B state before any operations on A
            const bActiveBefore = switcherB.activeCameraId
            const bModeBefore = switcherB.mode
            const bTimestampBefore = switcherB.lastSwitchTimestamp

            // Evaluate scores on instance A
            switcherA.evaluateScores(scores)

            // Instance B state must remain unchanged
            expect(switcherB.activeCameraId).toBe(bActiveBefore)
            expect(switcherB.mode).toBe(bModeBefore)
            expect(switcherB.lastSwitchTimestamp).toBe(bTimestampBefore)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('manual select on instance A does not affect instance B state', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2, max: 5 }),
          (numParticipants) => {
            // Create participants for both instances
            const idsA: string[] = []
            const idsB: string[] = []
            for (let i = 0; i < numParticipants; i++) {
              idsA.push(`a-player-${i}`)
              idsB.push(`b-player-${i}`)
            }

            const participantsA = createParticipantMap(idsA)
            const participantsB = createParticipantMap(idsB)

            const registryA = new ParticipantRegistry(participantsA)
            const registryB = new ParticipantRegistry(participantsB)

            const switcherA = new POVSwitcher(registryA as any, {
              cooldownMs: 3000,
              activityThreshold: 0.15,
              silenceThreshold: 0.05,
            })
            const switcherB = new POVSwitcher(registryB as any, {
              cooldownMs: 3000,
              activityThreshold: 0.15,
              silenceThreshold: 0.05,
            })

            // Give instance B an initial state by evaluating scores
            const scoresB = new Map<string, number>()
            for (const id of idsB) {
              scoresB.set(id, 0.5)
            }
            switcherB.evaluateScores(scoresB)

            // Capture instance B state
            const bActiveBefore = switcherB.activeCameraId
            const bModeBefore = switcherB.mode
            const bTimestampBefore = switcherB.lastSwitchTimestamp

            // Perform manual select on instance A
            switcherA.manualSelect(idsA[0])

            // Instance B state must remain unchanged
            expect(switcherB.activeCameraId).toBe(bActiveBefore)
            expect(switcherB.mode).toBe(bModeBefore)
            expect(switcherB.lastSwitchTimestamp).toBe(bTimestampBefore)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('mode change on instance A does not affect instance B mode', () => {
      fc.assert(
        fc.property(
          switchMode,
          (newMode) => {
            // Create two separate instances
            const idsA = ['a-p1', 'a-p2']
            const idsB = ['b-p1', 'b-p2']

            const participantsA = createParticipantMap(idsA)
            const participantsB = createParticipantMap(idsB)

            const registryA = new ParticipantRegistry(participantsA)
            const registryB = new ParticipantRegistry(participantsB)

            const switcherA = new POVSwitcher(registryA as any, {
              cooldownMs: 3000,
              activityThreshold: 0.15,
              silenceThreshold: 0.05,
            })
            const switcherB = new POVSwitcher(registryB as any, {
              cooldownMs: 3000,
              activityThreshold: 0.15,
              silenceThreshold: 0.05,
            })

            // Capture instance B mode before
            const bModeBefore = switcherB.mode

            // Change mode on instance A
            switcherA.setMode(newMode)

            // Instance B mode must remain unchanged
            expect(switcherB.mode).toBe(bModeBefore)
          }
        ),
        { numRuns: 100 }
      )
    })
  })


  /**
   * Feature: browser-pov-online, Property 11: Switch event emission correctness
   *
   * For any active player change in an online room, the emitted switch event SHALL
   * contain the correct previous participant ID (or null if none), the correct new
   * participant ID, a valid timestamp, and the correct reason ('automatic', 'manual',
   * or 'fallback').
   *
   * **Validates: Requirements 7.3**
   */
  describe('Property 11: Switch event emission correctness', () => {
    it('automatic switch events have correct previousId, newId, timestamp, and reason', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2, max: 6 }),
          fc.array(
            fc.double({ min: 0.2, max: 1.0, noNaN: true }),
            { minLength: 2, maxLength: 6 }
          ),
          (numPlayers, levels) => {
            const manager = new OnlineSessionManager({
              maxActiveRooms: 5,
              maxPlayersPerRoom: 10,
              idleTimeoutMs: 60000,
              cooldownMs: 3000,
              activityThreshold: 0.15,
              silenceThreshold: 0.05,
              scoreEmitIntervalMs: 500,
              audioReportIntervalMs: 100,
              rollingWindowMs: 2000,
            })

            const events: SessionEvent[] = []
            manager.onEvent((event) => events.push(event))

            // Create room and join players
            const roomResult = manager.createRoom()
            if (!('roomCode' in roomResult)) return
            const roomCode = roomResult.roomCode

            const participantIds: string[] = []
            for (let i = 0; i < numPlayers; i++) {
              const join = manager.joinRoom(roomCode, `Player${i}`, `socket-${i}`)
              if ('participantId' in join) {
                participantIds.push(join.participantId)
              }
            }

            if (participantIds.length < 2) return

            // Feed audio levels to trigger automatic switch (initial selection)
            // Give the first player the highest level
            for (let tick = 0; tick < 6; tick++) {
              for (let i = 0; i < participantIds.length; i++) {
                const level = levels[i % levels.length]
                manager.handleAudioReport(roomCode, participantIds[i], level)
              }
              vi.advanceTimersByTime(100)
            }

            // Get switch events
            const switchEvents = events.filter(
              (e): e is Extract<SessionEvent, { type: 'switch' }> => e.type === 'switch'
            )

            // Verify each switch event has correct structure
            let expectedPrevious: string | null = null
            for (const evt of switchEvents) {
              // previousId should be null for first switch, or the previous active player
              expect(evt.previousId).toBe(expectedPrevious)

              // newId must be a valid participant ID in the room
              expect(participantIds).toContain(evt.newId)

              // timestamp must be a positive number
              expect(evt.timestamp).toBeGreaterThan(0)

              // reason must be 'automatic' for score-based switches
              expect(evt.reason).toBe('automatic')

              // roomCode must match
              expect(evt.roomCode).toBe(roomCode)

              // Update expected previous for next switch
              expectedPrevious = evt.newId
            }

            // Clean up
            manager.closeRoom(roomCode)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('manual select emits switch event with reason=manual', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2, max: 6 }),
          (numPlayers) => {
            const manager = new OnlineSessionManager({
              maxActiveRooms: 5,
              maxPlayersPerRoom: 10,
              idleTimeoutMs: 60000,
              cooldownMs: 3000,
              activityThreshold: 0.15,
              silenceThreshold: 0.05,
              scoreEmitIntervalMs: 500,
              audioReportIntervalMs: 100,
              rollingWindowMs: 2000,
            })

            const events: SessionEvent[] = []
            manager.onEvent((event) => events.push(event))

            // Create room and join players
            const roomResult = manager.createRoom()
            if (!('roomCode' in roomResult)) return
            const roomCode = roomResult.roomCode

            const participantIds: string[] = []
            for (let i = 0; i < numPlayers; i++) {
              const join = manager.joinRoom(roomCode, `Player${i}`, `socket-${i}`)
              if ('participantId' in join) {
                participantIds.push(join.participantId)
              }
            }

            if (participantIds.length < 2) return

            // Trigger initial selection so there's an active player
            for (let tick = 0; tick < 6; tick++) {
              for (let i = 0; i < participantIds.length; i++) {
                manager.handleAudioReport(roomCode, participantIds[i], 0.5 + i * 0.1)
              }
              vi.advanceTimersByTime(100)
            }

            // Get the current active player
            const room = manager.getRoom(roomCode)
            const activeBefore = room?.switcher.activeCameraId

            // Pick a different player to manually select
            const targetId = participantIds.find((id) => id !== activeBefore)
            if (!targetId) {
              manager.closeRoom(roomCode)
              return
            }

            // Clear events to focus on manual select
            events.length = 0

            // Perform manual select
            const result = manager.manualSelect(roomCode, targetId)
            expect(result.ok).toBe(true)

            // Get switch events after manual select
            const switchEvents = events.filter(
              (e): e is Extract<SessionEvent, { type: 'switch' }> => e.type === 'switch'
            )

            expect(switchEvents.length).toBeGreaterThanOrEqual(1)
            const manualSwitch = switchEvents[0]

            // previousId should be the previously active player
            expect(manualSwitch.previousId).toBe(activeBefore)

            // newId should be the manually selected player
            expect(manualSwitch.newId).toBe(targetId)

            // timestamp must be a positive number
            expect(manualSwitch.timestamp).toBeGreaterThan(0)

            // reason must be 'manual'
            expect(manualSwitch.reason).toBe('manual')

            // roomCode must match
            expect(manualSwitch.roomCode).toBe(roomCode)

            // Clean up
            manager.closeRoom(roomCode)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('disconnect of active player emits switch event with reason=fallback', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2, max: 6 }),
          (numPlayers) => {
            const manager = new OnlineSessionManager({
              maxActiveRooms: 5,
              maxPlayersPerRoom: 10,
              idleTimeoutMs: 60000,
              cooldownMs: 3000,
              activityThreshold: 0.15,
              silenceThreshold: 0.05,
              scoreEmitIntervalMs: 500,
              audioReportIntervalMs: 100,
              rollingWindowMs: 2000,
            })

            const events: SessionEvent[] = []
            manager.onEvent((event) => events.push(event))

            // Create room and join players
            const roomResult = manager.createRoom()
            if (!('roomCode' in roomResult)) return
            const roomCode = roomResult.roomCode

            const participantIds: string[] = []
            for (let i = 0; i < numPlayers; i++) {
              const join = manager.joinRoom(roomCode, `Player${i}`, `socket-${i}`)
              if ('participantId' in join) {
                participantIds.push(join.participantId)
              }
            }

            if (participantIds.length < 2) return

            // Trigger initial selection — give first player highest score
            for (let tick = 0; tick < 6; tick++) {
              for (let i = 0; i < participantIds.length; i++) {
                // First player gets highest level
                const level = i === 0 ? 0.9 : 0.3 + i * 0.05
                manager.handleAudioReport(roomCode, participantIds[i], level)
              }
              vi.advanceTimersByTime(100)
            }

            // Verify first player is active
            const room = manager.getRoom(roomCode)
            const activePlayer = room?.switcher.activeCameraId
            if (!activePlayer) {
              manager.closeRoom(roomCode)
              return
            }

            // Clear events to focus on disconnect
            events.length = 0

            // Disconnect the active player
            manager.leaveRoom(roomCode, activePlayer)

            // Get switch events after disconnect
            const switchEvents = events.filter(
              (e): e is Extract<SessionEvent, { type: 'switch' }> => e.type === 'switch'
            )

            // Should have emitted a fallback switch event
            expect(switchEvents.length).toBeGreaterThanOrEqual(1)
            const fallbackSwitch = switchEvents[0]

            // previousId should be the disconnected player
            expect(fallbackSwitch.previousId).toBe(activePlayer)

            // newId must be a valid remaining participant
            const remainingIds = participantIds.filter((id) => id !== activePlayer)
            expect(remainingIds).toContain(fallbackSwitch.newId)

            // timestamp must be a positive number
            expect(fallbackSwitch.timestamp).toBeGreaterThan(0)

            // reason must be 'fallback'
            expect(fallbackSwitch.reason).toBe('fallback')

            // roomCode must match
            expect(fallbackSwitch.roomCode).toBe(roomCode)

            // Clean up
            manager.closeRoom(roomCode)
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})
