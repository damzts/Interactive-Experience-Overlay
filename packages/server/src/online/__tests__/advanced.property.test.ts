import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fc from 'fast-check'
import { POVSwitcher } from '../../pov/switcher.js'
import { ParticipantRegistry } from '../participant-registry.js'
import type { Participant } from '../participant-registry.js'
import { SignalingServer, type SignalingServerDeps, type SignalingLogger } from '../signaling.js'
import type { OnlineRoom } from '../session-manager.js'
import { OnlineSessionManager } from '../session-manager.js'
import type { SessionEvent } from '../session-manager.js'
import type { SignalingMessage } from '@ieom/shared'

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeParticipant(id: string, socketId: string, status: 'connected' | 'disconnected' = 'connected'): Participant {
  return {
    id,
    displayName: `Player ${id}`,
    socketId,
    joinedAt: Date.now(),
    connectionStatus: status,
    lastAudioReport: Date.now(),
    activityScore: 0,
  }
}

function makeRoom(participants: Participant[], roomCode = 'ABC123'): OnlineRoom {
  const participantMap = new Map<string, Participant>()
  for (const p of participants) {
    participantMap.set(p.id, p)
  }
  return {
    roomCode,
    createdAt: Date.now(),
    maxPlayers: 10,
    participants: participantMap,
    switcher: {} as any,
    registry: {} as any,
    scoreProcessor: {} as any,
    status: 'active',
    idleTimer: null,
  }
}

// ── Generators ───────────────────────────────────────────────────────────────

/** Generate a valid participant ID (alphanumeric, 4-12 chars) */
const participantIdArb = fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')), { minLength: 4, maxLength: 12 })

/** Generate a signaling message type */
const signalingTypeArb = fc.constantFrom('offer' as const, 'answer' as const, 'ice-candidate' as const)

/** Generate arbitrary SDP content */
const sdpContentArb = fc.string({ minLength: 1, maxLength: 500 })

/** Generate a signaling payload (SDP or ICE candidate) */
const signalingPayloadArb = fc.oneof(
  sdpContentArb.map((sdp) => ({ type: 'offer' as const, sdp }) as RTCSessionDescriptionInit),
  sdpContentArb.map((sdp) => ({ type: 'answer' as const, sdp }) as RTCSessionDescriptionInit),
  fc.record({
    candidate: fc.string({ minLength: 1, maxLength: 200 }),
    sdpMid: fc.string({ minLength: 0, maxLength: 10 }),
    sdpMLineIndex: fc.integer({ min: 0, max: 10 }),
  }).map((ice) => ice as RTCIceCandidateInit),
)

/** Generate a number of participants (2-10) */
const participantCountArb = fc.integer({ min: 2, max: 10 })

/** Generate an audio level (0-1) */
const audioLevelArb = fc.double({ min: 0, max: 1, noNaN: true })

/** Generate a score map entry */
const scoreEntryArb = fc.tuple(participantIdArb, audioLevelArb)

// ── Property Tests ───────────────────────────────────────────────────────────

describe('Advanced Property Tests', () => {
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
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('evaluating scores on one POVSwitcher instance does not affect another instance', () => {
      fc.assert(
        fc.property(
          // Generate 2-5 participant IDs for instance A
          fc.array(participantIdArb, { minLength: 2, maxLength: 5 }).chain((idsA) => {
            const uniqueIdsA = [...new Set(idsA)]
            if (uniqueIdsA.length < 2) return fc.constant({ idsA: ['p1', 'p2'], scoresA: [0.8, 0.3] })
            return fc.tuple(
              fc.constant(uniqueIdsA),
              fc.array(audioLevelArb, { minLength: uniqueIdsA.length, maxLength: uniqueIdsA.length }),
            ).map(([ids, scores]) => ({ idsA: ids, scoresA: scores }))
          }),
          // Generate 2-5 participant IDs for instance B
          fc.array(participantIdArb, { minLength: 2, maxLength: 5 }).chain((idsB) => {
            const uniqueIdsB = [...new Set(idsB)]
            if (uniqueIdsB.length < 2) return fc.constant({ idsB: ['q1', 'q2'], scoresB: [0.6, 0.9] })
            return fc.tuple(
              fc.constant(uniqueIdsB),
              fc.array(audioLevelArb, { minLength: uniqueIdsB.length, maxLength: uniqueIdsB.length }),
            ).map(([ids, scores]) => ({ idsB: ids, scoresB: scores }))
          }),
          (dataA, dataB) => {
            // Create two separate participant maps and registries
            const participantsA = new Map<string, Participant>()
            for (const id of dataA.idsA) {
              participantsA.set(id, makeParticipant(id, `socket-a-${id}`))
            }
            const registryA = new ParticipantRegistry(participantsA)

            const participantsB = new Map<string, Participant>()
            for (const id of dataB.idsB) {
              participantsB.set(id, makeParticipant(id, `socket-b-${id}`))
            }
            const registryB = new ParticipantRegistry(participantsB)

            // Create two separate POVSwitcher instances
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

            // Record initial state of instance B
            const initialBActiveCamera = switcherB.activeCameraId
            const initialBMode = switcherB.mode
            const initialBLastSwitch = switcherB.lastSwitchTimestamp

            // Evaluate scores on instance A
            const scoresA = new Map<string, number>()
            for (let i = 0; i < dataA.idsA.length; i++) {
              scoresA.set(dataA.idsA[i], dataA.scoresA[i])
            }
            switcherA.evaluateScores(scoresA)

            // Verify instance B is unchanged
            expect(switcherB.activeCameraId).toBe(initialBActiveCamera)
            expect(switcherB.mode).toBe(initialBMode)
            expect(switcherB.lastSwitchTimestamp).toBe(initialBLastSwitch)

            // Now evaluate scores on instance B and verify A's state is captured before
            const stateAAfterEval = {
              activeCamera: switcherA.activeCameraId,
              mode: switcherA.mode,
              lastSwitch: switcherA.lastSwitchTimestamp,
            }

            const scoresB = new Map<string, number>()
            for (let i = 0; i < dataB.idsB.length; i++) {
              scoresB.set(dataB.idsB[i], dataB.scoresB[i])
            }
            switcherB.evaluateScores(scoresB)

            // Verify instance A is unchanged after B's evaluation
            expect(switcherA.activeCameraId).toBe(stateAAfterEval.activeCamera)
            expect(switcherA.mode).toBe(stateAAfterEval.mode)
            expect(switcherA.lastSwitchTimestamp).toBe(stateAAfterEval.lastSwitch)
          },
        ),
        { numRuns: 100 },
      )
    })
  })

  /**
   * Feature: browser-pov-online, Property 6: Signaling relay integrity
   *
   * For any WebRTC signaling message (SDP offer, SDP answer, or ICE candidate)
   * sent from one peer to another via the signaling server, the payload received
   * by the target peer SHALL be byte-for-byte identical to the payload sent by
   * the source peer.
   *
   * **Validates: Requirements 4.2**
   */
  describe('Property 6: Signaling relay integrity', () => {
    it('relayed signaling message payload is identical to the sent payload', () => {
      fc.assert(
        fc.property(
          signalingTypeArb,
          signalingPayloadArb,
          (msgType, payload) => {
            // Set up two connected participants
            const p1 = makeParticipant('sender', 'socket-sender')
            const p2 = makeParticipant('receiver', 'socket-receiver')
            const room = makeRoom([p1, p2], 'ROOM01')

            let receivedPayload: unknown = null
            let receivedMessage: SignalingMessage | null = null

            const sendToSocket = vi.fn((socketId: string, event: string, msg: unknown) => {
              if (socketId === 'socket-receiver') {
                receivedMessage = msg as SignalingMessage
                receivedPayload = (msg as SignalingMessage).payload
              }
            })
            const getRoom = vi.fn().mockReturnValue(room)
            const getOverlaySocket = vi.fn().mockReturnValue(undefined)
            const logger: SignalingLogger = { warn: vi.fn() }

            const deps: SignalingServerDeps = { getRoom, sendToSocket, getOverlaySocket, logger }
            const server = new SignalingServer(deps)

            const message: SignalingMessage = {
              type: msgType,
              from: 'sender',
              to: 'receiver',
              roomCode: 'ROOM01',
              payload,
            }

            // Deep clone the original payload for comparison
            const originalPayload = JSON.parse(JSON.stringify(payload))

            server.relay(message)

            // Verify the message was sent
            expect(sendToSocket).toHaveBeenCalledOnce()

            // Verify the payload is identical (same reference — not modified)
            expect(receivedPayload).toBe(payload)

            // Also verify deep equality with original
            expect(JSON.parse(JSON.stringify(receivedPayload))).toEqual(originalPayload)

            // Verify the full message structure is preserved
            expect(receivedMessage!.type).toBe(msgType)
            expect(receivedMessage!.from).toBe('sender')
            expect(receivedMessage!.to).toBe('receiver')
            expect(receivedMessage!.roomCode).toBe('ROOM01')
          },
        ),
        { numRuns: 100 },
      )
    })
  })

  /**
   * Feature: browser-pov-online, Property 7: Signaling notifications reach all relevant participants
   *
   * For any online room with N connected participants, when a new participant joins,
   * all N existing participants SHALL receive a peer-joined notification. When a
   * participant disconnects, all remaining (N-1) participants SHALL receive a
   * peer-left notification.
   *
   * **Validates: Requirements 4.3, 4.7**
   */
  describe('Property 7: Signaling notifications reach all relevant participants', () => {
    it('notifyNewPeer sends notification to exactly N-1 connected participants (excluding the new peer)', () => {
      fc.assert(
        fc.property(
          participantCountArb,
          (n) => {
            // Create N participants, all connected
            const participants: Participant[] = []
            for (let i = 0; i < n; i++) {
              participants.push(makeParticipant(`p${i}`, `socket-${i}`))
            }
            const room = makeRoom(participants, 'TESTROOM')

            const sendToSocket = vi.fn()
            const getRoom = vi.fn().mockReturnValue(room)
            const getOverlaySocket = vi.fn().mockReturnValue(undefined)
            const logger: SignalingLogger = { warn: vi.fn() }

            const deps: SignalingServerDeps = { getRoom, sendToSocket, getOverlaySocket, logger }
            const server = new SignalingServer(deps)

            // The "new peer" is the last participant
            const newPeerId = `p${n - 1}`
            const newPeerName = `Player p${n - 1}`

            server.notifyNewPeer('TESTROOM', newPeerId, newPeerName)

            // Should notify exactly N-1 participants (all except the new peer)
            expect(sendToSocket).toHaveBeenCalledTimes(n - 1)

            // Verify each notified participant is NOT the new peer
            const notifiedSocketIds = sendToSocket.mock.calls.map((call) => call[0])
            expect(notifiedSocketIds).not.toContain(`socket-${n - 1}`)

            // Verify all other participants were notified
            for (let i = 0; i < n - 1; i++) {
              expect(notifiedSocketIds).toContain(`socket-${i}`)
            }

            // Verify the payload is correct
            for (const call of sendToSocket.mock.calls) {
              expect(call[1]).toBe('pov-online:peer:joined')
              expect(call[2]).toEqual({ participantId: newPeerId, displayName: newPeerName })
            }
          },
        ),
        { numRuns: 100 },
      )
    })

    it('notifyPeerDisconnect sends notification to exactly N-1 connected participants (excluding the disconnecting peer)', () => {
      fc.assert(
        fc.property(
          participantCountArb,
          (n) => {
            // Create N participants, all connected
            const participants: Participant[] = []
            for (let i = 0; i < n; i++) {
              participants.push(makeParticipant(`p${i}`, `socket-${i}`))
            }
            const room = makeRoom(participants, 'TESTROOM')

            const sendToSocket = vi.fn()
            const getRoom = vi.fn().mockReturnValue(room)
            const getOverlaySocket = vi.fn().mockReturnValue(undefined)
            const logger: SignalingLogger = { warn: vi.fn() }

            const deps: SignalingServerDeps = { getRoom, sendToSocket, getOverlaySocket, logger }
            const server = new SignalingServer(deps)

            // The disconnecting peer is the first participant
            const disconnectingPeerId = 'p0'

            server.notifyPeerDisconnect('TESTROOM', disconnectingPeerId)

            // Should notify exactly N-1 participants (all except the disconnecting peer)
            expect(sendToSocket).toHaveBeenCalledTimes(n - 1)

            // Verify the disconnecting peer was NOT notified
            const notifiedSocketIds = sendToSocket.mock.calls.map((call) => call[0])
            expect(notifiedSocketIds).not.toContain('socket-0')

            // Verify all remaining participants were notified
            for (let i = 1; i < n; i++) {
              expect(notifiedSocketIds).toContain(`socket-${i}`)
            }

            // Verify the payload is correct
            for (const call of sendToSocket.mock.calls) {
              expect(call[1]).toBe('pov-online:peer:left')
              expect(call[2]).toEqual({ participantId: disconnectingPeerId })
            }
          },
        ),
        { numRuns: 100 },
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
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('automatic switch events have correct previousId, newId, timestamp > 0, and reason=automatic', () => {
      fc.assert(
        fc.property(
          // Generate 2-5 players with varying audio levels
          fc.integer({ min: 2, max: 5 }),
          fc.array(fc.double({ min: 0.2, max: 1.0, noNaN: true }), { minLength: 5, maxLength: 5 }),
          (playerCount, levels) => {
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

            const result = manager.createRoom()
            if (!('roomCode' in result)) return // skip if room creation fails
            const roomCode = result.roomCode

            const participantIds: string[] = []
            for (let i = 0; i < playerCount; i++) {
              const join = manager.joinRoom(roomCode, `Player${i}`, `socket-${i}`)
              if ('participantId' in join) participantIds.push(join.participantId)
            }

            if (participantIds.length < 2) {
              manager.closeRoom(roomCode)
              return
            }

            // Feed audio levels to trigger initial automatic switch
            for (let tick = 0; tick < 6; tick++) {
              for (let i = 0; i < participantIds.length; i++) {
                const level = levels[i % levels.length]
                manager.handleAudioReport(roomCode, participantIds[i], level)
              }
              vi.advanceTimersByTime(100)
            }

            // Check switch events
            const switchEvents = events.filter(
              (e): e is Extract<SessionEvent, { type: 'switch' }> => e.type === 'switch',
            )

            for (const evt of switchEvents) {
              // Timestamp must be > 0
              expect(evt.timestamp).toBeGreaterThan(0)
              // Reason must be valid
              expect(['automatic', 'manual', 'fallback']).toContain(evt.reason)
              // newId must be one of the participants
              expect(participantIds).toContain(evt.newId)
              // previousId must be null or a participant
              if (evt.previousId !== null) {
                expect(participantIds).toContain(evt.previousId)
              }
              // roomCode must match
              expect(evt.roomCode).toBe(roomCode)
            }

            // The first switch should have previousId = null (initial selection)
            if (switchEvents.length > 0) {
              expect(switchEvents[0].previousId).toBeNull()
              expect(switchEvents[0].reason).toBe('automatic')
            }

            manager.closeRoom(roomCode)
          },
        ),
        { numRuns: 100 },
      )
    })

    it('manual switch events have correct previousId, newId, timestamp > 0, and reason=manual', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2, max: 5 }),
          (playerCount) => {
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

            const result = manager.createRoom()
            if (!('roomCode' in result)) return
            const roomCode = result.roomCode

            const participantIds: string[] = []
            for (let i = 0; i < playerCount; i++) {
              const join = manager.joinRoom(roomCode, `Player${i}`, `socket-${i}`)
              if ('participantId' in join) participantIds.push(join.participantId)
            }

            if (participantIds.length < 2) {
              manager.closeRoom(roomCode)
              return
            }

            // Feed audio to establish initial active player
            for (let tick = 0; tick < 6; tick++) {
              manager.handleAudioReport(roomCode, participantIds[0], 0.8)
              for (let i = 1; i < participantIds.length; i++) {
                manager.handleAudioReport(roomCode, participantIds[i], 0.2)
              }
              vi.advanceTimersByTime(100)
            }

            const room = manager.getRoom(roomCode)
            const activeBeforeManual = room!.switcher.activeCameraId

            // Clear events and perform manual select
            events.length = 0
            const targetIdx = activeBeforeManual === participantIds[0] ? 1 : 0
            const targetId = participantIds[targetIdx]

            const selectResult = manager.manualSelect(roomCode, targetId)
            expect(selectResult.ok).toBe(true)

            const switchEvents = events.filter(
              (e): e is Extract<SessionEvent, { type: 'switch' }> => e.type === 'switch',
            )

            expect(switchEvents.length).toBeGreaterThanOrEqual(1)
            const manualSwitch = switchEvents[0]
            expect(manualSwitch.previousId).toBe(activeBeforeManual)
            expect(manualSwitch.newId).toBe(targetId)
            expect(manualSwitch.timestamp).toBeGreaterThan(0)
            expect(manualSwitch.reason).toBe('manual')

            manager.closeRoom(roomCode)
          },
        ),
        { numRuns: 100 },
      )
    })

    it('fallback switch events have correct previousId, newId, timestamp > 0, and reason=fallback', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2, max: 5 }),
          (playerCount) => {
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

            const result = manager.createRoom()
            if (!('roomCode' in result)) return
            const roomCode = result.roomCode

            const participantIds: string[] = []
            for (let i = 0; i < playerCount; i++) {
              const join = manager.joinRoom(roomCode, `Player${i}`, `socket-${i}`)
              if ('participantId' in join) participantIds.push(join.participantId)
            }

            if (participantIds.length < 2) {
              manager.closeRoom(roomCode)
              return
            }

            // Feed audio to establish initial active player (first participant has highest)
            for (let tick = 0; tick < 6; tick++) {
              manager.handleAudioReport(roomCode, participantIds[0], 0.9)
              for (let i = 1; i < participantIds.length; i++) {
                manager.handleAudioReport(roomCode, participantIds[i], 0.3 + i * 0.05)
              }
              vi.advanceTimersByTime(100)
            }

            const room = manager.getRoom(roomCode)
            const activePlayer = room!.switcher.activeCameraId
            expect(activePlayer).toBe(participantIds[0])

            // Clear events and disconnect the active player
            events.length = 0
            manager.leaveRoom(roomCode, participantIds[0])

            const switchEvents = events.filter(
              (e): e is Extract<SessionEvent, { type: 'switch' }> => e.type === 'switch',
            )

            expect(switchEvents.length).toBeGreaterThanOrEqual(1)
            const fallbackSwitch = switchEvents[0]
            expect(fallbackSwitch.previousId).toBe(participantIds[0])
            expect(fallbackSwitch.timestamp).toBeGreaterThan(0)
            expect(fallbackSwitch.reason).toBe('fallback')
            // newId must be one of the remaining participants
            const remainingIds = participantIds.slice(1)
            expect(remainingIds).toContain(fallbackSwitch.newId)

            manager.closeRoom(roomCode)
          },
        ),
        { numRuns: 100 },
      )
    })
  })
})
