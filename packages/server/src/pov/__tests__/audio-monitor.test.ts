import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { normalizeDb, CircularBuffer, AudioMonitor } from '../audio-monitor.js'
import { CameraConnectionManager } from '../connections.js'
import { CameraRegistry } from '../registry.js'
import type { CameraFeed } from '@ieom/shared'

// ── normalizeDb tests ────────────────────────────────────────────────────────

describe('normalizeDb', () => {
  it('returns 0 for values at the floor', () => {
    expect(normalizeDb(-60, -60, 0)).toBe(0)
  })

  it('returns 1 for values at the ceiling', () => {
    expect(normalizeDb(0, -60, 0)).toBe(1)
  })

  it('returns 0 for values below the floor', () => {
    expect(normalizeDb(-100, -60, 0)).toBe(0)
  })

  it('returns 1 for values above the ceiling', () => {
    expect(normalizeDb(10, -60, 0)).toBe(1)
  })

  it('returns 0.5 for the midpoint', () => {
    expect(normalizeDb(-30, -60, 0)).toBe(0.5)
  })

  it('handles custom floor and ceiling', () => {
    expect(normalizeDb(-20, -40, 0)).toBe(0.5)
  })

  it('returns 0 when floor equals ceiling', () => {
    expect(normalizeDb(-30, -30, -30)).toBe(0)
  })
})

// ── CircularBuffer tests ─────────────────────────────────────────────────────

describe('CircularBuffer', () => {
  it('returns 0 average when empty', () => {
    const buf = new CircularBuffer(5)
    expect(buf.average()).toBe(0)
  })

  it('computes average of pushed values', () => {
    const buf = new CircularBuffer(5)
    buf.push(0.2)
    buf.push(0.4)
    buf.push(0.6)
    expect(buf.average()).toBeCloseTo(0.4, 10)
  })

  it('overwrites oldest values when full', () => {
    const buf = new CircularBuffer(3)
    buf.push(0.1)
    buf.push(0.2)
    buf.push(0.3)
    // Buffer is full: [0.1, 0.2, 0.3]
    buf.push(0.9)
    // Now: [0.9, 0.2, 0.3] — oldest (0.1) replaced
    expect(buf.average()).toBeCloseTo((0.2 + 0.3 + 0.9) / 3, 10)
  })

  it('reports correct size', () => {
    const buf = new CircularBuffer(5)
    expect(buf.size()).toBe(0)
    buf.push(1)
    expect(buf.size()).toBe(1)
    buf.push(2)
    expect(buf.size()).toBe(2)
  })

  it('size does not exceed capacity', () => {
    const buf = new CircularBuffer(3)
    buf.push(1)
    buf.push(2)
    buf.push(3)
    buf.push(4)
    expect(buf.size()).toBe(3)
  })

  it('reset clears all values', () => {
    const buf = new CircularBuffer(5)
    buf.push(0.5)
    buf.push(0.7)
    buf.reset()
    expect(buf.size()).toBe(0)
    expect(buf.average()).toBe(0)
  })
})

// ── AudioMonitor tests ───────────────────────────────────────────────────────

describe('AudioMonitor', () => {
  let registry: CameraRegistry
  let connectionManager: CameraConnectionManager
  let monitor: AudioMonitor

  // Mock feed for testing
  const mockFeed: CameraFeed = {
    id: 'feed-1',
    label: 'Player 1',
    obsAddress: 'ws://localhost:4455',
    obsPassword: 'pass',
    sceneName: 'Scene1',
    connectionStatus: 'connected',
    connectedAt: Date.now(),
    registeredAt: Date.now(),
    lastHealthCheck: null,
    activityScore: 0,
  }

  beforeEach(() => {
    vi.useFakeTimers()
    registry = new CameraRegistry(10)
    connectionManager = new CameraConnectionManager()

    // Register a feed in the registry
    registry.feeds.set(mockFeed.id, { ...mockFeed })

    monitor = new AudioMonitor(connectionManager, registry)
  })

  afterEach(() => {
    monitor.stop()
    connectionManager.disconnectAll()
    vi.useRealTimers()
  })

  it('starts and stops without errors', () => {
    monitor.start()
    expect(monitor.getConfig().pollIntervalMs).toBe(100)
    monitor.stop()
  })

  it('clamps config values to valid bounds', () => {
    monitor.updateConfig({
      pollIntervalMs: 10,   // below min 50
      rollingWindowMs: 100, // below min 500
      emitIntervalMs: 50,   // below min 100
    })
    const config = monitor.getConfig()
    expect(config.pollIntervalMs).toBe(50)
    expect(config.rollingWindowMs).toBe(500)
    expect(config.emitIntervalMs).toBe(100)
  })

  it('clamps config values to upper bounds', () => {
    monitor.updateConfig({
      pollIntervalMs: 5000,   // above max 1000
      rollingWindowMs: 50000, // above max 10000
      emitIntervalMs: 10000,  // above max 5000
    })
    const config = monitor.getConfig()
    expect(config.pollIntervalMs).toBe(1000)
    expect(config.rollingWindowMs).toBe(10000)
    expect(config.emitIntervalMs).toBe(5000)
  })

  it('registers and invokes score callbacks', () => {
    const callback = vi.fn()
    monitor.onScoresUpdated(callback)
    monitor.start({ emitIntervalMs: 100 })

    // Advance past emit interval
    vi.advanceTimersByTime(100)

    expect(callback).toHaveBeenCalled()
  })

  it('removes callbacks with offScoresUpdated', () => {
    const callback = vi.fn()
    monitor.onScoresUpdated(callback)
    monitor.offScoresUpdated(callback)
    monitor.start({ emitIntervalMs: 100 })

    vi.advanceTimersByTime(100)

    expect(callback).not.toHaveBeenCalled()
  })

  it('sets score to 0 after 3 consecutive missed polls', () => {
    // Mock getConnection to return undefined (simulating no connection)
    vi.spyOn(connectionManager, 'getConnection').mockReturnValue(undefined)

    monitor.start({ pollIntervalMs: 100 })

    // Advance 3 poll cycles
    vi.advanceTimersByTime(300)

    const scores = monitor.getScores()
    expect(scores.get('feed-1')).toBe(0)
  })

  it('computes score from successful polls', async () => {
    // Create a mock OBS connection that returns volume data
    const mockObs = {
      call: vi.fn().mockResolvedValue({
        inputLevelsMul: [
          [[0.5, 0.5]], // magnitude, peak — linear 0.5 = ~-6dB
        ],
      }),
    }

    vi.spyOn(connectionManager, 'getConnection').mockReturnValue(mockObs as any)

    monitor.start({ pollIntervalMs: 100, rollingWindowMs: 500, dbFloor: -60, dbCeiling: 0 })

    // Advance one poll cycle
    vi.advanceTimersByTime(100)
    // Flush the microtask queue to resolve the promise
    await Promise.resolve()
    await Promise.resolve()

    const scores = monitor.getScores()
    const score = scores.get('feed-1')
    // 0.5 linear → 20*log10(0.5) ≈ -6.02 dB → normalized: (-6.02 - (-60)) / (0 - (-60)) ≈ 0.9
    expect(score).toBeGreaterThan(0)
    expect(score).toBeLessThanOrEqual(1)
  })

  it('resets buffer on data resumption after zeroing', async () => {
    const mockObs = {
      call: vi.fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockRejectedValueOnce(new Error('fail'))
        .mockRejectedValueOnce(new Error('fail'))
        // After 3 misses, data resumes
        .mockResolvedValue({
          inputLevelsMul: [
            [[0.8, 0.8]], // high level
          ],
        }),
    }

    vi.spyOn(connectionManager, 'getConnection').mockReturnValue(mockObs as any)

    monitor.start({ pollIntervalMs: 100, rollingWindowMs: 500, dbFloor: -60, dbCeiling: 0 })

    // 3 missed polls — advance timer and flush microtasks each time
    vi.advanceTimersByTime(100)
    await Promise.resolve()
    await Promise.resolve()

    vi.advanceTimersByTime(100)
    await Promise.resolve()
    await Promise.resolve()

    vi.advanceTimersByTime(100)
    await Promise.resolve()
    await Promise.resolve()

    // Score should be 0
    expect(monitor.getScores().get('feed-1')).toBe(0)

    // Data resumes
    vi.advanceTimersByTime(100)
    await Promise.resolve()
    await Promise.resolve()

    // Score should be computed from new reading only (buffer was reset)
    const score = monitor.getScores().get('feed-1')
    expect(score).toBeGreaterThan(0)
  })
})
