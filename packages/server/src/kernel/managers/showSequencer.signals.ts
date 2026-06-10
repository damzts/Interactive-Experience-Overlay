import type { } from '../bus.js'

declare module '../bus.js' {
  interface KernelEvents {
    'show:step': { showId: string; stepIndex: number; label: string }
  }
}
