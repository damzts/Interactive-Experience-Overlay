import { describe, it, expect, beforeEach } from 'vitest'
import { CameraRegistry } from '../registry.js'
import type { CameraFeedRegistration } from '../registry.js'
import type { CameraFeed } from '@ieom/shared'

function validFeedInput(overrides?: Partial<CameraFeedRegistration>): CameraFeedRegistration {
  return {
    label: 'Player A',
    obsAddress: 'ws://192.168.1.10:4455',
    obsPassword: 'secret',
    sceneName: 'CamA',
    ...overrides,
  }
}

describe('CameraRegistry', () => {
  let registry: CameraRegistry

  beforeEach(() => {
    registry = new CameraRegistry(10)
  })

  describe('constructor', () => {
    it('clamps maxConnections to minimum of 3', () => {
      const r = new CameraRegistry(1)
      expect(r.maxConnections).toBe(3)
    })

    it('clamps maxConnections to maximum of 10', () => {
      const r = new CameraRegistry(20)
      expect(r.maxConnections).toBe(10)
    })

    it('defaults maxConnections to 10', () => {
      const r = new CameraRegistry()
      expect(r.maxConnections).toBe(10)
    })
  })

  describe('register()', () => {
    it('creates a feed with a unique UUID', () => {
      const result = registry.register(validFeedInput())
      expect('id' in result).toBe(true)
      const feed = result as CameraFeed
      expect(feed.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      )
    })

    it('sets initial connectionStatus to disconnected', () => {
      const result = registry.register(validFeedInput()) as CameraFeed
      expect(result.connectionStatus).toBe('disconnected')
    })

    it('sets initial activityScore to 0', () => {
      const result = registry.register(validFeedInput()) as CameraFeed
      expect(result.activityScore).toBe(0)
    })

    it('sets registeredAt to a timestamp', () => {
      const before = Date.now()
      const result = registry.register(validFeedInput()) as CameraFeed
      const after = Date.now()
      expect(result.registeredAt).toBeGreaterThanOrEqual(before)
      expect(result.registeredAt).toBeLessThanOrEqual(after)
    })

    it('sets connectedAt and lastHealthCheck to null', () => {
      const result = registry.register(validFeedInput()) as CameraFeed
      expect(result.connectedAt).toBeNull()
      expect(result.lastHealthCheck).toBeNull()
    })

    it('accepts a label with exactly 32 characters', () => {
      const label = 'A'.repeat(32)
      const result = registry.register(validFeedInput({ label }))
      expect('id' in result).toBe(true)
      expect((result as CameraFeed).label).toBe(label)
    })

    it('rejects a label longer than 32 characters', () => {
      const label = 'A'.repeat(33)
      const result = registry.register(validFeedInput({ label }))
      expect(result).toEqual({ error: 'label_too_long' })
    })

    it('rejects an empty label', () => {
      const result = registry.register(validFeedInput({ label: '' }))
      expect(result).toEqual({ error: 'label_required' })
    })

    it('rejects registration when capacity is reached', () => {
      const r = new CameraRegistry(3)
      r.register(validFeedInput({ label: 'P1', obsAddress: 'ws://1:4455' }))
      r.register(validFeedInput({ label: 'P2', obsAddress: 'ws://2:4455' }))
      r.register(validFeedInput({ label: 'P3', obsAddress: 'ws://3:4455' }))

      const result = r.register(validFeedInput({ label: 'P4', obsAddress: 'ws://4:4455' }))
      expect(result).toEqual({ error: 'capacity_reached' })
    })

    it('stores the feed in the registry map', () => {
      const result = registry.register(validFeedInput()) as CameraFeed
      expect(registry.feeds.get(result.id)).toBe(result)
    })
  })

  describe('unregister()', () => {
    it('removes an existing feed and returns true', () => {
      const feed = registry.register(validFeedInput()) as CameraFeed
      expect(registry.unregister(feed.id)).toBe(true)
      expect(registry.feeds.has(feed.id)).toBe(false)
    })

    it('returns false for a non-existent feed', () => {
      expect(registry.unregister('non-existent-id')).toBe(false)
    })
  })

  describe('updateStatus()', () => {
    it('updates the connection status of a feed', () => {
      const feed = registry.register(validFeedInput()) as CameraFeed
      registry.updateStatus(feed.id, 'connected')
      expect(registry.feeds.get(feed.id)!.connectionStatus).toBe('connected')
    })

    it('sets connectedAt when status changes to connected', () => {
      const feed = registry.register(validFeedInput()) as CameraFeed
      const before = Date.now()
      registry.updateStatus(feed.id, 'connected')
      const after = Date.now()
      const updated = registry.feeds.get(feed.id)!
      expect(updated.connectedAt).toBeGreaterThanOrEqual(before)
      expect(updated.connectedAt).toBeLessThanOrEqual(after)
    })

    it('does nothing for a non-existent feed', () => {
      // Should not throw
      registry.updateStatus('non-existent', 'connected')
    })
  })

  describe('updateActivityScore()', () => {
    it('updates the activity score', () => {
      const feed = registry.register(validFeedInput()) as CameraFeed
      registry.updateActivityScore(feed.id, 0.75)
      expect(registry.feeds.get(feed.id)!.activityScore).toBe(0.75)
    })

    it('clamps score to 0 minimum', () => {
      const feed = registry.register(validFeedInput()) as CameraFeed
      registry.updateActivityScore(feed.id, -0.5)
      expect(registry.feeds.get(feed.id)!.activityScore).toBe(0)
    })

    it('clamps score to 1 maximum', () => {
      const feed = registry.register(validFeedInput()) as CameraFeed
      registry.updateActivityScore(feed.id, 1.5)
      expect(registry.feeds.get(feed.id)!.activityScore).toBe(1)
    })

    it('does nothing for a non-existent feed', () => {
      registry.updateActivityScore('non-existent', 0.5)
    })
  })

  describe('getActiveFeed()', () => {
    it('returns the feed by ID', () => {
      const feed = registry.register(validFeedInput()) as CameraFeed
      expect(registry.getActiveFeed(feed.id)).toBe(feed)
    })

    it('returns undefined for non-existent ID', () => {
      expect(registry.getActiveFeed('non-existent')).toBeUndefined()
    })
  })

  describe('getAllFeeds()', () => {
    it('returns all registered feeds', () => {
      registry.register(validFeedInput({ label: 'P1', obsAddress: 'ws://1:4455' }))
      registry.register(validFeedInput({ label: 'P2', obsAddress: 'ws://2:4455' }))
      expect(registry.getAllFeeds()).toHaveLength(2)
    })

    it('returns empty array when no feeds registered', () => {
      expect(registry.getAllFeeds()).toEqual([])
    })
  })

  describe('getConnectedFeeds()', () => {
    it('returns only feeds with connected status', () => {
      const f1 = registry.register(validFeedInput({ label: 'P1', obsAddress: 'ws://1:4455' })) as CameraFeed
      const f2 = registry.register(validFeedInput({ label: 'P2', obsAddress: 'ws://2:4455' })) as CameraFeed
      registry.register(validFeedInput({ label: 'P3', obsAddress: 'ws://3:4455' }))

      registry.updateStatus(f1.id, 'connected')
      registry.updateStatus(f2.id, 'connected')

      const connected = registry.getConnectedFeeds()
      expect(connected).toHaveLength(2)
      expect(connected.map((f) => f.id)).toContain(f1.id)
      expect(connected.map((f) => f.id)).toContain(f2.id)
    })

    it('returns empty array when no feeds are connected', () => {
      registry.register(validFeedInput())
      expect(registry.getConnectedFeeds()).toEqual([])
    })
  })

  describe('findByAddress()', () => {
    it('finds a feed by its OBS address', () => {
      const feed = registry.register(validFeedInput({ obsAddress: 'ws://10.0.0.1:4455' })) as CameraFeed
      expect(registry.findByAddress('ws://10.0.0.1:4455')).toBe(feed)
    })

    it('returns undefined when no feed matches the address', () => {
      registry.register(validFeedInput())
      expect(registry.findByAddress('ws://unknown:4455')).toBeUndefined()
    })
  })
})
