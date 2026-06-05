/**
 * In-memory runtime state store.
 *
 * Separates live, ephemeral state (current scene, open widgets, ambiance state,
 * transition in-progress) from SQLite-persisted configuration.
 *
 * Rule: if state survives a server restart, it belongs in SQLite (DesktopConfigService).
 *       if it's live-session state, it belongs here.
 *
 * The HandlerContext openWidgetIds, recycleBinFull, startMenuState already live in memory
 * inside setupSocketHandlers. This store makes that state accessible outside the socket
 * handler closure — e.g. for HTTP routes that need to read current runtime state.
 */

import { STATE } from '@ieom/shared'

export interface WidgetRuntimeState {
  openWidgetIds: ReadonlySet<string>
  recycleBinFull: boolean
  startMenuOpen: boolean
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

export class RuntimeStateStore {
  private _currentScene: STATE = STATE.DESKTOP
  private _transitionInProgress = false
  private _overlayConnected = false
  private _ambianceLeaderSocketId: string | null = null
  private _openWidgetIds = new Set<string>()
  private _recycleBinFull = false
  private _startMenuOpen = false

  // ── Scene ─────────────────────────────────────────────────────

  get currentScene(): STATE { return this._currentScene }
  setCurrentScene(s: STATE): void { this._currentScene = s }

  get transitionInProgress(): boolean { return this._transitionInProgress }
  setTransitionInProgress(v: boolean): void { this._transitionInProgress = v }

  // ── Overlay connection ────────────────────────────────────────

  get overlayConnected(): boolean { return this._overlayConnected }
  setOverlayConnected(v: boolean): void { this._overlayConnected = v }

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

  get recycleBinFull(): boolean { return this._recycleBinFull }
  setRecycleBinFull(v: boolean): void { this._recycleBinFull = v }

  get startMenuOpen(): boolean { return this._startMenuOpen }
  setStartMenuOpen(v: boolean): void { this._startMenuOpen = v }

  // ── Snapshot ──────────────────────────────────────────────────

  snapshot(): RuntimeStateSnapshot {
    return {
      widget: {
        openWidgetIds: new Set(this._openWidgetIds),
        recycleBinFull: this._recycleBinFull,
        startMenuOpen: this._startMenuOpen,
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
