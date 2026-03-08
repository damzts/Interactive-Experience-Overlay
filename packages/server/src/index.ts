import Fastify from 'fastify'
import fastifyCors from '@fastify/cors'
import fastifyStatic from '@fastify/static'
import { Server as SocketIO } from 'socket.io'
import { existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { SceneMachine } from './state/machine.js'
import { setupSocketHandlers } from './socket/handlers.js'
import { configRoute } from './routes/config.js'
import { mediaRoute } from './routes/media.js'
import { archiveRoute } from './routes/archive.js'
import { ObsBridge } from './obs/bridge.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

const PORT = parseInt(process.env.PORT ?? '3000', 10)
// Root of the ieom monorepo (4 levels up from packages/server/src/)
const MONO_ROOT = join(__dirname, '../../../..')
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

// Serve shared assets
const assetsDir = join(MONO_ROOT, 'assets')
if (existsSync(assetsDir)) {
  await app.register(fastifyStatic, {
    root: assetsDir,
    prefix: '/assets',
    decorateReply: false,
  })
}

// Serve scraped game images
const scrapedDir = join(PROJECT_ROOT, 'imagescrap/output')
if (existsSync(scrapedDir)) {
  await app.register(fastifyStatic, {
    root: scrapedDir,
    prefix: '/media/games',
    decorateReply: false,
    setHeaders: (res) => {
      res.setHeader('Cache-Control', 'public, max-age=86400')
    },
  })
}

// Scene state machine
const machine = new SceneMachine()

// Socket.IO on the same Fastify HTTP server
const io = new SocketIO(app.server, {
  cors: { origin: '*' },
  transports: ['websocket', 'polling'],
})

setupSocketHandlers(io, machine)

// REST routes
await app.register(configRoute, { machine })
await app.register(mediaRoute)
await app.register(archiveRoute)

// OBS WebSocket bridge (graceful — server works without OBS)
const obsBridge = new ObsBridge(io, machine)
obsBridge.connect()

await app.listen({ port: PORT, host: '0.0.0.0' })

console.log(`
╔═══════════════════════════════════════════╗
║   IEOM — Interactive Experience Overlay   ║
╠═══════════════════════════════════════════╣
║  Server  →  http://localhost:${PORT}          ║
║  Overlay →  http://localhost:3001 (dev)   ║
║  Admin   →  http://localhost:3002 (dev)   ║
╚═══════════════════════════════════════════╝
`)
