import type { WidgetSimulationIntentPayload } from '@ieomlabs/shared'

const WIDGET_SIMULATION_INTENT_EVENT = 'ieom:widget-simulation-intent'

export function dispatchWidgetSimulationIntent(payload: WidgetSimulationIntentPayload) {
  window.dispatchEvent(new CustomEvent<WidgetSimulationIntentPayload>(WIDGET_SIMULATION_INTENT_EVENT, {
    detail: payload,
  }))
}

export function addWidgetSimulationIntentListener(listener: (payload: WidgetSimulationIntentPayload) => void) {
  const handler = (event: Event) => {
    const detail = (event as CustomEvent<WidgetSimulationIntentPayload>).detail
    if (!detail) return
    listener(detail)
  }

  window.addEventListener(WIDGET_SIMULATION_INTENT_EVENT, handler as EventListener)
  return () => {
    window.removeEventListener(WIDGET_SIMULATION_INTENT_EVENT, handler as EventListener)
  }
}

// ── Widget signal bus (IPC: widget → kernel reactive chain router) ──────────

const WIDGET_SIGNAL_EVENT = 'ieom:widget-signal'

export interface WidgetSignalDetail {
  /** appId of the emitting widget instance */
  source: string
  /** Event name matching a WidgetSignalDescriptor (e.g. 'music:track-changed') */
  event: string
  payload?: unknown
}

/** Emit a signal from a widget into the DOM bus. useSocket forwards this to the kernel. */
export function dispatchWidgetSignal(detail: WidgetSignalDetail) {
  window.dispatchEvent(new CustomEvent<WidgetSignalDetail>(WIDGET_SIGNAL_EVENT, { detail }))
}

/** Listen to widget signals on the DOM bus. Returns a cleanup function. */
export function addWidgetSignalListener(listener: (detail: WidgetSignalDetail) => void): () => void {
  const handler = (e: Event) => {
    const detail = (e as CustomEvent<WidgetSignalDetail>).detail
    if (detail) listener(detail)
  }
  window.addEventListener(WIDGET_SIGNAL_EVENT, handler as EventListener)
  return () => window.removeEventListener(WIDGET_SIGNAL_EVENT, handler as EventListener)
}

// ── Widget chain action bus (kernel → overlay for open/close/toggle chains) ─

const WIDGET_CHAIN_ACTION_EVENT = 'ieom:widget-chain-action'

export interface WidgetChainActionDetail {
  targetWidgetId: string
  action: string
  sourceSignal?: unknown
}

/**
 * Dispatch a chain-triggered action directly on the DOM bus.
 * Used by useSocket when a reactive chain with a custom action matches —
 * no kernel involvement, no type cast needed.
 */
export function dispatchWidgetChainAction(detail: WidgetChainActionDetail) {
  window.dispatchEvent(new CustomEvent<WidgetChainActionDetail>(WIDGET_CHAIN_ACTION_EVENT, { detail }))
}

export function addWidgetChainActionListener(listener: (detail: WidgetChainActionDetail) => void): () => void {
  const handler = (e: Event) => {
    const detail = (e as CustomEvent<WidgetChainActionDetail>).detail
    if (detail) listener(detail)
  }
  window.addEventListener(WIDGET_CHAIN_ACTION_EVENT, handler as EventListener)
  return () => window.removeEventListener(WIDGET_CHAIN_ACTION_EVENT, handler as EventListener)
}