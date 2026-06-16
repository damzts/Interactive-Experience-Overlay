import type { SwitchMode } from '@ieomlabs/shared'

export interface POVSwitcherConfig {
  cooldownMs: number
  activityThreshold: number
  silenceThreshold: number
}

export type SwitchReason = 'automatic' | 'manual' | 'fallback'
export type SwitchCallback = (prev: string | null, next: string, timestamp: number, reason: SwitchReason) => void
export type ModeChangeCallback = (mode: SwitchMode) => void

export interface FeedLike {
  id: string
  connectionStatus: 'connected' | 'disconnected'
  activityScore: number
}

export interface RegistryLike {
  getActiveFeed(id: string): FeedLike | undefined
  getConnectedFeeds(): FeedLike[]
}

const DEFAULT_CONFIG: POVSwitcherConfig = { cooldownMs: 3000, activityThreshold: 0.15, silenceThreshold: 0.05 }

export class POVSwitcher {
  private config: POVSwitcherConfig
  private _mode: SwitchMode = 'automatic'
  private _activeCameraId: string | null = null
  private _lastSwitchTimestamp: number | null = null
  private lastActiveTimestamps = new Map<string, number>()
  private switchCallbacks: SwitchCallback[] = []
  private modeChangeCallbacks: ModeChangeCallback[] = []
  private rotationTimer: ReturnType<typeof setInterval> | null = null
  private rotationIndex = 0
  /** Interval in ms for round-robin/random modes (default: 15000) */
  rotationIntervalMs = 15_000

  constructor(private registry: RegistryLike, config?: Partial<POVSwitcherConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  get mode(): SwitchMode { return this._mode }
  get activeCameraId(): string | null { return this._activeCameraId }

  updateConfig(config: Partial<POVSwitcherConfig>): void {
    if (config.cooldownMs !== undefined) this.config.cooldownMs = config.cooldownMs
    if (config.activityThreshold !== undefined) this.config.activityThreshold = config.activityThreshold
    if (config.silenceThreshold !== undefined) this.config.silenceThreshold = config.silenceThreshold
  }

  setMode(mode: SwitchMode): void {
    if (this._mode === mode) return
    this._mode = mode
    this.stopRotation()
    if (mode === 'round-robin' || mode === 'random') {
      this.startRotation()
    }
    for (const cb of this.modeChangeCallbacks) { try { cb(mode) } catch {} }
  }

  setRotationInterval(ms: number): void {
    this.rotationIntervalMs = Math.max(1000, ms)
    if (this.rotationTimer) {
      this.stopRotation()
      this.startRotation()
    }
  }

  private startRotation(): void {
    this.stopRotation()
    this.rotationTimer = setInterval(() => {
      const feeds = this.registry.getConnectedFeeds()
      if (feeds.length < 2) return

      if (this._mode === 'round-robin') {
        this.rotationIndex = (this.rotationIndex + 1) % feeds.length
        const next = feeds[this.rotationIndex]
        if (next && next.id !== this._activeCameraId) {
          this.performSwitch(next.id, 'automatic')
        }
      } else if (this._mode === 'random') {
        // Pick a random feed different from current
        const others = feeds.filter(f => f.id !== this._activeCameraId)
        if (others.length > 0) {
          const pick = others[Math.floor(Math.random() * others.length)]
          this.performSwitch(pick.id, 'automatic')
        }
      }
    }, this.rotationIntervalMs)
  }

  private stopRotation(): void {
    if (this.rotationTimer) {
      clearInterval(this.rotationTimer)
      this.rotationTimer = null
    }
  }

  manualSelect(feedId: string): { ok: boolean; error?: string } {
    const feed = this.registry.getActiveFeed(feedId)
    if (!feed) return { ok: false, error: 'feed_not_found' }
    if (feed.connectionStatus !== 'connected') return { ok: false, error: 'feed_unavailable' }
    this.performSwitch(feedId, 'manual')
    return { ok: true }
  }

  evaluateScores(scores: Map<string, number>): void {
    if (this._mode === 'manual' || this._mode === 'round-robin' || this._mode === 'random') return
    const connected = this.filterConnected(scores)
    if (connected.size === 0) return

    if (this._activeCameraId === null) {
      const best = this.selectHighest(connected)
      if (best) this.performSwitch(best, 'automatic')
      return
    }

    const currentFeed = this.registry.getActiveFeed(this._activeCameraId)
    if (!currentFeed || currentFeed.connectionStatus !== 'connected') {
      const best = this.selectHighest(connected)
      if (best) this.performSwitch(best, 'fallback')
      return
    }

    if (this.allBelowSilence(connected)) return
    if (this.isWithinCooldown()) return

    const currentScore = connected.get(this._activeCameraId) ?? 0
    const candidate = this.findBestCandidate(connected, currentScore)
    if (candidate && candidate !== this._activeCameraId) this.performSwitch(candidate, 'automatic')
  }

  handleDisconnect(feedId: string): void {
    if (this._activeCameraId !== feedId) return
    if (this._mode !== 'automatic') {
      this.stopRotation()
      this._mode = 'automatic'
      for (const cb of this.modeChangeCallbacks) { try { cb('automatic') } catch {} }
    }
    const feeds = this.registry.getConnectedFeeds()
    if (feeds.length === 0) { this._activeCameraId = null; return }
    const scores = new Map<string, number>()
    for (const f of feeds) scores.set(f.id, f.activityScore)
    const best = this.selectHighest(scores)
    if (best) this.performSwitch(best, 'fallback')
    else this._activeCameraId = null
  }

  onSwitch(cb: SwitchCallback): void { this.switchCallbacks.push(cb) }
  onModeChange(cb: ModeChangeCallback): void { this.modeChangeCallbacks.push(cb) }

  private filterConnected(scores: Map<string, number>): Map<string, number> {
    const m = new Map<string, number>()
    for (const [id, score] of scores) { const f = this.registry.getActiveFeed(id); if (f?.connectionStatus === 'connected') m.set(id, score) }
    return m
  }

  private allBelowSilence(scores: Map<string, number>): boolean {
    for (const s of scores.values()) if (s >= this.config.silenceThreshold) return false
    return true
  }

  private isWithinCooldown(): boolean {
    if (!this._lastSwitchTimestamp) return false
    return Date.now() - this._lastSwitchTimestamp < this.config.cooldownMs
  }

  private findBestCandidate(scores: Map<string, number>, currentScore: number): string | null {
    let bestScore = -1, bestCandidates: string[] = []
    for (const [id, score] of scores) {
      if (score - currentScore < this.config.activityThreshold) continue
      if (score > bestScore) { bestScore = score; bestCandidates = [id] }
      else if (score === bestScore) bestCandidates.push(id)
    }
    if (bestCandidates.length === 0) return null
    if (bestCandidates.length === 1) return bestCandidates[0]
    return this.selectLeastRecent(bestCandidates)
  }

  private selectHighest(scores: Map<string, number>): string | null {
    let bestScore = -1, bestCandidates: string[] = []
    for (const [id, score] of scores) {
      if (score > bestScore) { bestScore = score; bestCandidates = [id] }
      else if (score === bestScore) bestCandidates.push(id)
    }
    if (bestCandidates.length === 0) return null
    if (bestCandidates.length === 1) return bestCandidates[0]
    return this.selectLeastRecent(bestCandidates)
  }

  private selectLeastRecent(candidates: string[]): string {
    let oldest = candidates[0], oldestTs = this.lastActiveTimestamps.get(candidates[0]) ?? 0
    for (let i = 1; i < candidates.length; i++) {
      const ts = this.lastActiveTimestamps.get(candidates[i]) ?? 0
      if (ts < oldestTs) { oldestTs = ts; oldest = candidates[i] }
    }
    return oldest
  }

  private performSwitch(newId: string, reason: SwitchReason): void {
    const prev = this._activeCameraId
    if (prev === newId) return
    this._activeCameraId = newId
    this._lastSwitchTimestamp = Date.now()
    this.lastActiveTimestamps.set(newId, this._lastSwitchTimestamp)
    for (const cb of this.switchCallbacks) { try { cb(prev, newId, this._lastSwitchTimestamp, reason) } catch {} }
  }
}
