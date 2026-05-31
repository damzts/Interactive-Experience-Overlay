/**
 * Desktop mode entry point for @ieom/server.
 *
 * Provides a factory function that creates a Fastify server configured for
 * the Electron desktop app: no auth, no PostgreSQL, localhost-only binding,
 * static file serving for overlay and admin UIs.
 *
 * Requirements: 2.1, 2.2, 2.3, 2.5, 4.1, 4.2, 4.3, 4.5, 4.6
 */

import Fastify from 'fastify'
import type { FastifyInstance } from 'fastify'
import fastifyCors from '@fastify/cors'
import fastifyStatic from '@fastify/static'
import fastifyMultipart from '@fastify/multipart'
import { Server as SocketIOServer } from 'socket.io'
import { existsSync, mkdirSync, createWriteStream } from 'fs'
import { join } from 'path'
import { pipeline } from 'stream/promises'

import { DEFAULT_CONFIG, withDesktopAmbianceDefaults } from '@ieom/shared'
import type { AppConfig } from '@ieom/shared'

import { SceneMachine } from './state/machine.js'
import { setupSocketHandlers } from './socket/handlers.js'
import { ObsBridge } from './obs/bridge.js'
import { EventScheduler } from './events/scheduler.js'
import { AmbianceManager } from './ambiance/manager.js'
import { registerOverlayNamespace } from './socket/overlayHandlers.js'
import { clearMediaCaches } from './services/MediaService.js'
import { configRoute } from './routes/config.js'
import { mediaRoute } from './routes/media.js'
import { archiveRoute } from './routes/archive.js'
import { roomRoute } from './routes/room.js'
import { initDesktopDatabase, closeDesktopDatabase } from './db/desktop-db.js'
import { DesktopConfigService } from './db/desktop-config-service.js'
import { HubConnection } from './room/hub-connection.js'
import { POVOrchestrator } from './pov/index.js'
import { OverlayRelay } from './room/overlay-relay.js'
import { CloudSignaling } from './room/cloud-signaling.js'
import { OnlineRoomManager } from './online/manager.js'
import { onlineRoute } from './online/routes.js'
import { registerOnlineNamespace } from './online/namespace.js'

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
  /** Cloud API URL for room creation (default: https://ieom.danhub.dev) */
  cloudUrl?: string
  /** Token provider for cloud API authentication */
  getToken?: () => string | null
}

export interface DesktopServer {
  /** The Fastify instance */
  app: FastifyInstance
  /** The Socket.IO server instance */
  io: SocketIOServer
  /** Start the server (bind to port) */
  start(): Promise<void>
  /** Gracefully stop the server */
  stop(): Promise<void>
  /** Get the port the server is bound to */
  getPort(): number
}

// ── Constant desktop user ID (single-tenant, no auth) ────────────

const DESKTOP_USER_ID = 'desktop'

// ── Factory ──────────────────────────────────────────────────────

/**
 * Create a desktop-mode Fastify server.
 *
 * This server:
 * - Binds only to 127.0.0.1 (localhost)
 * - Has NO authentication middleware
 * - Has NO CSRF protection
 * - Has NO PostgreSQL connections
 * - Serves overlay static files at `/`
 * - Serves admin static files at `/admin`
 * - Registers all API routes without auth
 * - Configures Socket.IO without auth handshake
 */
export async function createDesktopServer(options: DesktopServerOptions): Promise<DesktopServer> {
  const {
    dbPath,
    port = 3000,
    assetsDir,
    overlayDir,
    adminDir,
    cloudUrl,
    getToken,
  } = options

  let boundPort = port

  // ── Initialize SQLite database (WAL mode, migrations, seeding) ──
  const db = await initDesktopDatabase(dbPath)

  // ── Create Fastify instance ──────────────────────────────────
  const app = Fastify({ logger: { level: 'warn' } })

  await app.register(fastifyCors, { origin: '*' })

  // ── Assign a fixed userId to every request (no auth) ─────────
  app.addHook('onRequest', async (request) => {
    request.userId = DESKTOP_USER_ID
  })

  // ── Static file serving ──────────────────────────────────────

  // Admin UI at /admin
  if (existsSync(adminDir)) {
    await app.register(fastifyStatic, {
      root: adminDir,
      prefix: '/admin/',
      decorateReply: true,
    })

    // Serve admin's built assets at /assets/ (Vite uses absolute /assets/ paths)
    const adminAssetsDir = join(adminDir, 'assets')
    if (existsSync(adminAssetsDir)) {
      await app.register(fastifyStatic, {
        root: adminAssetsDir,
        prefix: '/assets/',
        decorateReply: false,
      })
    }

    // SPA fallback: serve index.html for /admin
    app.get('/admin', async (_req, reply) => {
      return reply.sendFile('index.html', adminDir)
    })
  }

  // Media assets directory
  mkdirSync(assetsDir, { recursive: true })
  await app.register(fastifyStatic, {
    root: assetsDir,
    prefix: '/media/',
    decorateReply: false,
  })

  // ── File upload endpoint ─────────────────────────────────────
  await app.register(fastifyMultipart, { limits: { fileSize: 500 * 1024 * 1024 } })
  app.post('/api/upload/asset', async (req, reply) => {
    const data = await req.file()
    if (!data) return reply.code(400).send({ error: 'No file' })

    const mime = data.mimetype
    const subfolder = mime.startsWith('video/') ? 'video' : 'images'
    const destDir = join(assetsDir, subfolder)
    mkdirSync(destDir, { recursive: true })

    const safeName = data.filename.replace(/[\\/]/g, '_')
    const destPath = join(destDir, safeName)

    await pipeline(data.file, createWriteStream(destPath))
    clearMediaCaches()
    return reply.send({ url: `/assets/${subfolder}/${safeName}` })
  })

  // ── Socket.IO server (NO auth handshake) ─────────────────────
  const io = new SocketIOServer(app.server, {
    cors: { origin: '*' },
    transports: ['websocket', 'polling'],
  })

  // ── Desktop ConfigService (SQLite-backed, single-tenant) ──────
  const configService = new DesktopConfigService(db, io)

  // ── Scene state machine ──────────────────────────────────────
  const machine = new SceneMachine()

  // ── Managers ─────────────────────────────────────────────────
  let cachedConfig: AppConfig = await configService.getForUser(DESKTOP_USER_ID)
  const scheduler = new EventScheduler(machine, () => cachedConfig)
  const ambianceManager = new AmbianceManager(io, () => cachedConfig)
  const obsBridge = new ObsBridge(io, machine)

  // ── Socket handlers (NO auth middleware on io.use) ───────────
  setupSocketHandlers(io, machine, scheduler, ambianceManager, {
    getObsStatus: () => obsBridge.getStatus(),
    configService: configService as any,
  })

  // NOTE: We intentionally do NOT call io.use(socketAuthMiddleware)
  // This satisfies Requirement 4.3, 4.6: no socket auth in desktop mode

  // ── Register overlay namespace ───────────────────────────────
  registerOverlayNamespace(io)

  // ── REST routes (NO auth middleware registered) ──────────────
  await app.register(configRoute, { machine, configService: configService as any })
  await app.register(mediaRoute)
  await app.register(archiveRoute, { getObsStatus: () => obsBridge.getStatus() })

  // ── Room system (hub-and-spoke WebRTC) ───────────────────────
  const hubConnection = new HubConnection()
  const povOrchestrator = new POVOrchestrator(hubConnection)
  const overlayRelay = new OverlayRelay()
  const cloudSignaling = new CloudSignaling(hubConnection, povOrchestrator, overlayRelay)

  // Wire overlay relay signaling through Socket.IO
  io.on('connection', (socket) => {
    socket.on('pov:subscribe', () => {
      overlayRelay.createOffer((event, payload) => {
        socket.emit(event, payload)
      })
    })
    socket.on('pov:answer', (payload: { sdp: string }) => {
      overlayRelay.handleAnswer(payload.sdp)
    })
    socket.on('pov:ice-candidate', (candidate: any) => {
      overlayRelay.handleIceCandidate(candidate)
    })
  })

  // Emit room status changes to all connected clients
  cloudSignaling.onStatus((status) => {
    io.emit('room:status' as any, status)
  })

  await app.register(roomRoute, { cloudSignaling })

  // ── Online rooms (admin panel integration) ───────────────────
  const onlineManager = new OnlineRoomManager(cloudSignaling, povOrchestrator, { cloudUrl, getToken })
  registerOnlineNamespace(io, onlineManager)
  await app.register(onlineRoute, { onlineManager })

  // ── OBS WebSocket bridge ─────────────────────────────────────
  const defaultObsUrl = process.env.OBS_URL ?? 'ws://localhost:4455'
  const defaultObsPassword = process.env.OBS_PASSWORD ?? ''
  let activeObsUrl = defaultObsUrl
  let activeObsPassword = defaultObsPassword
  let activeAmbianceIntervalSeconds = withDesktopAmbianceDefaults(DEFAULT_CONFIG.desktopAmbiance).widgetSimulation.intervalSeconds

  obsBridge.connect(activeObsUrl, activeObsPassword)

  machine.on('config:update', (config) => {
    cachedConfig = config

    if (config.obs.url !== activeObsUrl || config.obs.password !== activeObsPassword) {
      activeObsUrl = config.obs.url
      activeObsPassword = config.obs.password
      obsBridge.updateConnection(activeObsUrl, activeObsPassword)
    }

    const nextAmbianceIntervalSeconds = withDesktopAmbianceDefaults(config.desktopAmbiance).widgetSimulation.intervalSeconds
    if (nextAmbianceIntervalSeconds !== activeAmbianceIntervalSeconds) {
      activeAmbianceIntervalSeconds = nextAmbianceIntervalSeconds
      ambianceManager.start()
    }
  })

  // ── Overlay static files at root `/` ─────────────────────────
  if (existsSync(overlayDir)) {
    await app.register(fastifyStatic, {
      root: overlayDir,
      prefix: '/',
      wildcard: false,
      decorateReply: false,
    })
  }

  // ── Lifecycle methods ────────────────────────────────────────

  async function start(): Promise<void> {
    // Start managers
    scheduler.start()
    ambianceManager.start()

    // Bind to localhost only
    await app.listen({ port: boundPort, host: '127.0.0.1' })
    // Update boundPort in case port 0 was used (random port)
    const address = app.server.address()
    if (address && typeof address === 'object') {
      boundPort = address.port
    }
  }

  async function stop(): Promise<void> {
    cloudSignaling.disconnect()
    povOrchestrator.stop()
    overlayRelay.cleanup()
    await hubConnection.closeAll()
    scheduler.stop()
    ambianceManager.stop()
    io.close()
    await app.close()
    closeDesktopDatabase(db)
  }

  function getPort(): number {
    return boundPort
  }

  return { app, io, start, stop, getPort }
}

// ── Dev-mode self-start ──────────────────────────────────────────

const isDev = process.argv[1]?.endsWith('desktop-entry.ts') || process.argv[1]?.endsWith('desktop-entry.js')
if (isDev && !process.env.IEOM_NO_AUTOSTART) {
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
    console.log(`[server] listening on http://localhost:${server.getPort()}`)
  }).catch((err) => {
    console.error('[server] failed to start:', err)
    process.exit(1)
  })
}
