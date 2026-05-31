/**
 * @ieom/server — self-hosted desktop server.
 * This is a lightweight socket bridge for overlay visual updates.
 * No auth, no PostgreSQL, no cloud features.
 * See desktop-entry.ts for the full implementation.
 */
export { createDesktopServer } from './desktop-entry.js'
export type { DesktopServer, DesktopServerOptions } from './desktop-entry.js'
