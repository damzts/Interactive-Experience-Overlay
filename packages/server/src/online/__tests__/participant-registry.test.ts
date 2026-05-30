import { describe, it, expect, beforeEach } from 'vitest'
import { ParticipantRegistry, type Participant } from '../participant-registry.js'

function makeParticipant(overrides: Partial<Participant> = {}): Participant {
  return {
    id: 'p1',
    displayName: 'Player 1',
    socketId: 'socket-1',
    joinedAt: Date.now(),
    connectionStatus: 'connected',
    lastAudioReport: Date.now(),
    activityScore: 0,
    ...overrides,
  }
}

describe('ParticipantRegistry', () => {
  let participants: Map<string, Participant>
  let registry: ParticipantRegistry

  beforeEach(() => {
    participants = new Map()
    registry = new ParticipantRegistry(participants)
  })

  describe('getActiveFeed', () => {
    it('returns undefined for unknown participant', () => {
      expect(registry.getActiveFeed('unknown')).toBeUndefined()
    })

    it('returns feed object for existing connected participant', () => {
      const p = makeParticipant({ id: 'p1', connectionStatus: 'connected', activityScore: 0.5 })
      participants.set(p.id, p)

      const feed = registry.getActiveFeed('p1')
      expect(feed).toEqual({
        id: 'p1',
        connectionStatus: 'connected',
        activityScore: 0.5,
      })
    })

    it('returns feed object for disconnected participant', () => {
      const p = makeParticipant({ id: 'p2', connectionStatus: 'disconnected', activityScore: 0.3 })
      participants.set(p.id, p)

      const feed = registry.getActiveFeed('p2')
      expect(feed).toEqual({
        id: 'p2',
        connectionStatus: 'disconnected',
        activityScore: 0.3,
      })
    })

    it('reflects live changes to the participant map', () => {
      const p = makeParticipant({ id: 'p1', activityScore: 0.1 })
      participants.set(p.id, p)

      expect(registry.getActiveFeed('p1')?.activityScore).toBe(0.1)

      p.activityScore = 0.9
      expect(registry.getActiveFeed('p1')?.activityScore).toBe(0.9)
    })
  })

  describe('getConnectedFeeds', () => {
    it('returns empty array when no participants', () => {
      expect(registry.getConnectedFeeds()).toEqual([])
    })

    it('returns only connected participants', () => {
      participants.set('p1', makeParticipant({ id: 'p1', connectionStatus: 'connected', activityScore: 0.4 }))
      participants.set('p2', makeParticipant({ id: 'p2', connectionStatus: 'disconnected', activityScore: 0.6 }))
      participants.set('p3', makeParticipant({ id: 'p3', connectionStatus: 'connected', activityScore: 0.2 }))

      const feeds = registry.getConnectedFeeds()
      expect(feeds).toHaveLength(2)
      expect(feeds.map(f => f.id).sort()).toEqual(['p1', 'p3'])
      expect(feeds.every(f => f.connectionStatus === 'connected')).toBe(true)
    })

    it('returns all participants when all are connected', () => {
      participants.set('p1', makeParticipant({ id: 'p1', connectionStatus: 'connected' }))
      participants.set('p2', makeParticipant({ id: 'p2', connectionStatus: 'connected' }))

      expect(registry.getConnectedFeeds()).toHaveLength(2)
    })

    it('returns empty array when all are disconnected', () => {
      participants.set('p1', makeParticipant({ id: 'p1', connectionStatus: 'disconnected' }))
      participants.set('p2', makeParticipant({ id: 'p2', connectionStatus: 'disconnected' }))

      expect(registry.getConnectedFeeds()).toEqual([])
    })
  })

  describe('updateActivityScore', () => {
    it('updates score for existing participant', () => {
      const p = makeParticipant({ id: 'p1', activityScore: 0 })
      participants.set(p.id, p)

      registry.updateActivityScore('p1', 0.75)
      expect(p.activityScore).toBe(0.75)
    })

    it('clamps score to 0 when negative', () => {
      const p = makeParticipant({ id: 'p1', activityScore: 0.5 })
      participants.set(p.id, p)

      registry.updateActivityScore('p1', -0.5)
      expect(p.activityScore).toBe(0)
    })

    it('clamps score to 1 when above 1', () => {
      const p = makeParticipant({ id: 'p1', activityScore: 0.5 })
      participants.set(p.id, p)

      registry.updateActivityScore('p1', 1.5)
      expect(p.activityScore).toBe(1)
    })

    it('does nothing for unknown participant', () => {
      registry.updateActivityScore('unknown', 0.5)
      // No error thrown, map unchanged
      expect(participants.size).toBe(0)
    })

    it('score is visible via getActiveFeed after update', () => {
      const p = makeParticipant({ id: 'p1', activityScore: 0 })
      participants.set(p.id, p)

      registry.updateActivityScore('p1', 0.88)
      expect(registry.getActiveFeed('p1')?.activityScore).toBe(0.88)
    })
  })
})
