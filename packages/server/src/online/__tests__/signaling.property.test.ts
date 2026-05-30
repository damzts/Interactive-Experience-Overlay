import { describe, it, expect, vi } from 'vitest'
import fc from 'fast-check'
import { SignalingServer, type SignalingServerDeps, type SignalingLogger } from '../signaling.js'
import type { OnlineRoom } from '../session-manager.js'
import type { Participant } from '../participant-registry.js'
import type { SignalingMessage } from '@ieom/shared'

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeParticipant(
  id: string,
  socketId: string,
  status: 'connected' | 'disconnected' = 'connected',
): Participant {
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

/** Generate a signaling message type */
const signalingTypeArb = fc.constantFrom(
  'offer' as const,
  'answer' as const,
  'ice-candidate' as const,
)

/** Generate arbitrary SDP content */
const sdpContentArb = fc.string({ minLength: 1, maxLength: 500 })

/** Generate a signaling payload (SDP or ICE candidate) */
const signalingPayloadArb = fc.oneof(
  sdpContentArb.map((sdp) => ({ type: 'offer' as const, sdp }) as RTCSessionDescriptionInit),
  sdpContentArb.map((sdp) => ({ type: 'answer' as const, sdp }) as RTCSessionDescriptionInit),
  fc
    .record({
      candidate: fc.string({ minLength: 1, maxLength: 200 }),
      sdpMid: fc.string({ minLength: 0, maxLength: 10 }),
      sdpMLineIndex: fc.integer({ min: 0, max: 10 }),
    })
    .map((ice) => ice as RTCIceCandidateInit),
)

/** Generate a number of participants (2-10) */
const participantCountArb = fc.integer({ min: 2, max: 10 })

// ── Property Tests ───────────────────────────────────────────────────────────

describe('Signaling Property Tests', () => {
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
        fc.property(signalingTypeArb, signalingPayloadArb, (msgType, payload) => {
          // Set up two connected participants
          const p1 = makeParticipant('sender', 'socket-sender')
          const p2 = makeParticipant('receiver', 'socket-receiver')
          const room = makeRoom([p1, p2], 'ROOM01')

          let receivedPayload: unknown = null
          let receivedMessage: SignalingMessage | null = null

          const sendToSocket = vi.fn(
            (socketId: string, _event: string, msg: unknown) => {
              if (socketId === 'socket-receiver') {
                receivedMessage = msg as SignalingMessage
                receivedPayload = (msg as SignalingMessage).payload
              }
            },
          )
          const getRoom = vi.fn().mockReturnValue(room)
          const getOverlaySocket = vi.fn().mockReturnValue(undefined)
          const logger: SignalingLogger = { warn: vi.fn() }

          const deps: SignalingServerDeps = {
            getRoom,
            sendToSocket,
            getOverlaySocket,
            logger,
          }
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
        }),
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
        fc.property(participantCountArb, (n) => {
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

          const deps: SignalingServerDeps = {
            getRoom,
            sendToSocket,
            getOverlaySocket,
            logger,
          }
          const server = new SignalingServer(deps)

          // The "new peer" is the last participant
          const newPeerId = `p${n - 1}`
          const newPeerName = `Player p${n - 1}`

          server.notifyNewPeer('TESTROOM', newPeerId, newPeerName)

          // Should notify exactly N-1 participants (all except the new peer)
          expect(sendToSocket).toHaveBeenCalledTimes(n - 1)

          // Verify each notified participant is NOT the new peer
          const notifiedSocketIds = sendToSocket.mock.calls.map(
            (call) => call[0],
          )
          expect(notifiedSocketIds).not.toContain(`socket-${n - 1}`)

          // Verify all other participants were notified
          for (let i = 0; i < n - 1; i++) {
            expect(notifiedSocketIds).toContain(`socket-${i}`)
          }

          // Verify the payload is correct
          for (const call of sendToSocket.mock.calls) {
            expect(call[1]).toBe('pov-online:peer:joined')
            expect(call[2]).toEqual({
              participantId: newPeerId,
              displayName: newPeerName,
            })
          }
        }),
        { numRuns: 100 },
      )
    })

    it('notifyPeerDisconnect sends notification to exactly N-1 connected participants (excluding the disconnecting peer)', () => {
      fc.assert(
        fc.property(participantCountArb, (n) => {
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

          const deps: SignalingServerDeps = {
            getRoom,
            sendToSocket,
            getOverlaySocket,
            logger,
          }
          const server = new SignalingServer(deps)

          // The disconnecting peer is the first participant
          const disconnectingPeerId = 'p0'

          server.notifyPeerDisconnect('TESTROOM', disconnectingPeerId)

          // Should notify exactly N-1 participants (all except the disconnecting peer)
          expect(sendToSocket).toHaveBeenCalledTimes(n - 1)

          // Verify the disconnecting peer was NOT notified
          const notifiedSocketIds = sendToSocket.mock.calls.map(
            (call) => call[0],
          )
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
        }),
        { numRuns: 100 },
      )
    })

    it('overlay receives notifications when subscribed', () => {
      fc.assert(
        fc.property(participantCountArb, (n) => {
          // Create N participants, all connected
          const participants: Participant[] = []
          for (let i = 0; i < n; i++) {
            participants.push(makeParticipant(`p${i}`, `socket-${i}`))
          }
          const room = makeRoom(participants, 'TESTROOM')

          const sendToSocket = vi.fn()
          const getRoom = vi.fn().mockReturnValue(room)
          const getOverlaySocket = vi.fn().mockReturnValue('overlay-socket')
          const logger: SignalingLogger = { warn: vi.fn() }

          const deps: SignalingServerDeps = {
            getRoom,
            sendToSocket,
            getOverlaySocket,
            logger,
          }
          const server = new SignalingServer(deps)

          // New peer joins — overlay should also be notified
          const newPeerId = `p${n - 1}`
          const newPeerName = `Player p${n - 1}`

          server.notifyNewPeer('TESTROOM', newPeerId, newPeerName)

          // N-1 participants + 1 overlay = N total calls
          expect(sendToSocket).toHaveBeenCalledTimes(n)

          // Verify overlay received the notification
          const overlayCalls = sendToSocket.mock.calls.filter(
            (call) => call[0] === 'overlay-socket',
          )
          expect(overlayCalls).toHaveLength(1)
          expect(overlayCalls[0][1]).toBe('pov-online:peer:joined')
          expect(overlayCalls[0][2]).toEqual({
            participantId: newPeerId,
            displayName: newPeerName,
          })

          // Reset and test disconnect notification
          sendToSocket.mockClear()

          const disconnectingPeerId = 'p0'
          server.notifyPeerDisconnect('TESTROOM', disconnectingPeerId)

          // N-1 participants + 1 overlay = N total calls
          expect(sendToSocket).toHaveBeenCalledTimes(n)

          // Verify overlay received the disconnect notification
          const overlayDisconnectCalls = sendToSocket.mock.calls.filter(
            (call) => call[0] === 'overlay-socket',
          )
          expect(overlayDisconnectCalls).toHaveLength(1)
          expect(overlayDisconnectCalls[0][1]).toBe('pov-online:peer:left')
          expect(overlayDisconnectCalls[0][2]).toEqual({
            participantId: disconnectingPeerId,
          })
        }),
        { numRuns: 100 },
      )
    })
  })
})
