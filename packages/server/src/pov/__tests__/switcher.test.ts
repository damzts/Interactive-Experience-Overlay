import { describe, it, expect, beforeEach, vi } from 'vitest'
import { POVSwitcher } from '../switcher.js'
import { CameraRegistry } from '../registry.js'

// ── Test Helpers ─────────────────────────────────────────────────────────────

function createRegistry(maxConnections = 10): CameraRegistry {
  return new CameraRegistry(maxConnections)
}

function registerConnectedFeed(registry: CameraRegistry, label: string): string {
  const result = registry.register({
    label,
    obsAddress: `ws://192.168.1.${Math.floor(Math.random() * 255)}:4455`,
    obsPassword: 'test',
    sceneName: `scene-${label}`,
  })
  if ('error' in result) throw new Error(`Registration failed: ${result.error}`)
  registry.updateStatus(result.id, 'connected')
  return result.id
}

function registerDisconnectedFeed(registry: CameraRegistry, label: string): string {
  const result = registry.register({
    label,
    obsAddress: `ws://192.168.1.${Math.floor(Math.random() * 255)}:4455`,
    obsPassword: 'test',
    sceneName: `scene-${label}`,
  })
  if ('error' in result) throw new Error(`Registration failed: ${result.error}`)
  // Stays disconnected by default
  return result.id
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('POVSwitcher', () => {
  let registry: CameraRegistry
  let switcher: POVSwitcher

  beforeEach(() => {
    registry = createRegistry()
    switcher = new POVSwitcher(registry, {
      cooldownMs: 3000,
      activityThreshold: 0.15,
      silenceThreshold: 0.05,
    })
  })

  describe('initial state', () => {
    it('starts in automatic mode with no active camera', () => {
      expect(switcher.mode).toBe('automatic')
      expect(switcher.activeCameraId).toBeNull()
      expect(switcher.lastSwitchTimestamp).toBeNull()
    })
  })

  describe('evaluateScores - initial selection', () => {
    it('selects highest scoring feed when no active camera is set', () => {
      const feedA = registerConnectedFeed(registry, 'PlayerA')
      const feedB = registerConnectedFeed(registry, 'PlayerB')
      const feedC = registerConnectedFeed(registry, 'PlayerC')

      const scores = new Map([
        [feedA, 0.3],
        [feedB, 0.7],
        [feedC, 0.5],
      ])

      switcher.evaluateScores(scores)

      expect(switcher.activeCameraId).toBe(feedB)
    })

    it('selects immediately without cooldown or threshold on initial selection', () => {
      const feedA = registerConnectedFeed(registry, 'PlayerA')
      const feedB = registerConnectedFeed(registry, 'PlayerB')

      // Even with very low scores (below silence threshold), initial selection should work
      // Actually, initial selection picks highest regardless
      const scores = new Map([
        [feedA, 0.01],
        [feedB, 0.02],
      ])

      switcher.evaluateScores(scores)

      expect(switcher.activeCameraId).toBe(feedB)
    })
  })

  describe('evaluateScores - threshold comparison', () => {
    it('switches only if candidate exceeds current by activityThreshold', () => {
      const feedA = registerConnectedFeed(registry, 'PlayerA')
      const feedB = registerConnectedFeed(registry, 'PlayerB')

      // Set initial active camera
      const initialScores = new Map([
        [feedA, 0.5],
        [feedB, 0.3],
      ])
      switcher.evaluateScores(initialScores)
      expect(switcher.activeCameraId).toBe(feedA)

      // Advance time past cooldown
      vi.useFakeTimers()
      vi.advanceTimersByTime(4000)

      // feedB is higher but not by threshold (0.15)
      const scores2 = new Map([
        [feedA, 0.5],
        [feedB, 0.6], // only 0.1 above current, below threshold of 0.15
      ])
      switcher.evaluateScores(scores2)
      expect(switcher.activeCameraId).toBe(feedA) // no switch

      // feedB exceeds by threshold
      const scores3 = new Map([
        [feedA, 0.5],
        [feedB, 0.7], // 0.2 above current, exceeds threshold of 0.15
      ])
      switcher.evaluateScores(scores3)
      expect(switcher.activeCameraId).toBe(feedB) // switch!

      vi.useRealTimers()
    })
  })

  describe('evaluateScores - silence threshold', () => {
    it('does not switch when all scores are below silence threshold', () => {
      const feedA = registerConnectedFeed(registry, 'PlayerA')
      const feedB = registerConnectedFeed(registry, 'PlayerB')

      // Set initial active camera with a score above silence threshold
      const initialScores = new Map([
        [feedA, 0.3],
        [feedB, 0.1],
      ])
      switcher.evaluateScores(initialScores)
      expect(switcher.activeCameraId).toBe(feedA)

      vi.useFakeTimers()
      vi.advanceTimersByTime(4000)

      // All scores below silence threshold (0.05)
      const silentScores = new Map([
        [feedA, 0.02],
        [feedB, 0.04],
      ])
      switcher.evaluateScores(silentScores)
      expect(switcher.activeCameraId).toBe(feedA) // no switch

      vi.useRealTimers()
    })
  })

  describe('evaluateScores - cooldown enforcement', () => {
    it('does not switch within cooldown period', () => {
      const feedA = registerConnectedFeed(registry, 'PlayerA')
      const feedB = registerConnectedFeed(registry, 'PlayerB')

      vi.useFakeTimers()

      // Initial selection
      const scores1 = new Map([
        [feedA, 0.5],
        [feedB, 0.3],
      ])
      switcher.evaluateScores(scores1)
      expect(switcher.activeCameraId).toBe(feedA)

      // Immediately try to switch (within cooldown)
      const scores2 = new Map([
        [feedA, 0.3],
        [feedB, 0.8], // exceeds threshold
      ])
      switcher.evaluateScores(scores2)
      expect(switcher.activeCameraId).toBe(feedA) // still A, cooldown active

      // Advance past cooldown
      vi.advanceTimersByTime(3001)

      switcher.evaluateScores(scores2)
      expect(switcher.activeCameraId).toBe(feedB) // now switches

      vi.useRealTimers()
    })
  })

  describe('evaluateScores - tie-breaking', () => {
    it('retains current camera if it is among tied feeds', () => {
      const feedA = registerConnectedFeed(registry, 'PlayerA')
      const feedB = registerConnectedFeed(registry, 'PlayerB')

      // Set feedA as active
      const scores1 = new Map([
        [feedA, 0.5],
        [feedB, 0.3],
      ])
      switcher.evaluateScores(scores1)
      expect(switcher.activeCameraId).toBe(feedA)

      vi.useFakeTimers()
      vi.advanceTimersByTime(4000)

      // Both tied at 0.8 — feedA exceeds current (0.5) by threshold (0.3 > 0.15)
      // But feedB also exceeds. Since feedA is current and tied at highest, retain feedA
      const scores2 = new Map([
        [feedA, 0.8],
        [feedB, 0.8],
      ])
      switcher.evaluateScores(scores2)
      // feedA's score is 0.8, current is feedA with score 0.5 from last eval
      // Actually the threshold check is: candidate score - current score >= threshold
      // Current score is what's in the scores map for the active camera
      // feedA is current, so we check if any OTHER feed exceeds feedA's score by threshold
      // feedB score (0.8) - feedA score (0.8) = 0 < 0.15, so no switch
      expect(switcher.activeCameraId).toBe(feedA)

      vi.useRealTimers()
    })

    it('selects least-recently-active when tied and current is not among them', () => {
      const feedA = registerConnectedFeed(registry, 'PlayerA')
      const feedB = registerConnectedFeed(registry, 'PlayerB')
      const feedC = registerConnectedFeed(registry, 'PlayerC')

      vi.useFakeTimers()

      // Make feedA active first
      const scores1 = new Map([
        [feedA, 0.5],
        [feedB, 0.3],
        [feedC, 0.3],
      ])
      switcher.evaluateScores(scores1)
      expect(switcher.activeCameraId).toBe(feedA)

      vi.advanceTimersByTime(4000)

      // Switch to feedB
      const scores2 = new Map([
        [feedA, 0.3],
        [feedB, 0.8],
        [feedC, 0.3],
      ])
      switcher.evaluateScores(scores2)
      expect(switcher.activeCameraId).toBe(feedB)

      vi.advanceTimersByTime(4000)

      // Now feedA and feedC are tied at 0.9, both exceed feedB (0.3) by threshold
      // feedC has never been active (timestamp 0), feedA was active earlier
      // Least-recently-active = feedC
      const scores3 = new Map([
        [feedA, 0.9],
        [feedB, 0.3],
        [feedC, 0.9],
      ])
      switcher.evaluateScores(scores3)
      expect(switcher.activeCameraId).toBe(feedC)

      vi.useRealTimers()
    })
  })

  describe('handleDisconnect', () => {
    it('selects highest-scoring connected feed when active camera disconnects in auto mode', () => {
      const feedA = registerConnectedFeed(registry, 'PlayerA')
      const feedB = registerConnectedFeed(registry, 'PlayerB')
      const feedC = registerConnectedFeed(registry, 'PlayerC')

      // Set feedA as active
      const scores = new Map([
        [feedA, 0.8],
        [feedB, 0.5],
        [feedC, 0.3],
      ])
      switcher.evaluateScores(scores)
      expect(switcher.activeCameraId).toBe(feedA)

      // Update activity scores in registry for fallback selection
      registry.updateActivityScore(feedB, 0.5)
      registry.updateActivityScore(feedC, 0.3)

      // Disconnect feedA
      registry.updateStatus(feedA, 'disconnected')
      switcher.handleDisconnect(feedA)

      expect(switcher.activeCameraId).toBe(feedB)
    })

    it('bypasses cooldown on disconnect fallback', () => {
      const feedA = registerConnectedFeed(registry, 'PlayerA')
      const feedB = registerConnectedFeed(registry, 'PlayerB')

      vi.useFakeTimers()

      // Set feedA as active
      const scores = new Map([
        [feedA, 0.8],
        [feedB, 0.5],
      ])
      switcher.evaluateScores(scores)
      expect(switcher.activeCameraId).toBe(feedA)

      // Immediately disconnect (within cooldown)
      registry.updateActivityScore(feedB, 0.5)
      registry.updateStatus(feedA, 'disconnected')
      switcher.handleDisconnect(feedA)

      // Should switch despite being within cooldown
      expect(switcher.activeCameraId).toBe(feedB)

      vi.useRealTimers()
    })

    it('does nothing if disconnected feed is not the active camera', () => {
      const feedA = registerConnectedFeed(registry, 'PlayerA')
      const feedB = registerConnectedFeed(registry, 'PlayerB')

      const scores = new Map([
        [feedA, 0.8],
        [feedB, 0.5],
      ])
      switcher.evaluateScores(scores)
      expect(switcher.activeCameraId).toBe(feedA)

      // Disconnect feedB (not active)
      registry.updateStatus(feedB, 'disconnected')
      switcher.handleDisconnect(feedB)

      expect(switcher.activeCameraId).toBe(feedA) // unchanged
    })

    it('sets activeCameraId to null when no connected feeds remain', () => {
      const feedA = registerConnectedFeed(registry, 'PlayerA')

      const scores = new Map([[feedA, 0.8]])
      switcher.evaluateScores(scores)
      expect(switcher.activeCameraId).toBe(feedA)

      registry.updateStatus(feedA, 'disconnected')
      switcher.handleDisconnect(feedA)

      expect(switcher.activeCameraId).toBeNull()
    })
  })

  describe('manual mode', () => {
    it('suspends automatic evaluation when in manual mode', () => {
      const feedA = registerConnectedFeed(registry, 'PlayerA')
      const feedB = registerConnectedFeed(registry, 'PlayerB')

      // Set initial active camera
      const scores1 = new Map([
        [feedA, 0.5],
        [feedB, 0.3],
      ])
      switcher.evaluateScores(scores1)
      expect(switcher.activeCameraId).toBe(feedA)

      // Switch to manual mode
      switcher.setMode('manual')
      expect(switcher.mode).toBe('manual')

      vi.useFakeTimers()
      vi.advanceTimersByTime(4000)

      // Even with high scores, no switch in manual mode
      const scores2 = new Map([
        [feedA, 0.1],
        [feedB, 0.9],
      ])
      switcher.evaluateScores(scores2)
      expect(switcher.activeCameraId).toBe(feedA) // unchanged

      vi.useRealTimers()
    })

    it('manualSelect validates feed is connected', () => {
      const feedA = registerConnectedFeed(registry, 'PlayerA')
      const feedB = registerDisconnectedFeed(registry, 'PlayerB')

      switcher.setMode('manual')

      const result = switcher.manualSelect(feedB)
      expect(result.ok).toBe(false)
      expect(result.error).toBe('feed_unavailable')
    })

    it('manualSelect succeeds for connected feed', () => {
      const feedA = registerConnectedFeed(registry, 'PlayerA')
      const feedB = registerConnectedFeed(registry, 'PlayerB')

      switcher.setMode('manual')

      const result = switcher.manualSelect(feedB)
      expect(result.ok).toBe(true)
      expect(switcher.activeCameraId).toBe(feedB)
    })

    it('manualSelect rejects non-existent feed', () => {
      switcher.setMode('manual')

      const result = switcher.manualSelect('non-existent-id')
      expect(result.ok).toBe(false)
      expect(result.error).toBe('feed_not_found')
    })
  })

  describe('manual feed disconnect fallback', () => {
    it('switches to automatic mode when manually selected feed disconnects', () => {
      const feedA = registerConnectedFeed(registry, 'PlayerA')
      const feedB = registerConnectedFeed(registry, 'PlayerB')

      switcher.setMode('manual')
      switcher.manualSelect(feedA)
      expect(switcher.activeCameraId).toBe(feedA)
      expect(switcher.mode).toBe('manual')

      // Set activity scores for fallback
      registry.updateActivityScore(feedB, 0.6)

      // Disconnect the manually selected feed
      registry.updateStatus(feedA, 'disconnected')
      switcher.handleDisconnect(feedA)

      expect(switcher.mode).toBe('automatic')
      expect(switcher.activeCameraId).toBe(feedB)
    })
  })

  describe('event callbacks', () => {
    it('emits switch events', () => {
      const feedA = registerConnectedFeed(registry, 'PlayerA')
      const feedB = registerConnectedFeed(registry, 'PlayerB')

      const switchEvents: Array<{ prev: string | null; next: string; timestamp: number; reason: string }> = []
      switcher.onSwitch((prev, next, timestamp, reason) => {
        switchEvents.push({ prev, next, timestamp, reason })
      })

      const scores = new Map([
        [feedA, 0.8],
        [feedB, 0.3],
      ])
      switcher.evaluateScores(scores)

      expect(switchEvents).toHaveLength(1)
      expect(switchEvents[0].prev).toBeNull()
      expect(switchEvents[0].next).toBe(feedA)
      expect(switchEvents[0].reason).toBe('automatic')
      expect(switchEvents[0].timestamp).toBeGreaterThan(0)
    })

    it('emits mode change events', () => {
      const modeEvents: string[] = []
      switcher.onModeChange((mode) => {
        modeEvents.push(mode)
      })

      switcher.setMode('manual')
      switcher.setMode('automatic')

      expect(modeEvents).toEqual(['manual', 'automatic'])
    })

    it('does not emit mode change when setting same mode', () => {
      const modeEvents: string[] = []
      switcher.onModeChange((mode) => {
        modeEvents.push(mode)
      })

      switcher.setMode('automatic') // already automatic
      expect(modeEvents).toHaveLength(0)
    })

    it('can remove switch callbacks', () => {
      const feedA = registerConnectedFeed(registry, 'PlayerA')
      const events: string[] = []
      const callback = () => { events.push('called') }

      switcher.onSwitch(callback)
      switcher.offSwitch(callback)

      const scores = new Map([[feedA, 0.8]])
      switcher.evaluateScores(scores)

      expect(events).toHaveLength(0)
    })

    it('can remove mode change callbacks', () => {
      const events: string[] = []
      const callback = () => { events.push('called') }

      switcher.onModeChange(callback)
      switcher.offModeChange(callback)

      switcher.setMode('manual')
      expect(events).toHaveLength(0)
    })
  })

  describe('configuration', () => {
    it('uses default config values', () => {
      const config = switcher.getConfig()
      expect(config.cooldownMs).toBe(3000)
      expect(config.activityThreshold).toBe(0.15)
      expect(config.silenceThreshold).toBe(0.05)
    })

    it('accepts custom config on construction', () => {
      const custom = new POVSwitcher(registry, {
        cooldownMs: 5000,
        activityThreshold: 0.2,
        silenceThreshold: 0.1,
      })
      const config = custom.getConfig()
      expect(config.cooldownMs).toBe(5000)
      expect(config.activityThreshold).toBe(0.2)
      expect(config.silenceThreshold).toBe(0.1)
    })

    it('updateConfig updates individual fields', () => {
      switcher.updateConfig({ cooldownMs: 5000 })
      expect(switcher.getConfig().cooldownMs).toBe(5000)
      expect(switcher.getConfig().activityThreshold).toBe(0.15) // unchanged
    })
  })

  describe('edge cases', () => {
    it('handles empty scores map', () => {
      switcher.evaluateScores(new Map())
      expect(switcher.activeCameraId).toBeNull()
    })

    it('ignores scores for disconnected feeds', () => {
      const feedA = registerConnectedFeed(registry, 'PlayerA')
      const feedB = registerDisconnectedFeed(registry, 'PlayerB')

      const scores = new Map([
        [feedA, 0.3],
        [feedB, 0.9], // disconnected, should be ignored
      ])
      switcher.evaluateScores(scores)

      expect(switcher.activeCameraId).toBe(feedA)
    })

    it('handles scores for non-existent feeds gracefully', () => {
      const feedA = registerConnectedFeed(registry, 'PlayerA')

      const scores = new Map([
        [feedA, 0.5],
        ['non-existent', 0.9],
      ])
      switcher.evaluateScores(scores)

      expect(switcher.activeCameraId).toBe(feedA)
    })
  })
})
