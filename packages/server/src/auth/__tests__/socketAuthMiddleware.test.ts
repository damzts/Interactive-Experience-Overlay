import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { socketAuthMiddleware } from '../socketAuthMiddleware.js'
import { signAccessToken } from '../jwt.js'

describe('socketAuthMiddleware', () => {
  const TEST_SECRET = 'test-jwt-secret-key'
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv, JWT_SECRET: TEST_SECRET }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  function createMockSocket(cookieHeader?: string, auth?: Record<string, unknown>) {
    return {
      handshake: {
        headers: cookieHeader !== undefined ? { cookie: cookieHeader } : {},
        auth: auth ?? {},
      },
      data: {} as Record<string, unknown>,
    } as any
  }

  it('calls next() with no error and attaches userId when access_token cookie is valid', () => {
    const token = signAccessToken('user-abc-123', 'user@example.com')
    const socket = createMockSocket(`access_token=${token}`)
    const next = vi.fn()

    socketAuthMiddleware(socket, next)

    expect(next).toHaveBeenCalledWith()
    expect(socket.data.userId).toBe('user-abc-123')
  })

  it('rejects connection with authentication_error when cookie header is missing', () => {
    const socket = createMockSocket(undefined)
    const next = vi.fn()

    socketAuthMiddleware(socket, next)

    expect(next).toHaveBeenCalledWith(expect.any(Error))
    expect((next.mock.calls[0][0] as Error).message).toBe('authentication_error')
    expect(socket.data.userId).toBeUndefined()
  })

  it('rejects connection with authentication_error when access_token cookie is not present', () => {
    const socket = createMockSocket('other_cookie=somevalue')
    const next = vi.fn()

    socketAuthMiddleware(socket, next)

    expect(next).toHaveBeenCalledWith(expect.any(Error))
    expect((next.mock.calls[0][0] as Error).message).toBe('authentication_error')
  })

  it('rejects connection with authentication_error when access_token is invalid', () => {
    const socket = createMockSocket('access_token=not-a-valid-jwt')
    const next = vi.fn()

    socketAuthMiddleware(socket, next)

    expect(next).toHaveBeenCalledWith(expect.any(Error))
    expect((next.mock.calls[0][0] as Error).message).toBe('authentication_error')
    expect(socket.data.userId).toBeUndefined()
  })

  it('rejects connection with authentication_error when token is signed with wrong secret', () => {
    // Sign with a different secret
    const originalSecret = process.env.JWT_SECRET
    process.env.JWT_SECRET = 'wrong-secret'
    const token = signAccessToken('user-xyz', 'user@example.com')
    process.env.JWT_SECRET = originalSecret

    const socket = createMockSocket(`access_token=${token}`)
    const next = vi.fn()

    socketAuthMiddleware(socket, next)

    expect(next).toHaveBeenCalledWith(expect.any(Error))
    expect((next.mock.calls[0][0] as Error).message).toBe('authentication_error')
  })

  it('extracts access_token correctly when multiple cookies are present', () => {
    const token = signAccessToken('user-multi', 'multi@example.com')
    const socket = createMockSocket(`csrf_token=abc123; access_token=${token}; other=value`)
    const next = vi.fn()

    socketAuthMiddleware(socket, next)

    expect(next).toHaveBeenCalledWith()
    expect(socket.data.userId).toBe('user-multi')
  })

  it('reads from socket.handshake.auth.token when provided', () => {
    const token = signAccessToken('user-old', 'old@example.com')
    const socket = createMockSocket(undefined, { token })
    const next = vi.fn()

    socketAuthMiddleware(socket, next)

    expect(next).toHaveBeenCalledWith()
    expect(socket.data.userId).toBe('user-old')
  })
})
