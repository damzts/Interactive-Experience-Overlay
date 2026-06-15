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
import * as mediasoup from 'mediasoup'
import { bridgeTrackToProducer, closeBridgedProducer, type BridgedProducer } from './transport/webrtc/rtp-bridge.js'
import logger from './lib/logger.js'

import { DEFAULT_CONFIG, withDesktopAmbianceDefaults, WIDGET_INTENT_MANIFESTS } from '@ieomlabs/shared'
import type { AppConfig } from '@ieomlabs/shared'

import { RoomPreviewRelay } from './transport/webrtc/room-preview-relay.js'
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
import { roomRoute as roomHttpRoute } from './transport/http/room.js'
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
import { RoomHub } from './transport/webrtc/room-hub.js'
import { POVOrchestrator } from './kernel/managers/pov.js'
import { RoomRelay } from './transport/webrtc/room-relay.js'
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
  // Create mediasoup Worker and Router
  const msWorker = await mediasoup.createWorker({
    logLevel: 'warn',
    rtcMinPort: Number(process.env['MEDIASOUP_RTC_MIN_PORT'] || 10000),
    rtcMaxPort: Number(process.env['MEDIASOUP_RTC_MAX_PORT'] || 10100),
  })
  msWorker.on('died', () => {
    logger.error('[mediasoup] Worker died — exiting')
    process.exit(1)
  })

  const msRouter = await msWorker.createRouter({
    mediaCodecs: [
      {
        kind: 'audio',
        mimeType: 'audio/opus',
        clockRate: 48000,
        channels: 2,
      },
      {
        kind: 'video',
        mimeType: 'video/VP8',
        clockRate: 90000,
        parameters: {},
      },
      {
        kind: 'video',
        mimeType: 'video/VP9',
        clockRate: 90000,
        parameters: {
          'profile-id': 0,
        },
      },
      {
        kind: 'video',
        mimeType: 'video/VP9',
        clockRate: 90000,
        parameters: {
          'profile-id': 2,
        },
      },
      {
        kind: 'video',
        mimeType: 'video/H264',
        clockRate: 90000,
        parameters: {
          'packetization-mode': 1,
          'profile-level-id': '42001f',
          'level-asymmetry-allowed': 1,
        },
      },
      {
        kind: 'video',
        mimeType: 'video/H264',
        clockRate: 90000,
        parameters: {
          'packetization-mode': 0,
          'profile-level-id': '42001f',
          'level-asymmetry-allowed': 1,
        },
      },
      {
        kind: 'video',
        mimeType: 'video/H264',
        clockRate: 90000,
        parameters: {
          'packetization-mode': 1,
          'profile-level-id': '42e01f',
          'level-asymmetry-allowed': 1,
        },
      },
      {
        kind: 'video',
        mimeType: 'video/H264',
        clockRate: 90000,
        parameters: {
          'packetization-mode': 0,
          'profile-level-id': '42e01f',
          'level-asymmetry-allowed': 1,
        },
      },
      {
        kind: 'video',
        mimeType: 'video/H264',
        clockRate: 90000,
        parameters: {
          'packetization-mode': 1,
          'profile-level-id': '4d0032',
          'level-asymmetry-allowed': 1,
        },
      },
      {
        kind: 'video',
        mimeType: 'video/H264',
        clockRate: 90000,
        parameters: {
          'packetization-mode': 1,
          'profile-level-id': '640032',
          'level-asymmetry-allowed': 1,
        },
      },
    ],
  })
  logger.info('[mediasoup] Worker and Router created')

  const roomRelay = new RoomRelay()
  roomRelay.setRouter(msRouter)

  const roomPreviewRelay = new RoomPreviewRelay()
  roomPreviewRelay.setRouter(msRouter)
  roomPreviewRelay.bindHub(roomHub)

  // Start WebRTC freeze detection (monitors frozen tracks every 500ms)
  roomHub.startFreezeDetection()

  // ── RTP Bridge: werift tracks → mediasoup Producers ───────────
  // Maps userId → bridged producers. When a track arrives from werift,
  // we pipe it into mediasoup so the relay can consume it.
  const bridgedProducers = new Map<string, { audio?: BridgedProducer; video?: BridgedProducer }>()

  // Wire POV → room relay for all participants (LAN and cloud)
  povOrchestrator.onSwitch((_prev, next) => {
    logger.info(`[pov-relay] switch → ${next}`)
    const bridged = bridgedProducers.get(next)
    const videoProducer = bridged?.video?.producer ?? null
    const audioProducer = bridged?.audio?.producer ?? null
    if (videoProducer || audioProducer) {
      roomRelay.switchTo(audioProducer, videoProducer)
        .catch(e => logger.warn({ err: e }, '[pov-relay] switchTo failed'))
    }
  })

  // When a werift track arrives, bridge it to mediasoup
  roomHub.onTrack(async (userId, kind, track) => {
    try {
      // Close existing bridge for this kind if re-offering
      const existing = bridgedProducers.get(userId)
      if (existing?.[kind]) {
        closeBridgedProducer(existing[kind]!)
        existing[kind] = undefined
      }

      // Bridge the werift track → mediasoup Producer
      const bridged = await bridgeTrackToProducer(msRouter, track, kind)

      if (!bridgedProducers.has(userId)) bridgedProducers.set(userId, {})
      bridgedProducers.get(userId)![kind] = bridged

      logger.info(`[rtp-bridge] ${userId} ${kind} bridged → Producer ${bridged.producer.id}`)

      // Notify preview relay about the new producer
      roomPreviewRelay.notifyProducer(userId, kind, bridged.producer.id)

      // If this is video for the active camera, update the relay
      if (kind === 'video') {
        if (!povOrchestrator.activeCameraId) {
          povOrchestrator.switcher.manualSelect(userId)
        } else if (userId === povOrchestrator.activeCameraId) {
          const audioBridged = bridgedProducers.get(userId)?.audio
          roomRelay.switchTo(audioBridged?.producer ?? null, bridged.producer)
            .catch(e => logger.warn({ err: e }, '[pov-relay] switchTo on new producer failed'))
        }
      }
    } catch (err) {
      logger.error({ err }, `[rtp-bridge] failed to bridge ${kind} for ${userId}`)
    }
  })

  // Clean up bridged producers when participant leaves
  roomHub.onParticipantRemoved((userId) => {
    const bridged = bridgedProducers.get(userId)
    if (bridged) {
      if (bridged.audio) closeBridgedProducer(bridged.audio)
      if (bridged.video) closeBridgedProducer(bridged.video)
      bridgedProducers.delete(userId)
    }
  })

  const roomSignaling = new RoomSignaling(roomHub, povOrchestrator)

  io.on('connection', (socket) => {
    const clientType = (socket.handshake.auth as { clientType?: string } | undefined)?.clientType
    if (clientType !== 'overlay') return

    socket.on('pov-online:relay:subscribe', () => {
      logger.info('[pov-relay] overlay subscribed')
      roomRelay.createOffer((event, payload) => socket.emit(event, payload))
        .then(() => {
          const activeId = povOrchestrator.activeCameraId
          if (activeId && roomHub.hasParticipant(activeId)) {
            logger.info(`[pov-relay] active camera ${activeId} exists — consuming producers`)
            const bridged = bridgedProducers.get(activeId)
            const videoProducer = bridged?.video?.producer ?? null
            const audioProducer = bridged?.audio?.producer ?? null
            if (videoProducer) {
              roomRelay.switchTo(audioProducer, videoProducer)
                .catch(e => logger.warn({ err: e }, '[pov-relay] initial switchTo failed'))
            }
          } else {
            logger.info('[pov-relay] no active camera with producer — will wait for next offer')
          }
        })
        .catch(e => logger.error({ err: e?.message ?? e, stack: e?.stack }, '[pov-relay] createOffer failed'))
    })
    socket.on('pov-online:relay:answer', async (payload: { dtlsParameters: any }) => {
      try {
        await roomRelay.handleAnswer(payload)
      } catch (err) {
        logger.error({ err }, '[pov-relay] handleAnswer error:')
      }
    })
    socket.on('pov-online:relay:ice', async (_candidate: any) => {
      // mediasoup handles ICE internally — no-op but kept for protocol compat
    })
  })

  roomSignaling.onStatus((status) => io.emit('room:status' as any, status))
  await app.register(roomHttpRoute, { cloudSignaling: roomSignaling, pov: povOrchestrator, hub: roomHub })

  const roomManager = new RoomManager(roomSignaling, povOrchestrator, {
    cloudUrl,
    getToken,
    signalingFactory: () => new RoomSignaling(roomHub, povOrchestrator),
  })

  // mediasoup doesn't need re-offers — Consumers are created from existing Producers
  // onNeedReOffer is kept as no-op for interface compat
  roomRelay.onNeedReOffer = null

  registerRoomNamespace(io, roomManager, roomPreviewRelay)
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
  // Log and exit on uncaught exceptions; let the process manager restart.
  // Exception: mediasoup internal errors are logged but non-fatal when possible.
  process.on('uncaughtException', (err) => {
    const isMediasoupNoise = err.stack?.includes('mediasoup')
    if (isMediasoupNoise) {
      logger.warn({ err }, '[crash] Suppressed mediasoup exception:')
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
    roomRelay.cleanup()
    await roomHub.closeAll()
    msWorker.close()
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