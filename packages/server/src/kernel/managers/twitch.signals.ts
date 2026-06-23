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
    'twitch:eventsub:connected': { sessionId: string }
    'twitch:follow': { user: string; userId: string }
    'twitch:subscribe': { user: string; userId: string; tier: string; isGift: boolean }
    'twitch:gift-sub': { gifter: string; gifterId: string; tier: string; total: number; cumulative?: number }
    'twitch:cheer': { user: string; userId?: string; bits: number; message: string; isAnonymous: boolean }
    'twitch:raid': { from: string; fromId: string; viewers: number }
    'twitch:points:redemption': { user: string; userId: string; rewardId: string; rewardTitle: string; input: string }
    'twitch:stream:online': { startedAt: string }
    'twitch:stream:offline': Record<string, never>
    'twitch:hype-train:begin': { level: number; total: number; goal: number }
    'twitch:hype-train:end': { level: number; total: number }
  }
}
