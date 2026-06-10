import type { } from '../bus.js'

declare module '../bus.js' {
  interface KernelEvents {
    'obs:stream:started':    Record<string, never>
    'obs:stream:stopped':    Record<string, never>
    'obs:recording:started': Record<string, never>
    'obs:recording:stopped': Record<string, never>
    'obs:virtualcam:changed': { active: boolean }
  }
}
