/**
 * Unit tests for OverlayRelay lifecycle.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { OverlayRelay } from '../overlay-relay.js'

describe('OverlayRelay', () => {
  let relay: OverlayRelay

  beforeEach(() => {
    relay = new OverlayRelay()
  })

  afterEach(() => {
    relay.cleanup()
  })

  describe('initial state', () => {
    it('should start disconnected', () => {
      expect(relay.isConnected()).toBe(false)
    })

    it('should cleanup safely when nothing started', () => {
      expect(() => relay.cleanup()).not.toThrow()
    })

    it('should pause do nothing', () => {
      expect(() => relay.pause()).not.toThrow()
    })
  })

  describe('offer lifecycle', () => {
    it('should handle handleAnswer without PC gracefully', async () => {
      await expect(relay.handleAnswer('test-sdp')).resolves.not.toThrow()
    })

    it('should handle handleIceCandidate without PC gracefully', async () => {
      await expect(
        relay.handleIceCandidate({ candidate: 'test', sdpMid: '0', sdpMLineIndex: 0 })
      ).resolves.not.toThrow()
    })
  })

  describe('cleanup', () => {
    it('should be safe to call multiple times', () => {
      relay.cleanup()
      relay.cleanup()
      relay.cleanup()
    })

    it('should reset connected state', () => {
      relay.cleanup()
      expect(relay.isConnected()).toBe(false)
    })
  })
})
