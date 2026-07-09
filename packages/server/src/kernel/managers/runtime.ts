import { STATE } from '@ieomlabs/shared'
import type { Manager, ManagerStatus } from '@ieomlabs/shared'

export interface WidgetRuntimeState {
  openWidgetIds: ReadonlySet<string>
  presentation: Record<string, unknown>
}

export interface OverlayRuntimeState {
  currentScene: STATE
  transitionInProgress: boolean
  overlayConnected: boolean
  ambianceLeaderSocketId: string | null
}

export interface RuntimeStateSnapshot {
  widget: WidgetRuntimeState
  overlay: OverlayRuntimeState
  capturedAt: number
}

export class RuntimeStateStore implements Manager {
  readonly name = 'RuntimeStateStore'
  private _managerStatus: ManagerStatus = 'idle'

  init(): void { this._managerStatus = 'idle' }
  start(): void { this._managerStatus = 'running' }
  stop(): void { this._managerStatus = 'stopped' }
  dispose(): void { this._managerStatus = 'stopped' }
  status(): ManagerStatus { return this._managerStatus }

  private _currentScene: STATE = STATE.DESKTOP
  private _transitionInProgress = false
  private _overlayConnected = false
  private _overlaySocketId: string | null = null
  private _ambianceLeaderSocketId: string | null = null
  private _openWidgetIds = new Set<string>()
  private _presentationState = new Map<string, unknown>()
  private _acceptedSimulatedToggles = 0
  private _rejectedSimulatedToggles = 0

  // ── Scene ─────────────────────────────────────────────────────

  get currentScene(): STATE { return this._currentScene }
  setCurrentScene(s: STATE): void { this._currentScene = s }

  get transitionInProgress(): boolean { return this._transitionInProgress }
  setTransitionInProgress(v: boolean): void { this._transitionInProgress = v }

  // ── Overlay connection ────────────────────────────────────────

  get overlayConnected(): boolean { return this._overlayConnected }
  setOverlayConnected(v: boolean): void { this._overlayConnected = v }

  get overlaySocketId(): string | null { return this._overlaySocketId }
  setOverlaySocketId(id: string | null): void { this._overlaySocketId = id }

  get ambianceLeaderSocketId(): string | null { return this._ambianceLeaderSocketId }
  setAmbianceLeaderSocketId(id: string | null): void { this._ambianceLeaderSocketId = id }

  // ── Widget state ──────────────────────────────────────────────

  get openWidgetIds(): ReadonlySet<string> { return this._openWidgetIds }

  openWidget(id: string): void { this._openWidgetIds.add(id) }
  closeWidget(id: string): void { this._openWidgetIds.delete(id) }
  toggleWidget(id: string): void {
    if (this._openWidgetIds.has(id)) this._openWidgetIds.delete(id)
    else this._openWidgetIds.add(id)
  }
  syncOpenWidgets(ids: string[]): void {
    this._openWidgetIds.clear()
    for (const id of ids) this._openWidgetIds.add(id)
  }

  /** Latest client-reported presentation facts (opaque to the kernel). */
  get presentationState(): Record<string, unknown> {
    return Object.fromEntries(this._presentationState)
  }
  setPresentationState(key: string, value: unknown): void {
    this._presentationState.set(key, value)
  }

  // ── Simulation metrics ────────────────────────────────────────

  get acceptedSimulatedToggles(): number { return this._acceptedSimulatedToggles }
  get rejectedSimulatedToggles(): number { return this._rejectedSimulatedToggles }

  incrementAccepted(): void { this._acceptedSimulatedToggles++ }
  incrementRejected(): void { this._rejectedSimulatedToggles++ }
  resetSimulationMetrics(): void { this._acceptedSimulatedToggles = 0; this._rejectedSimulatedToggles = 0 }

  // ── Snapshot ──────────────────────────────────────────────────

  snapshot(): RuntimeStateSnapshot {
    return {
      widget: {
        openWidgetIds: new Set(this._openWidgetIds),
        presentation: this.presentationState,
      },
      overlay: {
        currentScene: this._currentScene,
        transitionInProgress: this._transitionInProgress,
        overlayConnected: this._overlayConnected,
        ambianceLeaderSocketId: this._ambianceLeaderSocketId,
      },
      capturedAt: Date.now(),
    }
  }
}
