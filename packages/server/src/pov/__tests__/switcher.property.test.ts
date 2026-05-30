import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
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
          // Generate 3-8 feed scores
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

            // Build scores map using generated scores (pad/trim to match feed count)
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
   * manualSelect(feedId) returns an error when the feed is disconnected or not found.
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


// ── Property Tests: Automatic Switching Logic ────────────────────────────────

describe('POVSwitcher - Automatic Switching Property Tests', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  /**
   * **Validates: Requirements 4.1**
   *
   * Property 10: Automatic switching threshold decision
   *
   * A switch occurs only if the candidate's score exceeds the current
   * camera's score by at least activityThreshold.
   */
  describe('Property 10: Automatic switching threshold decision', () => {
    it('switches only when candidate exceeds current by at least activityThreshold', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0.01, max: 0.5, noNaN: true }),  // activityThreshold
          fc.double({ min: 0.1, max: 0.8, noNaN: true }),   // currentScore
          fc.double({ min: 0.0, max: 1.0, noNaN: true }),   // candidateScore
          (activityThreshold, currentScore, candidateScore) => {
            const registry = createRegistry()
            const switcher = new POVSwitcher(registry, {
              cooldownMs: 1000,
              activityThreshold,
              silenceThreshold: 0.0, // disable silence threshold for this test
            })

            vi.useFakeTimers()

            // Register feeds
            const currentFeedId = registerConnectedFeed(registry, 'Current', 'ws://current.local:4455')
            const candidateFeedId = registerConnectedFeed(registry, 'Candidate', 'ws://candidate.local:4455')

            // Set initial active camera
            const initialScores = new Map<string, number>([
              [currentFeedId, currentScore],
              [candidateFeedId, 0],
            ])
            switcher.evaluateScores(initialScores)
            expect(switcher.activeCameraId).toBe(currentFeedId)

            // Advance past cooldown
            vi.advanceTimersByTime(31000)

            // Evaluate with candidate score
            const scores = new Map<string, number>([
              [currentFeedId, currentScore],
              [candidateFeedId, candidateScore],
            ])
            switcher.evaluateScores(scores)

            const diff = candidateScore - currentScore
            if (diff >= activityThreshold) {
              // Should have switched to candidate
              expect(switcher.activeCameraId).toBe(candidateFeedId)
            } else {
              // Should remain on current
              expect(switcher.activeCameraId).toBe(currentFeedId)
            }
          },
        ),
        { numRuns: 100 },
      )
    })
  })

  /**
   * **Validates: Requirements 4.4**
   *
   * Property 11: Silence threshold prevents switching
   *
   * When all scores are below silenceThreshold, no switch occurs
   * regardless of score differences.
   */
  describe('Property 11: Silence threshold prevents switching', () => {
    it('no switch occurs when all scores are below silenceThreshold', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0.1, max: 1.0, noNaN: true }), // silenceThreshold (high enough to test)
          fc.integer({ min: 2, max: 6 }),                   // number of feeds
          (silenceThreshold, numFeeds) => {
            const registry = createRegistry()
            const switcher = new POVSwitcher(registry, {
              cooldownMs: 1000,
              activityThreshold: 0.01, // very low so threshold isn't the blocker
              silenceThreshold,
            })

            vi.useFakeTimers()

            // Register feeds
            const feedIds: string[] = []
            for (let i = 0; i < numFeeds; i++) {
              feedIds.push(registerConnectedFeed(registry, `Player${i}`, `ws://player${i}.local:4455`))
            }

            // Set initial active camera with a score above silence threshold
            const initialScores = new Map<string, number>()
            initialScores.set(feedIds[0], silenceThreshold + 0.1)
            for (let i = 1; i < feedIds.length; i++) {
              initialScores.set(feedIds[i], 0)
            }
            switcher.evaluateScores(initialScores)
            const initialActive = switcher.activeCameraId
            expect(initialActive).toBe(feedIds[0])

            // Advance past cooldown
            vi.advanceTimersByTime(31000)

            // Now set ALL scores strictly below silence threshold
            const silentScores = new Map<string, number>()
            for (let i = 0; i < feedIds.length; i++) {
              // Generate scores that are strictly below silenceThreshold
              const score = silenceThreshold * (0.1 + (0.8 * i) / numFeeds)
              silentScores.set(feedIds[i], Math.min(score, silenceThreshold - 0.001))
            }

            switcher.evaluateScores(silentScores)

            // Active camera should not change
            expect(switcher.activeCameraId).toBe(initialActive)
          },
        ),
        { numRuns: 100 },
      )
    })
  })

  /**
   * **Validates: Requirements 4.2**
   *
   * Property 12: Switch cooldown enforcement
   *
   * No switch occurs if less than cooldownMs has elapsed since the last switch.
   */
  describe('Property 12: Switch cooldown enforcement', () => {
    it('no automatic switch occurs within cooldown period', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1000, max: 30000 }), // cooldownMs
          fc.integer({ min: 1, max: 29999 }),     // elapsed time (will be clamped)
          (cooldownMs, elapsedRaw) => {
            // Ensure elapsed is strictly less than cooldown
            const elapsed = Math.min(elapsedRaw, cooldownMs - 1)
            fc.pre(elapsed > 0 && elapsed < cooldownMs)

            const registry = createRegistry()
            const switcher = new POVSwitcher(registry, {
              cooldownMs,
              activityThreshold: 0.01, // very low so threshold isn't the blocker
              silenceThreshold: 0.0,
            })

            vi.useFakeTimers()

            const feedA = registerConnectedFeed(registry, 'FeedA', 'ws://feedA.local:4455')
            const feedB = registerConnectedFeed(registry, 'FeedB', 'ws://feedB.local:4455')

            // Initial selection (sets lastSwitchTimestamp)
            const initialScores = new Map<string, number>([[feedA, 0.5], [feedB, 0.3]])
            switcher.evaluateScores(initialScores)
            expect(switcher.activeCameraId).toBe(feedA)

            // Advance by less than cooldown
            vi.advanceTimersByTime(elapsed)

            // Try to switch with a clearly better candidate
            const scores = new Map<string, number>([[feedA, 0.1], [feedB, 0.9]])
            switcher.evaluateScores(scores)

            // Should NOT have switched due to cooldown
            expect(switcher.activeCameraId).toBe(feedA)
          },
        ),
        { numRuns: 100 },
      )
    })

    it('switch is allowed after cooldown period elapses', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1000, max: 30000 }), // cooldownMs
          (cooldownMs) => {
            const registry = createRegistry()
            const switcher = new POVSwitcher(registry, {
              cooldownMs,
              activityThreshold: 0.01,
              silenceThreshold: 0.0,
            })

            vi.useFakeTimers()

            const feedA = registerConnectedFeed(registry, 'FeedA', 'ws://feedA.local:4455')
            const feedB = registerConnectedFeed(registry, 'FeedB', 'ws://feedB.local:4455')

            // Initial selection
            const initialScores = new Map<string, number>([[feedA, 0.5], [feedB, 0.3]])
            switcher.evaluateScores(initialScores)
            expect(switcher.activeCameraId).toBe(feedA)

            // Advance past cooldown
            vi.advanceTimersByTime(cooldownMs + 1)

            // Now switch should be allowed
            const scores = new Map<string, number>([[feedA, 0.1], [feedB, 0.9]])
            switcher.evaluateScores(scores)

            expect(switcher.activeCameraId).toBe(feedB)
          },
        ),
        { numRuns: 100 },
      )
    })
  })

  /**
   * **Validates: Requirements 4.6**
   *
   * Property 13: Initial camera selection without constraints
   *
   * When no camera is active, the highest-scoring feed is selected
   * immediately without cooldown or threshold checks.
   */
  describe('Property 13: Initial camera selection without constraints', () => {
    it('selects highest-scoring feed immediately when no active camera', () => {
      fc.assert(
        fc.property(
          fc.array(fc.double({ min: 0.0, max: 1.0, noNaN: true }), { minLength: 2, maxLength: 8 }),
          fc.double({ min: 0.01, max: 1.0, noNaN: true }),  // activityThreshold
          fc.integer({ min: 1000, max: 30000 }),             // cooldownMs
          (scores, activityThreshold, cooldownMs) => {
            // Ensure there's a unique maximum
            const maxScore = Math.max(...scores)
            fc.pre(maxScore > 0)
            const maxCount = scores.filter(s => s === maxScore).length
            fc.pre(maxCount === 1)

            const registry = createRegistry()
            const switcher = new POVSwitcher(registry, {
              cooldownMs,
              activityThreshold,
              silenceThreshold: 0.0, // disable silence for this test
            })

            // Register feeds
            const feedIds: string[] = []
            for (let i = 0; i < scores.length; i++) {
              feedIds.push(registerConnectedFeed(registry, `Player${i}`, `ws://player${i}.local:4455`))
            }

            // No active camera initially
            expect(switcher.activeCameraId).toBeNull()

            // Evaluate scores
            const scoreMap = new Map<string, number>()
            for (let i = 0; i < feedIds.length; i++) {
              scoreMap.set(feedIds[i], scores[i])
            }
            switcher.evaluateScores(scoreMap)

            // Should select the highest-scoring feed regardless of threshold/cooldown
            const expectedIdx = scores.indexOf(maxScore)
            expect(switcher.activeCameraId).toBe(feedIds[expectedIdx])
          },
        ),
        { numRuns: 100 },
      )
    })
  })

  /**
   * **Validates: Requirements 4.7**
   *
   * Property 14: Tie-breaking preserves current or selects least-recently-active
   *
   * If scores are tied, the current camera is retained. If no current camera,
   * the least-recently-active feed is selected.
   */
  describe('Property 14: Tie-breaking preserves current or selects least-recently-active', () => {
    it('retains current camera when it is among tied highest-scoring feeds', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0.3, max: 1.0, noNaN: true }), // tied score
          fc.integer({ min: 2, max: 6 }),                   // number of tied feeds
          (tiedScore, numTied) => {
            const registry = createRegistry()
            const switcher = new POVSwitcher(registry, {
              cooldownMs: 1000,
              activityThreshold: 0.01,
              silenceThreshold: 0.0,
            })

            vi.useFakeTimers()

            // Register feeds
            const feedIds: string[] = []
            for (let i = 0; i < numTied; i++) {
              feedIds.push(registerConnectedFeed(registry, `Player${i}`, `ws://player${i}.local:4455`))
            }

            // Set first feed as active
            const initialScores = new Map<string, number>()
            initialScores.set(feedIds[0], tiedScore)
            for (let i = 1; i < feedIds.length; i++) {
              initialScores.set(feedIds[i], 0)
            }
            switcher.evaluateScores(initialScores)
            expect(switcher.activeCameraId).toBe(feedIds[0])

            // Advance past cooldown
            vi.advanceTimersByTime(31000)

            // All feeds tied at the same score
            // Since the current feed is among the tied feeds, and no candidate
            // exceeds current by threshold (diff = 0), no switch occurs
            const tiedScores = new Map<string, number>()
            for (const id of feedIds) {
              tiedScores.set(id, tiedScore)
            }
            switcher.evaluateScores(tiedScores)

            // Current camera should be retained
            expect(switcher.activeCameraId).toBe(feedIds[0])
          },
        ),
        { numRuns: 100 },
      )
    })

    it('selects least-recently-active when tied and no current camera', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0.1, max: 1.0, noNaN: true }), // tied score
          fc.integer({ min: 2, max: 6 }),                   // number of tied feeds
          (tiedScore, numTied) => {
            const registry = createRegistry()
            const switcher = new POVSwitcher(registry, {
              cooldownMs: 1000,
              activityThreshold: 0.01,
              silenceThreshold: 0.0,
            })

            // Register feeds
            const feedIds: string[] = []
            for (let i = 0; i < numTied; i++) {
              feedIds.push(registerConnectedFeed(registry, `Player${i}`, `ws://player${i}.local:4455`))
            }

            // No active camera — all tied
            const tiedScores = new Map<string, number>()
            for (const id of feedIds) {
              tiedScores.set(id, tiedScore)
            }
            switcher.evaluateScores(tiedScores)

            // Should select one of the tied feeds (least-recently-active)
            // Since none have been active before, all have timestamp 0,
            // the first one in iteration order is selected
            expect(switcher.activeCameraId).not.toBeNull()
            expect(feedIds).toContain(switcher.activeCameraId)
          },
        ),
        { numRuns: 100 },
      )
    })
  })

  /**
   * **Validates: Requirements 4.8**
   *
   * Property 15: Disconnect triggers immediate fallback switch
   *
   * When the active camera disconnects in auto mode, the highest-scoring
   * connected feed is selected immediately, bypassing cooldown.
   */
  describe('Property 15: Disconnect triggers immediate fallback switch', () => {
    it('immediately selects highest-scoring connected feed on active camera disconnect', () => {
      fc.assert(
        fc.property(
          fc.array(fc.double({ min: 0.01, max: 1.0, noNaN: true }), { minLength: 2, maxLength: 7 }),
          fc.integer({ min: 1000, max: 30000 }), // cooldownMs
          (remainingScores, cooldownMs) => {
            // Ensure unique maximum among remaining
            const maxRemaining = Math.max(...remainingScores)
            const maxCount = remainingScores.filter(s => s === maxRemaining).length
            fc.pre(maxCount === 1)

            const registry = createRegistry()
            const switcher = new POVSwitcher(registry, {
              cooldownMs,
              activityThreshold: 0.01,
              silenceThreshold: 0.0,
            })

            vi.useFakeTimers()

            // Register the active feed and remaining feeds
            const activeFeedId = registerConnectedFeed(registry, 'Active', 'ws://active.local:4455')
            const remainingFeedIds: string[] = []
            for (let i = 0; i < remainingScores.length; i++) {
              remainingFeedIds.push(registerConnectedFeed(registry, `Remaining${i}`, `ws://remaining${i}.local:4455`))
            }

            // Set active feed as current
            const initialScores = new Map<string, number>()
            initialScores.set(activeFeedId, 1.0)
            for (const id of remainingFeedIds) {
              initialScores.set(id, 0)
            }
            switcher.evaluateScores(initialScores)
            expect(switcher.activeCameraId).toBe(activeFeedId)

            // Do NOT advance past cooldown — disconnect should bypass it
            // Set activity scores on remaining feeds
            for (let i = 0; i < remainingFeedIds.length; i++) {
              registry.updateActivityScore(remainingFeedIds[i], remainingScores[i])
            }

            // Disconnect the active camera
            registry.updateStatus(activeFeedId, 'disconnected')
            switcher.handleDisconnect(activeFeedId)

            // Should have switched to highest-scoring remaining feed
            const expectedIdx = remainingScores.indexOf(maxRemaining)
            expect(switcher.activeCameraId).toBe(remainingFeedIds[expectedIdx])
          },
        ),
        { numRuns: 100 },
      )
    })

    it('bypasses cooldown on disconnect even when within cooldown period', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1000, max: 30000 }), // cooldownMs
          fc.integer({ min: 1, max: 999 }),       // very short elapsed time
          (cooldownMs, elapsed) => {
            fc.pre(elapsed < cooldownMs)

            const registry = createRegistry()
            const switcher = new POVSwitcher(registry, {
              cooldownMs,
              activityThreshold: 0.01,
              silenceThreshold: 0.0,
            })

            vi.useFakeTimers()

            const feedA = registerConnectedFeed(registry, 'FeedA', 'ws://feedA.local:4455')
            const feedB = registerConnectedFeed(registry, 'FeedB', 'ws://feedB.local:4455')

            // Set feedA as active
            const initialScores = new Map<string, number>([[feedA, 0.8], [feedB, 0.3]])
            switcher.evaluateScores(initialScores)
            expect(switcher.activeCameraId).toBe(feedA)

            // Advance only a tiny bit (still within cooldown)
            vi.advanceTimersByTime(elapsed)

            // Set activity score for feedB
            registry.updateActivityScore(feedB, 0.5)

            // Disconnect active camera
            registry.updateStatus(feedA, 'disconnected')
            switcher.handleDisconnect(feedA)

            // Should switch despite being within cooldown
            expect(switcher.activeCameraId).toBe(feedB)
          },
        ),
        { numRuns: 100 },
      )
    })
  })
})
