import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { OnlineSessionManager } from '../session-manager.js'
import type { OnlineRoomConfig, SessionEvent } from '../session-manager.js'

describe('OnlineSessionManager', () => {
  let manager: OnlineSessionManager
  let events: SessionEvent[]

  beforeEach(() => {
    vi.useFakeTimers()
    manager = new OnlineSessionManager({
      maxActiveRooms: 5,
      maxPlayersPerRoom: 10,
      idleTimeoutMs: 60000,
    })
    events = []
    manager.onEvent((event) => events.push(event))
  })

  afterEach(() => {
    // Close all rooms to clean up timers
    for (const room of manager.getActiveRooms()) {
      manager.closeRoom(room.roomCode)
    }
    vi.useRealTimers()
  })

  describe('createRoom', () => {
    it('creates a room with a valid 6-char uppercase alphanumeric code', () => {
      const result = manager.createRoom()
      expect('roomCode' in result).toBe(true)
      if ('roomCode' in result) {
        expect(result.roomCode).toMatch(/^[A-Z0-9]{6}$/)
        expect(result.joinUrl).toBe(`/online/room/${result.roomCode}`)
      }
    })

    it('emits room:created event', () => {
      const result = manager.createRoom()
      expect(events).toHaveLength(1)
      expect(events[0].type).toBe('room:created')
      if ('roomCode' in result && events[0].type === 'room:created') {
        expect(events[0].roomCode).toBe(result.roomCode)
      }
    })

    it('rejects when max active rooms limit is reached', () => {
      for (let i = 0; i < 5; i++) {
        const r = manager.createRoom()
        expect('roomCode' in r).toBe(true)
      }
      const result = manager.createRoom()
      expect(result).toEqual({ error: 'room_limit_reached' })
    })

    it('generates unique room codes', () => {
      const codes = new Set<string>()
      for (let i = 0; i < 5; i++) {
        const result = manager.createRoom()
        if ('roomCode' in result) {
          codes.add(result.roomCode)
        }
      }
      expect(codes.size).toBe(5)
    })

    it('initializes room with empty participant list', () => {
      const result = manager.createRoom()
      if ('roomCode' in result) {
        const room = manager.getRoom(result.roomCode)
        expect(room).toBeDefined()
        expect(room!.participants.size).toBe(0)
        expect(room!.status).toBe('active')
      }
    })
  })

  describe('closeRoom', () => {
    it('removes room from active rooms', () => {
      const result = manager.createRoom()
      if ('roomCode' in result) {
        manager.closeRoom(result.roomCode)
        expect(manager.getRoom(result.roomCode)).toBeUndefined()
        expect(manager.getActiveRooms()).toHaveLength(0)
      }
    })

    it('emits room:closed event', () => {
      const result = manager.createRoom()
      if ('roomCode' in result) {
        events = []
        manager.closeRoom(result.roomCode)
        expect(events).toHaveLength(1)
        expect(events[0].type).toBe('room:closed')
      }
    })

    it('disconnects all participants', () => {
      const result = manager.createRoom()
      if ('roomCode' in result) {
        manager.joinRoom(result.roomCode, 'Alice', 'socket-1')
        manager.joinRoom(result.roomCode, 'Bob', 'socket-2')
        manager.closeRoom(result.roomCode)
        expect(manager.getRoom(result.roomCode)).toBeUndefined()
      }
    })

    it('does nothing for non-existent room', () => {
      expect(() => manager.closeRoom('ZZZZZZ')).not.toThrow()
    })
  })

  describe('joinRoom', () => {
    it('assigns a UUID participant ID on successful join', () => {
      const room = manager.createRoom()
      if ('roomCode' in room) {
        const result = manager.joinRoom(room.roomCode, 'Alice', 'socket-1')
        expect('participantId' in result).toBe(true)
        if ('participantId' in result) {
          // UUID format check
          expect(result.participantId).toMatch(
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
          )
        }
      }
    })

    it('rejects join with invalid room code', () => {
      const result = manager.joinRoom('BADCOD', 'Alice', 'socket-1')
      expect(result).toEqual({ error: 'room_not_found' })
    })

    it('rejects join when room is full', () => {
      const mgr = new OnlineSessionManager({ maxPlayersPerRoom: 2, maxActiveRooms: 5 })
      const room = mgr.createRoom()
      if ('roomCode' in room) {
        mgr.joinRoom(room.roomCode, 'Alice', 'socket-1')
        mgr.joinRoom(room.roomCode, 'Bob', 'socket-2')
        const result = mgr.joinRoom(room.roomCode, 'Charlie', 'socket-3')
        expect(result).toEqual({ error: 'room_full' })
        mgr.closeRoom(room.roomCode)
      }
    })

    it('rejects join with empty display name', () => {
      const room = manager.createRoom()
      if ('roomCode' in room) {
        const result = manager.joinRoom(room.roomCode, '', 'socket-1')
        expect(result).toEqual({ error: 'invalid_name' })
      }
    })

    it('rejects join with display name longer than 32 characters', () => {
      const room = manager.createRoom()
      if ('roomCode' in room) {
        const longName = 'A'.repeat(33)
        const result = manager.joinRoom(room.roomCode, longName, 'socket-1')
        expect(result).toEqual({ error: 'invalid_name' })
      }
    })

    it('emits participant:joined event', () => {
      const room = manager.createRoom()
      if ('roomCode' in room) {
        events = []
        manager.joinRoom(room.roomCode, 'Alice', 'socket-1')
        const joinEvent = events.find((e) => e.type === 'participant:joined')
        expect(joinEvent).toBeDefined()
        if (joinEvent && joinEvent.type === 'participant:joined') {
          expect(joinEvent.participant.displayName).toBe('Alice')
          expect(joinEvent.participant.connectionStatus).toBe('connected')
        }
      }
    })

    it('cancels idle timer when player joins idle room', () => {
      const room = manager.createRoom()
      if ('roomCode' in room) {
        const joinResult = manager.joinRoom(room.roomCode, 'Alice', 'socket-1')
        if ('participantId' in joinResult) {
          manager.leaveRoom(room.roomCode, joinResult.participantId)
          // Room should have idle timer started
          // Join again before timeout
          manager.joinRoom(room.roomCode, 'Bob', 'socket-2')
          // Advance past idle timeout
          vi.advanceTimersByTime(70000)
          // Room should still be active
          const roomState = manager.getRoom(room.roomCode)
          expect(roomState).toBeDefined()
          expect(roomState!.status).toBe('active')
        }
      }
    })
  })

  describe('leaveRoom', () => {
    it('removes participant from room', () => {
      const room = manager.createRoom()
      if ('roomCode' in room) {
        const join = manager.joinRoom(room.roomCode, 'Alice', 'socket-1')
        if ('participantId' in join) {
          manager.leaveRoom(room.roomCode, join.participantId)
          const roomState = manager.getRoom(room.roomCode)
          expect(roomState!.participants.size).toBe(0)
        }
      }
    })

    it('emits participant:left event', () => {
      const room = manager.createRoom()
      if ('roomCode' in room) {
        const join = manager.joinRoom(room.roomCode, 'Alice', 'socket-1')
        if ('participantId' in join) {
          events = []
          manager.leaveRoom(room.roomCode, join.participantId)
          const leftEvent = events.find((e) => e.type === 'participant:left')
          expect(leftEvent).toBeDefined()
        }
      }
    })

    it('starts idle timer when last player leaves', () => {
      const room = manager.createRoom()
      if ('roomCode' in room) {
        const join = manager.joinRoom(room.roomCode, 'Alice', 'socket-1')
        if ('participantId' in join) {
          events = []
          manager.leaveRoom(room.roomCode, join.participantId)
          // Advance time past idle timeout
          vi.advanceTimersByTime(60000)
          const idleEvent = events.find((e) => e.type === 'room:idle')
          expect(idleEvent).toBeDefined()
          const roomState = manager.getRoom(room.roomCode)
          expect(roomState!.status).toBe('idle')
        }
      }
    })

    it('does nothing for non-existent room or participant', () => {
      expect(() => manager.leaveRoom('ZZZZZZ', 'fake-id')).not.toThrow()
    })
  })

  describe('handleAudioReport', () => {
    it('feeds audio level into room score processor', () => {
      const room = manager.createRoom()
      if ('roomCode' in room) {
        const join = manager.joinRoom(room.roomCode, 'Alice', 'socket-1')
        if ('participantId' in join) {
          // Should not throw
          expect(() =>
            manager.handleAudioReport(room.roomCode, join.participantId, 0.5),
          ).not.toThrow()
        }
      }
    })

    it('does nothing for non-existent room', () => {
      expect(() => manager.handleAudioReport('ZZZZZZ', 'fake-id', 0.5)).not.toThrow()
    })

    it('does nothing for non-existent participant', () => {
      const room = manager.createRoom()
      if ('roomCode' in room) {
        expect(() =>
          manager.handleAudioReport(room.roomCode, 'fake-id', 0.5),
        ).not.toThrow()
      }
    })
  })

  describe('manualSelect', () => {
    it('delegates to room POVSwitcher and sets manual mode', () => {
      const room = manager.createRoom()
      if ('roomCode' in room) {
        const join = manager.joinRoom(room.roomCode, 'Alice', 'socket-1')
        if ('participantId' in join) {
          const result = manager.manualSelect(room.roomCode, join.participantId)
          expect(result.ok).toBe(true)
          const roomState = manager.getRoom(room.roomCode)
          expect(roomState!.switcher.mode).toBe('manual')
        }
      }
    })

    it('returns error for non-existent room', () => {
      const result = manager.manualSelect('ZZZZZZ', 'fake-id')
      expect(result).toEqual({ ok: false, error: 'room_not_found' })
    })

    it('returns error for non-existent participant', () => {
      const room = manager.createRoom()
      if ('roomCode' in room) {
        const result = manager.manualSelect(room.roomCode, 'fake-id')
        expect(result.ok).toBe(false)
      }
    })
  })

  describe('setMode', () => {
    it('sets mode on room POVSwitcher', () => {
      const room = manager.createRoom()
      if ('roomCode' in room) {
        manager.setMode(room.roomCode, 'manual')
        const roomState = manager.getRoom(room.roomCode)
        expect(roomState!.switcher.mode).toBe('manual')
      }
    })

    it('does nothing for non-existent room', () => {
      expect(() => manager.setMode('ZZZZZZ', 'manual')).not.toThrow()
    })
  })

  describe('updateConfig', () => {
    it('applies new config to all active rooms', () => {
      const room = manager.createRoom()
      if ('roomCode' in room) {
        manager.updateConfig({ cooldownMs: 5000, activityThreshold: 0.3 })
        const roomState = manager.getRoom(room.roomCode)
        const switcherConfig = roomState!.switcher.getConfig()
        expect(switcherConfig.cooldownMs).toBe(5000)
        expect(switcherConfig.activityThreshold).toBe(0.3)
      }
    })

    it('updates maxPlayersPerRoom for existing rooms', () => {
      const room = manager.createRoom()
      if ('roomCode' in room) {
        manager.updateConfig({ maxPlayersPerRoom: 3 })
        const roomState = manager.getRoom(room.roomCode)
        expect(roomState!.maxPlayers).toBe(3)
      }
    })
  })

  describe('getRoomStatus', () => {
    it('returns undefined for non-existent room', () => {
      expect(manager.getRoomStatus('ZZZZZZ')).toBeUndefined()
    })

    it('returns correct status for active room', () => {
      const room = manager.createRoom()
      if ('roomCode' in room) {
        manager.joinRoom(room.roomCode, 'Alice', 'socket-1')
        const status = manager.getRoomStatus(room.roomCode)
        expect(status).toBeDefined()
        expect(status!.roomCode).toBe(room.roomCode)
        expect(status!.status).toBe('active')
        expect(status!.participantCount).toBe(1)
        expect(status!.participants).toHaveLength(1)
        expect(status!.participants[0].displayName).toBe('Alice')
      }
    })
  })

  describe('event callbacks', () => {
    it('supports removing event callbacks', () => {
      const room = manager.createRoom()
      const cb = vi.fn()
      manager.onEvent(cb)
      manager.offEvent(cb)
      if ('roomCode' in room) {
        manager.closeRoom(room.roomCode)
      }
      // The original callback still fires (registered in beforeEach)
      // but the new one should not
      expect(cb).not.toHaveBeenCalled()
    })
  })
})
