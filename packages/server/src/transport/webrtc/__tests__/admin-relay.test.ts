/**
 * Unit tests for AdminRelay.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AdminRelay } from '../admin-relay.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockSocket() {
  return {
    emit: vi.fn(),
    on: vi.fn(),
    connected: true,
  }
}

function makeMockHub() {
  const trackCallbacks: Array<(userId: string, kind: string, track: any) => void> = []
  const removeCallbacks: Array<(userId: string) => void> = []

  return {
    onTrack: (cb: any) => trackCallbacks.push(cb),
    onParticipantRemoved: (cb: any) => removeCallbacks.push(cb),
    getAudioTrack: vi.fn(() => null) as any,
    _trackCallbacks: trackCallbacks,
    _removeCallbacks: removeCallbacks,
  }
}

function makeFakeTrack(kind: string) {
  return { kind, id: `${kind}-1` }
}

describe('AdminRelay', () => {
  let relay: AdminRelay

  beforeEach(() => {
    relay = new AdminRelay()
  })

  describe('initial state', () => {
    it('starts with no relays and no socket', () => {
      expect(relay.getStatus()).toEqual([])
    })
  })

  describe('setSocket / clearSocket', () => {
    it('accepts a socket and reports status', () => {
      const socket = makeMockSocket()
      relay.setSocket(socket as any)
      expect(relay.getStatus()).toEqual([])
    })

    it('clears socket on clearSocket', () => {
      const socket = makeMockSocket()
      relay.setSocket(socket as any)
      relay.clearSocket()
      expect(relay.getStatus()).toEqual([])
    })
  })

  describe('bindHub', () => {
    it('registers track and remove callbacks', () => {
      const hub = makeMockHub()
      relay.bindHub(hub as any)

      expect(hub._trackCallbacks.length).toBe(1)
      expect(hub._removeCallbacks.length).toBe(1)
    })
  })

  describe('getStatus', () => {
    it('returns empty when no participants have video', () => {
      expect(relay.getStatus()).toEqual([])
    })
  })

  describe('handleAnswer', () => {
    it('does not throw for unknown participant', async () => {
      await expect(relay.handleAnswer('unknown', 'sdp123')).resolves.toBeUndefined()
    })
  })

  describe('handleIceCandidate', () => {
    it('does not throw for unknown participant', async () => {
      await expect(relay.handleIceCandidate('unknown', { candidate: 'c1', sdpMid: '0', sdpMLineIndex: 0 })).resolves.toBeUndefined()
    })
  })

  describe('cleanup', () => {
    it('clears socket and relays', () => {
      const socket = makeMockSocket()
      relay.setSocket(socket as any)
      relay.cleanup()
      expect(relay.getStatus()).toEqual([])
    })
  })
})
