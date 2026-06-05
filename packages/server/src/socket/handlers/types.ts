import type { Server, Socket } from 'socket.io'
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
  RuntimeConfigOverridePayload,
  OverlayClientDiagnostics,
  ObsStatusPayload,
} from '@ieom/shared'
import type { AppConfig } from '@ieom/shared'
import type { SceneMachine } from '../../state/machine.js'
import type { EventScheduler } from '../../events/scheduler.js'
import type { AmbianceManager } from '../../ambiance/manager.js'

export type IO = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>
export type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>

/** Shared mutable state owned by setupSocketHandlers, passed by reference into each domain module. */
export interface HandlerContext {
  io: IO
  machine: SceneMachine
  scheduler: EventScheduler
  ambianceManager: AmbianceManager
  configService: any | null
  getObsStatus?: () => ObsStatusPayload

  // Runtime state — mutated by domain handlers
  openWidgetIds: Set<string>
  recycleBinFull: boolean
  startMenuState: { open: boolean; activeRoot: 'programs' | 'widget-layouts' | null }
  runtimeConfigOverride: RuntimeConfigOverridePayload
  cachedUserConfig: AppConfig

  // Overlay slot state
  overlaySocketId: string | null
  overlayClientInfo: OverlayClientDiagnostics | null
  socketClientTypes: Map<string, 'overlay' | 'admin' | 'unknown'>

  // Ambiance simulation leader
  simulationLeaderSocketId: string | null
  acceptedSimulatedToggles: number
  rejectedSimulatedToggles: number
}
