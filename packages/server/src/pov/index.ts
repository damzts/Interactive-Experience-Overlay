/**
 * POV orchestrator — wires HubConnection, AudioScoreProcessor, ParticipantRegistry, and POVSwitcher.
 * When audio tracks arrive from participants, feeds levels into the score processor.
 * When the switcher decides to switch, notifies listeners (overlay relay).
 */

import type { HubConnection } from '../room/hub-connection.js'
import { ParticipantRegistry, type Participant } from './participant-registry.js'
import { createAudioScoreProcessor, type AudioScoreProcessor } from './audio-score-processor.js'
import { POVSwitcher, type SwitchCallback } from './switcher.js'

export interface POVOrchestratorConfig {
  rollingWindowMs?: number
  reportIntervalMs?: number
  emitIntervalMs?: number
  cooldownMs?: number
  activityThreshold?: number
  silenceThreshold?: number
}

export class POVOrchestrator {
  readonly participants = new Map<string, Participant>()
  readonly registry: ParticipantRegistry
  readonly switcher: POVSwitcher
  readonly scoreProcessor: AudioScoreProcessor
  private audioUnsubscribes = new Map<string, () => void>()

  constructor(private hub: HubConnection, config?: POVOrchestratorConfig) {
    this.registry = new ParticipantRegistry(this.participants)
    this.switcher = new POVSwitcher(this.registry, {
      cooldownMs: config?.cooldownMs ?? 3000,
      activityThreshold: config?.activityThreshold ?? 0.15,
      silenceThreshold: config?.silenceThreshold ?? 0.05,
    })
    this.scoreProcessor = createAudioScoreProcessor()

    this.scoreProcessor.onScoresUpdated((scores) => {
      for (const [id, score] of scores) this.registry.updateActivityScore(id, score)
      this.switcher.evaluateScores(scores)
    })

    this.scoreProcessor.start({
      rollingWindowMs: config?.rollingWindowMs ?? 2000,
      reportIntervalMs: config?.reportIntervalMs ?? 100,
      emitIntervalMs: config?.emitIntervalMs ?? 500,
    })

    hub.onTrack((userId, kind, track) => {
      if (kind === 'audio') this.startAudioLevelMonitoring(userId, track)
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
    this.scoreProcessor.removeParticipant(userId)
    const wasActive = this.switcher.activeCameraId === userId
    this.participants.delete(userId)
    if (wasActive) this.switcher.handleDisconnect(userId)
  }

  get activeCameraId(): string | null {
    return this.switcher.activeCameraId
  }

  onSwitch(cb: SwitchCallback): void {
    this.switcher.onSwitch(cb)
  }

  stop(): void {
    this.scoreProcessor.stop()
    for (const unsub of this.audioUnsubscribes.values()) unsub()
    this.audioUnsubscribes.clear()
  }

  private startAudioLevelMonitoring(userId: string, track: any): void {
    this.stopAudioLevelMonitoring(userId)

    // werift MediaStreamTrack.onReceiveRtp.subscribe returns { unsubscribe }
    const sub = track.onReceiveRtp.subscribe((packet: any) => {
      const payload = packet.payload as Buffer
      if (!payload || payload.length === 0) return
      // Estimate energy from encoded audio payload bytes
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

    this.audioUnsubscribes.set(userId, () => sub.unsubscribe())
  }

  private stopAudioLevelMonitoring(userId: string): void {
    const unsub = this.audioUnsubscribes.get(userId)
    if (unsub) { unsub(); this.audioUnsubscribes.delete(userId) }
  }
}
