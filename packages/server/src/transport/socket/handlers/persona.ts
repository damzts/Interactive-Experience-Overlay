/**
 * Persona brain handlers — the streamer's side of the conversation.
 * Admin-only: the console and manual summaries are operator controls;
 * the resulting speech reaches the overlay via the persona:speak signal.
 */
import type { HandlerContext, AppSocket } from './types.js'

export function registerPersonaHandlers(ctx: HandlerContext, socket: AppSocket): void {
  socket.on('persona:console', (payload, callback) => {
    if (typeof callback !== 'function') return
    if (ctx.socketClientTypes.get(socket.id) !== 'admin') { callback(null); return }
    const text = typeof payload?.text === 'string' ? payload.text.trim() : ''
    if (!text || !ctx.personaBrain) { callback(null); return }
    void ctx.personaBrain.converse(text).then(
      (reply) => callback(reply),
      () => callback(null),
    )
  })

  socket.on('persona:summarize', (callback) => {
    if (ctx.socketClientTypes.get(socket.id) !== 'admin') {
      if (callback) callback('Only admin clients can trigger a summary')
      return
    }
    if (!ctx.personaBrain) {
      if (callback) callback('Persona brain unavailable')
      return
    }
    void ctx.personaBrain.summarizeNow('manual').then(
      (summary) => { if (callback) callback(summary ? null : 'No summary produced — brain disabled, no recent chat, or the LLM failed') },
      () => { if (callback) callback('Summary failed') },
    )
  })
}
