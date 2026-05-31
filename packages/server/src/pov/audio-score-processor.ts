export interface AudioScoreProcessorConfig {
  rollingWindowMs: number
  reportIntervalMs: number
  emitIntervalMs: number
}

export interface AudioScoreProcessor {
  reportLevel(participantId: string, level: number, timestamp: number): void
  getScores(): Map<string, number>
  removeParticipant(participantId: string): void
  start(config: AudioScoreProcessorConfig): void
  stop(): void
  onScoresUpdated(callback: (scores: Map<string, number>) => void): void
}

interface TimestampedReading { level: number; timestamp: number }
interface ParticipantState {
  readings: TimestampedReading[]
  writeIndex: number
  count: number
  lastReportTimestamp: number
  consecutiveMisses: number
}

const MISS_THRESHOLD = 3
const BUFFER_CAPACITY = 200

export function createAudioScoreProcessor(): AudioScoreProcessor {
  const participants = new Map<string, ParticipantState>()
  const callbacks: Array<(scores: Map<string, number>) => void> = []
  let config: AudioScoreProcessorConfig | null = null
  let emitTimer: ReturnType<typeof setInterval> | null = null

  function getOrCreateState(id: string): ParticipantState {
    let s = participants.get(id)
    if (!s) {
      s = { readings: new Array(BUFFER_CAPACITY), writeIndex: 0, count: 0, lastReportTimestamp: 0, consecutiveMisses: 0 }
      participants.set(id, s)
    }
    return s
  }

  function computeScore(state: ParticipantState, rollingWindowMs: number, now: number): number {
    if (state.consecutiveMisses >= MISS_THRESHOLD) return 0
    const windowStart = now - rollingWindowMs
    let sum = 0, count = 0
    for (let i = 0; i < state.count; i++) {
      const idx = (state.writeIndex - 1 - i + BUFFER_CAPACITY) % BUFFER_CAPACITY
      const r = state.readings[idx]
      if (r.timestamp < windowStart) break
      sum += r.level
      count++
    }
    return count === 0 ? 0 : sum / count
  }

  function computeAllScores(): Map<string, number> {
    const scores = new Map<string, number>()
    if (!config) return scores
    const now = Date.now()
    for (const [id, state] of participants) scores.set(id, computeScore(state, config.rollingWindowMs, now))
    return scores
  }

  function checkMissedReports(): void {
    if (!config) return
    const now = Date.now()
    for (const [, state] of participants) {
      if (state.lastReportTimestamp === 0) continue
      const missed = Math.max(0, Math.floor((now - state.lastReportTimestamp) / config.reportIntervalMs) - 1)
      if (missed > 0) state.consecutiveMisses = missed
    }
  }

  return {
    reportLevel(id, level, timestamp) {
      const state = getOrCreateState(id)
      const clamped = Math.max(0, Math.min(1, level))
      if (state.consecutiveMisses >= MISS_THRESHOLD) { state.count = 0; state.writeIndex = 0 }
      state.consecutiveMisses = 0
      state.lastReportTimestamp = timestamp
      state.readings[state.writeIndex] = { level: clamped, timestamp }
      state.writeIndex = (state.writeIndex + 1) % BUFFER_CAPACITY
      if (state.count < BUFFER_CAPACITY) state.count++
    },
    getScores: computeAllScores,
    removeParticipant(id) { participants.delete(id) },
    start(cfg) {
      config = cfg
      if (emitTimer) clearInterval(emitTimer)
      emitTimer = setInterval(() => { checkMissedReports(); const s = computeAllScores(); for (const cb of callbacks) cb(s) }, cfg.emitIntervalMs)
    },
    stop() { if (emitTimer) { clearInterval(emitTimer); emitTimer = null } },
    onScoresUpdated(cb) { callbacks.push(cb) },
  }
}
