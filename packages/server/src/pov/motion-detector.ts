/**
 * Lightweight motion detector for video RTP tracks.
 *
 * Uses RTP packet size fluctuation as a proxy for frame motion:
 * - Static scene → encoder produces roughly constant-size packets
 * - Motion → packet sizes vary more between frames
 *
 * This avoids expensive frame decoding on the server.
 * The score is a rolling RMS of packet-size deltas, normalized 0-1.
 */

import logger from '../lib/logger.js'

export interface MotionDetectorConfig {
  /** Rolling window in ms (default: 2000) */
  rollingWindowMs: number
  /** Report this level to the callback on each batch of packets (default: every 200ms) */
  reportIntervalMs: number
  /** Minimum packet count per interval to produce a reading */
  minPacketsPerReport: number
}

const DEFAULT_CONFIG: MotionDetectorConfig = {
  rollingWindowMs: 2000,
  reportIntervalMs: 200,
  minPacketsPerReport: 5,
}

interface SizeReading {
  size: number
  timestamp: number
}

interface ParticipantMotionState {
  readings: SizeReading[]
  lastReportTimestamp: number
}

export interface MotionAware {
  reportMotionLevel(participantId: string, level: number, timestamp: number): void
  removeParticipant(participantId: string): void
  subscribe(callback: (participantId: string, level: number) => void): () => void
}

/**
 * Creates a motion detector that watches RTP packet sizes.
 *
 * Usage per participant:
 *   det.packetReceived(userId, packetSize)
 *
 * It accumulates, computes RMS-based delta scores, and emits
 * them via the subscriber callback at `reportIntervalMs`.
 */
export function createMotionDetector(config?: Partial<MotionDetectorConfig>): MotionAware {
  const cfg: MotionDetectorConfig = { ...DEFAULT_CONFIG, ...config }
  const participants = new Map<string, ParticipantMotionState>()
  const callbacks: Array<(participantId: string, level: number) => void> = []
  const pendingLevels = new Map<string, number[]>()  // accumulated levels per interval

  // Accumulate sizes and compute RMS delta
  function processReadings(readings: SizeReading[]): number {
    if (readings.length < cfg.minPacketsPerReport) return 0

    let sumSqDeltas = 0
    let count = 0
    for (let i = 1; i < readings.length; i++) {
      const delta = Math.abs(readings[i].size - readings[i - 1].size)
      sumSqDeltas += delta * delta
      count++
    }
    if (count === 0) return 0

    // Normalize: assume max plausible delta ~= 1500 bytes (MTU-sized jump)
    const rms = Math.sqrt(sumSqDeltas / count)
    return Math.min(1, rms / 1500)
  }

  // Emit accumulated levels every reportIntervalMs
  const emitTimer = setInterval(() => {
    if (pendingLevels.size === 0) return
    for (const [id, levels] of pendingLevels) {
      if (levels.length === 0) continue
      const avg = levels.reduce((a, b) => a + b, 0) / levels.length
      for (const cb of callbacks) {
        try { cb(id, avg) } catch { /* ignore callback errors */ }
      }
    }
    pendingLevels.clear()
  }, cfg.reportIntervalMs)

  return {
    reportMotionLevel(participantId, level, timestamp) {
      let state = participants.get(participantId)
      if (!state) {
        state = { readings: [], lastReportTimestamp: 0 }
        participants.set(participantId, state)
      }

      // Prune readings outside rolling window
      const cutoff = timestamp - cfg.rollingWindowMs
      state.readings = state.readings.filter(r => r.timestamp >= cutoff)

      // Skip if we already reported recently
      if (timestamp - state.lastReportTimestamp < cfg.reportIntervalMs) return
      state.lastReportTimestamp = timestamp

      // Compute and accumulate
      const motionLevel = processReadings(state.readings)
      if (motionLevel > 0) {
        const existing = pendingLevels.get(participantId) ?? []
        existing.push(motionLevel)
        pendingLevels.set(participantId, existing)
      }
    },

    removeParticipant(id) {
      participants.delete(id)
      pendingLevels.delete(id)
    },

    subscribe(cb) {
      callbacks.push(cb)
      return () => {
        const idx = callbacks.indexOf(cb)
        if (idx >= 0) callbacks.splice(idx, 1)
      }
    },
  }
}
