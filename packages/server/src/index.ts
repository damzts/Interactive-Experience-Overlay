import Fastify from 'fastify'
import fastifyCors from '@fastify/cors'
import fastifyHttpProxy from '@fastify/http-proxy'
import fastifyStatic from '@fastify/static'
import fastifyMultipart from '@fastify/multipart'
import { Server as SocketIO } from 'socket.io'
import { existsSync, readdirSync, mkdirSync, createWriteStream } from 'fs'
import { join, dirname, extname } from 'path'
import { pipeline } from 'stream/promises'
import { fileURLToPath } from 'url'
import { SceneMachine } from './state/machine.js'
import { setupSocketHandlers } from './socket/handlers.js'
import { configRoute } from './routes/config.js'
import { mediaRoute } from './routes/media.js'
import { clearMediaCaches } from './services/MediaService.js'
import { archiveRoute } from './routes/archive.js'
import { configService } from './services/ConfigService.js'
import { ObsBridge } from './obs/bridge.js'
import { EventScheduler } from './events/scheduler.js'
import { AmbianceManager } from './ambiance/manager.js'
import { withDesktopAmbianceDefaults } from '@ieom/shared'

const __dirname = dirname(fileURLToPath(import.meta.url))

const PORT = parseInt(process.env.PORT ?? '3000', 10)
const OVERLAY_DEV_UPSTREAM = process.env.IEOM_OVERLAY_DEV_UPSTREAM ?? 'http://localhost:3001'
const IS_DEV_SERVER = process.env.npm_lifecycle_event === 'dev'
// Root of the ieom monorepo (3 levels up: src → server → packages → ieom)
const MONO_ROOT = join(__dirname, '../../..')
// Root of the stream project (one level above ieom/)
const PROJECT_ROOT = join(MONO_ROOT, '..')

const app = Fastify({ logger: { level: 'warn' } })

await app.register(fastifyCors, { origin: '*' })

// Overlay build output is served at / in non-dev runs.
const overlayDist = join(__dirname, '../../overlay/dist')

// Serve admin dist at /admin (only after build)
const adminDist = join(__dirname, '../../admin/dist')
if (existsSync(adminDist)) {
  await app.register(fastifyStatic, {
    root: adminDist,
    prefix: '/admin',
    decorateReply: false,
    wildcard: false,
  })
}

// Serve shared assets (always register — upload endpoint may create the dir on first use)
const assetsDir = join(MONO_ROOT, 'assets')
mkdirSync(assetsDir, { recursive: true })
await app.register(fastifyStatic, {
  root: assetsDir,
  prefix: '/assets',
  decorateReply: false,
})

// Serve scraped game images at the canonical /assets/images/games path.
// Only registers if the assets/images/games folder is empty or missing
// (i.e. not yet symlinked) — avoids prefix collision with the /assets route.
const gamesAssetsDir = join(MONO_ROOT, 'assets/images/games')
const scrapedDir     = join(PROJECT_ROOT, 'imagescrap/output')
const gamesAssetsHasContent = existsSync(gamesAssetsDir)
  && readdirSync(gamesAssetsDir).length > 0

if (!gamesAssetsHasContent && existsSync(scrapedDir)) {
  // assets/images/games is empty or missing — serve scraped images under a
  // separate prefix so the API can reference /media/games URLs.
  await app.register(fastifyStatic, {
    root: scrapedDir,
    prefix: '/media/games',
    decorateReply: false,
    setHeaders: (res) => {
      res.setHeader('Cache-Control', 'public, max-age=86400')
    },
  })
}

// File upload endpoint — saves to ieom/assets/{video|images}/{filename}
await app.register(fastifyMultipart, { limits: { fileSize: 500 * 1024 * 1024 } })
app.post('/api/upload/asset', async (req, reply) => {
  const data = await req.file()
  if (!data) return reply.code(400).send({ error: 'No file' })

  const mime = data.mimetype
  const subfolder = mime.startsWith('video/') ? 'video' : 'images'
  const destDir  = join(MONO_ROOT, 'assets', subfolder)
  mkdirSync(destDir, { recursive: true })

  // Sanitise filename — keep extension, replace path separators
  const safeName = data.filename.replace(/[\\/]/g, '_')
  const destPath = join(destDir, safeName)

  await pipeline(data.file, createWriteStream(destPath))
  clearMediaCaches()
  return reply.send({ url: `/assets/${subfolder}/${safeName}` })
})

// Scene state machine
const machine = new SceneMachine()

// Socket.IO on the same Fastify HTTP server
const io = new SocketIO(app.server, {
  cors: { origin: '*' },
  transports: ['websocket', 'polling'],
})

// Managers for automated behaviors
const scheduler = new EventScheduler(machine, () => configService.get())
const ambianceManager = new AmbianceManager(io, () => configService.get())
const obsBridge = new ObsBridge(io, machine)
let activeObsUrl = configService.get().obs.url
let activeObsPassword = configService.get().obs.password
let activeAmbianceIntervalSeconds = withDesktopAmbianceDefaults(configService.get().desktopAmbiance).widgetSimulation.intervalSeconds

// Socket handlers wire up all managers
setupSocketHandlers(io, machine, scheduler, ambianceManager, {
  getObsStatus: () => obsBridge.getStatus(),
})

// REST routes
await app.register(configRoute, { machine })
await app.register(mediaRoute)
await app.register(archiveRoute, { getObsStatus: () => obsBridge.getStatus() })

// Frontend hosting strategy:
// - `pnpm dev`: proxy overlay HTTP requests from :3000 -> :3001 so OBS can still use :3000.
// - built runs: serve overlay dist directly from the server.
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

// OBS WebSocket bridge (graceful — server works without OBS)
obsBridge.connect(activeObsUrl, activeObsPassword)

machine.on('config:update', (config) => {
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

// Start managers after all handlers are wired
scheduler.start()
ambianceManager.start()

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
