/**
 * Room routes — allows the desktop app (or admin UI) to tell the server
 * to join/leave a cloud room as the hub, and control active camera / switch mode.
 */

import type { FastifyInstance, FastifyPluginOptions } from 'fastify'
import type { SwitchMode } from '@ieom/shared'
import type { CloudSignaling } from '../webrtc/cloud-signaling.js'
import type { POVOrchestrator } from '../../kernel/managers/pov.js'

interface RoomRouteOptions extends FastifyPluginOptions {
  cloudSignaling: CloudSignaling
  pov?: POVOrchestrator
}

export async function roomRoute(app: FastifyInstance, opts: RoomRouteOptions) {
  const { cloudSignaling, pov } = opts

  // ── Cloud join / leave / status ────────────────────────────────

  app.post<{ Body: { cloudUrl: string; token: string; roomId: string } }>('/api/room/join', async (req, reply) => {
    const { cloudUrl, token, roomId } = req.body ?? {}
    if (!cloudUrl || !token || !roomId) {
      return reply.code(400).send({ ok: false, error: 'missing_params' })
    }
    await cloudSignaling.connect({ cloudUrl, token, roomId })
    return { ok: true }
  })

  app.post('/api/room/leave', async () => {
    cloudSignaling.disconnect()
    return { ok: true }
  })

  app.get('/api/room/status', async () => {
    const status = cloudSignaling.getStatus()
    return {
      connected: status.connected,
      participants: status.participants,
      roomId: status.roomId,
    }
  })

  // ── Camera switch control ────────────────────────────────────

  /** Pin camera to a specific participant (manual override) */
  app.post<{ Params: { userId: string } }>('/api/camera/select/:userId', async (req, reply) => {
    if (!pov) return reply.code(503).send({ ok: false, error: 'pov_unavailable' })
    const result = pov.switcher.manualSelect(req.params.userId)
    return reply.code(result.ok ? 200 : 400).send(result)
  })

  /** Set switch mode: automatic | manual | disabled */
  app.post<{ Body: { mode: SwitchMode } }>('/api/camera/mode', async (req, reply) => {
    if (!pov) return reply.code(503).send({ ok: false, error: 'pov_unavailable' })
    const { mode } = req.body ?? {}
    if (!['automatic', 'manual'].includes(mode)) {
      return reply.code(400).send({ ok: false, error: 'invalid_mode' })
    }
    pov.switcher.setMode(mode)
    return { ok: true, mode: pov.switcher.mode }
  })

  /** Get current camera state */
  app.get('/api/camera/status', async (_req, reply) => {
    if (!pov) return reply.code(503).send({ ok: false, error: 'pov_unavailable' })
    return {
      mode: pov.switcher.mode,
      activeCameraId: pov.switcher.activeCameraId,
    }
  })

  /** Update POV orchestrator config (weights, thresholds, etc.) */
  app.post<{ Body: { motionWeight?: number; cooldownMs?: number; activityThreshold?: number; silenceThreshold?: number } }>('/api/camera/config', async (req, reply) => {
    if (!pov) return reply.code(503).send({ ok: false, error: 'pov_unavailable' })
    const cfg = req.body ?? {}
    if (cfg.motionWeight !== undefined) pov.motionWeight = cfg.motionWeight
    if (cfg.cooldownMs !== undefined || cfg.activityThreshold !== undefined || cfg.silenceThreshold !== undefined) {
      pov.switcher.updateConfig({
        cooldownMs: cfg.cooldownMs,
        activityThreshold: cfg.activityThreshold,
        silenceThreshold: cfg.silenceThreshold,
      })
    }
    return { ok: true }
  })
}
