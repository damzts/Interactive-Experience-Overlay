import type { } from '../bus.js'

declare module '../bus.js' {
  interface KernelEvents {
    /** Automation rules were created/updated/deleted via the HTTP API */
    'automation:rules:changed': { ruleId?: string }
  }
}
