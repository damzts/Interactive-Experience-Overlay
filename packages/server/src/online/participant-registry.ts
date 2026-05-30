/**
 * ParticipantRegistry — lightweight adapter that implements the feed interface
 * expected by POVSwitcher, backed by the room's participant map.
 *
 * This allows each online room to reuse the same POVSwitcher decision engine
 * without coupling it to the LAN-mode CameraRegistry.
 *
 * Requirements: 12.2, 12.4
 */

// ── Types ────────────────────────────────────────────────────────

/** Minimal participant shape required by the registry */
export interface Participant {
  id: string
  displayName: string
  socketId: string
  joinedAt: number
  connectionStatus: 'connected' | 'disconnected'
  lastAudioReport: number
  activityScore: number
}

/** Feed shape returned by the registry, matching what POVSwitcher expects */
export interface ParticipantFeed {
  id: string
  connectionStatus: 'connected' | 'disconnected'
  activityScore: number
}

/** Connected feed — narrowed type guaranteeing connected status */
export interface ConnectedParticipantFeed {
  id: string
  connectionStatus: 'connected'
  activityScore: number
}

// ── Interface ────────────────────────────────────────────────────

export interface IParticipantRegistry {
  /** Get a participant as a "feed" for the POVSwitcher */
  getActiveFeed(participantId: string): ParticipantFeed | undefined

  /** Get all connected participants as "feeds" */
  getConnectedFeeds(): ConnectedParticipantFeed[]

  /** Update activity score for a participant */
  updateActivityScore(participantId: string, score: number): void
}

// ── Implementation ───────────────────────────────────────────────

/**
 * ParticipantRegistry adapts a room's participant map to the feed interface
 * expected by POVSwitcher. It does not own the participant data — it reads
 * from and writes to the shared Map reference provided at construction.
 */
export class ParticipantRegistry implements IParticipantRegistry {
  constructor(private readonly participants: Map<string, Participant>) {}

  /**
   * Get a participant as a feed object.
   * Returns undefined if the participant is not found in the map.
   */
  getActiveFeed(participantId: string): ParticipantFeed | undefined {
    const participant = this.participants.get(participantId)
    if (!participant) return undefined

    return {
      id: participant.id,
      connectionStatus: participant.connectionStatus,
      activityScore: participant.activityScore,
    }
  }

  /**
   * Get all connected participants as feed objects.
   * Only returns participants with connectionStatus === 'connected'.
   */
  getConnectedFeeds(): ConnectedParticipantFeed[] {
    const connected: ConnectedParticipantFeed[] = []

    for (const participant of this.participants.values()) {
      if (participant.connectionStatus === 'connected') {
        connected.push({
          id: participant.id,
          connectionStatus: 'connected',
          activityScore: participant.activityScore,
        })
      }
    }

    return connected
  }

  /**
   * Update the activity score for a participant.
   * Score is clamped to [0, 1]. No-op if participant not found.
   */
  updateActivityScore(participantId: string, score: number): void {
    const participant = this.participants.get(participantId)
    if (!participant) return

    participant.activityScore = Math.max(0, Math.min(1, score))
  }
}
