import type { Server, Socket } from 'socket.io'
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
  RuntimeConfigOverridePayload,
  ObsStatusPayload,
} from '@ieomlabs/shared'
import type { AppConfig } from '@ieomlabs/shared'
import type { SceneMachine } from '../../../kernel/managers/scene.js'
import type { EventScheduler } from '../../../kernel/managers/scheduler.js'
import type { AmbianceManager } from '../../../kernel/managers/ambiance.js'
import type { KernelBus } from '../../../kernel/bus.js'
import type { RuntimeStateStore } from '../../../kernel/managers/runtime.js'
import type { IConfigService } from '../../../kernel/managers/config.js'

export type IO = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>
export type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>

/** Shared mutable state owned by setupSocketHandlers, passed by reference into each domain module. */
export interface HandlerContext {
  io: IO
  machine: SceneMachine
  scheduler: EventScheduler
  ambianceManager: AmbianceManager
  runtimeState: RuntimeStateStore
  configService: IConfigService | null
  getObsStatus?: () => ObsStatusPayload
  getManagerStatuses?: () => Record<string, import('@ieomlabs/shared').ManagerStatus>
  bus: KernelBus

  runtimeConfigOverride: RuntimeConfigOverridePayload
  cachedUserConfig: AppConfig

  socketClientTypes: Map<string, 'overlay' | 'admin' | 'unknown'>
}
