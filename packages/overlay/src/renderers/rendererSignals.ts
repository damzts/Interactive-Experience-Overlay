/**
 * rendererSignals — bridges scene renderers into the automation-rule signal pipeline.
 *
 * Renderers already have a private DOM bus (`renderer:*` CustomEvents provided by
 * WindowHost's emit/onSignal props). This module connects that bus to the
 * widget-signal world in both directions:
 *
 *   Inbound  — automation `widget:action` dispatches (dispatchWidgetChainAction)
 *              are re-broadcast as `renderer:action` events, so a renderer can
 *              receive rule actions via onSignal('action', …), filtering on its
 *              own instanceId.
 *
 *   Outbound — a renderer calling emit('signal', { source: instanceId, event,
 *              payload }) produces a `renderer:signal` event; this module relays
 *              it into dispatchWidgetSignal, where it flows through the exact
 *              same pipeline as widget signals (local rule evaluation + kernel
 *              forwarding).
 *
 * Mounted once from useSocket.
 */
import { addWidgetChainActionListener, dispatchWidgetSignal } from '../desktop/widgetSimulationEvents'

export interface RendererActionDetail {
  targetWidgetId: string
  action: string
  sourceSignal?: unknown
}

export interface RendererSignalDetail {
  source?: string
  event: string
  payload?: unknown
}

/** Wire both bridge directions. Returns a cleanup function. */
export function initRendererSignalBridge(): () => void {
  // Inbound: chain actions → renderer:action (WindowHost onSignal('action', …))
  const removeChainListener = addWidgetChainActionListener((detail) => {
    window.dispatchEvent(new CustomEvent<RendererActionDetail>('renderer:action', { detail }))
  })

  // Outbound: renderer emit('signal', …) → widget-signal pipeline
  const onRendererSignal = (e: Event) => {
    const detail = (e as CustomEvent<RendererSignalDetail>).detail
    if (!detail || typeof detail.event !== 'string' || !detail.event) return
    dispatchWidgetSignal({
      source: detail.source ?? 'renderer',
      event: detail.event,
      payload: detail.payload,
    })
  }
  window.addEventListener('renderer:signal', onRendererSignal)

  return () => {
    removeChainListener()
    window.removeEventListener('renderer:signal', onRendererSignal)
  }
}
