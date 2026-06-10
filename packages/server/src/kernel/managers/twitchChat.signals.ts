import type { } from '../bus.js'

declare module '../bus.js' {
  interface KernelEvents {
    'chat:message': {
      user: string
      text: string
      color: string
      badges: string[]
      channel: string
      source: 'twitch' | 'simulation'
    }
    'chat:connected': { channel: string }
  }
}
