import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import jwt from 'jsonwebtoken'
import { authMiddleware, registerAuthMiddleware } from '../authMiddleware.js'
import { signAccessToken } from '../jwt.js'
import Fastify from 'fastify'
import fastifyCookie from '@fastify/cookie'

describe('authMiddleware', () => {
  const TEST_SECRET = 'test-jwt-secret-key'
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv, JWT_SECRET: TEST_SECRET }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('authMiddleware hook function', () => {
    it('attaches userId to request when access_token cookie is valid', async () => {
      const app = Fastify()
      await app.register(fastifyCookie)
      app.addHook('onRequest', authMiddleware)
      app.get('/test', async (request) => {
        return { userId: request.userId }
      })

      const token = signAccessToken('user-123', 'test@example.com')
      const response = await app.inject({
        method: 'GET',
        url: '/test',
        cookies: { access_token: token },
      })

      expect(response.statusCode).toBe(200)
      expect(response.json()).toEqual({ userId: 'user-123' })
    })

    it('returns 401 with unauthorized error when no access_token cookie', async () => {
      const app = Fastify()
      await app.register(fastifyCookie)
      app.addHook('onRequest', authMiddleware)
      app.get('/test', async () => ({ ok: true }))

      const response = await app.inject({
        method: 'GET',
        url: '/test',
      })

      expect(response.statusCode).toBe(401)
      expect(response.json()).toEqual({ error: 'unauthorized' })
    })

    it('authenticates when Authorization header is provided even without cookie', async () => {
      const app = Fastify()
      await app.register(fastifyCookie)
      app.addHook('onRequest', authMiddleware)
      app.get('/test', async (request) => ({ userId: request.userId }))

      const token = signAccessToken('user-123', 'test@example.com')
      const response = await app.inject({
        method: 'GET',
        url: '/test',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(response.statusCode).toBe(200)
      expect(response.json()).toEqual({ userId: 'user-123' })
    })

    it('returns 401 with unauthorized error when access_token cookie is empty', async () => {
      const app = Fastify()
      await app.register(fastifyCookie)
      app.addHook('onRequest', authMiddleware)
      app.get('/test', async () => ({ ok: true }))

      const response = await app.inject({
        method: 'GET',
        url: '/test',
        cookies: { access_token: '' },
      })

      expect(response.statusCode).toBe(401)
      expect(response.json()).toEqual({ error: 'unauthorized' })
    })

    it('returns 401 with token_expired error when token is expired', async () => {
      const app = Fastify()
      await app.register(fastifyCookie)
      app.addHook('onRequest', authMiddleware)
      app.get('/test', async () => ({ ok: true }))

      // Create an already-expired token
      const expiredToken = jwt.sign(
        { sub: 'user-123', email: 'test@example.com' },
        TEST_SECRET,
        { expiresIn: '0s' },
      )

      const response = await app.inject({
        method: 'GET',
        url: '/test',
        cookies: { access_token: expiredToken },
      })

      expect(response.statusCode).toBe(401)
      expect(response.json()).toEqual({ error: 'token_expired' })
    })

    it('returns 401 with unauthorized error when token is signed with wrong secret', async () => {
      const app = Fastify()
      await app.register(fastifyCookie)
      app.addHook('onRequest', authMiddleware)
      app.get('/test', async () => ({ ok: true }))

      const badToken = jwt.sign(
        { sub: 'user-123', email: 'test@example.com' },
        'wrong-secret',
        { expiresIn: '1h' },
      )

      const response = await app.inject({
        method: 'GET',
        url: '/test',
        cookies: { access_token: badToken },
      })

      expect(response.statusCode).toBe(401)
      expect(response.json()).toEqual({ error: 'unauthorized' })
    })

    it('returns 401 with unauthorized error when token is malformed', async () => {
      const app = Fastify()
      await app.register(fastifyCookie)
      app.addHook('onRequest', authMiddleware)
      app.get('/test', async () => ({ ok: true }))

      const response = await app.inject({
        method: 'GET',
        url: '/test',
        cookies: { access_token: 'not.a.valid.token' },
      })

      expect(response.statusCode).toBe(401)
      expect(response.json()).toEqual({ error: 'unauthorized' })
    })
  })

  describe('registerAuthMiddleware', () => {
    it('protects /api/config routes', async () => {
      const app = Fastify()
      await app.register(fastifyCookie)
      registerAuthMiddleware(app)
      app.get('/api/config', async () => ({ ok: true }))

      const response = await app.inject({
        method: 'GET',
        url: '/api/config',
      })

      expect(response.statusCode).toBe(401)
    })

    it('protects /api/assets routes', async () => {
      const app = Fastify()
      await app.register(fastifyCookie)
      registerAuthMiddleware(app)
      app.get('/api/assets/list', async () => ({ ok: true }))

      const response = await app.inject({
        method: 'GET',
        url: '/api/assets/list',
      })

      expect(response.statusCode).toBe(401)
    })

    it('protects /api/upload routes', async () => {
      const app = Fastify()
      await app.register(fastifyCookie)
      registerAuthMiddleware(app)
      app.post('/api/upload/asset', async () => ({ ok: true }))

      const response = await app.inject({
        method: 'POST',
        url: '/api/upload/asset',
      })

      expect(response.statusCode).toBe(401)
    })

    it('protects /api/archive routes', async () => {
      const app = Fastify()
      await app.register(fastifyCookie)
      registerAuthMiddleware(app)
      app.get('/api/archive', async () => ({ ok: true }))

      const response = await app.inject({
        method: 'GET',
        url: '/api/archive',
      })

      expect(response.statusCode).toBe(401)
    })

    it('protects /api/pov routes', async () => {
      const app = Fastify()
      await app.register(fastifyCookie)
      registerAuthMiddleware(app)
      app.get('/api/pov/config', async () => ({ ok: true }))

      const response = await app.inject({
        method: 'GET',
        url: '/api/pov/config',
      })

      expect(response.statusCode).toBe(401)
    })

    it('protects /api/online routes', async () => {
      const app = Fastify()
      await app.register(fastifyCookie)
      registerAuthMiddleware(app)
      app.get('/api/online/config', async () => ({ ok: true }))

      const response = await app.inject({
        method: 'GET',
        url: '/api/online/config',
      })

      expect(response.statusCode).toBe(401)
    })

    it('allows unauthenticated access to online room-joining endpoint', async () => {
      const app = Fastify()
      await app.register(fastifyCookie)
      registerAuthMiddleware(app)
      app.post('/api/online/rooms/abc123/join', async () => ({ ok: true }))

      const response = await app.inject({
        method: 'POST',
        url: '/api/online/rooms/abc123/join',
      })

      expect(response.statusCode).toBe(200)
      expect(response.json()).toEqual({ ok: true })
    })

    it('does not protect non-API routes', async () => {
      const app = Fastify()
      await app.register(fastifyCookie)
      registerAuthMiddleware(app)
      app.get('/auth/google', async () => ({ ok: true }))
      app.get('/u/some-slug/overlay', async () => ({ ok: true }))

      const authResponse = await app.inject({
        method: 'GET',
        url: '/auth/google',
      })
      expect(authResponse.statusCode).toBe(200)

      const overlayResponse = await app.inject({
        method: 'GET',
        url: '/u/some-slug/overlay',
      })
      expect(overlayResponse.statusCode).toBe(200)
    })

    it('allows access to protected routes with valid access_token cookie', async () => {
      const app = Fastify()
      await app.register(fastifyCookie)
      registerAuthMiddleware(app)
      app.get('/api/config', async (request) => ({ userId: request.userId }))

      const token = signAccessToken('user-456', 'admin@example.com')
      const response = await app.inject({
        method: 'GET',
        url: '/api/config',
        cookies: { access_token: token },
      })

      expect(response.statusCode).toBe(200)
      expect(response.json()).toEqual({ userId: 'user-456' })
    })
  })
})
