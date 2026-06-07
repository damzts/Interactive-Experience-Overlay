import { describe, it, expect, beforeEach } from 'vitest'
import { HubConnection } from '../hub-connection.js'

describe('HubConnection', () => {
  let hub: HubConnection

  beforeEach(() => {
    hub = new HubConnection()
  })

  describe('participant lifecycle', () => {
    it('should add participants and track them', async () => {
      const sdp = await hub.handleOffer('user-1', 'sdp')
      expect(sdp).toBeTruthy()
      expect(hub.getParticipantIds()).toContain('user-1')
      expect(hub.hasParticipant('user-1')).toBe(true)
    })

    it('should allow multiple participants', async () => {
      await hub.handleOffer('user-1', 'sdp')
      await hub.handleOffer('user-2', 'sdp')
      await hub.handleOffer('user-3', 'sdp')
      expect(hub.getParticipantIds()).toHaveLength(3)
    })

    it('should remove participant on removeParticipant', async () => {
      await hub.handleOffer('user-1', 'sdp')
      expect(hub.hasParticipant('user-1')).toBe(true)
      await hub.removeParticipant('user-1')
      expect(hub.hasParticipant('user-1')).toBe(false)
      expect(hub.getParticipantIds()).toHaveLength(0)
    })

    it('should fire removal callback', async () => {
      const removed: string[] = []
      hub.onParticipantRemoved((id) => removed.push(id))
      await hub.handleOffer('user-1', 'sdp')
      await hub.removeParticipant('user-1')
      expect(removed).toEqual(['user-1'])
    })
  })

  describe('re-offer (race condition safety)', () => {
    it('should handle re-offer without throwing', async () => {
      await hub.handleOffer('user-1', 'sdp')
      await hub.removeParticipant('user-1')
      await hub.handleOffer('user-1', 'sdp')
      expect(hub.hasParticipant('user-1')).toBe(true)
    })

    it('should handle rapid re-offer cycles', async () => {
      for (let i = 0; i < 10; i++) {
        await hub.handleOffer('user-1', 'sdp')
      }
      expect(hub.hasParticipant('user-1')).toBe(true)
    })
  })

  describe('freeze detection safety', () => {
    it('should not throw when started', () => {
      expect(() => hub.startFreezeDetection()).not.toThrow()
    })

    it('should not throw when stopped', () => {
      hub.startFreezeDetection()
      expect(() => hub.stopFreezeDetection()).not.toThrow()
    })

    it('should be idempotent start/stop', () => {
      hub.startFreezeDetection()
      hub.stopFreezeDetection()
      hub.startFreezeDetection()
      hub.stopFreezeDetection()
    })
  })

  describe('cleanup', () => {
    it('should close all participants', async () => {
      await hub.handleOffer('user-1', 'sdp')
      await hub.handleOffer('user-2', 'sdp')
      await hub.closeAll()
      expect(hub.getParticipantIds()).toHaveLength(0)
    })

    it('should stop freeze monitor on closeAll', () => {
      hub.startFreezeDetection()
      hub.closeAll()
      hub.startFreezeDetection()
      hub.stopFreezeDetection()
    })
  })
})
