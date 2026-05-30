import Fastify from 'fastify'
import fastifyCors from '@fastify/cors'
import fastifyCookie from '@fastify/cookie'
import fastifyHttpProxy from '@fastify/http-proxy'
import fastifyStatic from '@fastify/static'
import fastifyMultipart from '@fastify/multipart'
import { Server as SocketIO } from 'socket.io'
import { existsSync, readdirSync, mkdirSync, createWriteStream } from 'fs'
import { join, dirname } from 'path'
import { pipeline } from 'stream/promises'
import { fileURLToPath } from 'url'

// ── PostgreSQL stack ─────────────────────────────────────────────
import { validateEnvOrExit } from './db/envValidation.js'
import { createPool, verifyPoolConnection, registerPoolShutdown } from './db/pool.js'
import { MigrationRunner } from './db/migrationRunner.js'
import { createTenantRepositories, UserRepository } from './db/repositories/index.js'

// ── Auth ─────────────────────────────────────────────────────────
import { authRoutes } from './auth/authRoutes.js'
import { registerAuthMiddleware } from './auth/authMiddleware.js'
import { registerCsrfGuard } from './auth/csrfMiddleware.js'
import { socketAuthMiddleware } from './auth/socketAuthMiddleware.js'

// ── Services ─────────────────────────────────────────────────────
import { ConfigService } from './services/ConfigService.js'
import { clearMediaCaches } from './services/MediaService.js'

// ── Routes ───────────────────────────────────────────────────────
import { publicRoutes } from './routes/public.js'
import { configRoute } from './routes/config.js'
import { mediaRoute } from './routes/media.js'
import { archiveRoute } from './routes/archive.js'
import { povRoute } from './routes/pov.js'
import { onlineRoute } from './routes/online.js'

// ── Domain modules ───────────────────────────────────────────────
import { SceneMachine } from './state/machine.js'
import { setupSocketHandlers } from './socket/handlers.js'
import { ObsBridge } from './obs/bridge.js'
import { EventScheduler } from './events/scheduler.js'
import { AmbianceManager } from './ambiance/manager.js'
import { DEFAULT_CONFIG, withDesktopAmbianceDefaults } from '@ieom/shared'
import type { AppConfig } from '@ieom/shared'
import { POVOrchestrator } from './pov/index.js'
import { createOnlineMode } from './online/index.js'
import { registerOverlayNamespace } from './socket/overlayHandlers.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ── 1. Validate environment variables ────────────────────────────
validateEnvOrExit()

// ── 2. Create PostgreSQL pool ────────────────────────────────────
const pool = createPool()

// ── 3. Verify pool connection ────────────────────────────────────
await verifyPoolConnection(pool)

// ── 4. Run migrations ────────────────────────────────────────────
const migrationRunner = new MigrationRunner(pool)
await migrationRunner.run()

// ── 5. Instantiate repositories ──────────────────────────────────
const userRepository = new UserRepository(pool)
const repos = createTenantRepositories(pool)

// ── Server configuration ─────────────────────────────────────────
const PORT = parseInt(process.env.PORT ?? '3000', 10)
const OVERLAY_DEV_UPSTREAM = process.env.IEOM_OVERLAY_DEV_UPSTREAM ?? 'http://localhost:3001'
const IS_DEV_SERVER = process.env.npm_lifecycle_event === 'dev'
const MONO_ROOT = join(__dirname, '../../..')
const PROJECT_ROOT = join(MONO_ROOT, '..')

const app = Fastify({ logger: { level: 'warn' } })

await app.register(fastifyCors, { origin: '*' })
await app.register(fastifyCookie)

// ── Static file serving ──────────────────────────────────────────

const overlayDist = join(__dirname, '../../overlay/dist')
const adminDist = join(__dirname, '../../admin/dist')

if (existsSync(adminDist)) {
  await app.register(fastifyStatic, {
    root: adminDist,
    prefix: '/admin',
    decorateReply: false,
    wildcard: false,
  })
}

const assetsDir = join(MONO_ROOT, 'assets')
mkdirSync(assetsDir, { recursive: true })
await app.register(fastifyStatic, {
  root: assetsDir,
  prefix: '/assets',
  decorateReply: false,
})

const gamesAssetsDir = join(MONO_ROOT, 'assets/images/games')
const scrapedDir = join(PROJECT_ROOT, 'imagescrap/output')
const gamesAssetsHasContent = existsSync(gamesAssetsDir)
  && readdirSync(gamesAssetsDir).length > 0

if (!gamesAssetsHasContent && existsSync(scrapedDir)) {
  await app.register(fastifyStatic, {
    root: scrapedDir,
    prefix: '/media/games',
    decorateReply: false,
    setHeaders: (res) => {
      res.setHeader('Cache-Control', 'public, max-age=86400')
    },
  })
}

// ── File upload endpoint ─────────────────────────────────────────
await app.register(fastifyMultipart, { limits: { fileSize: 500 * 1024 * 1024 } })
app.post('/api/upload/asset', async (req, reply) => {
  const data = await req.file()
  if (!data) return reply.code(400).send({ error: 'No file' })

  const mime = data.mimetype
  const subfolder = mime.startsWith('video/') ? 'video' : 'images'
  const destDir = join(MONO_ROOT, 'assets', subfolder)
  mkdirSync(destDir, { recursive: true })

  const safeName = data.filename.replace(/[\\/]/g, '_')
  const destPath = join(destDir, safeName)

  await pipeline(data.file, createWriteStream(destPath))
  clearMediaCaches()
  return reply.send({ url: `/assets/${subfolder}/${safeName}` })
})

// ── Socket.IO server ─────────────────────────────────────────────
const io = new SocketIO(app.server, {
  cors: { origin: '*' },
  transports: ['websocket', 'polling'],
})

// ── 6. Instantiate ConfigService with repos and Socket.IO ────────
const configService = new ConfigService(repos, { io })

// ── Scene state machine ──────────────────────────────────────────
const machine = new SceneMachine()

// ── Managers for automated behaviors ─────────────────────────────
// Note: In multi-tenant mode, these managers will be refactored to work per-user.
// For now, they use DEFAULT_CONFIG as a placeholder until the config is loaded.
let cachedConfig: AppConfig = DEFAULT_CONFIG
const scheduler = new EventScheduler(machine, () => cachedConfig)
const ambianceManager = new AmbianceManager(io, () => cachedConfig)
const obsBridge = new ObsBridge(io, machine)

// ── Socket handlers ──────────────────────────────────────────────
setupSocketHandlers(io, machine, scheduler, ambianceManager, {
  getObsStatus: () => obsBridge.getStatus(),
  configService,
})

// ── 10. Apply socketAuthMiddleware to the default namespace ──────
io.use(socketAuthMiddleware)

// ── 7. Register auth routes ──────────────────────────────────────
await app.register(authRoutes, { userRepository })

// ── 8. Apply auth middleware to protected routes ─────────────────
registerAuthMiddleware(app)
registerCsrfGuard(app)

// ── 9. Register public routes ────────────────────────────────────
await app.register(publicRoutes, { userRepo: userRepository })

// ── REST routes ──────────────────────────────────────────────────
await app.register(configRoute, { machine, configService })
await app.register(mediaRoute)
await app.register(archiveRoute, { getObsStatus: () => obsBridge.getStatus() })

// ── POV Orchestrator and routes ──────────────────────────────────
const povOrchestrator = new POVOrchestrator({
  io,
  povConfigRepo: repos.povConfig,
  povFeedsRepo: repos.povFeeds,
})
await app.register(povRoute, { orchestrator: povOrchestrator, povFeedsRepo: repos.povFeeds, io, configService })

// ── Online mode orchestrator ─────────────────────────────────────
const onlineOrchestrator = await createOnlineMode({ io, onlineConfigRepo: repos.onlineConfig })
await app.register(onlineRoute, {
  onlineConfigRepo: repos.onlineConfig,
  sessionManager: onlineOrchestrator.sessionManager,
  io,
  onlineOrchestrator,
})

// ── 11. Register overlay namespace ───────────────────────────────
registerOverlayNamespace(io)

// ── Frontend hosting strategy ────────────────────────────────────
if (IS_DEV_SERVER) {
  await app.register(fastifyHttpProxy, {
    upstream: OVERLAY_DEV_UPSTREAM,
    httpMethods: ['GET', 'HEAD'],
  })
} else if (existsSync(overlayDist)) {
  await app.register(fastifyStatic, {
    root: overlayDist,
    prefix: '/',
    wildcard: false,
  })
} else {
  app.get('/', async (_req, reply) => {
    return reply.code(200).type('text/html').send(`
      <html><body style="background:#111;color:#0f0;font-family:monospace;padding:2rem">
        <h2>IEOM Server running — overlay not built yet</h2>
        <p>Run <code>pnpm dev</code> to proxy the live overlay through <a href="http://localhost:3000" style="color:#0ff">http://localhost:3000</a>, or run <code>pnpm build</code> for a static build.</p>
        <p>Direct overlay dev server: <a href="http://localhost:3001" style="color:#0ff">http://localhost:3001</a></p>
        <p>Admin panel: <a href="http://localhost:3002" style="color:#0ff">http://localhost:3002</a></p>
      </body></html>`)
  })
}

// ── OBS WebSocket bridge ─────────────────────────────────────────
// Note: In multi-tenant mode, OBS config will be per-user. For now, use defaults.
const defaultObsUrl = process.env.OBS_URL ?? 'ws://localhost:4455'
const defaultObsPassword = process.env.OBS_PASSWORD ?? ''
let activeObsUrl = defaultObsUrl
let activeObsPassword = defaultObsPassword
let activeAmbianceIntervalSeconds = withDesktopAmbianceDefaults(DEFAULT_CONFIG.desktopAmbiance).widgetSimulation.intervalSeconds

obsBridge.connect(activeObsUrl, activeObsPassword)

machine.on('config:update', (config) => {
  // Update the cached config for managers
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

// ── Start managers ───────────────────────────────────────────────
scheduler.start()
ambianceManager.start()

// Start POV system (graceful — server works without POV cameras)
void povOrchestrator.start(activeObsUrl, activeObsPassword).catch((err) => {
  console.warn(`[pov] Failed to start POV system: ${err instanceof Error ? err.message : String(err)}`)
})

// ── 12. Register graceful shutdown for pool ──────────────────────
registerPoolShutdown(pool)

// ── Start server ─────────────────────────────────────────────────
await app.listen({ port: PORT, host: '0.0.0.0' })

console.log(`
╔═══════════════════════════════════════════╗
║   IEOM — Interactive Experience Overlay   ║
╠═══════════════════════════════════════════╣
║  Overlay →  http://localhost:${PORT}          ║
║  Admin   →  http://localhost:3002          ║
║  Dev UI  →  http://localhost:3001          ║
╚═══════════════════════════════════════════╝
`)
