import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { CameraRegistry } from '../registry.js'
import type { CameraFeedRegistration } from '../registry.js'
import type { CameraFeed } from '@ieom/shared'

// ── Generators ──────────────────────────────────────────────────────

/** Generate a valid label (1-32 characters, printable ASCII) */
const validLabel = fc.string({ minLength: 1, maxLength: 32 }).filter((s) => s.trim().length > 0)

/** Generate a valid OBS WebSocket address */
const validAddress = fc.tuple(
  fc.ipV4(),
  fc.integer({ min: 1024, max: 65535 })
).map(([ip, port]) => `ws://${ip}:${port}`)

/** Generate a valid scene name */
const validSceneName = fc.string({ minLength: 1, maxLength: 32 }).filter((s) => s.trim().length > 0)

/** Generate a valid CameraFeedRegistration */
const validFeedRegistration: fc.Arbitrary<CameraFeedRegistration> = fc.record({
  label: validLabel,
  obsAddress: validAddress,
  obsPassword: fc.string({ minLength: 0, maxLength: 64 }),
  sceneName: validSceneName,
})

/** Generate a unique list of feed registrations with distinct addresses */
function uniqueFeedRegistrations(count: number): fc.Arbitrary<CameraFeedRegistration[]> {
  return fc.array(
    fc.tuple(validLabel, fc.integer({ min: 1024, max: 65535 }), fc.string({ minLength: 0, maxLength: 64 }), validSceneName),
    { minLength: count, maxLength: count }
  ).map((items) =>
    items.map(([label, port, password, scene], idx) => ({
      label,
      obsAddress: `ws://192.168.1.${idx + 1}:${port}`,
      obsPassword: password,
      sceneName: scene,
    }))
  )
}

// ── UUID regex ──────────────────────────────────────────────────────

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

// ── Property Tests ──────────────────────────────────────────────────

describe('CameraRegistry Property Tests', () => {
  /**
   * Property 1: Registration produces valid feed entry
   *
   * For any valid label (1-32 chars) and address, register() returns a CameraFeed
   * with a UUID id, the given label, connectionStatus 'disconnected', activityScore 0,
   * and a registeredAt timestamp.
   *
   * **Validates: Requirements 1.1**
   */
  describe('Property 1: Registration produces valid feed entry', () => {
    it('register() returns a CameraFeed with UUID id, given label, disconnected status, score 0, and timestamp', () => {
      fc.assert(
        fc.property(validFeedRegistration, (input) => {
          const registry = new CameraRegistry(10)
          const before = Date.now()
          const result = registry.register(input)
          const after = Date.now()

          // Result should be a valid CameraFeed (not an error)
          expect(result).not.toHaveProperty('error')
          const feed = result as CameraFeed

          // Must have a valid UUID id
          expect(feed.id).toMatch(UUID_REGEX)

          // Must preserve the given label
          expect(feed.label).toBe(input.label)

          // Must preserve the given obsAddress
          expect(feed.obsAddress).toBe(input.obsAddress)

          // Must have connectionStatus 'disconnected'
          expect(feed.connectionStatus).toBe('disconnected')

          // Must have activityScore 0
          expect(feed.activityScore).toBe(0)

          // Must have a registeredAt timestamp within the test window
          expect(feed.registeredAt).toBeGreaterThanOrEqual(before)
          expect(feed.registeredAt).toBeLessThanOrEqual(after)

          // Must have null connectedAt and lastHealthCheck
          expect(feed.connectedAt).toBeNull()
          expect(feed.lastHealthCheck).toBeNull()
        }),
        { numRuns: 100 }
      )
    })
  })

  /**
   * Property 2: Reconnection reuses existing registration
   *
   * If a feed with the same obsAddress is already registered, register() returns
   * the existing feed instead of creating a duplicate.
   *
   * **Validates: Requirements 1.3**
   */
  describe('Property 2: Reconnection reuses existing registration', () => {
    it('findByAddress() returns the existing feed for a previously registered address', () => {
      fc.assert(
        fc.property(validFeedRegistration, (input) => {
          const registry = new CameraRegistry(10)

          // Register the feed
          const result = registry.register(input)
          expect(result).not.toHaveProperty('error')
          const originalFeed = result as CameraFeed

          // Mark as disconnected (simulating a disconnect)
          registry.updateStatus(originalFeed.id, 'disconnected')

          // findByAddress should locate the existing feed
          const found = registry.findByAddress(input.obsAddress)
          expect(found).toBeDefined()
          expect(found!.id).toBe(originalFeed.id)
          expect(found!.label).toBe(originalFeed.label)
          expect(found!.obsAddress).toBe(input.obsAddress)

          // No duplicate should exist — total feeds should be 1
          expect(registry.getAllFeeds()).toHaveLength(1)
        }),
        { numRuns: 100 }
      )
    })

    it('reconnection via findByAddress + updateStatus reuses existing registration without duplicates', () => {
      fc.assert(
        fc.property(validFeedRegistration, (input) => {
          const registry = new CameraRegistry(10)

          // Register the feed
          const result = registry.register(input)
          expect(result).not.toHaveProperty('error')
          const originalFeed = result as CameraFeed

          // Simulate disconnect
          registry.updateStatus(originalFeed.id, 'disconnected')

          // Simulate reconnection: find by address and restore status
          const existing = registry.findByAddress(input.obsAddress)
          expect(existing).toBeDefined()

          // Restore to connected — reuses existing registration
          registry.updateStatus(existing!.id, 'connected')

          // Verify the same feed is now connected
          const reconnected = registry.getActiveFeed(existing!.id)
          expect(reconnected).toBeDefined()
          expect(reconnected!.id).toBe(originalFeed.id)
          expect(reconnected!.connectionStatus).toBe('connected')
          expect(reconnected!.registeredAt).toBe(originalFeed.registeredAt)

          // Still only one feed in the registry
          expect(registry.getAllFeeds()).toHaveLength(1)
        }),
        { numRuns: 100 }
      )
    })
  })

  /**
   * Property 3: Capacity enforcement
   *
   * When maxConnections feeds are registered, any additional register() call
   * returns { error: 'capacity_reached' }.
   *
   * **Validates: Requirements 1.4, 1.7**
   */
  describe('Property 3: Capacity enforcement', () => {
    it('registering exactly maxConnections feeds succeeds, and the next one fails with capacity_reached', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 3, max: 10 }),
          (maxConnections) => {
            const registry = new CameraRegistry(maxConnections)

            // Register exactly maxConnections feeds — all should succeed
            for (let i = 0; i < maxConnections; i++) {
              const input: CameraFeedRegistration = {
                label: `Player ${i + 1}`,
                obsAddress: `ws://10.0.0.${i + 1}:4455`,
                obsPassword: 'pass',
                sceneName: `Scene${i + 1}`,
              }
              const result = registry.register(input)
              expect(result).not.toHaveProperty('error')
            }

            // Verify all feeds were registered
            expect(registry.getAllFeeds()).toHaveLength(maxConnections)

            // The next registration should fail
            const overflow: CameraFeedRegistration = {
              label: 'Overflow',
              obsAddress: `ws://10.0.0.${maxConnections + 1}:4455`,
              obsPassword: 'pass',
              sceneName: 'SceneOverflow',
            }
            const result = registry.register(overflow)
            expect(result).toEqual({ error: 'capacity_reached' })

            // Feed count should not have increased
            expect(registry.getAllFeeds()).toHaveLength(maxConnections)
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})
