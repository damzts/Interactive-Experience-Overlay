import type { } from '../bus.js'

declare module '../bus.js' {
  interface KernelEvents {
    /** A manager (currently: PersonaManager, when brain.postRepliesToChat is
     *  on) wants a message posted to Twitch chat. TwitchIntegrationManager
     *  subscribes and calls its own sendMessage() — kept event-based rather
     *  than a direct manager reference so managers stay decoupled. No-ops
     *  when IRC isn't connected with an authenticated (chat:edit-scoped)
     *  token. Never forwarded to clients (manager-private). */
    'twitch:chat:send': { text: string }
  }
}
