import type { } from '../bus.js'

declare module '../bus.js' {
  interface KernelEvents {
    /** AmbianceManager wants to trigger a widget action */
    'ambiance:tick': { widgetId: string; action: 'open' | 'close' | 'interact' | 'select' }
  }
}
