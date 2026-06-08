/**
 * Desktop mode entry point for @ieom/server.
 *
 * Thin bootstrap: creates the Kernel, registers managers, wires transport
 * (Fastify + Socket.IO), then delegates lifecycle to kernel.boot/shutdown.
 *
 * Requirements: 2.1, 2.2, 2.3, 2.5, 4.1, 4.2, 4.3, 4.5, 4.6
 */

import Fastify from 'fastify'
import type { FastifyInstance } from 'fastify'
import fastifyCors from '@fastify/cors'
import fastifyCookie from '@fastify/cookie'
import fastifyStatic from '@fastify/static'
import fastifyMultipart from '@fastify/multipart'
import { Server as SocketIOServer } from 'socket.io'
import { existsSync, mkdirSync, createWriteStream, readFileSync } from 'fs'
import { join } from 'path'
import { pipeline } from 'stream/promises'
import logger from './lib/logger.js'

import { DEFAULT_CONFIG, withDesktopAmbianceDefaults } from '@ieomlabs/shared'
import type { AppConfig } from '@ieomlabs/shared'

import { AdminRelay } from './transport/webrtc/admin-relay.js'
import { Kernel } from './kernel/index.js'
import { SceneMachine } from './kernel/managers/scene.js'
import { RuntimeStateStore } from './kernel/managers/runtime.js'
import { setupSocketHandlers } from './transport/socket/handlers.js'
import { ObsBridge } from './kernel/managers/obs.js'
import { EventScheduler } from './kernel/managers/scheduler.js'
import { AmbianceManager } from './kernel/managers/ambiance.js'
import { registerOverlayNamespace } from './transport/socket/overlayHandlers.js'
import { clearMediaCaches } from './services/MediaService.js'
import { configRoute } from './transport/http/config.js'
import { mediaRoute } from './transport/http/media.js'
import { archiveRoute } from './transport/http/archive.js'
import { roomRoute } from './transport/http/room.js'
import { initDesktopDatabase, closeDesktopDatabase } from './db/desktop-db.js'
import { DesktopConfigService } from './kernel/managers/config.js'
import { UserRepository } from './db/repositories/UserRepository.js'
import { authRoutes } from './auth/authRoutes.js'
import { registerAuthMiddleware } from './auth/authMiddleware.js'
import { HubConnection } from './transport/webrtc/hub-connection.js'
import { POVOrchestrator } from './kernel/managers/pov.js'
import { OverlayRelay } from './transport/webrtc/overlay-relay.js'
import { CloudSignaling } from './transport/webrtc/cloud-signaling.js'
import { OnlineRoomManager } from './online/manager.js'
import { onlineRoute } from './online/routes.js'
import { registerOnlineNamespace } from './online/namespace.js'
import { registerJoinNamespace } from './transport/socket/joinNamespace.js'

// ── Types ────────────────────────────────────────────────────────

export interface DesktopServerOptions {
  /** Path to SQLite database file */
  dbPath: string
  /** Port to bind to (default: 3000) */
  port?: number
  /** Path to the assets directory */
  assetsDir: string
  /** Path to the overlay dist directory */
  overlayDir: string
  /** Path to the admin dist directory */
  adminDir: string
  /**
   * Overlay admin token for authenticating admin HTTP + Socket.IO connections.
   * If set, protects /api/config, /api/online, /api/pov, etc.
   * If not set, falls back to permissive mode (DESKTOP_USER_ID) for local dev.
   * In production (Electron), auto-generated and injected into the admin UI.
   */
  adminToken?: string
  /** Cloud API URL for room creation (default: https://ieom.danhub.dev) */
  cloudUrl?: string
  /** Token provider for cloud API authentication */
  getToken?: () => string | null
}

export interface DesktopServer {
  app: FastifyInstance
  io: SocketIOServer
  start(): Promise<void>
  stop(): Promise<void>
  getPort(): number
  runtimeState: import('./kernel/managers/runtime.js').RuntimeStateStore
}

const DESKTOP_USER_ID = 'desktop'

// ── Factory ──────────────────────────────────────────────────────

export async function createDesktopServer(options: DesktopServerOptions): Promise<DesktopServer> {
  const { dbPath, port = 3000, assetsDir, overlayDir, adminDir, cloudUrl, getToken } = options
  let boundPort = port

  // ── Database ─────────────────────────────────────────────────
  const db = initDesktopDatabase(dbPath)

  // ── Fastify ───────────────────────────────────────────────────
  const app = Fastify({ logger: { level: 'warn' } })
  await app.register(fastifyCors, { origin: '*' })
  await app.register(fastifyCookie)

  // Auth: if a token is configured, protected routes require it.
  // Priority: options.adminToken > OVERLAY_ADMIN_TOKEN env var > permissive fallback.
  // In permissive mode (no token), blanket-assign 'desktop' user for backward compat.
  const adminToken = options.adminToken?.trim() || process.env['OVERLAY_ADMIN_TOKEN']?.trim()
  if (adminToken) {
    // Set it back so downstream code (namespace.ts, authMiddleware.ts) sees the same value
    if (!process.env['OVERLAY_ADMIN_TOKEN']) process.env['OVERLAY_ADMIN_TOKEN'] = adminToken
    registerAuthMiddleware(app)
  } else {
    app.addHook('onRequest', async (request) => { request.userId = DESKTOP_USER_ID })
  }

  // ── Static files ──────────────────────────────────────────────
  if (existsSync(adminDir)) {
    await app.register(fastifyStatic, { root: adminDir, prefix: '/admin/', decorateReply: true })
    const adminAssetsDir = join(adminDir, 'assets')
    if (existsSync(adminAssetsDir)) {
      await app.register(fastifyStatic, { root: adminAssetsDir, prefix: '/assets/', decorateReply: false })
    }
    app.get('/admin', async (_req, reply) => reply.sendFile('index.html', adminDir))
  }
  mkdirSync(assetsDir, { recursive: true })
  await app.register(fastifyStatic, { root: assetsDir, prefix: '/media/', decorateReply: false })

  // ── File upload ───────────────────────────────────────────────
  await app.register(fastifyMultipart, { limits: { fileSize: 500 * 1024 * 1024 } })
  app.post('/api/upload/asset', async (req, reply) => {
    const data = await req.file()
    if (!data) return reply.code(400).send({ error: 'No file' })
    const subfolder = data.mimetype.startsWith('video/') ? 'video' : 'images'
    const destDir = join(assetsDir, subfolder)
    mkdirSync(destDir, { recursive: true })
    const safeName = data.filename.replace(/[\\/]/g, '_')
    await pipeline(data.file, createWriteStream(join(destDir, safeName)))
    clearMediaCaches()
    return reply.send({ url: `/assets/${subfolder}/${safeName}` })
  })

  // ── Socket.IO ─────────────────────────────────────────────────
  const io = new SocketIOServer(app.server, {
    cors: { origin: '*' },
    transports: ['websocket', 'polling'],
  })

  // ── Managers ──────────────────────────────────────────────────
  const configService = new DesktopConfigService(db, io)
  const dbQueryAdapter = {
    query: async (sql: string, params: unknown[] = []) => {
      const positional = sql.replace(/\$\d+/g, '?')
      const stmt = db.prepare(positional)
      const isSelect = /^\s*SELECT/i.test(sql)
      const rows = isSelect ? stmt.all(...params) as Record<string, unknown>[] : (stmt.run(...params), [])
      return { rows }
    },
  }
  const userRepository = new UserRepository(dbQueryAdapter)
  const machine = new SceneMachine()
  const runtimeState = new RuntimeStateStore()

  // ── Kernel ────────────────────────────────────────────────────
  const kernel = new Kernel()

  const scheduler = new EventScheduler(machine, () => configService.cachedConfig ?? DEFAULT_CONFIG as unknown as AppConfig, kernel.bus)
  const ambianceManager = new AmbianceManager(io, () => configService.cachedConfig ?? DEFAULT_CONFIG as unknown as AppConfig)
  const obsBridge = new ObsBridge(io, machine)
  const hubConnection = new HubConnection()
  const povOrchestrator = new POVOrchestrator(hubConnection)
  kernel.register(configService)
  kernel.register(runtimeState)
  kernel.register(machine, { after: ['DesktopConfigService'] })
  kernel.register(scheduler, { after: ['SceneMachine', 'DesktopConfigService'] })
  kernel.register(ambianceManager, { after: ['DesktopConfigService'] })
  kernel.register(obsBridge, { after: ['SceneMachine'] })
  kernel.register(povOrchestrator)

  // ── Scene → RuntimeState sync ─────────────────────────────────
  machine.on('state:change', (payload: { state: import('@ieomlabs/shared').STATE }) => {
    runtimeState.setCurrentScene(payload.state)
    runtimeState.setTransitionInProgress(false)
  })
  machine.on('transition:start', () => runtimeState.setTransitionInProgress(true))

  // ── Socket handlers ───────────────────────────────────────────
  const { isOverlaySlotTaken } = setupSocketHandlers(io, machine, scheduler, ambianceManager, {
    getObsStatus: () => obsBridge.getStatus(),
    getManagerStatuses: () => kernel.getManagerStatuses(),
    bus: kernel.bus,
    runtimeState,
    configService: configService as any,
  })

  registerOverlayNamespace(io)

  // ── REST routes ───────────────────────────────────────────────
  app.get('/api/health', async () => ({ ok: true }))
  app.get('/api/overlay/status', async () => ({ slotTaken: isOverlaySlotTaken() }))
  await app.register(authRoutes, { userRepository })
  await app.register(configRoute, { machine, configService: configService as any })
  await app.register(mediaRoute)
  await app.register(archiveRoute, { getObsStatus: () => obsBridge.getStatus(), obsBridge })

  // ── Room system ───────────────────────────────────────────────
  const overlayRelay = new OverlayRelay()
  // Start WebRTC freeze detection (monitorea tracks congelados cada 2s)
  hubConnection.startFreezeDetection()

  const cloudSignaling = new CloudSignaling(hubConnection, povOrchestrator, overlayRelay)

  io.on('connection', (socket) => {
    socket.on('pov:subscribe', () => {
      overlayRelay.createOffer((event, payload) => socket.emit(event, payload))
        .catch(e => logger.error('[pov-relay] createOffer failed:', e.message))
    })
    socket.on('pov:answer', async (payload: { sdp: string }) => {
      try {
        await overlayRelay.handleAnswer(payload.sdp)
      } catch (err) {
        logger.error({ err }, '[pov-relay] handleAnswer error:')
      }
    })
    socket.on('pov:ice-candidate', async (candidate: any) => {
      try {
        await overlayRelay.handleIceCandidate(candidate)
      } catch (err) {
        logger.error({ err }, '[pov-relay] ice-candidate error:')
      }
    })
  })

  cloudSignaling.onStatus((status) => io.emit('room:status' as any, status))
  await app.register(roomRoute, { cloudSignaling, pov: povOrchestrator })

  const onlineManager = new OnlineRoomManager(cloudSignaling, povOrchestrator, { cloudUrl, getToken })
  const adminRelay = new AdminRelay()
  adminRelay.bindHub(hubConnection)
  registerOnlineNamespace(io, onlineManager, adminRelay)
  await app.register(onlineRoute, { onlineManager })

  // Auto-sync rooms from cloud on startup (reconnects hub if rooms exist)
  setTimeout(() => {
    onlineManager.syncFromCloud().catch((e) => {
      logger.info({ err: (e as Error).message }, '[online] auto-sync on startup failed')
    })
  }, 2000) // Small delay to let auth token settle

  registerJoinNamespace(io, hubConnection, povOrchestrator, onlineManager)

  const joinPagePath = join(import.meta.dirname, 'join.html')
  if (existsSync(joinPagePath)) {
    const joinHtml = readFileSync(joinPagePath, 'utf8')
    app.get('/join', async (_req, reply) => {
      reply.header('content-type', 'text/html; charset=utf-8')
      return reply.send(joinHtml)
    })
  }

  // ── OBS config sync ───────────────────────────────────────────
  const defaultObsUrl = process.env.OBS_URL ?? 'ws://localhost:4455'
  const defaultObsPassword = process.env.OBS_PASSWORD ?? ''
  let activeObsUrl = defaultObsUrl
  let activeObsPassword = defaultObsPassword
  let activeAmbianceIntervalSeconds = withDesktopAmbianceDefaults(DEFAULT_CONFIG.desktopAmbiance).widgetSimulation.intervalSeconds
  let activeAmbianceEnabled = withDesktopAmbianceDefaults(DEFAULT_CONFIG.desktopAmbiance).widgetSimulation.enabled

  obsBridge.connect(activeObsUrl, activeObsPassword)

  configService.onConfigUpdate((config: AppConfig) => {
    if (config.obs.url !== activeObsUrl || config.obs.password !== activeObsPassword) {
      activeObsUrl = config.obs.url
      activeObsPassword = config.obs.password
      obsBridge.updateConnection(activeObsUrl, activeObsPassword)
    }
    const nextAmbiance = withDesktopAmbianceDefaults(config.desktopAmbiance).widgetSimulation
    if (nextAmbiance.intervalSeconds !== activeAmbianceIntervalSeconds || nextAmbiance.enabled !== activeAmbianceEnabled) {
      activeAmbianceIntervalSeconds = nextAmbiance.intervalSeconds
      activeAmbianceEnabled = nextAmbiance.enabled
      ambianceManager.start()
    }
  })

  // ── Overlay static files ──────────────────────────────────────
  if (existsSync(overlayDir)) {
    await app.register(fastifyStatic, { root: overlayDir, prefix: '/', wildcard: false, decorateReply: false })
  }

  // ── Global crash handler ────────────────────────────────────────
// Evita que excepciones no capturadas de werift/WSLR maten el proceso
process.on('uncaughtException', (err) => {
  logger.error({ err }, '[crash] Uncaught exception:')
  if (err.stack) logger.error(err.stack)
  // No terminamos el proceso — werift puede fallar sin matar la app
})

process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, '[crash] Unhandled rejection:')
  if ((reason as Error).stack) logger.error((reason as Error).stack)
  // No terminamos el proceso
})

// ── Lifecycle ─────────────────────────────────────────────────

  async function start(): Promise<void> {
    await kernel.boot()
    await app.listen({ port: boundPort, host: '127.0.0.1' })
    const address = app.server.address()
    if (address && typeof address === 'object') boundPort = address.port
  }

  async function stop(): Promise<void> {
    cloudSignaling.disconnect()
    overlayRelay.cleanup()
    await hubConnection.closeAll()
    io.close()
    await app.close()
    await kernel.shutdown()
    closeDesktopDatabase(db)
  }

  return { app, io, start, stop, getPort: () => boundPort, runtimeState }
}

// ── Dev-mode self-start ──────────────────────────────────────────

const NODE_ENV = process.env.NODE_ENV ?? 'development'
const isDevScript = process.argv[1]?.endsWith('desktop-entry.ts') || process.argv[1]?.endsWith('desktop-entry.js')
const shouldAutoStart = isDevScript && NODE_ENV !== 'production' && !process.env.IEOM_NO_AUTOSTART
if (shouldAutoStart) {
  const monorepo = join(import.meta.dirname, '..', '..', '..')
  const dataDir = join(monorepo, 'data')
  mkdirSync(dataDir, { recursive: true })
  createDesktopServer({
    dbPath: join(dataDir, 'ieom-dev.db'),
    port: 3000,
    assetsDir: join(monorepo, 'assets'),
    overlayDir: join(monorepo, 'packages', 'overlay', 'dist'),
    adminDir: join(monorepo, 'packages', 'admin', 'dist'),
  }).then(async (server) => {
    await server.start()
    logger.info(`[server] listening on http://localhost:${server.getPort()}`)
  }).catch((err) => {
    logger.error({ err }, '[server] failed to start')
    process.exit(1)
  })
}