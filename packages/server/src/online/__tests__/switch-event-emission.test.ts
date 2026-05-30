import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { OnlineSessionManager } from '../session-manager.js'
import type { SessionEvent } from '../session-manager.js'

/**
 * Tests for switch event emission in OnlineSessionManager.
 * Validates Requirements 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7
 *
 * Verifies that the POVSwitcher switch decisions are properly wired
 * to emit 'switch' SessionEvents with correct payload fields.
 */
describe('OnlineSessionManager — switch event emission', () => {
  let manager: OnlineSessionManager
  let events: SessionEvent[]

  beforeEach(() => {
    vi.useFakeTimers()
    manager = new OnlineSessionManager({
      maxActiveRooms: 5,
      maxPlayersPerRoom: 10,
      idleTimeoutMs: 60000,
      cooldownMs: 3000,
      activityThreshold: 0.15,
      silenceThreshold: 0.05,
      scoreEmitIntervalMs: 500,
      audioReportIntervalMs: 100,
      rollingWindowMs: 2000,
    })
    events = []
    manager.onEvent((event) => events.push(event))
  })

  afterEach(() => {
    for (const room of manager.getActiveRooms()) {
      manager.closeRoom(room.roomCode)
    }
    vi.useRealTimers()
  })

  function getSwitchEvents(): Extract<SessionEvent, { type: 'switch' }>[] {
    return events.filter((e): e is Extract<SessionEvent, { type: 'switch' }> => e.type === 'switch')
  }

  function createRoomWithPlayers(count: number): { roomCode: string; participantIds: string[] } {
    const result = manager.createRoom()
    if (!('roomCode' in result)) throw new Error('Failed to create room')
    const roomCode = result.roomCode
    const participantIds: string[] = []

    for (let i = 0; i < count; i++) {
      const join = manager.joinRoom(roomCode, `Player${i}`, `socket-${i}`)
      if (!('participantId' in join)) throw new Error('Failed to join room')
      participantIds.push(join.participantId)
    }

    return { roomCode, participantIds }
  }

  function feedAudioAndTriggerEvaluation(roomCode: string, levels: Map<string, number>): void {
    // Feed reports at the expected interval (100ms) to avoid missed-report zeroing.
    // We need to cover at least one full emit interval (500ms) with reports.
    for (let i = 0; i < 6; i++) {
      for (const [participantId, level] of levels) {
        manager.handleAudioReport(roomCode, participantId, level)
      }
      vi.advanceTimersByTime(100)
    }
  }

  describe('switch event payload correctness (Req 7.3)', () => {
    it('emits switch event with previousId=null, newId, timestamp, and reason on initial selection', () => {
      const { roomCode, participantIds } = createRoomWithPlayers(3)
      const [pA, pB, pC] = participantIds

      // Feed audio levels — pB has highest
      feedAudioAndTriggerEvaluation(roomCode, new Map([
        [pA, 0.3],
        [pB, 0.8],
        [pC, 0.5],
      ]))

      const switchEvts = getSwitchEvents()
      expect(switchEvts.length).toBeGreaterThanOrEqual(1)

      const firstSwitch = switchEvts[0]
      expect(firstSwitch.roomCode).toBe(roomCode)
      expect(firstSwitch.previousId).toBeNull()
      expect(firstSwitch.newId).toBe(pB)
      expect(firstSwitch.timestamp).toBeGreaterThan(0)
      expect(firstSwitch.reason).toBe('automatic')
    })

    it('emits switch event with correct previousId when switching between players', () => {
      const { roomCode, participantIds } = createRoomWithPlayers(2)
      const [pA, pB] = participantIds

      // Initial selection — pA wins
      feedAudioAndTriggerEvaluation(roomCode, new Map([
        [pA, 0.8],
        [pB, 0.3],
      ]))

      // Advance past cooldown
      vi.advanceTimersByTime(3500)

      // Clear events to focus on the next switch
      events = []

      // Now pB exceeds pA by more than activityThreshold (0.15)
      feedAudioAndTriggerEvaluation(roomCode, new Map([
        [pA, 0.3],
        [pB, 0.8],
      ]))

      const switchEvts = getSwitchEvents()
      expect(switchEvts.length).toBeGreaterThanOrEqual(1)

      const secondSwitch = switchEvts[0]
      expect(secondSwitch.previousId).toBe(pA)
      expect(secondSwitch.newId).toBe(pB)
      expect(secondSwitch.reason).toBe('automatic')
    })
  })

  describe('initial selection — no cooldown/threshold (Req 7.7)', () => {
    it('picks highest score immediately without cooldown when no active player is set', () => {
      const { roomCode, participantIds } = createRoomWithPlayers(3)
      const [pA, pB, pC] = participantIds

      // Even with low scores, initial selection should pick the highest
      feedAudioAndTriggerEvaluation(roomCode, new Map([
        [pA, 0.02],
        [pB, 0.04],
        [pC, 0.01],
      ]))

      const switchEvts = getSwitchEvents()
      expect(switchEvts.length).toBeGreaterThanOrEqual(1)
      expect(switchEvts[0].newId).toBe(pB)
      expect(switchEvts[0].previousId).toBeNull()
      expect(switchEvts[0].reason).toBe('automatic')
    })
  })

  describe('silence detection — remain on current (Req 7.4)', () => {
    it('does not emit switch event when all scores are below silence threshold', () => {
      const { roomCode, participantIds } = createRoomWithPlayers(2)
      const [pA, pB] = participantIds

      // Initial selection — pA wins
      feedAudioAndTriggerEvaluation(roomCode, new Map([
        [pA, 0.5],
        [pB, 0.3],
      ]))

      // Advance past cooldown
      vi.advanceTimersByTime(3500)

      // Clear events
      events = []

      // All scores below silence threshold (0.05)
      feedAudioAndTriggerEvaluation(roomCode, new Map([
        [pA, 0.02],
        [pB, 0.03],
      ]))

      const switchEvts = getSwitchEvents()
      expect(switchEvts).toHaveLength(0)

      // Active player should remain unchanged
      const room = manager.getRoom(roomCode)
      expect(room!.switcher.activeCameraId).toBe(pA)
    })
  })

  describe('active player disconnect — immediate fallback (Req 7.6)', () => {
    it('emits switch event with reason=fallback when active player disconnects', () => {
      const { roomCode, participantIds } = createRoomWithPlayers(3)
      const [pA, pB, pC] = participantIds

      // Initial selection — pA wins
      feedAudioAndTriggerEvaluation(roomCode, new Map([
        [pA, 0.8],
        [pB, 0.5],
        [pC, 0.3],
      ]))

      // Verify pA is active
      const room = manager.getRoom(roomCode)
      expect(room!.switcher.activeCameraId).toBe(pA)

      // Clear events
      events = []

      // Active player disconnects (leaveRoom triggers handleDisconnect)
      manager.leaveRoom(roomCode, pA)

      const switchEvts = getSwitchEvents()
      expect(switchEvts.length).toBeGreaterThanOrEqual(1)

      const fallbackSwitch = switchEvts[0]
      expect(fallbackSwitch.previousId).toBe(pA)
      expect(fallbackSwitch.reason).toBe('fallback')
      // Should pick highest-scoring remaining player
      expect([pB, pC]).toContain(fallbackSwitch.newId)
    })

    it('bypasses cooldown when active player disconnects', () => {
      const { roomCode, participantIds } = createRoomWithPlayers(2)
      const [pA, pB] = participantIds

      // Initial selection — pA wins
      feedAudioAndTriggerEvaluation(roomCode, new Map([
        [pA, 0.8],
        [pB, 0.5],
      ]))

      // Do NOT advance past cooldown — disconnect immediately
      events = []

      // Active player disconnects within cooldown period
      manager.leaveRoom(roomCode, pA)

      const switchEvts = getSwitchEvents()
      expect(switchEvts.length).toBeGreaterThanOrEqual(1)
      expect(switchEvts[0].previousId).toBe(pA)
      expect(switchEvts[0].newId).toBe(pB)
      expect(switchEvts[0].reason).toBe('fallback')
    })

    it('selects highest-scoring connected player on disconnect', () => {
      const { roomCode, participantIds } = createRoomWithPlayers(3)
      const [pA, pB, pC] = participantIds

      // Feed audio so pB has higher score than pC
      feedAudioAndTriggerEvaluation(roomCode, new Map([
        [pA, 0.9],
        [pB, 0.7],
        [pC, 0.2],
      ]))

      expect(manager.getRoom(roomCode)!.switcher.activeCameraId).toBe(pA)

      events = []

      // Active player disconnects
      manager.leaveRoom(roomCode, pA)

      const switchEvts = getSwitchEvents()
      expect(switchEvts.length).toBeGreaterThanOrEqual(1)
      // pB had higher score, so should be selected
      expect(switchEvts[0].newId).toBe(pB)
    })
  })

  describe('manual selection (Req 7.5)', () => {
    it('emits switch event with reason=manual on manual select', () => {
      const { roomCode, participantIds } = createRoomWithPlayers(2)
      const [pA, pB] = participantIds

      // Initial selection — pA wins
      feedAudioAndTriggerEvaluation(roomCode, new Map([
        [pA, 0.8],
        [pB, 0.3],
      ]))

      expect(manager.getRoom(roomCode)!.switcher.activeCameraId).toBe(pA)

      // Clear events
      events = []

      // Manual select pB
      const result = manager.manualSelect(roomCode, pB)
      expect(result.ok).toBe(true)

      const switchEvts = getSwitchEvents()
      expect(switchEvts).toHaveLength(1)
      expect(switchEvts[0].previousId).toBe(pA)
      expect(switchEvts[0].newId).toBe(pB)
      expect(switchEvts[0].reason).toBe('manual')
      expect(switchEvts[0].timestamp).toBeGreaterThan(0)
    })

    it('suspends automatic switching after manual select', () => {
      const { roomCode, participantIds } = createRoomWithPlayers(2)
      const [pA, pB] = participantIds

      // Initial selection — pA wins
      feedAudioAndTriggerEvaluation(roomCode, new Map([
        [pA, 0.8],
        [pB, 0.3],
      ]))

      // Manual select pB
      manager.manualSelect(roomCode, pB)

      // Advance past cooldown
      vi.advanceTimersByTime(3500)

      // Clear events
      events = []

      // Even with pA having much higher score, no automatic switch in manual mode
      feedAudioAndTriggerEvaluation(roomCode, new Map([
        [pA, 0.9],
        [pB, 0.1],
      ]))

      const switchEvts = getSwitchEvents()
      expect(switchEvts).toHaveLength(0)
      expect(manager.getRoom(roomCode)!.switcher.activeCameraId).toBe(pB)
    })
  })

  describe('cooldown enforcement (Req 7.2)', () => {
    it('does not switch within cooldown period', () => {
      const { roomCode, participantIds } = createRoomWithPlayers(2)
      const [pA, pB] = participantIds

      // Initial selection — pA wins
      feedAudioAndTriggerEvaluation(roomCode, new Map([
        [pA, 0.8],
        [pB, 0.3],
      ]))

      expect(manager.getRoom(roomCode)!.switcher.activeCameraId).toBe(pA)

      // Clear events — don't advance past cooldown
      events = []

      // pB now has much higher score but we're within cooldown
      feedAudioAndTriggerEvaluation(roomCode, new Map([
        [pA, 0.2],
        [pB, 0.9],
      ]))

      const switchEvts = getSwitchEvents()
      expect(switchEvts).toHaveLength(0)
      expect(manager.getRoom(roomCode)!.switcher.activeCameraId).toBe(pA)
    })
  })
})
