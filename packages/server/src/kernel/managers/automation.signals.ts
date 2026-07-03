import type { } from '../bus.js'

declare module '../bus.js' {
  interface KernelEvents {
    /** Automation rules were created/updated/deleted via the HTTP API */
    'automation:rules:changed': { ruleId?: string }
    /** A widget/renderer signal forwarded from the overlay (or minted by a signal:emit action) */
    'widget:signal': { source: string; event: string; payload: unknown }
  }
}
