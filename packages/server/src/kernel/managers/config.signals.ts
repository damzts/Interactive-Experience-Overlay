import type { } from '../bus.js'

declare module '../bus.js' {
  interface KernelEvents {
    /** DesktopConfigService persisted a config change */
    'config:changed': { section: string }
  }
}
