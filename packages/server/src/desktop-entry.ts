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

import { Kernel } from './kernel/index.js'
import { loadDefaultConfig } from './lib/defaults.js'
import { SceneManager } from './kernel/managers/scene.js'
import { RuntimeStateStore } from './kernel/managers/runtime.js'
import { setupSocketHandlers } from './transport/socket/handlers.js'
import { setWidgetRuntimeOpenState, toggleWidgetRuntime } from './transport/socket/handlers/widget.js'
import { ObsBridgeManager } from './kernel/managers/obs.js'
import { EventScheduler } from './kernel/managers/scheduler.js'
import { AmbianceManager } from './kernel/managers/ambiance.js'
import { clearMediaCaches } from './services/MediaService.js'
import { configRoute } from './transport/http/config.js'
import { mediaRoute } from './transport/http/media.js'
import { archiveRoute } from './transport/http/archive.js'
import { roomRoute as roomHttpRoute } from './transport/http/room.js'
import { initDesktopDatabase, closeDesktopDatabase } from './db/desktop-db.js'
import { DesktopConfigService } from './kernel/managers/config.js'
import { AutomationManager } from './kernel/managers/automation.js'
import { ShowSequencer } from './kernel/managers/showSequencer.js'
import { TwitchIntegrationManager } from './kernel/managers/twitch.js'
import { ChatReactionManager } from './kernel/managers/chatReactions.js'
import { EffectAmbianceManager } from './kernel/managers/effectAmbiance.js'
import { ThemeDriftManager } from './kernel/managers/themeDrift.js'
import { PersonaManager } from './kernel/managers/persona.js'
import { TtsService } from './services/TtsService.js'
import { AutomationRuleRepository } from './db/repositories/AutomationRuleRepository.js'
import { automationRoute } from './transport/http/automation.js'
import { showsRoute } from './transport/http/shows.js'
import { presetsRoute } from './transport/http/presets.js'
import { sequencesRoute } from './transport/http/sequences.js'
import { busHistoryRoute } from './transport/http/busHistory.js'
import { BusHistoryRecorder } from './kernel/BusHistoryRecorder.js'
import { UserRepository } from './db/repositories/UserRepository.js'
import { authRoutes } from './auth/authRoutes.js'
import { registerAuthMiddleware } from './auth/authMiddleware.js'
import { RoomHub } from './transport/webrtc/room-hub.js'
import { POVOrchestrator } from './kernel/managers/pov.js'
import { RoomSignaling } from './transport/webrtc/room-signaling.js'
import { RoomManager } from './room/manager.js'
import { roomRoute as onlineRoomRoute } from './room/routes.js'
import { registerRoomNamespace } from './room/namespace.js'
import { registerStudioNamespace } from './transport/socket/roomNamespace.js'

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
  /** Path to the external plugins directory (reserved — not consumed yet) */
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
  const machine = new SceneManager(kernel.bus)
  const runtimeState = new RuntimeStateStore()

  const scheduler = new EventScheduler(machine, () => configService.cachedConfig ?? DEFAULT_CONFIG as unknown as AppConfig, kernel.bus)
  const ambianceManager = new AmbianceManager(io, () => configService.cachedConfig ?? DEFAULT_CONFIG as unknown as AppConfig, kernel.bus)
  const obsBridge = new ObsBridgeManager(io, machine, kernel.bus)
  const roomHub = new RoomHub()
  const povOrchestrator = new POVOrchestrator(roomHub)
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
  kernel.register(scheduler, { after: ['SceneManager', 'DesktopConfigService'] })
  kernel.register(ambianceManager, { after: ['DesktopConfigService'] })
  kernel.register(obsBridge, { after: ['SceneManager'] })
  kernel.register(povOrchestrator)
  kernel.register(automationManager, { after: ['DesktopConfigService', 'SceneManager', 'EventScheduler', 'AmbianceManager'] })
  kernel.register(showSequencer, { after: ['DesktopConfigService', 'SceneManager'] })

  const twitchManager = new TwitchIntegrationManager(
    () => configService.cachedConfig ?? DEFAULT_CONFIG as unknown as AppConfig,
    kernel.bus,
  )
  kernel.register(twitchManager, { after: ['DesktopConfigService'] })
  configService.onConfigUpdate((config) => {
    scheduler.onConfigChange()
    twitchManager.onConfigChange(config)
    effectAmbianceManager.onConfigChange()
    themeDriftManager.onConfigChange()
  })

  const chatReactionManager = new ChatReactionManager(
    () => configService.cachedConfig ?? DEFAULT_CONFIG as unknown as AppConfig,
    kernel.bus,
  )
  kernel.register(chatReactionManager, { after: ['DesktopConfigService', 'TwitchIntegrationManager'] })

  const effectAmbianceManager = new EffectAmbianceManager(
    () => configService.cachedConfig ?? DEFAULT_CONFIG as unknown as AppConfig,
    kernel.bus,
  )
  kernel.register(effectAmbianceManager, { after: ['DesktopConfigService'] })

  const themeDriftManager = new ThemeDriftManager(
    () => configService.cachedConfig ?? DEFAULT_CONFIG as unknown as AppConfig,
    kernel.bus,
  )
  kernel.register(themeDriftManager, { after: ['DesktopConfigService'] })

  const ttsService = new TtsService()
  const personaManager = new PersonaManager(
    () => configService.cachedConfig ?? DEFAULT_CONFIG as unknown as AppConfig,
    kernel.bus,
    ttsService,
  )
  kernel.register(personaManager, { after: ['DesktopConfigService', 'TwitchIntegrationManager'] })

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
    getTwitchStatus: () => ({
      ircConnected: twitchManager.isConnected,
      channel: twitchManager.channel,
      eventSubConnected: twitchManager.isEventSubConnected,
    }),
    bus: kernel.bus,
    runtimeState,
    configService,
    obsBridge,
  })

  // Authoritative widget open-state mutations for automation rules
  automationManager.setWidgetRuntime({
    setOpen: (widgetId, open) => setWidgetRuntimeOpenState({ runtimeState, io }, widgetId, open),
    toggle: (widgetId) => toggleWidgetRuntime({ runtimeState, io }, widgetId),
  })

  // ── REST routes ───────────────────────────────────────────────
  app.get('/api/health', async () => ({ ok: true }))
  app.get('/api/overlay/status', async () => ({ slotTaken: isOverlaySlotTaken() }))
  app.get('/api/defaults', async () => loadDefaultConfig())
  app.get('/api/tts/voices', async (req) => ({
    voices: await ttsService.listVoices((req.query as { provider?: string })?.provider),
  }))
  await app.register(authRoutes, { userRepository })
  await app.register(configRoute, { machine, configService })
  await app.register(mediaRoute)
  await app.register(archiveRoute, { getObsStatus: () => obsBridge.getStatus(), obsBridge })
  await app.register(automationRoute, {
    automationRepo,
    bus: kernel.bus,
    getManifests: () => WIDGET_INTENT_MANIFESTS,
    broadcastRules: () => {
      configService.invalidateCache()
      io.emit('config:patch', { automationRules: automationRepo.list() })
    },
  })
  await app.register(showsRoute, { sequencer: showSequencer, configService })
  await app.register(presetsRoute, { configService })
  await app.register(sequencesRoute, { configService })
  const busRecorder = new BusHistoryRecorder(kernel.bus, { capacity: 500, io })
  await app.register(busHistoryRoute, { recorder: busRecorder })

  // ── Room system ───────────────────────────────────────────────
  // P2P mode: server only relays signaling, overlay connects directly to guests

  // Start WebRTC freeze detection (monitors frozen tracks every 500ms)
  roomHub.startFreezeDetection()

  const roomSignaling = new RoomSignaling(roomHub, povOrchestrator)

  // ── P2P Relay: direct overlay↔guest signaling ───────────────────
  const { P2PRelay } = await import('./transport/webrtc/p2p-relay.js')
  const p2pRelay = new P2PRelay()

  // Wire P2P relay to send messages to guests via cloud signaling
  p2pRelay.setSendToGuest((userId, type, payload) => {
    roomSignaling.send_raw({ type, payload, senderId: 'self', timestamp: new Date().toISOString(), targetUserId: userId })
  })

  // Set P2P relay on signaling so it relays offers to overlay
  roomSignaling.p2pRelay = p2pRelay

  // Wire POV switch → P2P relay (tell overlay which guest to show)
  povOrchestrator.onSwitch((_prev, next) => {
    logger.info(`[pov-relay] switch → ${next}`)
    p2pRelay.switchTo(next)
  })

  // When participant is removed, notify overlay
  roomHub.onParticipantRemoved((userId) => {
    p2pRelay.removeGuest(userId)
  })

  io.on('connection', (socket) => {
    const clientType = (socket.handshake.auth as { clientType?: string } | undefined)?.clientType
    if (clientType !== 'overlay') return

    socket.on('pov-online:relay:subscribe', () => {
      logger.info('[pov-relay] overlay subscribed (P2P mode)')
      p2pRelay.setOverlaySocket(socket)

      // For each existing guest, request a fresh offer so they connect to the overlay
      for (const userId of roomSignaling.getStatus().participants) {
        roomSignaling.requestReOffer(userId)
      }

      // Tell overlay which guest is active
      const activeId = povOrchestrator.activeCameraId
      if (activeId) {
        p2pRelay.switchTo(activeId)
      }
    })

    // Relay P2P answer from overlay back to guest
    socket.on('pov-online:p2p:answer' as any, (payload: { userId: string; sdp: string }) => {
      logger.info(`[pov-relay] overlay answer for ${payload.userId}`)
      roomSignaling.send_raw({
        type: 'answer',
        payload: { sdp: payload.sdp },
        senderId: 'self',
        timestamp: new Date().toISOString(),
        targetUserId: payload.userId,
      })
    })

    // Relay ICE from overlay to guest
    socket.on('pov-online:p2p:ice' as any, (payload: { userId: string; candidate: any }) => {
      logger.info(`[pov-relay] ICE from overlay for ${payload.userId}`)
      roomSignaling.send_raw({
        type: 'ice-candidate',
        payload: payload.candidate,
        senderId: 'self',
        timestamp: new Date().toISOString(),
        targetUserId: payload.userId,
      })
    })

    // Legacy handlers (no-op)
    socket.on('pov-online:relay:answer', () => {})
    socket.on('pov-online:relay:ice', () => {})

    socket.on('disconnect', () => {
      p2pRelay.clearOverlaySocket()
    })
  })

  roomSignaling.onStatus((status) => io.emit('room:status' as any, status))
  await app.register(roomHttpRoute, { cloudSignaling: roomSignaling, pov: povOrchestrator, hub: roomHub })

  const roomManager = new RoomManager(roomSignaling, povOrchestrator, {
    cloudUrl,
    getToken,
    signalingFactory: () => {
      const sig = new RoomSignaling(roomHub, povOrchestrator)
      sig.p2pRelay = p2pRelay // Propagate P2P relay to all per-room signaling instances
      return sig
    },
  })

  registerRoomNamespace(io, roomManager)
  await app.register(onlineRoomRoute, { roomManager })

  // In Electron mode getToken is provided at startup (loadToken from keychain).
  // Sync immediately so the hub reconnects to cloud rooms without admin panel interaction.
  if (getToken?.()) {
    roomManager.syncFromCloud().catch((e) => {
      logger.info({ err: (e as Error).message }, '[room] startup sync failed')
    })
  }

  registerStudioNamespace(io, roomHub, povOrchestrator, roomManager)

  const studioPagePath = join(import.meta.dirname, 'studio.html')
  if (existsSync(studioPagePath)) {
    const studioHtml = readFileSync(studioPagePath, 'utf8')
    app.get('/studio', async (_req, reply) => {
      reply.header('content-type', 'text/html; charset=utf-8')
      return reply.send(studioHtml)
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
  process.on('uncaughtException', (err) => {
    logger.error({ err }, '[crash] Uncaught exception — exiting:')
    process.exit(1)
  })

  process.on('unhandledRejection', (reason) => {
    logger.warn({ reason }, '[crash] Unhandled rejection (non-fatal):')
  })

// ── Lifecycle ─────────────────────────────────────────────────

  async function start(): Promise<void> {
    await kernel.boot()
    // Pre-warm the config cache before accepting socket connections.
    // Without this, an overlay connecting before any admin HTTP request would
    // receive DEFAULT_CONFIG (cachedConfig is null until first getForUser call).
    await configService.getForUser(DESKTOP_USER_ID)
    await app.listen({ port: boundPort, host: '0.0.0.0' })
    const address = app.server.address()
    if (address && typeof address === 'object') boundPort = address.port
  }

  async function stop(): Promise<void> {
    roomSignaling.disconnect()
    await roomHub.closeAll()
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