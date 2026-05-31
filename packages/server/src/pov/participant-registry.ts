export interface Participant {
  id: string
  displayName: string
  connectionStatus: 'connected' | 'disconnected'
  activityScore: number
}

export interface ParticipantFeed {
  id: string
  connectionStatus: 'connected' | 'disconnected'
  activityScore: number
}

export class ParticipantRegistry {
  constructor(private readonly participants: Map<string, Participant>) {}

  getActiveFeed(participantId: string): ParticipantFeed | undefined {
    const p = this.participants.get(participantId)
    if (!p) return undefined
    return { id: p.id, connectionStatus: p.connectionStatus, activityScore: p.activityScore }
  }

  getConnectedFeeds(): ParticipantFeed[] {
    const connected: ParticipantFeed[] = []
    for (const p of this.participants.values()) {
      if (p.connectionStatus === 'connected') {
        connected.push({ id: p.id, connectionStatus: 'connected', activityScore: p.activityScore })
      }
    }
    return connected
  }

  updateActivityScore(participantId: string, score: number): void {
    const p = this.participants.get(participantId)
    if (p) p.activityScore = Math.max(0, Math.min(1, score))
  }
}
