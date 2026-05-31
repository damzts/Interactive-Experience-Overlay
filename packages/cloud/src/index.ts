import Fastify from 'fastify'
import fastifyCors from '@fastify/cors'
import fastifyCookie from '@fastify/cookie'
import fastifyStatic from '@fastify/static'
import { Server as SocketIO } from 'socket.io'
import { existsSync, readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

import { validateEnvOrExit } from './db/envValidation.js'
import { createPool, verifyPoolConnection, registerPoolShutdown } from './db/pool.js'
import { MigrationRunner } from './db/migrationRunner.js'
import { UserRepository } from './db/repositories/UserRepository.js'
import { authRoutes } from './auth/authRoutes.js'
import { registerAuthMiddleware } from './auth/authMiddleware.js'
import { registerCsrfGuard } from './auth/csrfMiddleware.js'
import { RoomManager } from './online/session-manager.js'
import { registerRoomsNamespace } from './socket/onlineHandlers.js'

const PORT = parseInt(process.env.PORT ?? '3100', 10)

// 1. Validate env
validateEnvOrExit()

// 2. PostgreSQL
const pool = createPool()
await verifyPoolConnection(pool)
registerPoolShutdown(pool)

// 3. Migrations
const migrationRunner = new MigrationRunner(pool)
await migrationRunner.run()

// 4. Repositories
const userRepository = new UserRepository(pool)

// 5. Fastify
const app = Fastify({ logger: { level: 'warn' } })
await app.register(fastifyCors, { origin: true, credentials: true })
await app.register(fastifyCookie)

// 6. Auth
registerAuthMiddleware(app)
registerCsrfGuard(app)
await app.register(authRoutes, { userRepository, prefix: '' })

// Health check
app.get('/health', async () => ({ status: 'ok', timestamp: Date.now() }))

// 7. Socket.IO
const io = new SocketIO(app.server, { cors: { origin: '*' } })

// 8. Room manager (signaling relay only)
const roomManager = new RoomManager()
registerRoomsNamespace(io, roomManager)

// 9. REST routes for room management
app.post('/api/rooms', async (req, reply) => {
  const userId = (req as any).userId
  if (!userId) return reply.code(401).send({ error: 'unauthorized' })
  const result = roomManager.createRoom(userId)
  if ('error' in result) return reply.code(400).send({ ok: false, error: result.error })
  return { ok: true, roomId: result.roomId }
})

app.get('/api/rooms', async () => {
  return roomManager.getRooms().map(r => ({
    roomId: r.roomId,
    createdAt: r.createdAt,
    hubConnected: !!r.hubSocketId,
    participantCount: r.participants.size,
  }))
})

app.delete<{ Params: { roomId: string } }>('/api/rooms/:roomId', async (req) => {
  roomManager.closeRoom(req.params.roomId)
  return { ok: true }
})

// 10. Serve cloud-ui static assets (production)
const __dirname = dirname(fileURLToPath(import.meta.url))
const CLOUD_UI_DIST = join(__dirname, '../../cloud-ui/dist')
const IS_DEV = process.env.NODE_ENV !== 'production' && !existsSync(CLOUD_UI_DIST)

if (!IS_DEV && existsSync(CLOUD_UI_DIST)) {
  await app.register(fastifyStatic, { root: CLOUD_UI_DIST, prefix: '/', wildcard: false })
  app.setNotFoundHandler(async (_req, reply) => {
    const indexPath = join(CLOUD_UI_DIST, 'index.html')
    if (existsSync(indexPath)) {
      return reply.type('text/html').send(readFileSync(indexPath))
    }
    return reply.code(404).send({ error: 'not_found' })
  })
}

// 11. Start
await app.listen({ port: PORT, host: '0.0.0.0' })
console.log(`@ieom/cloud listening on :${PORT}`)

export { app, io, pool, userRepository, roomManager }
