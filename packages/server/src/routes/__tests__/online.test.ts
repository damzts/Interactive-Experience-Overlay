import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Fastify from 'fastify'
import type { FastifyInstance } from 'fastify'
import { onlineRoute } from '../online.js'
import { OnlineSessionManager } from '../../online/session-manager.js'

function createMockOnlineConfigRepo() {
  return {
    getOnlineConfig: vi.fn().mockResolvedValue({
      audioReportIntervalMs: 100,
      rollingWindowMs: 2000,
      cooldownMs: 3000,
      activityThreshold: 0.15,
      silenceThreshold: 0.05,
      maxPlayersPerRoom: 10,
      maxActiveRooms: 5,
      scoreEmitIntervalMs: 500,
      idleTimeoutMs: 60000,
      transition: { type: 'cut', durationMs: 0 },
    }),
    upsertOnlineConfig: vi.fn(),
  }
}

function createMockIO() {
  return {
    emit: vi.fn(),
    of: vi.fn().mockReturnValue({ sockets: new Map(), emit: vi.fn() }),
  } as any
}

/**
 * Creates a Fastify app with the online route registered and an optional
 * userId injected via onRequest hook (simulating auth middleware).
 */
async function createApp(
  sessionManager: OnlineSessionManager,
  userId?: string,
): Promise<FastifyInstance> {
  const app = Fastify()
  const mockOnlineConfigRepo = createMockOnlineConfigRepo()
  const mockIO = createMockIO()

  if (userId) {
    app.addHook('onRequest', async (request) => {
      ;(request as any).userId = userId
    })
  }

  await app.register(onlineRoute, {
    onlineConfigRepo: mockOnlineConfigRepo as any,
    sessionManager,
    io: mockIO,
  })
  await app.ready()
  return app
}

describe('Online Routes - Multi-Tenant Room Ownership', () => {
  let sessionManager: OnlineSessionManager

  beforeEach(() => {
    sessionManager = new OnlineSessionManager({
      maxActiveRooms: 5,
      maxPlayersPerRoom: 10,
      idleTimeoutMs: 60000,
    })
  })

  afterEach(() => {
    // Close all rooms to clean up timers
    for (const room of sessionManager.getActiveRooms()) {
      sessionManager.closeRoom(room.roomCode)
    }
    vi.restoreAllMocks()
  })

  describe('POST /api/online/rooms (room creation)', () => {
    it('returns 401 when no userId is present on request', async () => {
      const app = await createApp(sessionManager)

      const response = await app.inject({
        method: 'POST',
        url: '/api/online/rooms',
      })

      expect(response.statusCode).toBe(401)
      expect(response.json()).toEqual({ error: 'unauthorized' })
      await app.close()
    })

    it('creates a room and associates it with the authenticated user', async () => {
      const app = await createApp(sessionManager, 'user-123')

      const response = await app.inject({
        method: 'POST',
        url: '/api/online/rooms',
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.ok).toBe(true)
      expect(body.roomCode).toMatch(/^[A-Z0-9]{6}$/)
      expect(body.joinUrl).toBe(`/online/room/${body.roomCode}`)

      // Verify the room has the userId set
      const room = sessionManager.getRoom(body.roomCode)
      expect(room).toBeDefined()
      expect(room!.userId).toBe('user-123')

      await app.close()
    })

    it('returns error when room limit is reached', async () => {
      const app = await createApp(sessionManager, 'user-456')

      // Fill up all room slots
      for (let i = 0; i < 5; i++) {
        sessionManager.createRoom('user-456')
      }

      const response = await app.inject({
        method: 'POST',
        url: '/api/online/rooms',
      })

      expect(response.statusCode).toBe(400)
      const body = response.json()
      expect(body.ok).toBe(false)
      expect(body.error).toBe('room_limit_reached')

      await app.close()
    })
  })

  describe('POST /api/online/rooms/:roomId/join (room joining)', () => {
    it('allows unauthenticated participants to join a room', async () => {
      // Create a room owned by a specific user
      const result = sessionManager.createRoom('owner-user-id')
      if (!('roomCode' in result)) throw new Error('Failed to create room')
      const roomCode = result.roomCode

      // No auth on this app - simulates unauthenticated access
      const app = await createApp(sessionManager)

      const response = await app.inject({
        method: 'POST',
        url: `/api/online/rooms/${roomCode}/join`,
        payload: { displayName: 'Alice' },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.ok).toBe(true)
      expect(body.participantId).toBeDefined()
      expect(body.roomCode).toBe(roomCode)
      expect(body.ownerUserId).toBe('owner-user-id')

      await app.close()
    })

    it('returns the owning userId so data can be scoped', async () => {
      const result = sessionManager.createRoom('scoped-owner')
      if (!('roomCode' in result)) throw new Error('Failed to create room')
      const roomCode = result.roomCode

      const app = await createApp(sessionManager)

      const response = await app.inject({
        method: 'POST',
        url: `/api/online/rooms/${roomCode}/join`,
        payload: { displayName: 'Bob' },
      })

      const body = response.json()
      expect(body.ownerUserId).toBe('scoped-owner')

      await app.close()
    })

    it('returns 404 for non-existent room', async () => {
      const app = await createApp(sessionManager)

      const response = await app.inject({
        method: 'POST',
        url: '/api/online/rooms/ZZZZZZ/join',
        payload: { displayName: 'Charlie' },
      })

      expect(response.statusCode).toBe(404)
      const body = response.json()
      expect(body.ok).toBe(false)
      expect(body.error).toBe('room_not_found')

      await app.close()
    })

    it('returns 400 for empty display name', async () => {
      const result = sessionManager.createRoom('owner-id')
      if (!('roomCode' in result)) throw new Error('Failed to create room')
      const roomCode = result.roomCode

      const app = await createApp(sessionManager)

      const response = await app.inject({
        method: 'POST',
        url: `/api/online/rooms/${roomCode}/join`,
        payload: { displayName: '' },
      })

      expect(response.statusCode).toBe(400)
      const body = response.json()
      expect(body.ok).toBe(false)
      expect(body.error).toBe('invalid_name')

      await app.close()
    })

    it('returns 400 for display name longer than 32 characters', async () => {
      const result = sessionManager.createRoom('owner-id')
      if (!('roomCode' in result)) throw new Error('Failed to create room')
      const roomCode = result.roomCode

      const app = await createApp(sessionManager)

      const response = await app.inject({
        method: 'POST',
        url: `/api/online/rooms/${roomCode}/join`,
        payload: { displayName: 'A'.repeat(33) },
      })

      expect(response.statusCode).toBe(400)
      const body = response.json()
      expect(body.ok).toBe(false)
      expect(body.error).toBe('invalid_name')

      await app.close()
    })

    it('returns 400 when missing displayName', async () => {
      const result = sessionManager.createRoom('owner-id')
      if (!('roomCode' in result)) throw new Error('Failed to create room')
      const roomCode = result.roomCode

      const app = await createApp(sessionManager)

      const response = await app.inject({
        method: 'POST',
        url: `/api/online/rooms/${roomCode}/join`,
        payload: {},
      })

      expect(response.statusCode).toBe(400)
      const body = response.json()
      expect(body.ok).toBe(false)
      expect(body.error).toBe('invalid_name')

      await app.close()
    })

    it('returns 400 when room is full', async () => {
      const smallManager = new OnlineSessionManager({
        maxPlayersPerRoom: 2,
        maxActiveRooms: 5,
        idleTimeoutMs: 60000,
      })
      const result = smallManager.createRoom('owner-id')
      if (!('roomCode' in result)) throw new Error('Failed to create room')
      const roomCode = result.roomCode

      // Fill the room
      smallManager.joinRoom(roomCode, 'Player1', 'socket-1')
      smallManager.joinRoom(roomCode, 'Player2', 'socket-2')

      const app = await createApp(smallManager)

      const response = await app.inject({
        method: 'POST',
        url: `/api/online/rooms/${roomCode}/join`,
        payload: { displayName: 'Player3' },
      })

      expect(response.statusCode).toBe(400)
      const body = response.json()
      expect(body.ok).toBe(false)
      expect(body.error).toBe('room_full')

      smallManager.closeRoom(roomCode)
      await app.close()
    })
  })

  describe('Session Manager - userId on room', () => {
    it('stores userId on room when provided to createRoom', () => {
      const result = sessionManager.createRoom('test-user-id')
      expect('roomCode' in result).toBe(true)
      if ('roomCode' in result) {
        const room = sessionManager.getRoom(result.roomCode)
        expect(room).toBeDefined()
        expect(room!.userId).toBe('test-user-id')
      }
    })

    it('stores null userId when no userId provided', () => {
      const result = sessionManager.createRoom()
      expect('roomCode' in result).toBe(true)
      if ('roomCode' in result) {
        const room = sessionManager.getRoom(result.roomCode)
        expect(room).toBeDefined()
        expect(room!.userId).toBeNull()
      }
    })

    it('participants can join regardless of room ownership', () => {
      const result = sessionManager.createRoom('owner-id')
      if ('roomCode' in result) {
        const joinResult = sessionManager.joinRoom(result.roomCode, 'Guest', 'socket-1')
        expect('participantId' in joinResult).toBe(true)
      }
    })

    it('room data is scoped to the owning user', () => {
      const result = sessionManager.createRoom('owner-user-abc')
      if ('roomCode' in result) {
        const room = sessionManager.getRoom(result.roomCode)
        expect(room!.userId).toBe('owner-user-abc')

        // Participants joining get access to room scoped to owner
        sessionManager.joinRoom(result.roomCode, 'Viewer', 'socket-1')
        const roomAfterJoin = sessionManager.getRoom(result.roomCode)
        expect(roomAfterJoin!.userId).toBe('owner-user-abc')
        expect(roomAfterJoin!.participants.size).toBe(1)
      }
    })
  })
})
