import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { POVSwitcher } from '../switcher.js'
import { CameraRegistry } from '../registry.js'

// ── Test Helpers ─────────────────────────────────────────────────────────────

function createRegistry(maxConnections = 10): CameraRegistry {
  return new CameraRegistry(maxConnections)
}

function registerConnectedFeed(registry: CameraRegistry, label: string, address?: string): string {
  const result = registry.register({
    label,
    obsAddress: address ?? `ws://${label}.local:4455`,
    obsPassword: 'test',
    sceneName: `scene-${label}`,
  })
  if ('error' in result) throw new Error(`Registration failed: ${result.error}`)
  registry.updateStatus(result.id, 'connected')
  return result.id
}

function registerFeedWithStatus(
  registry: CameraRegistry,
  label: string,
  status: 'connected' | 'disconnected' | 'reconnecting' | 'unresponsive' | 'unreachable',
): string {
  const result = registry.register({
    label,
    obsAddress: `ws://${label}.local:4455`,
    obsPassword: 'test',
    sceneName: `scene-${label}`,
  })
  if ('error' in result) throw new Error(`Registration failed: ${result.error}`)
  registry.updateStatus(result.id, status)
  return result.id
}

/** Arbitrary for valid activity scores (0 to 1) */
const scoreArb = fc.double({ min: 0, max: 1, noNaN: true })

/** Arbitrary for valid POVSwitcher config values */
const configArb = fc.record({
  cooldownMs: fc.integer({ min: 1000, max: 30000 }),
  activityThreshold: fc.double({ min: 0.01, max: 1.0, noNaN: true }),
  silenceThreshold: fc.double({ min: 0.0, max: 1.0, noNaN: true }),
})

/** Arbitrary for non-connected statuses */
const unavailableStatusArb = fc.constantFrom(
  'disconnected' as const,
  'reconnecting' as const,
  'unresponsive' as const,
  'unreachable' as const,
)

// ── Property Tests: Manual Mode Logic ────────────────────────────────────────

describe('POVSwitcher - Manual Mode Property Tests', () => {
  /**
   * **Validates: Requirements 5.2**
   *
   * Property 16: Manual mode suspends automatic switching
   *
   * When mode is 'manual', evaluateScores() never triggers a switch
   * regardless of score values.
   */
  describe('Property 16: Manual mode suspends automatic switching', () => {
    it('evaluateScores never triggers a switch in manual mode regardless of score values', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 3, max: 8 }),
          configArb,
          fc.array(scoreArb, { minLength: 3, maxLength: 8 }),
          (numFeeds, config, rawScores) => {
            const registry = createRegistry()
            const switcher = new POVSwitcher(registry, config)

            // Register connected feeds
            const feedIds: string[] = []
            for (let i = 0; i < numFeeds; i++) {
              feedIds.push(registerConnectedFeed(registry, `Player${i}`, `ws://player${i}.local:4455`))
            }

            // Set manual mode
            switcher.setMode('manual')

            // Manually select the first feed so we have an active camera
            switcher.manualSelect(feedIds[0])
            const activeBefore = switcher.activeCameraId

            // Build scores map using generated scores
            const scores = new Map<string, number>()
            for (let i = 0; i < feedIds.length; i++) {
              scores.set(feedIds[i], rawScores[i % rawScores.length])
            }

            // Evaluate scores — should NOT change active camera
            switcher.evaluateScores(scores)

            expect(switcher.activeCameraId).toBe(activeBefore)
          },
        ),
        { numRuns: 100 },
      )
    })

    it('evaluateScores never triggers a switch in manual mode even with no prior active camera', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 3, max: 8 }),
          configArb,
          fc.array(scoreArb, { minLength: 3, maxLength: 8 }),
          (numFeeds, config, rawScores) => {
            const registry = createRegistry()
            const switcher = new POVSwitcher(registry, config)

            // Register connected feeds
            const feedIds: string[] = []
            for (let i = 0; i < numFeeds; i++) {
              feedIds.push(registerConnectedFeed(registry, `Player${i}`, `ws://player${i}.local:4455`))
            }

            // Set manual mode BEFORE any evaluation
            switcher.setMode('manual')

            // Build scores map
            const scores = new Map<string, number>()
            for (let i = 0; i < feedIds.length; i++) {
              scores.set(feedIds[i], rawScores[i % rawScores.length])
            }

            // Evaluate scores — should NOT select any camera
            switcher.evaluateScores(scores)

            expect(switcher.activeCameraId).toBeNull()
          },
        ),
        { numRuns: 100 },
      )
    })

    it('no switch callback is emitted during evaluateScores in manual mode', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 3, max: 8 }),
          fc.array(scoreArb, { minLength: 3, maxLength: 8 }),
          (numFeeds, rawScores) => {
            const registry = createRegistry()
            const switcher = new POVSwitcher(registry)

            const feedIds: string[] = []
            for (let i = 0; i < numFeeds; i++) {
              feedIds.push(registerConnectedFeed(registry, `Player${i}`, `ws://player${i}.local:4455`))
            }

            // Set manual mode and select a feed
            switcher.setMode('manual')
            switcher.manualSelect(feedIds[0])

            // Track switch events after manual select
            const switchEvents: string[] = []
            switcher.onSwitch((_prev, next) => switchEvents.push(next))

            // Build scores and evaluate
            const scores = new Map<string, number>()
            for (let i = 0; i < feedIds.length; i++) {
              scores.set(feedIds[i], rawScores[i % rawScores.length])
            }
            switcher.evaluateScores(scores)

            // No switch events should have been emitted from evaluateScores
            expect(switchEvents).toHaveLength(0)
          },
        ),
        { numRuns: 100 },
      )
    })
  })

  /**
   * **Validates: Requirements 5.6**
   *
   * Property 17: Manual selection rejects unavailable feeds
   *
   * manualSelect(feedId) returns an error when the feed is disconnected,
   * unresponsive, or unreachable.
   */
  describe('Property 17: Manual selection rejects unavailable feeds', () => {
    it('manualSelect returns error for feeds with non-connected status', () => {
      fc.assert(
        fc.property(
          unavailableStatusArb,
          (status) => {
            const registry = createRegistry()
            const switcher = new POVSwitcher(registry)

            // Register a feed with a non-connected status
            const feedId = registerFeedWithStatus(registry, 'UnavailablePlayer', status)

            switcher.setMode('manual')
            const result = switcher.manualSelect(feedId)

            expect(result.ok).toBe(false)
            expect(result.error).toBe('feed_unavailable')
          },
        ),
        { numRuns: 100 },
      )
    })

    it('manualSelect returns error for non-existent feed IDs', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          (fakeFeedId) => {
            const registry = createRegistry()
            const switcher = new POVSwitcher(registry)

            switcher.setMode('manual')
            const result = switcher.manualSelect(fakeFeedId)

            expect(result.ok).toBe(false)
            expect(result.error).toBe('feed_not_found')
          },
        ),
        { numRuns: 100 },
      )
    })

    it('manualSelect does not change active camera when feed is unavailable', () => {
      fc.assert(
        fc.property(
          unavailableStatusArb,
          (status) => {
            const registry = createRegistry()
            const switcher = new POVSwitcher(registry)

            // Register a connected feed and select it
            const connectedId = registerConnectedFeed(registry, 'Connected', 'ws://connected.local:4455')
            switcher.setMode('manual')
            switcher.manualSelect(connectedId)

            // Register an unavailable feed
            const unavailableId = registerFeedWithStatus(registry, 'Unavailable', status)

            // Try to select the unavailable feed
            const activeBefore = switcher.activeCameraId
            switcher.manualSelect(unavailableId)

            // Active camera should not change
            expect(switcher.activeCameraId).toBe(activeBefore)
          },
        ),
        { numRuns: 100 },
      )
    })
  })

  /**
   * **Validates: Requirements 5.5**
   *
   * Property 18: Manual feed disconnect triggers automatic fallback
   *
   * When the manually selected feed disconnects, the system switches to
   * automatic mode and selects the highest-scoring connected feed.
   */
  describe('Property 18: Manual feed disconnect triggers automatic fallback', () => {
    it('switches to automatic mode when manually selected feed disconnects', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2, max: 8 }),
          fc.array(scoreArb, { minLength: 2, maxLength: 8 }),
          (numFeeds, rawScores) => {
            const registry = createRegistry()
            const switcher = new POVSwitcher(registry)

            // Register connected feeds
            const feedIds: string[] = []
            for (let i = 0; i < numFeeds; i++) {
              feedIds.push(registerConnectedFeed(registry, `Player${i}`, `ws://player${i}.local:4455`))
            }

            // Set manual mode and select the first feed
            switcher.setMode('manual')
            switcher.manualSelect(feedIds[0])
            expect(switcher.mode).toBe('manual')

            // Set activity scores on remaining feeds for fallback selection
            for (let i = 1; i < feedIds.length; i++) {
              registry.updateActivityScore(feedIds[i], rawScores[i % rawScores.length])
            }

            // Disconnect the manually selected feed
            registry.updateStatus(feedIds[0], 'disconnected')
            switcher.handleDisconnect(feedIds[0])

            // Mode should switch to automatic
            expect(switcher.mode).toBe('automatic')
          },
        ),
        { numRuns: 100 },
      )
    })

    it('selects highest-scoring connected feed after manual disconnect fallback', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2, max: 8 }),
          fc.array(
            fc.double({ min: 0.01, max: 1.0, noNaN: true }),
            { minLength: 2, maxLength: 8 },
          ),
          (numFeeds, rawScores) => {
            const registry = createRegistry()
            const switcher = new POVSwitcher(registry)

            // Register connected feeds
            const feedIds: string[] = []
            for (let i = 0; i < numFeeds; i++) {
              feedIds.push(registerConnectedFeed(registry, `Player${i}`, `ws://player${i}.local:4455`))
            }

            // Set manual mode and select the first feed
            switcher.setMode('manual')
            switcher.manualSelect(feedIds[0])

            // Set distinct activity scores on remaining feeds
            const remainingScores: Array<{ id: string; score: number }> = []
            for (let i = 1; i < feedIds.length; i++) {
              const score = rawScores[i % rawScores.length]
              registry.updateActivityScore(feedIds[i], score)
              remainingScores.push({ id: feedIds[i], score })
            }

            // Find the expected highest-scoring feed
            const maxScore = Math.max(...remainingScores.map((f) => f.score))
            const highestScoringFeeds = remainingScores.filter((f) => f.score === maxScore)

            // Disconnect the manually selected feed
            registry.updateStatus(feedIds[0], 'disconnected')
            switcher.handleDisconnect(feedIds[0])

            // The new active camera should be one of the highest-scoring feeds
            expect(switcher.activeCameraId).not.toBeNull()
            expect(switcher.activeCameraId).not.toBe(feedIds[0])
            expect(highestScoringFeeds.map((f) => f.id)).toContain(switcher.activeCameraId)
          },
        ),
        { numRuns: 100 },
      )
    })

    it('emits mode change event on manual disconnect fallback', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2, max: 5 }),
          (numFeeds) => {
            const registry = createRegistry()
            const switcher = new POVSwitcher(registry)

            const feedIds: string[] = []
            for (let i = 0; i < numFeeds; i++) {
              feedIds.push(registerConnectedFeed(registry, `Player${i}`, `ws://player${i}.local:4455`))
              registry.updateActivityScore(feedIds[i], 0.5)
            }

            // Set manual mode and select first feed
            switcher.setMode('manual')
            switcher.manualSelect(feedIds[0])

            // Track mode change events after setup
            const modeEvents: string[] = []
            switcher.onModeChange((mode) => modeEvents.push(mode))

            // Disconnect the manually selected feed
            registry.updateStatus(feedIds[0], 'disconnected')
            switcher.handleDisconnect(feedIds[0])

            // Should have emitted 'automatic' mode change
            expect(modeEvents).toContain('automatic')
          },
        ),
        { numRuns: 100 },
      )
    })
  })
})
