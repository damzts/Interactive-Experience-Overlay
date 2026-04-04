import type { WidgetSimulationIntentPayload } from '@ieom/shared'

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