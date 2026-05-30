import { describe, it, expect, vi, beforeEach } from 'vitest'
import { registerOverlayNamespace } from '../overlayHandlers.js'

// ── Mock Types ────────────────────────────────────────────────────

interface MockSocket {
  handshake: {
    auth: Record<string, unknown>
    query: Record<string, unknown>
  }
  data: Record<string, unknown>
  join: ReturnType<typeof vi.fn>
  emit: ReturnType<typeof vi.fn>
  disconnect: ReturnType<typeof vi.fn>
}

function createMockSocket(overrides?: {
  auth?: Record<string, unknown>
  query?: Record<string, unknown>
}): MockSocket {
  return {
    handshake: {
      auth: overrides?.auth ?? {},
      query: overrides?.query ?? {},
    },
    data: {},
    join: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn(),
  }
}

function createMockIo() {
  let connectionHandler: ((socket: MockSocket) => void) | null = null

  const nsp = {
    on: vi.fn((event: string, handler: (socket: MockSocket) => void) => {
      if (event === 'connection') {
        connectionHandler = handler
      }
    }),
  }

  const io = {
    of: vi.fn().mockReturnValue(nsp),
  }

  return {
    io,
    nsp,
    simulateConnection(socket: MockSocket) {
      if (!connectionHandler) throw new Error('No connection handler registered')
      connectionHandler(socket)
    },
  }
}

// ── Tests ────────────────────────────────────────────────────────

describe('registerOverlayNamespace', () => {
  let mockIo: ReturnType<typeof createMockIo>

  beforeEach(() => {
    mockIo = createMockIo()
  })

  it('registers the /overlay namespace', () => {
    registerOverlayNamespace(mockIo.io as any)
    expect(mockIo.io.of).toHaveBeenCalledWith('/overlay')
  })

  it('registers a connection handler on the namespace', () => {
    registerOverlayNamespace(mockIo.io as any)
    expect(mockIo.nsp.on).toHaveBeenCalledWith('connection', expect.any(Function))
  })

  describe('connection handling', () => {
    beforeEach(() => {
      registerOverlayNamespace(mockIo.io as any)
    })

    it('joins socket to user-specific room when userId is in auth', () => {
      const socket = createMockSocket({ auth: { userId: 'user-123' } })
      mockIo.simulateConnection(socket)

      expect(socket.data.userId).toBe('user-123')
      expect(socket.join).toHaveBeenCalledWith('user:user-123')
      expect(socket.disconnect).not.toHaveBeenCalled()
    })

    it('joins socket to user-specific room when userId is in query', () => {
      const socket = createMockSocket({ query: { userId: 'user-456' } })
      mockIo.simulateConnection(socket)

      expect(socket.data.userId).toBe('user-456')
      expect(socket.join).toHaveBeenCalledWith('user:user-456')
      expect(socket.disconnect).not.toHaveBeenCalled()
    })

    it('prefers auth.userId over query.userId', () => {
      const socket = createMockSocket({
        auth: { userId: 'auth-user' },
        query: { userId: 'query-user' },
      })
      mockIo.simulateConnection(socket)

      expect(socket.data.userId).toBe('auth-user')
      expect(socket.join).toHaveBeenCalledWith('user:auth-user')
    })

    it('disconnects socket when no userId is provided', () => {
      const socket = createMockSocket()
      mockIo.simulateConnection(socket)

      expect(socket.emit).toHaveBeenCalledWith('error', { message: 'userId is required' })
      expect(socket.disconnect).toHaveBeenCalledWith(true)
      expect(socket.join).not.toHaveBeenCalled()
    })

    it('disconnects socket when userId is empty string', () => {
      const socket = createMockSocket({ auth: { userId: '' } })
      mockIo.simulateConnection(socket)

      expect(socket.disconnect).toHaveBeenCalledWith(true)
      expect(socket.join).not.toHaveBeenCalled()
    })

    it('disconnects socket when userId is whitespace only', () => {
      const socket = createMockSocket({ auth: { userId: '   ' } })
      mockIo.simulateConnection(socket)

      expect(socket.disconnect).toHaveBeenCalledWith(true)
      expect(socket.join).not.toHaveBeenCalled()
    })

    it('trims whitespace from userId', () => {
      const socket = createMockSocket({ auth: { userId: '  user-789  ' } })
      mockIo.simulateConnection(socket)

      expect(socket.data.userId).toBe('user-789')
      expect(socket.join).toHaveBeenCalledWith('user:user-789')
    })

    it('disconnects socket when userId is not a string', () => {
      const socket = createMockSocket({ auth: { userId: 12345 } })
      mockIo.simulateConnection(socket)

      expect(socket.disconnect).toHaveBeenCalledWith(true)
      expect(socket.join).not.toHaveBeenCalled()
    })

    it('falls back to query.userId when auth.userId is missing', () => {
      const socket = createMockSocket({
        auth: {},
        query: { userId: 'fallback-user' },
      })
      mockIo.simulateConnection(socket)

      expect(socket.data.userId).toBe('fallback-user')
      expect(socket.join).toHaveBeenCalledWith('user:fallback-user')
    })

    it('falls back to query.userId when auth.userId is empty', () => {
      const socket = createMockSocket({
        auth: { userId: '' },
        query: { userId: 'fallback-user' },
      })
      mockIo.simulateConnection(socket)

      expect(socket.data.userId).toBe('fallback-user')
      expect(socket.join).toHaveBeenCalledWith('user:fallback-user')
    })

    it('does not apply any auth middleware (allows unauthenticated connections)', () => {
      // The namespace should not have any use() middleware calls
      // This is verified by the fact that connections succeed without tokens
      const socket = createMockSocket({ auth: { userId: 'no-token-user' } })
      mockIo.simulateConnection(socket)

      expect(socket.data.userId).toBe('no-token-user')
      expect(socket.join).toHaveBeenCalledWith('user:no-token-user')
      expect(socket.disconnect).not.toHaveBeenCalled()
    })
  })
})
