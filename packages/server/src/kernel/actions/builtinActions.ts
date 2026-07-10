/** Registers the built-in catalog actions (see @ieomlabs/shared's
 *  ACTION_CATALOG) against the action registry. Call registerBuiltinActions()
 *  once at boot, before any event can fire — see desktop-entry.ts.
 *
 *  Each handler surfaces a capability the server already implements
 *  internally (a manager method or an existing socket command) that wasn't
 *  previously reachable from an event's Runtime Actions.
 */
import type { ActionConfigMap, DesktopNotificationPayload, EffectConfig, TransitionPlayPayload } from '@ieomlabs/shared'
import { SYNTHETIC_SIGNAL_KEY } from '@ieomlabs/shared'
import { registerAction } from './registry.js'
import { resolvePipelines } from '../../transport/socket/handlers/scene.js'

type WidgetSignalFrame = { source: string; event: string; payload: unknown }

function parseJsonObject(text: string | undefined): Record<string, unknown> {
  if (!text) return {}
  try {
    const parsed: unknown = JSON.parse(text)
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {}
  } catch {
    return {}
  }
}

export function registerBuiltinActions(): void {
  registerAction('desktop-notify', (ctx, cfg) => {
    const c = cfg as ActionConfigMap['desktop-notify']
    const payload: DesktopNotificationPayload = {
      title: c.title || 'Alert',
      body: c.body ?? '',
      icon: c.icon,
      durationMs: c.durationMs,
    }
    ctx.io.emit('desktop:notify', payload)
  })

  registerAction('signal-emit', (ctx, cfg) => {
    const c = cfg as ActionConfigMap['signal-emit']
    const event = c.event?.trim()
    if (!event) return
    // Marked synthetic so AutomationManager's single-hop guard can refuse to
    // chain a second signal-emit action off of this one (loop protection).
    const payload = { ...parseJsonObject(c.payload), [SYNTHETIC_SIGNAL_KEY]: true }
    const frame: WidgetSignalFrame = { source: 'event', event, payload }
    ctx.bus.emit('widget:signal', frame)
    ctx.io.emit('widget:signal', frame)
  })

  registerAction('obs-virtualcam', (ctx) => {
    void ctx.obsBridge?.toggleVirtualCam()
  })

  registerAction('obs-ensure-overlay-source', (ctx, cfg) => {
    const c = cfg as ActionConfigMap['obs-ensure-overlay-source']
    void ctx.obsBridge?.ensureOverlaySource(c.sourceName, c.width, c.height)
  })

  registerAction('obs-stream', (ctx, cfg) => {
    const c = cfg as ActionConfigMap['obs-stream']
    if (!ctx.obsBridge) return
    if (c.action === 'start') void ctx.obsBridge.startStreaming(c.rtmpUrl, c.streamKey)
    else void ctx.obsBridge.stopStreaming()
  })

  registerAction('scene-change', (ctx, cfg) => {
    const c = cfg as ActionConfigMap['scene-change']
    if (!(ctx.cachedUserConfig.scenes ?? {})[c.target]) return
    const { exit, intro } = resolvePipelines(
      ctx.cachedUserConfig,
      (id) => ctx.configService?.getSequence(id),
      ctx.machine.currentState,
      c.target,
    )
    ctx.machine.transition(c.target, { exit, intro })
  })

  registerAction('transition', (ctx, cfg) => {
    const c = cfg as ActionConfigMap['transition']
    const sequence = c.sequenceId ? ctx.configService?.getSequence(c.sequenceId) : undefined
    if (!sequence) return
    const payload: TransitionPlayPayload = {
      from: ctx.machine.currentState,
      to: ctx.machine.currentState,
      exit: sequence.steps,
      intro: [],
    }
    ctx.io.emit('transition:play', payload)
  })

  registerAction('preset-apply', (ctx, cfg) => {
    const c = cfg as ActionConfigMap['preset-apply']
    // Persisted, not a runtime patch — a preset swap is meant to stick, same
    // as the rest of the config it just overwrote.
    void ctx.configService?.applyPreset(c.presetId)
  })

  registerAction('overlay-trigger', (ctx, cfg) => {
    const c = cfg as ActionConfigMap['overlay-trigger']
    let effects: EffectConfig[]
    try {
      const parsed: unknown = JSON.parse(c.effectsJson)
      effects = Array.isArray(parsed) ? parsed as EffectConfig[] : []
    } catch {
      effects = []
    }
    if (!effects.length) return
    ctx.machine.triggerOverlay({ id: `automation-overlay-${Date.now()}`, effects })
  })

  registerAction('persona-summarize', (ctx) => {
    void ctx.personaBrain?.summarizeNow('manual')
  })

  registerAction('ambiance-clear-history', (ctx) => {
    ctx.ambianceManager.clearHistory()
  })
}
