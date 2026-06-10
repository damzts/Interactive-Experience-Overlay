import type { EventConfig } from '@ieomlabs/shared'
import type { } from '../bus.js'

declare module '../bus.js' {
  interface KernelEvents {
    /** EventScheduler fired an event */
    'scheduler:fired': { eventId: string; event: EventConfig }
  }
}
