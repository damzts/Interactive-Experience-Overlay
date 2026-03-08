import type { FastifyInstance } from 'fastify'

/** In-memory archive store for v1. Replace with SQLite queries in v2. */
const stats = {
  wins: 0,
  losses: 0,
  deaths: 0,
  revives: 0,
  sessions: 1,
}

const eventLog: Array<{ id: number; date: string; event: string; detail: string | null }> = []
let logIdCounter = 1

export function appendArchiveEvent(event: string, detail?: string) {
  eventLog.unshift({
    id: logIdCounter++,
    date: new Date().toISOString(),
    event,
    detail: detail ?? null,
  })
  // Keep last 500 entries
  if (eventLog.length > 500) eventLog.splice(500)
}

export async function archiveRoute(app: FastifyInstance) {
  app.get('/api/archive/stats', async () => {
    return { ...stats }
  })

  app.get('/api/archive/log', async () => {
    return eventLog.slice(0, 100)
  })

  app.post<{ Body: { field: keyof typeof stats } }>(
    '/api/archive/increment',
    async (req, reply) => {
      const { field } = req.body
      if (!(field in stats)) return reply.code(400).send({ error: 'Unknown field' })
      stats[field]++
      appendArchiveEvent('increment', `${field}=${stats[field]}`)
      return { ok: true, stats: { ...stats } }
    },
  )

  app.post('/api/archive/reset', async () => {
    Object.assign(stats, { wins: 0, losses: 0, deaths: 0, revives: 0, sessions: 0 })
    eventLog.length = 0
    return { ok: true }
  })

  // OBS connection test endpoint
  app.get('/api/obs/test', async (_req, reply) => {
    // Return current OBS connection state from context — we use the global flag set by the bridge
    // In v1, we just return not-connected since the bridge is a fire-and-forget
    return reply.code(200).send({ connected: false, message: 'Check OBS — bridge auto-reconnects' })
  })
}
