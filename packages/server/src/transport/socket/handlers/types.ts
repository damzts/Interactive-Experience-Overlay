import type { Server, Socket } from 'socket.io'
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
  RuntimeConfig,
  ObsStatusPayload,
} from '@ieomlabs/shared'
import type { AppConfig } from '@ieomlabs/shared'
import type { SceneManager } from '../../../kernel/managers/scene.js'
import type { EventScheduler } from '../../../kernel/managers/scheduler.js'
import type { AmbianceManager } from '../../../kernel/managers/ambiance.js'
import type { KernelBus } from '../../../kernel/bus.js'
import type { RuntimeStateStore } from '../../../kernel/managers/runtime.js'
import type { IConfigService } from '../../../kernel/managers/config.js'
import type { ObsBridgeManager } from '../../../kernel/managers/obs.js'

export type IO = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>
export type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>

/** Shared mutable state owned by setupSocketHandlers, passed by reference into each domain module. */
export interface HandlerContext {
  io: IO
  machine: SceneManager
  scheduler: EventScheduler
  ambianceManager: AmbianceManager
  runtimeState: RuntimeStateStore
  configService: IConfigService | null
  getObsStatus?: () => ObsStatusPayload
  getManagerStatuses?: () => Record<string, import('@ieomlabs/shared').ManagerStatus>
  bus: KernelBus
  obsBridge?: ObsBridgeManager

  runtimeConfig: RuntimeConfig
  cachedUserConfig: AppConfig

  socketClientTypes: Map<string, 'overlay' | 'admin' | 'unknown'>

  /** Last render-performance sample from the connected overlay (RAM-only). */
  lastOverlayPerf?: import('@ieomlabs/shared').OverlayPerfPayload | null

  /** Persona brain surface (streamer console + manual summaries) — a narrow
   *  interface instead of the whole PersonaManager to keep handlers decoupled. */
  personaBrain?: {
    converse(text: string): Promise<string | null>
    summarizeNow(reason: 'manual' | 'interval'): Promise<string | null>
  }

  /** Twitch outbound-chat surface — a narrow interface instead of the whole
   *  TwitchIntegrationManager to keep handlers decoupled. sendMessage()
   *  no-ops (returns false) when IRC isn't connected with an authenticated
   *  (chat:edit-scoped) token. */
  twitchChat?: {
    sendMessage(text: string): boolean
  }
}
