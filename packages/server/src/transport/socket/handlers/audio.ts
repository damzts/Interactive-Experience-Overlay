import type { AudioBeatPayload, AudioEnergyPayload, AudioLevelPayload } from '@ieomlabs/shared'
import type { HandlerContext, AppSocket } from './types.js'

/**
 * Audio reactivity — the overlay detects beats/energy/silence client-side
 * (it owns the AudioContext/analyser) and reports them here. Only the overlay
 * socket may report these, mirroring the ambiance/widget simulation guards —
 * this prevents any other connected client from spoofing audio signals.
 * Forwarding onto the KernelBus promotes them to first-class kernel signals
 * (see KernelSignalMap in signals.ts): AutomationManager's bus.onAny() picks
 * them up for free, same as a manager-originated event like twitch:follow.
 */
export function registerAudioHandlers(ctx: HandlerContext, socket: AppSocket): void {
  socket.on('audio:beat', (payload: AudioBeatPayload) => {
    if (socket.id !== ctx.runtimeState.overlaySocketId) return
    ctx.bus.emit('audio:beat', payload)
  })

  socket.on('audio:energy:high', (payload: AudioEnergyPayload) => {
    if (socket.id !== ctx.runtimeState.overlaySocketId) return
    ctx.bus.emit('audio:energy:high', payload)
  })

  socket.on('audio:energy:low', (payload: AudioEnergyPayload) => {
    if (socket.id !== ctx.runtimeState.overlaySocketId) return
    ctx.bus.emit('audio:energy:low', payload)
  })

  socket.on('audio:silence', () => {
    if (socket.id !== ctx.runtimeState.overlaySocketId) return
    ctx.bus.emit('audio:silence', {})
  })

  // Live VU meter feed for the Admin Audio panel — a raw passthrough, NOT
  // promoted onto the KernelBus (unlike beat/energy/silence above). It's a
  // ~10Hz continuous telemetry stream for a UI meter, not a discrete event
  // automation rules should be able to trigger on.
  socket.on('audio:level', (payload: AudioLevelPayload) => {
    if (socket.id !== ctx.runtimeState.overlaySocketId) return
    ctx.io.emit('audio:level', payload)
  })
}
