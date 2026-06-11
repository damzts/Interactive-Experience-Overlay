import type { FastifyInstance } from 'fastify'
import type { BusHistoryRecorder } from '../../kernel/BusHistoryRecorder.js'

export async function busHistoryRoute(
  app: FastifyInstance,
  opts: { recorder: BusHistoryRecorder },
): Promise<void> {
  const { recorder } = opts

  app.get('/api/diagnostics/bus-history', async (req) => {
    const query = req.query as { since?: string; limit?: string }
    const sinceSeq = query.since !== undefined ? parseInt(query.since, 10) : undefined
    const limit = query.limit !== undefined ? parseInt(query.limit, 10) : undefined

    let frames = sinceSeq !== undefined ? recorder.since(sinceSeq) : recorder.snapshot()
    if (limit !== undefined && Number.isFinite(limit)) frames = frames.slice(-limit)

    return { frames }
  })
}
