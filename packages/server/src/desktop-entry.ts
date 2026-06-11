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
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { pipeline } from 'stream/promises'
import logger from './lib/logger.js'

import { DEFAULT_CONFIG, withDesktopAmbianceDefaults, WIDGET_INTENT_MANIFESTS } from '@ieomlabs/shared'
import type { AppConfig } from '@ieomlabs/shared'

import { AdminRelay } from './transport/webrtc/admin-relay.js'
import { Kernel } from './kernel/index.js'
import { loadDefaultConfig } from './lib/defaults.js'
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
import { wiresRoute } from './transport/http/wires.js'
import { initDesktopDatabase, closeDesktopDatabase } from './db/desktop-db.js'
import { DesktopConfigService } from './kernel/managers/config.js'
import { AutomationManager } from './kernel/managers/automation.js'
import { ShowSequencer } from './kernel/managers/showSequencer.js'
import { TwitchChatManager } from './kernel/managers/twitchChat.js'
import { ChatReactionManager } from './kernel/managers/chatReactions.js'
import { AutomationRuleRepository } from './db/repositories/AutomationRuleRepository.js'
import { automationRoute } from './transport/http/automation.js'
import { showsRoute } from './transport/http/shows.js'
import { busHistoryRoute } from './transport/http/busHistory.js'
import { BusHistoryRecorder } from './kernel/BusHistoryRecorder.js'
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
  /** Path to the plugins directory (optional, served at /plugins/) */
  pluginsDir?: string
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

  // ── TLS (self-signed cert for LAN dev) ────────────────────────
  const certDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'scripts', 'certs')
  const certPath = join(certDir, 'cert.pem')
  const keyPath = join(certDir, 'key.pem')
  const hasCert = existsSync(certPath) && existsSync(keyPath)
  if (hasCert) logger.info('[server] HTTPS enabled (self-signed cert)')

  // ── CORS origin allowlist ──────────────────────────────────────
  // In LAN/dev mode allow all origins — connections come from trusted local network.
  // In production (CORS_ORIGINS env set), restrict to the explicit list.
  const corsOrigins: string[] | true = process.env['CORS_ORIGINS']
    ? process.env['CORS_ORIGINS'].split(',').map((o) => o.trim()).filter(Boolean)
    : true  // allow all origins in local dev / LAN mode

  // ── Database ─────────────────────────────────────────────────
  const db = initDesktopDatabase(dbPath)

  // ── Fastify ───────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const app: FastifyInstance = hasCert
    ? (Fastify as any)({
        logger: { level: 'warn' },
        https: { key: readFileSync(keyPath), cert: readFileSync(certPath) },
      })
    : Fastify({ logger: { level: 'warn' } })
  await app.register(fastifyCors, { origin: corsOrigins, credentials: true })
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
  mkdirSync(assetsDir, { recursive: true })
  if (existsSync(adminDir)) {
    await app.register(fastifyStatic, { root: adminDir, prefix: '/admin/', decorateReply: true })
    const adminAssetsDir = join(adminDir, 'assets')
    // Serve both admin Vite chunks and project assets (images/audio/video) under /assets/.
    // @fastify/static v9 tries each root in order, so hashed Vite filenames in adminAssetsDir
    // are found first; project assets in subdirectories (images/, audio/, etc.) come from assetsDir.
    const assetsRoots: string[] = existsSync(adminAssetsDir) ? [adminAssetsDir, assetsDir] : [assetsDir]
    await app.register(fastifyStatic, { root: assetsRoots, prefix: '/assets/', decorateReply: false })
    app.get('/admin', async (_req, reply) => reply.sendFile('index.html', adminDir))
  } else {
    await app.register(fastifyStatic, { root: assetsDir, prefix: '/assets/', decorateReply: false })
  }
  await app.register(fastifyStatic, { root: assetsDir, prefix: '/media/', decorateReply: false })

  // ── File upload ───────────────────────────────────────────────
  await app.register(fastifyMultipart, { limits: { fileSize: 50 * 1024 * 1024 } })

  const ALLOWED_IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'])
  const ALLOWED_VIDEO_EXTS = new Set(['.mp4', '.webm'])
  const ALLOWED_MIME_MAP: Record<string, Set<string>> = {
    '.png': new Set(['image/png']),
    '.jpg': new Set(['image/jpeg']),
    '.jpeg': new Set(['image/jpeg']),
    '.gif': new Set(['image/gif']),
    '.webp': new Set(['image/webp']),
    '.svg': new Set(['image/svg+xml', 'text/plain']),
    '.mp4': new Set(['video/mp4']),
    '.webm': new Set(['video/webm']),
  }
  const VIDEO_SIZE_LIMIT = 50 * 1024 * 1024
  const IMAGE_SIZE_LIMIT = 10 * 1024 * 1024

  app.post('/api/upload/asset', async (req, reply) => {
    const data = await req.file()
    if (!data) return reply.code(400).send({ error: 'No file' })

    // Strip null bytes and normalize
    const rawName = data.filename.replace(/\0/g, '').replace(/[\\/]/g, '_').slice(0, 200)
    const ext = rawName.slice(rawName.lastIndexOf('.')).toLowerCase()
    const isVideo = ALLOWED_VIDEO_EXTS.has(ext)
    const isImage = ALLOWED_IMAGE_EXTS.has(ext)

    if (!isVideo && !isImage) {
      data.file.resume()
      return reply.code(400).send({ error: `File type not allowed: ${ext}` })
    }

    const allowedMimes = ALLOWED_MIME_MAP[ext]
    if (allowedMimes && !allowedMimes.has(data.mimetype.split(';')[0].trim())) {
      data.file.resume()
      return reply.code(400).send({ error: `MIME type mismatch for ${ext}: ${data.mimetype}` })
    }

    const sizeLimit = isVideo ? VIDEO_SIZE_LIMIT : IMAGE_SIZE_LIMIT
    const subfolder = isVideo ? 'videos' : 'images'
    const destDir = join(assetsDir, subfolder)
    mkdirSync(destDir, { recursive: true })
    const safeName = rawName

    let bytesWritten = 0
    const dest = createWriteStream(join(destDir, safeName))
    try {
      await pipeline(
        data.file,
        async function* (source) {
          for await (const chunk of source) {
            bytesWritten += chunk.length
            if (bytesWritten > sizeLimit) throw Object.assign(new Error('File too large'), { code: 'ELIMIT' })
            yield chunk
          }
        },
        dest,
      )
    } catch (err: any) {
      if (err.code === 'ELIMIT') return reply.code(413).send({ error: 'File exceeds size limit' })
      throw err
    }

    clearMediaCaches()
    return reply.send({ url: `/assets/${subfolder}/${safeName}` })
  })

  // ── Socket.IO ─────────────────────────────────────────────────
  const io = new SocketIOServer(app.server, {
    cors: { origin: corsOrigins, credentials: true },
    transports: ['websocket', 'polling'],
  })

  // ── Kernel ────────────────────────────────────────────────────
  const kernel = new Kernel()

  // ── Managers ──────────────────────────────────────────────────
  const configService = new DesktopConfigService(db, io, kernel.bus)
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
  const machine = new SceneMachine(kernel.bus)
  const runtimeState = new RuntimeStateStore()

  const scheduler = new EventScheduler(machine, () => configService.cachedConfig ?? DEFAULT_CONFIG as unknown as AppConfig, kernel.bus)
  const ambianceManager = new AmbianceManager(io, () => configService.cachedConfig ?? DEFAULT_CONFIG as unknown as AppConfig, kernel.bus)
  const obsBridge = new ObsBridge(io, machine, kernel.bus)
  const hubConnection = new HubConnection()
  const povOrchestrator = new POVOrchestrator(hubConnection)
  const automationRepo = new AutomationRuleRepository(db)
  const automationManager = new AutomationManager(automationRepo, kernel.bus, io, machine)
  const showSequencer = new ShowSequencer(
    () => configService.cachedConfig ?? DEFAULT_CONFIG as unknown as AppConfig,
    kernel.bus,
    machine,
    obsBridge,
  )
  kernel.register(configService)
  kernel.register(runtimeState)
  kernel.register(machine, { after: ['DesktopConfigService'] })
  kernel.register(scheduler, { after: ['SceneMachine', 'DesktopConfigService'] })
  kernel.register(ambianceManager, { after: ['DesktopConfigService'] })
  kernel.register(obsBridge, { after: ['SceneMachine'] })
  kernel.register(povOrchestrator)
  kernel.register(automationManager, { after: ['DesktopConfigService', 'SceneMachine', 'EventScheduler', 'AmbianceManager'] })
  kernel.register(showSequencer, { after: ['DesktopConfigService', 'SceneMachine'] })

  const twitchChatManager = new TwitchChatManager(
    () => configService.cachedConfig ?? DEFAULT_CONFIG as unknown as AppConfig,
    kernel.bus,
  )
  kernel.register(twitchChatManager, { after: ['DesktopConfigService'] })
  configService.onConfigUpdate((config) => {
    scheduler.onConfigChange()
    twitchChatManager.onConfigChange(config)
  })

  const chatReactionManager = new ChatReactionManager(
    () => configService.cachedConfig ?? DEFAULT_CONFIG as unknown as AppConfig,
    kernel.bus,
  )
  kernel.register(chatReactionManager, { after: ['DesktopConfigService', 'TwitchChatManager'] })

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
    configService,
    obsBridge,
  })

  registerOverlayNamespace(io)

  // ── REST routes ───────────────────────────────────────────────
  app.get('/api/health', async () => ({ ok: true }))
  app.get('/api/overlay/status', async () => ({ slotTaken: isOverlaySlotTaken() }))
  app.get('/api/defaults', async () => loadDefaultConfig())
  await app.register(authRoutes, { userRepository })
  await app.register(configRoute, { machine, configService })
  await app.register(mediaRoute)
  await app.register(archiveRoute, { getObsStatus: () => obsBridge.getStatus(), obsBridge })
  await app.register(automationRoute, { automationRepo })
  await app.register(showsRoute, { sequencer: showSequencer, configService })
  const busRecorder = new BusHistoryRecorder(kernel.bus, { capacity: 500, io })
  await app.register(busHistoryRoute, { recorder: busRecorder })
  await app.register(wiresRoute, {
    wires: configService.widgetWires,
    getManifests: () => WIDGET_INTENT_MANIFESTS,
    broadcastWires: (wires) => {
      configService.invalidateCache()
      io.emit('config:patch', { widgetWires: wires })
    },
  })

  // ── Room system ───────────────────────────────────────────────
  const overlayRelay = new OverlayRelay()
  // Start WebRTC freeze detection (monitorea tracks congelados cada 2s)
  hubConnection.startFreezeDetection()

  // Wire POV → overlay relay for all participants (LAN and cloud)
  povOrchestrator.onSwitch((_prev, next) => {
    logger.info(`[pov-relay] switch → ${next}`)
    overlayRelay.switchTo(hubConnection.getAudioTrack(next), hubConnection.getVideoTrack(next))
      .catch(e => logger.warn({ err: e }, '[pov-relay] switchTo failed'))
  })

  // Auto-select first participant; relay fresh tracks on re-offer for active camera
  hubConnection.onTrack((userId) => {
    if (!povOrchestrator.activeCameraId) {
      povOrchestrator.switcher.manualSelect(userId)
    } else if (userId === povOrchestrator.activeCameraId) {
      overlayRelay.switchTo(hubConnection.getAudioTrack(userId), hubConnection.getVideoTrack(userId))
        .catch(e => logger.warn({ err: e }, '[pov-relay] switchTo on re-offer failed'))
    }
  })

  const cloudSignaling = new CloudSignaling(hubConnection, povOrchestrator)

  io.on('connection', (socket) => {
    socket.on('pov:subscribe', () => {
      logger.info('[pov-relay] overlay subscribed')
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
  await app.register(roomRoute, { cloudSignaling, pov: povOrchestrator, hub: hubConnection })

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

  // ── Plugin static files ────────────────────────────────────────
  const { pluginsDir } = options
  if (pluginsDir && existsSync(pluginsDir)) {
    await app.register(fastifyStatic, { root: pluginsDir, prefix: '/plugins/', decorateReply: false })
  }

  // ── Global crash handler ────────────────────────────────────────
  // Log and exit on uncaught exceptions; let the process manager restart.
  // Exception: werift WebRTC errors are non-fatal and caught here to avoid killing the app.
  process.on('uncaughtException', (err) => {
    const isWeriftNoise = err.stack?.includes('werift') || err.message?.includes('RTCPeerConnection')
    if (isWeriftNoise) {
      logger.warn({ err }, '[crash] Suppressed werift exception:')
      return
    }
    logger.error({ err }, '[crash] Uncaught exception — exiting:')
    process.exit(1)
  })

  process.on('unhandledRejection', (reason) => {
    logger.warn({ reason }, '[crash] Unhandled rejection (non-fatal):')
  })

// ── Lifecycle ─────────────────────────────────────────────────

  async function start(): Promise<void> {
    await kernel.boot()
    await app.listen({ port: boundPort, host: '0.0.0.0' })
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
    pluginsDir: join(monorepo, 'plugins'),
  }).then(async (server) => {
    await server.start()
    logger.info(`[server] listening on http${existsSync(join(import.meta.dirname, '..', '..', '..', 'scripts', 'certs', 'cert.pem')) ? 's' : ''}://localhost:${server.getPort()}`)
  }).catch((err) => {
    logger.error({ err }, '[server] failed to start')
    process.exit(1)
  })
}