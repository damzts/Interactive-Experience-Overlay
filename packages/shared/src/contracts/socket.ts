/**
 * Socket.IO event contract — backward-compatible re-export.
 *
 * The event maps are split into focused files for clarity:
 *   signals.ts  — Kernel → Userspace (directives to render)
 *   commands.ts — Userspace → Kernel (requests to act)
 *   queries.ts  — Request/response pairs (snapshots, diagnostics)
 *
 * Import from here for the combined maps, or import from the specific
 * file when you only need one direction.
 */

export * from './signals.js'
export * from './commands.js'
export * from './queries.js'

export interface InterServerEvents {}
export interface SocketData {
  userId?: string
}
