import type { FastifyInstance, FastifyPluginOptions } from 'fastify'
import type { Server as SocketIOServer } from 'socket.io'
import type { OnlineModeConfig } from '@ieom/shared'
import type { OnlineConfigRepository } from '../db/repositories/onlineConfigRepo.js'
import type { IOnlineSessionManager } from '../online/session-manager.js'
import type { OnlineOrchestrator } from '../online/index.js'
import { existsSync, readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ── Route Options ────────────────────────────────────────────────

interface OnlineRouteOptions extends FastifyPluginOptions {
  onlineConfigRepo: OnlineConfigRepository
  sessionManager: IOnlineSessionManager
  io: SocketIOServer
  onlineOrchestrator?: OnlineOrchestrator
}

// ── Route Plugin ─────────────────────────────────────────────────

export async function onlineRoute(app: FastifyInstance, opts: OnlineRouteOptions) {
  const { onlineConfigRepo, sessionManager, io, onlineOrchestrator } = opts

  // ── GET /api/config/online — return current online mode configuration ──

  app.get('/api/config/online', async (req, _reply) => {
    const userId = req.userId
    return onlineConfigRepo.getOnlineConfig(userId)
  })

  // ── PATCH /api/config/online — validate, persist, and apply updated config ──

  app.patch<{ Body: Partial<OnlineModeConfig> }>('/api/config/online', async (req, reply) => {
    try {
      const userId = req.userId

      // Persist to database with userId scoping
      const updated = await onlineConfigRepo.upsertOnlineConfig(userId, req.body)

      // Apply updated config to the session manager
      sessionManager.updateConfig({
        audioReportIntervalMs: updated.audioReportIntervalMs,
        rollingWindowMs: updated.rollingWindowMs,
        cooldownMs: updated.cooldownMs,
        activityThreshold: updated.activityThreshold,
        silenceThreshold: updated.silenceThreshold,
        maxPlayersPerRoom: updated.maxPlayersPerRoom,
        maxActiveRooms: updated.maxActiveRooms,
        scoreEmitIntervalMs: updated.scoreEmitIntervalMs,
        idleTimeoutMs: updated.idleTimeoutMs,
      })

      // Emit config update event only to the user's room
      io.to(`user:${userId}`).emit('config:patch', { onlineConfig: updated })

      return { ok: true, config: updated }
    } catch (e) {
      return reply.code(500).send({ ok: false, error: String(e) })
    }
  })

  // ── GET /api/online/rooms — list all active online rooms with status ──

  app.get('/api/online/rooms', async (req, _reply) => {
    const _userId = req.userId
    const rooms = sessionManager.getActiveRooms()
    return rooms.map((room) => {
      const status = sessionManager.getRoomStatus(room.roomCode)
      return status ?? {
        roomCode: room.roomCode,
        createdAt: room.createdAt,
        status: room.status,
        maxPlayers: room.maxPlayers,
        participantCount: room.participants.size,
        participants: [],
        activePlayerId: null,
        mode: 'automatic' as const,
      }
    })
  })

  // ── POST /api/online/rooms — create a new room (requires authentication) ──
  // Requirement 11.2: Room creation requires authentication and associates room with user

  app.post('/api/online/rooms', async (req, reply) => {
    const userId = req.userId
    if (!userId) {
      return reply.code(401).send({ error: 'unauthorized' })
    }

    const result = sessionManager.createRoom(userId)

    if ('error' in result) {
      return reply.code(400).send({ ok: false, error: result.error })
    }

    return { ok: true, roomCode: result.roomCode, joinUrl: result.joinUrl }
  })

  // ── POST /api/online/rooms/:roomId/join — join a room (no auth required) ──
  // Requirement 11.1, 11.3: Unauthenticated participants can join rooms scoped to owning user

  app.post<{ Params: { roomId: string }; Body: { displayName: string } }>(
    '/api/online/rooms/:roomId/join',
    async (req, reply) => {
      const { roomId } = req.params
      const { displayName } = req.body ?? {}

      if (!displayName || typeof displayName !== 'string' || displayName.length === 0 || displayName.length > 32) {
        return reply.code(400).send({ ok: false, error: 'invalid_name' })
      }

      const room = sessionManager.getRoom(roomId)
      if (!room) {
        return reply.code(404).send({ ok: false, error: 'room_not_found' })
      }

      // Room data is scoped to the owning user (Req 11.3)
      const ownerUserId = room.userId

      const result = sessionManager.joinRoom(roomId, displayName, `http-${Date.now()}`)

      if ('error' in result) {
        const statusCode = result.error === 'room_not_found' ? 404 : 400
        return reply.code(statusCode).send({ ok: false, error: result.error })
      }

      return {
        ok: true,
        participantId: result.participantId,
        roomCode: roomId,
        ownerUserId,
      }
    },
  )

  // ── GET /online/overlay/:roomCode — Serve Browser Source Overlay page ──
  // Requirement 8.1: Serve the overlay at /online/overlay/{Room_Code}

  const overlayDistPath = join(__dirname, '../../../overlay/dist')
  const overlayHtmlFile = join(overlayDistPath, 'online-overlay.html')
  const playerHtmlFile = join(overlayDistPath, 'online-player.html')
  const IS_DEV = process.env.npm_lifecycle_event === 'dev'
  const OVERLAY_DEV_UPSTREAM = process.env.IEOM_OVERLAY_DEV_UPSTREAM ?? 'http://localhost:3001'

  // ── GET /online/room/:roomCode — Serve Player Client SPA ──
  // Requirement 3.1: Player navigates to /online/room/{Room_Code}

  app.get<{ Params: { roomCode: string } }>('/online/room/:roomCode', async (req, reply) => {
    if (IS_DEV) {
      // In dev mode, proxy to the Vite dev server
      try {
        const response = await fetch(`${OVERLAY_DEV_UPSTREAM}/online-player.html`)
        if (response.ok) {
          const html = await response.text()
          return reply.code(200).type('text/html').send(html)
        }
      } catch {
        // Fall through to fallback
      }
      // Fallback: serve a minimal HTML that loads from the dev server
      return reply.code(200).type('text/html').send(`<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>IEOM — Join Room</title>
    <style>* { margin: 0; padding: 0; box-sizing: border-box; } html, body, #root { width: 100%; height: 100%; overflow: hidden; background: #111; }</style>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="${OVERLAY_DEV_UPSTREAM}/src/online/player/main.tsx"></script>
  </body>
</html>`)
    }

    // Production: serve the built HTML file
    if (existsSync(playerHtmlFile)) {
      const html = readFileSync(playerHtmlFile, 'utf-8')
      return reply.code(200).type('text/html').send(html)
    }

    // Player client not built yet
    return reply.code(200).type('text/html').send(`<!DOCTYPE html>
<html><body style="background:#111;color:#f00;font-family:monospace;padding:2rem">
  <p>Player client not built yet. Run <code>pnpm build</code> in the overlay package.</p>
</body></html>`)
  })

  app.get<{ Params: { roomCode: string } }>('/online/overlay/:roomCode', async (_req, reply) => {
    if (IS_DEV) {
      // In dev mode, proxy to the Vite dev server
      try {
        const response = await fetch(`${OVERLAY_DEV_UPSTREAM}/online-overlay.html`)
        if (response.ok) {
          const html = await response.text()
          return reply.code(200).type('text/html').send(html)
        }
      } catch {
        // Fall through to fallback
      }
      // Fallback: serve a minimal HTML that loads from the dev server
      return reply.code(200).type('text/html').send(`<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>IEOM Online Overlay</title>
    <style>* { margin: 0; padding: 0; box-sizing: border-box; } html, body, #root { width: 100%; height: 100%; overflow: hidden; background: #000; }</style>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="${OVERLAY_DEV_UPSTREAM}/src/online/overlay/main.tsx"></script>
  </body>
</html>`)
    }

    // Production: serve the built HTML file
    if (existsSync(overlayHtmlFile)) {
      const html = readFileSync(overlayHtmlFile, 'utf-8')
      return reply.code(200).type('text/html').send(html)
    }

    // Overlay not built yet
    return reply.code(200).type('text/html').send(`<!DOCTYPE html>
<html><body style="background:#000;color:#f00;font-family:monospace;padding:2rem">
  <p>Online overlay not built yet. Run <code>pnpm build</code> in the overlay package.</p>
</body></html>`)
  })
}
