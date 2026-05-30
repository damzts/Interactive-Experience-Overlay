import { describe, it, expect, beforeEach, vi } from 'vitest'
import { SignalingServer, type SignalingServerDeps, type SignalingLogger } from '../signaling.js'
import type { OnlineRoom } from '../session-manager.js'
import type { Participant } from '../participant-registry.js'
import type { SignalingMessage } from '@ieom/shared'

// ── Helpers ──────────────────────────────────────────────────────

function makeParticipant(overrides: Partial<Participant> = {}): Participant {
  return {
    id: 'p1',
    displayName: 'Player 1',
    socketId: 'socket-1',
    joinedAt: Date.now(),
    connectionStatus: 'connected',
    lastAudioReport: Date.now(),
    activityScore: 0,
    ...overrides,
  }
}

function makeRoom(participants: Participant[] = []): OnlineRoom {
  const participantMap = new Map<string, Participant>()
  for (const p of participants) {
    participantMap.set(p.id, p)
  }

  return {
    roomCode: 'ABC123',
    createdAt: Date.now(),
    maxPlayers: 10,
    participants: participantMap,
    // These are not used by SignalingServer, stub them
    switcher: {} as any,
    registry: {} as any,
    scoreProcessor: {} as any,
    status: 'active',
    idleTimer: null,
  }
}

function makeSignalingMessage(overrides: Partial<SignalingMessage> = {}): SignalingMessage {
  return {
    type: 'offer',
    from: 'p1',
    to: 'p2',
    roomCode: 'ABC123',
    payload: { type: 'offer', sdp: 'v=0\r\n...' } as RTCSessionDescriptionInit,
    ...overrides,
  }
}

// ── Tests ────────────────────────────────────────────────────────

describe('SignalingServer', () => {
  let sendToSocket: ReturnType<typeof vi.fn>
  let getRoom: ReturnType<typeof vi.fn>
  let getOverlaySocket: ReturnType<typeof vi.fn>
  let logger: SignalingLogger
  let server: SignalingServer

  beforeEach(() => {
    sendToSocket = vi.fn()
    getRoom = vi.fn()
    getOverlaySocket = vi.fn().mockReturnValue(undefined)
    logger = { warn: vi.fn() }

    const deps: SignalingServerDeps = {
      getRoom,
      sendToSocket,
      getOverlaySocket,
      logger,
    }

    server = new SignalingServer(deps)
  })

  describe('relay', () => {
    it('forwards message to target participant unchanged', () => {
      const p1 = makeParticipant({ id: 'p1', socketId: 'socket-1' })
      const p2 = makeParticipant({ id: 'p2', socketId: 'socket-2' })
      const room = makeRoom([p1, p2])
      getRoom.mockReturnValue(room)

      const message = makeSignalingMessage({ from: 'p1', to: 'p2' })
      server.relay(message)

      expect(sendToSocket).toHaveBeenCalledOnce()
      expect(sendToSocket).toHaveBeenCalledWith('socket-2', 'pov-online:signal', message)
    })

    it('does not modify the payload', () => {
      const p1 = makeParticipant({ id: 'p1', socketId: 'socket-1' })
      const p2 = makeParticipant({ id: 'p2', socketId: 'socket-2' })
      const room = makeRoom([p1, p2])
      getRoom.mockReturnValue(room)

      const payload = { type: 'offer' as const, sdp: 'original-sdp-content' }
      const message = makeSignalingMessage({ from: 'p1', to: 'p2', payload })
      server.relay(message)

      const sentMessage = sendToSocket.mock.calls[0][2] as SignalingMessage
      expect(sentMessage.payload).toBe(payload) // Same reference, not modified
    })

    it('drops message when room does not exist', () => {
      getRoom.mockReturnValue(undefined)

      const message = makeSignalingMessage()
      server.relay(message)

      expect(sendToSocket).not.toHaveBeenCalled()
      expect(logger.warn).toHaveBeenCalledWith(
        'relay: room not found',
        expect.objectContaining({ roomCode: 'ABC123' }),
      )
    })

    it('drops message when sender is not a participant in the room', () => {
      const p2 = makeParticipant({ id: 'p2', socketId: 'socket-2' })
      const room = makeRoom([p2])
      getRoom.mockReturnValue(room)

      const message = makeSignalingMessage({ from: 'unknown-sender', to: 'p2' })
      server.relay(message)

      expect(sendToSocket).not.toHaveBeenCalled()
      expect(logger.warn).toHaveBeenCalledWith(
        'relay: sender not authenticated in room',
        expect.objectContaining({ from: 'unknown-sender' }),
      )
    })

    it('drops message when sender is disconnected', () => {
      const p1 = makeParticipant({ id: 'p1', socketId: 'socket-1', connectionStatus: 'disconnected' })
      const p2 = makeParticipant({ id: 'p2', socketId: 'socket-2' })
      const room = makeRoom([p1, p2])
      getRoom.mockReturnValue(room)

      const message = makeSignalingMessage({ from: 'p1', to: 'p2' })
      server.relay(message)

      expect(sendToSocket).not.toHaveBeenCalled()
      expect(logger.warn).toHaveBeenCalledWith(
        'relay: sender not authenticated in room',
        expect.objectContaining({ from: 'p1' }),
      )
    })

    it('drops message to unknown target with warning log', () => {
      const p1 = makeParticipant({ id: 'p1', socketId: 'socket-1' })
      const room = makeRoom([p1])
      getRoom.mockReturnValue(room)

      const message = makeSignalingMessage({ from: 'p1', to: 'unknown-target' })
      server.relay(message)

      expect(sendToSocket).not.toHaveBeenCalled()
      expect(logger.warn).toHaveBeenCalledWith(
        'relay: unknown target, dropping message',
        expect.objectContaining({ to: 'unknown-target' }),
      )
    })

    it('drops message to disconnected target with warning log', () => {
      const p1 = makeParticipant({ id: 'p1', socketId: 'socket-1' })
      const p2 = makeParticipant({ id: 'p2', socketId: 'socket-2', connectionStatus: 'disconnected' })
      const room = makeRoom([p1, p2])
      getRoom.mockReturnValue(room)

      const message = makeSignalingMessage({ from: 'p1', to: 'p2' })
      server.relay(message)

      expect(sendToSocket).not.toHaveBeenCalled()
      expect(logger.warn).toHaveBeenCalledWith(
        'relay: unknown target, dropping message',
        expect.objectContaining({ to: 'p2' }),
      )
    })

    it('allows overlay as sender when subscribed', () => {
      const p1 = makeParticipant({ id: 'p1', socketId: 'socket-1' })
      const room = makeRoom([p1])
      getRoom.mockReturnValue(room)
      getOverlaySocket.mockReturnValue('overlay-socket')

      const message = makeSignalingMessage({ from: 'overlay', to: 'p1' })
      server.relay(message)

      expect(sendToSocket).toHaveBeenCalledOnce()
      expect(sendToSocket).toHaveBeenCalledWith('socket-1', 'pov-online:signal', message)
    })

    it('drops message from overlay when overlay is not subscribed', () => {
      const p1 = makeParticipant({ id: 'p1', socketId: 'socket-1' })
      const room = makeRoom([p1])
      getRoom.mockReturnValue(room)
      getOverlaySocket.mockReturnValue(undefined)

      const message = makeSignalingMessage({ from: 'overlay', to: 'p1' })
      server.relay(message)

      expect(sendToSocket).not.toHaveBeenCalled()
      expect(logger.warn).toHaveBeenCalledWith(
        'relay: overlay sender not subscribed to room',
        expect.objectContaining({ from: 'overlay' }),
      )
    })

    it('relays message to overlay when target is overlay', () => {
      const p1 = makeParticipant({ id: 'p1', socketId: 'socket-1' })
      const room = makeRoom([p1])
      getRoom.mockReturnValue(room)
      getOverlaySocket.mockReturnValue('overlay-socket')

      const message = makeSignalingMessage({ from: 'p1', to: 'overlay' })
      server.relay(message)

      expect(sendToSocket).toHaveBeenCalledOnce()
      expect(sendToSocket).toHaveBeenCalledWith('overlay-socket', 'pov-online:signal', message)
    })

    it('drops message to overlay when overlay is not subscribed', () => {
      const p1 = makeParticipant({ id: 'p1', socketId: 'socket-1' })
      const room = makeRoom([p1])
      getRoom.mockReturnValue(room)
      getOverlaySocket.mockReturnValue(undefined)

      const message = makeSignalingMessage({ from: 'p1', to: 'overlay' })
      server.relay(message)

      expect(sendToSocket).not.toHaveBeenCalled()
      expect(logger.warn).toHaveBeenCalledWith(
        'relay: unknown target, dropping message',
        expect.objectContaining({ to: 'overlay' }),
      )
    })

    it('relays ICE candidate messages', () => {
      const p1 = makeParticipant({ id: 'p1', socketId: 'socket-1' })
      const p2 = makeParticipant({ id: 'p2', socketId: 'socket-2' })
      const room = makeRoom([p1, p2])
      getRoom.mockReturnValue(room)

      const icePayload = { candidate: 'candidate:123', sdpMid: '0', sdpMLineIndex: 0 } as RTCIceCandidateInit
      const message = makeSignalingMessage({ type: 'ice-candidate', from: 'p1', to: 'p2', payload: icePayload })
      server.relay(message)

      expect(sendToSocket).toHaveBeenCalledWith('socket-2', 'pov-online:signal', message)
    })

    it('relays answer messages', () => {
      const p1 = makeParticipant({ id: 'p1', socketId: 'socket-1' })
      const p2 = makeParticipant({ id: 'p2', socketId: 'socket-2' })
      const room = makeRoom([p1, p2])
      getRoom.mockReturnValue(room)

      const answerPayload = { type: 'answer' as const, sdp: 'v=0\r\nanswer...' }
      const message = makeSignalingMessage({ type: 'answer', from: 'p2', to: 'p1', payload: answerPayload })
      server.relay(message)

      expect(sendToSocket).toHaveBeenCalledWith('socket-1', 'pov-online:signal', message)
    })
  })

  describe('notifyNewPeer', () => {
    it('notifies all existing participants except the new one', () => {
      const p1 = makeParticipant({ id: 'p1', socketId: 'socket-1' })
      const p2 = makeParticipant({ id: 'p2', socketId: 'socket-2' })
      const p3 = makeParticipant({ id: 'p3', socketId: 'socket-3' })
      const room = makeRoom([p1, p2, p3])
      getRoom.mockReturnValue(room)

      server.notifyNewPeer('ABC123', 'p3', 'Player 3')

      // Should notify p1 and p2, but NOT p3 (the new peer)
      expect(sendToSocket).toHaveBeenCalledTimes(2)
      expect(sendToSocket).toHaveBeenCalledWith('socket-1', 'pov-online:peer:joined', {
        participantId: 'p3',
        displayName: 'Player 3',
      })
      expect(sendToSocket).toHaveBeenCalledWith('socket-2', 'pov-online:peer:joined', {
        participantId: 'p3',
        displayName: 'Player 3',
      })
    })

    it('does not notify disconnected participants', () => {
      const p1 = makeParticipant({ id: 'p1', socketId: 'socket-1', connectionStatus: 'disconnected' })
      const p2 = makeParticipant({ id: 'p2', socketId: 'socket-2' })
      const p3 = makeParticipant({ id: 'p3', socketId: 'socket-3' })
      const room = makeRoom([p1, p2, p3])
      getRoom.mockReturnValue(room)

      server.notifyNewPeer('ABC123', 'p3', 'Player 3')

      // Only p2 should be notified (p1 is disconnected, p3 is the new peer)
      expect(sendToSocket).toHaveBeenCalledTimes(1)
      expect(sendToSocket).toHaveBeenCalledWith('socket-2', 'pov-online:peer:joined', {
        participantId: 'p3',
        displayName: 'Player 3',
      })
    })

    it('notifies overlay if subscribed', () => {
      const p1 = makeParticipant({ id: 'p1', socketId: 'socket-1' })
      const p2 = makeParticipant({ id: 'p2', socketId: 'socket-2' })
      const room = makeRoom([p1, p2])
      getRoom.mockReturnValue(room)
      getOverlaySocket.mockReturnValue('overlay-socket')

      server.notifyNewPeer('ABC123', 'p2', 'Player 2')

      // p1 + overlay
      expect(sendToSocket).toHaveBeenCalledTimes(2)
      expect(sendToSocket).toHaveBeenCalledWith('overlay-socket', 'pov-online:peer:joined', {
        participantId: 'p2',
        displayName: 'Player 2',
      })
    })

    it('does not notify overlay if not subscribed', () => {
      const p1 = makeParticipant({ id: 'p1', socketId: 'socket-1' })
      const p2 = makeParticipant({ id: 'p2', socketId: 'socket-2' })
      const room = makeRoom([p1, p2])
      getRoom.mockReturnValue(room)
      getOverlaySocket.mockReturnValue(undefined)

      server.notifyNewPeer('ABC123', 'p2', 'Player 2')

      // Only p1
      expect(sendToSocket).toHaveBeenCalledTimes(1)
      expect(sendToSocket).toHaveBeenCalledWith('socket-1', 'pov-online:peer:joined', {
        participantId: 'p2',
        displayName: 'Player 2',
      })
    })

    it('does nothing when room does not exist', () => {
      getRoom.mockReturnValue(undefined)

      server.notifyNewPeer('INVALID', 'p1', 'Player 1')

      expect(sendToSocket).not.toHaveBeenCalled()
    })

    it('handles room with only the new peer (no one to notify)', () => {
      const p1 = makeParticipant({ id: 'p1', socketId: 'socket-1' })
      const room = makeRoom([p1])
      getRoom.mockReturnValue(room)

      server.notifyNewPeer('ABC123', 'p1', 'Player 1')

      expect(sendToSocket).not.toHaveBeenCalled()
    })
  })

  describe('notifyPeerDisconnect', () => {
    it('notifies all remaining connected participants', () => {
      const p1 = makeParticipant({ id: 'p1', socketId: 'socket-1' })
      const p2 = makeParticipant({ id: 'p2', socketId: 'socket-2' })
      const p3 = makeParticipant({ id: 'p3', socketId: 'socket-3' })
      const room = makeRoom([p1, p2, p3])
      getRoom.mockReturnValue(room)

      server.notifyPeerDisconnect('ABC123', 'p3')

      // Should notify p1 and p2, but NOT p3 (the disconnected peer)
      expect(sendToSocket).toHaveBeenCalledTimes(2)
      expect(sendToSocket).toHaveBeenCalledWith('socket-1', 'pov-online:peer:left', {
        participantId: 'p3',
      })
      expect(sendToSocket).toHaveBeenCalledWith('socket-2', 'pov-online:peer:left', {
        participantId: 'p3',
      })
    })

    it('does not notify disconnected participants', () => {
      const p1 = makeParticipant({ id: 'p1', socketId: 'socket-1', connectionStatus: 'disconnected' })
      const p2 = makeParticipant({ id: 'p2', socketId: 'socket-2' })
      const p3 = makeParticipant({ id: 'p3', socketId: 'socket-3' })
      const room = makeRoom([p1, p2, p3])
      getRoom.mockReturnValue(room)

      server.notifyPeerDisconnect('ABC123', 'p3')

      // Only p2 should be notified (p1 is disconnected, p3 is the leaving peer)
      expect(sendToSocket).toHaveBeenCalledTimes(1)
      expect(sendToSocket).toHaveBeenCalledWith('socket-2', 'pov-online:peer:left', {
        participantId: 'p3',
      })
    })

    it('notifies overlay if subscribed', () => {
      const p1 = makeParticipant({ id: 'p1', socketId: 'socket-1' })
      const p2 = makeParticipant({ id: 'p2', socketId: 'socket-2' })
      const room = makeRoom([p1, p2])
      getRoom.mockReturnValue(room)
      getOverlaySocket.mockReturnValue('overlay-socket')

      server.notifyPeerDisconnect('ABC123', 'p2')

      // p1 + overlay
      expect(sendToSocket).toHaveBeenCalledTimes(2)
      expect(sendToSocket).toHaveBeenCalledWith('overlay-socket', 'pov-online:peer:left', {
        participantId: 'p2',
      })
    })

    it('does not notify overlay if not subscribed', () => {
      const p1 = makeParticipant({ id: 'p1', socketId: 'socket-1' })
      const p2 = makeParticipant({ id: 'p2', socketId: 'socket-2' })
      const room = makeRoom([p1, p2])
      getRoom.mockReturnValue(room)
      getOverlaySocket.mockReturnValue(undefined)

      server.notifyPeerDisconnect('ABC123', 'p2')

      // Only p1
      expect(sendToSocket).toHaveBeenCalledTimes(1)
      expect(sendToSocket).toHaveBeenCalledWith('socket-1', 'pov-online:peer:left', {
        participantId: 'p2',
      })
    })

    it('does nothing when room does not exist', () => {
      getRoom.mockReturnValue(undefined)

      server.notifyPeerDisconnect('INVALID', 'p1')

      expect(sendToSocket).not.toHaveBeenCalled()
    })

    it('handles room with no remaining participants', () => {
      const p1 = makeParticipant({ id: 'p1', socketId: 'socket-1' })
      const room = makeRoom([p1])
      getRoom.mockReturnValue(room)

      server.notifyPeerDisconnect('ABC123', 'p1')

      // No one to notify (p1 is the one disconnecting)
      expect(sendToSocket).not.toHaveBeenCalled()
    })
  })
})
