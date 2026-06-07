/**
 * POV orchestrator — wires HubConnection, AudioScoreProcessor, ParticipantRegistry, and POVSwitcher.
 * When audio tracks arrive from participants, feeds levels into the score processor.
 * When the switcher decides to switch, notifies listeners (overlay relay).
 */

import type { HubConnection } from '../../transport/webrtc/hub-connection.js'
import { ParticipantRegistry, type Participant } from '../../pov/participant-registry.js'
import { createAudioScoreProcessor, type AudioScoreProcessor } from '../../pov/audio-score-processor.js'
import { createMotionDetector, type MotionAware } from '../../pov/motion-detector.js'
import { POVSwitcher, type SwitchCallback } from '../../pov/switcher.js'
import type { Manager, ManagerStatus } from '@ieom/shared'
import logger from '../../lib/logger.js';


export interface POVOrchestratorConfig {
  rollingWindowMs?: number
  reportIntervalMs?: number
  emitIntervalMs?: number
  cooldownMs?: number
  activityThreshold?: number
  silenceThreshold?: number
  /** Weight of motion score vs audio score (0-1). Default: 0.3 */
  motionWeight?: number
}

export class POVOrchestrator implements Manager {
  readonly name = 'POVOrchestrator'
  private _status: ManagerStatus = 'idle'
  readonly participants = new Map<string, Participant>()
  readonly registry: ParticipantRegistry
  readonly switcher: POVSwitcher
  readonly scoreProcessor: AudioScoreProcessor
  readonly motionDetector: MotionAware
  private audioUnsubscribes = new Map<string, () => void>()
  private videoUnsubscribes = new Map<string, () => void>()
  /** Combined score: audio score + motion weight * motion score */
  motionWeight: number

  constructor(private hub: HubConnection, config?: POVOrchestratorConfig) {
    this.registry = new ParticipantRegistry(this.participants)
    this.switcher = new POVSwitcher(this.registry, {
      cooldownMs: config?.cooldownMs ?? 3000,
      activityThreshold: config?.activityThreshold ?? 0.15,
      silenceThreshold: config?.silenceThreshold ?? 0.05,
    })
    this.scoreProcessor = createAudioScoreProcessor()
    this.motionDetector = createMotionDetector({
      rollingWindowMs: config?.rollingWindowMs ?? 2000,
    })
    this.motionWeight = config?.motionWeight ?? 0.3

    // Combine audio + motion scores into a single composite score
    const motionScores = new Map<string, number>()
    this.motionDetector.subscribe((userId, level) => {
      motionScores.set(userId, level)
    })

    this.scoreProcessor.onScoresUpdated((audioScores) => {
      // Composite: audio + motion (weighted)
      const combined = new Map<string, number>()
      const allIds = new Set([...audioScores.keys(), ...motionScores.keys()])
      for (const id of allIds) {
        const audio = audioScores.get(id) ?? 0
        const motion = motionScores.get(id) ?? 0
        combined.set(id, audio + motion * this.motionWeight)
      }
      for (const [id, score] of combined) this.registry.updateActivityScore(id, score)
      this.switcher.evaluateScores(combined)
    })

    this.scoreProcessor.start({
      rollingWindowMs: config?.rollingWindowMs ?? 2000,
      reportIntervalMs: config?.reportIntervalMs ?? 100,
      emitIntervalMs: config?.emitIntervalMs ?? 500,
    })

    hub.onTrack((userId, kind, track) => {
      if (kind === 'audio') this.startAudioLevelMonitoring(userId, track)
      if (kind === 'video') this.startMotionDetection(userId, track)
    })

    hub.onParticipantRemoved((userId) => {
      this.removeParticipant(userId)
    })
  }

  addParticipant(userId: string, displayName: string): void {
    this.participants.set(userId, {
      id: userId,
      displayName,
      connectionStatus: 'connected',
      activityScore: 0,
    })
  }

  removeParticipant(userId: string): void {
    this.stopAudioLevelMonitoring(userId)
    this.stopMotionDetection(userId)
    this.scoreProcessor.removeParticipant(userId)
    this.motionDetector.removeParticipant(userId)
    const wasActive = this.switcher.activeCameraId === userId
    this.participants.delete(userId)
    if (wasActive) this.switcher.handleDisconnect(userId)
  }

  get activeCameraId(): string | null {
    return this.switcher.activeCameraId
  }

  // ── Manager interface ────────────────────────────────────────
  init(): void { this._status = 'idle' }
  start(): void { this._status = 'running' }
  stop(): void {
    this._status = 'stopped'
    this.scoreProcessor.stop()
    for (const unsub of this.audioUnsubscribes.values()) unsub()
    this.audioUnsubscribes.clear()
  }
  dispose(): void { this.stop() }
  status(): ManagerStatus { return this._status }

  onSwitch(cb: SwitchCallback): void {
    this.switcher.onSwitch(cb)
  }

  private startMotionDetection(userId: string, track: any): void {
    this.stopMotionDetection(userId)
    try {
      const sub = track.onReceiveRtp.subscribe((packet: any) => {
        const payload = packet.payload as Buffer
        if (!payload || payload.length === 0) return
        this.motionDetector.reportMotionLevel(userId, payload.length, Date.now())
      })
      this.videoUnsubscribes.set(userId, () => sub.unSubscribe())
    } catch (err) {
      logger.warn({ userId }, '[pov] motion detection unavailable for {userId}')
    }
  }

  private stopMotionDetection(userId: string): void {
    const unsub = this.videoUnsubscribes.get(userId)
    if (unsub) { unsub(); this.videoUnsubscribes.delete(userId) }
  }

  private startAudioLevelMonitoring(userId: string, track: any): void {
    this.stopAudioLevelMonitoring(userId)

    try {
      const sub = track.onReceiveRtp.subscribe((packet: any) => {
        const payload = packet.payload as Buffer
        if (!payload || payload.length === 0) return
        let sum = 0
        const len = Math.min(payload.length, 160)
        for (let i = 0; i < len; i++) {
          const sample = (payload[i] - 128) / 128
          sum += sample * sample
        }
        const rms = Math.sqrt(sum / len)
        const level = Math.min(1, rms * 3)
        this.scoreProcessor.reportLevel(userId, level, Date.now())
      })

      this.audioUnsubscribes.set(userId, () => sub.unSubscribe())
    } catch (err) {
      logger.warn({ userId: userId }, '[pov] audio level monitoring unavailable for {userId}:')
    }
  }

  private stopAudioLevelMonitoring(userId: string): void {
    const unsub = this.audioUnsubscribes.get(userId)
    if (unsub) { unsub(); this.audioUnsubscribes.delete(userId) }
  }
}
