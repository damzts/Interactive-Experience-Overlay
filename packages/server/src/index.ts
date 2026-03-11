import Fastify from 'fastify'
import fastifyCors from '@fastify/cors'
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
import { archiveRoute } from './routes/archive.js'
import { ObsBridge } from './obs/bridge.js'
import { EventScheduler } from './events/scheduler.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

const PORT = parseInt(process.env.PORT ?? '3000', 10)
// Root of the ieom monorepo (3 levels up: src → server → packages → ieom)
const MONO_ROOT = join(__dirname, '../../..')
// Root of the stream project (one level above ieom/)
const PROJECT_ROOT = join(MONO_ROOT, '..')

const app = Fastify({ logger: { level: 'warn' } })

await app.register(fastifyCors, { origin: '*' })

// Serve overlay dist at / (only after build)
const overlayDist = join(__dirname, '../../overlay/dist')
if (existsSync(overlayDist)) {
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
        <p>Run <code>pnpm build</code> to build the overlay, or access overlay at <a href="http://localhost:3001" style="color:#0ff">http://localhost:3001</a> in dev mode.</p>
        <p>Admin panel: <a href="http://localhost:3002" style="color:#0ff">http://localhost:3002</a> in dev mode.</p>
      </body></html>`)
  })
}

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
  return reply.send({ url: `/assets/${subfolder}/${safeName}` })
})

// Scene state machine
const machine = new SceneMachine()

// Socket.IO on the same Fastify HTTP server
const io = new SocketIO(app.server, {
  cors: { origin: '*' },
  transports: ['websocket', 'polling'],
})

// Auto-event scheduler — created before socket handlers so it can be passed in
const scheduler = new EventScheduler(io, machine)

// Socket handlers receive scheduler reference so scene:change resets idle timer
setupSocketHandlers(io, machine, scheduler)

// REST routes
await app.register(configRoute, { machine })
await app.register(mediaRoute)
await app.register(archiveRoute)

// OBS WebSocket bridge (graceful — server works without OBS)
const obsBridge = new ObsBridge(io, machine)
obsBridge.connect()

// Start scheduler after all handlers are wired
scheduler.start()

await app.listen({ port: PORT, host: '0.0.0.0' })

console.log(`
╔═══════════════════════════════════════════╗
║   IEOM — Interactive Experience Overlay   ║
╠═══════════════════════════════════════════╣
║  Server  →  http://localhost:${PORT}          ║
║  Admin   →  http://localhost:3002 (dev)   ║
╚═══════════════════════════════════════════╝
`)
