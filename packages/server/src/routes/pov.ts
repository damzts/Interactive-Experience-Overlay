import type { FastifyInstance, FastifyPluginOptions } from 'fastify'
import type { Server as SocketIOServer } from 'socket.io'
import type { POVSwitchingConfig } from '@ieom/shared'
import type { POVOrchestrator } from '../pov/index.js'
import type { PovFeedsRepository } from '../db/repositories/povFeedsRepo.js'
import type { ConfigService } from '../services/ConfigService.js'

// ── Route Options ────────────────────────────────────────────────

interface PovRouteOptions extends FastifyPluginOptions {
  orchestrator: POVOrchestrator
  povFeedsRepo: PovFeedsRepository
  io: SocketIOServer
  configService: ConfigService
}

// ── Request Body Types ───────────────────────────────────────────

interface RegisterFeedBody {
  label: string
  obsAddress: string
  obsPassword?: string
  sceneName: string
}

interface UpdateFeedBody {
  label?: string
  sceneName?: string
  obsAddress?: string
  obsPassword?: string
}

interface UpdateConfigBody extends Partial<POVSwitchingConfig> {}

// ── Route Plugin ─────────────────────────────────────────────────

export async function povRoute(app: FastifyInstance, opts: PovRouteOptions) {
  const { orchestrator, povFeedsRepo, io, configService } = opts

  // ── GET /api/config/pov — return current POV switching configuration ──

  app.get('/api/config/pov', async (req, _reply) => {
    const userId = req.userId
    const config = await configService.getForUser(userId)
    return config.povConfig ?? orchestrator.getConfig()
  })

  // ── PATCH /api/config/pov — validate, persist, and apply updated config ──

  app.patch<{ Body: UpdateConfigBody }>('/api/config/pov', async (req, reply) => {
    try {
      const userId = req.userId
      const updated = await orchestrator.updateConfig(req.body, userId)
      // Persist via configService for the user
      const config = await configService.getForUser(userId)
      await configService.persistForUser(userId, { ...config, povConfig: updated }, { povConfig: updated })
      return { ok: true, config: updated }
    } catch (e) {
      return reply.code(400).send({ ok: false, error: String(e) })
    }
  })

  // ── GET /api/pov/feeds — list all registered camera feeds with current status ──

  app.get('/api/pov/feeds', async (req, _reply) => {
    const _userId = req.userId
    const feeds = orchestrator.registry.getAllFeeds()
    return feeds.map((feed) => ({
      id: feed.id,
      label: feed.label,
      obsAddress: feed.obsAddress,
      sceneName: feed.sceneName,
      connectionStatus: feed.connectionStatus,
      activityScore: feed.activityScore,
      registeredAt: feed.registeredAt,
      connectedAt: feed.connectedAt,
    }))
  })

  // ── POST /api/pov/feeds — register a new camera feed ──

  app.post<{ Body: RegisterFeedBody }>('/api/pov/feeds', async (req, reply) => {
    const userId = req.userId
    const { label, obsAddress, obsPassword, sceneName } = req.body

    // Validate label
    if (!label || typeof label !== 'string') {
      return reply.code(400).send({ ok: false, error: 'label is required' })
    }
    if (label.length > 32) {
      return reply.code(400).send({ ok: false, error: 'label must be 32 characters or fewer' })
    }
    if (!obsAddress || typeof obsAddress !== 'string') {
      return reply.code(400).send({ ok: false, error: 'obsAddress is required' })
    }
    if (!sceneName || typeof sceneName !== 'string') {
      return reply.code(400).send({ ok: false, error: 'sceneName is required' })
    }

    // Register in the in-memory registry
    const result = orchestrator.registry.register({
      label,
      obsAddress,
      obsPassword: obsPassword ?? '',
      sceneName,
    })

    // Check for registration errors
    if ('error' in result) {
      const statusCode = result.error === 'capacity_reached' ? 409 : 400
      return reply.code(statusCode).send({ ok: false, error: result.error })
    }

    // Persist to database with userId scoping
    try {
      await povFeedsRepo.insertFeed(userId, {
        id: result.id,
        label: result.label,
        obsAddress: result.obsAddress,
        obsPassword: result.obsPassword,
        sceneName: result.sceneName,
        registeredAt: result.registeredAt,
      })
    } catch (e) {
      // Rollback in-memory registration on DB failure
      orchestrator.registry.unregister(result.id)
      return reply.code(500).send({ ok: false, error: 'Failed to persist feed registration' })
    }

    // Initiate connection to the OBS instance
    void orchestrator.connectionManager.connect(result).catch((err) => {
      const message = err instanceof Error ? err.message : String(err)
      console.warn(`[pov] Failed to initiate connection for feed "${label}": ${message}`)
    })

    // Broadcast updated feed status to the user's room
    io.to(`user:${userId}`).emit('pov:feed:status', {
      feedId: result.id,
      connectionStatus: result.connectionStatus,
      label: result.label,
    })

    return reply.code(201).send({
      ok: true,
      feed: {
        id: result.id,
        label: result.label,
        obsAddress: result.obsAddress,
        sceneName: result.sceneName,
        connectionStatus: result.connectionStatus,
        activityScore: result.activityScore,
        registeredAt: result.registeredAt,
      },
    })
  })

  // ── DELETE /api/pov/feeds/:id — unregister and disconnect a camera feed ──

  app.delete<{ Params: { id: string } }>('/api/pov/feeds/:id', async (req, reply) => {
    const userId = req.userId
    const { id } = req.params

    // Check if feed exists
    const feed = orchestrator.registry.getActiveFeed(id)
    if (!feed) {
      return reply.code(404).send({ ok: false, error: 'Feed not found' })
    }

    // Disconnect the OBS connection
    orchestrator.connectionManager.disconnect(id)

    // Remove from in-memory registry
    orchestrator.registry.unregister(id)

    // Remove from database with userId scoping
    try {
      await povFeedsRepo.deleteFeed(userId, id)
    } catch (e) {
      console.warn(`[pov] Failed to delete feed from database: ${String(e)}`)
    }

    // Broadcast feed removal to the user's room
    io.to(`user:${userId}`).emit('pov:feed:status', {
      feedId: id,
      connectionStatus: 'disconnected',
      label: feed.label,
    })

    return { ok: true }
  })

  // ── PATCH /api/pov/feeds/:id — update feed metadata (label, scene mapping) ──

  app.patch<{ Params: { id: string }; Body: UpdateFeedBody }>('/api/pov/feeds/:id', async (req, reply) => {
    const userId = req.userId
    const { id } = req.params
    const { label, sceneName, obsAddress, obsPassword } = req.body

    // Check if feed exists
    const feed = orchestrator.registry.getActiveFeed(id)
    if (!feed) {
      return reply.code(404).send({ ok: false, error: 'Feed not found' })
    }

    // Validate label if provided
    if (label !== undefined) {
      if (typeof label !== 'string' || label.length === 0) {
        return reply.code(400).send({ ok: false, error: 'label must be a non-empty string' })
      }
      if (label.length > 32) {
        return reply.code(400).send({ ok: false, error: 'label must be 32 characters or fewer' })
      }
    }

    // Update in-memory feed
    if (label !== undefined) feed.label = label
    if (sceneName !== undefined) feed.sceneName = sceneName
    if (obsAddress !== undefined) feed.obsAddress = obsAddress
    if (obsPassword !== undefined) feed.obsPassword = obsPassword

    // Persist updates to database with userId scoping
    try {
      const dbUpdate: Record<string, string | undefined> = {}
      if (label !== undefined) dbUpdate.label = label
      if (sceneName !== undefined) dbUpdate.sceneName = sceneName
      if (obsAddress !== undefined) dbUpdate.obsAddress = obsAddress
      if (obsPassword !== undefined) dbUpdate.obsPassword = obsPassword

      await povFeedsRepo.updateFeed(userId, id, dbUpdate)
    } catch (e) {
      return reply.code(500).send({ ok: false, error: 'Failed to persist feed update' })
    }

    // Broadcast updated feed status to the user's room
    io.to(`user:${userId}`).emit('pov:feed:status', {
      feedId: id,
      connectionStatus: feed.connectionStatus,
      label: feed.label,
    })

    return {
      ok: true,
      feed: {
        id: feed.id,
        label: feed.label,
        obsAddress: feed.obsAddress,
        sceneName: feed.sceneName,
        connectionStatus: feed.connectionStatus,
        activityScore: feed.activityScore,
        registeredAt: feed.registeredAt,
      },
    }
  })
}
