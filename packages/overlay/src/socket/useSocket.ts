import { useEffect } from 'react'
import { STATE, isSyntheticSignalPayload } from '@ieomlabs/shared'
import type { OverlaySyncSnapshot } from '@ieomlabs/shared'
import { socket } from './client'
import { useAppStore } from '../store/useAppStore'
import { useSignalReceiver } from './useSignalReceiver'
import { addWidgetSignalListener, dispatchWidgetChainAction } from '../desktop/widgetSimulationEvents'
import { evaluateWidgetRules } from './widgetRuleEvaluator'
import { initRendererSignalBridge } from '../renderers/rendererSignals'

/** Connects all socket events to the app store. Mount once — inside App. */
export function useSocket() {
  const markSocketActivity = useAppStore((s) => s.markSocketActivity)
  const setVisualState     = useAppStore((s) => s.setVisualState)
  const syncDesktopRuntimeState = useAppStore((s) => s.syncDesktopRuntimeState)

  // Mount all signal handlers from signalMap
  useSignalReceiver()

  // Evaluate widget-source automation rules locally on the DOM bus (widget:action
  // stays synchronous, zero round-trip) and forward the signal to the kernel,
  // where AutomationManager executes every other action kind. Synthetic signals
  // (minted server-side by signal:emit) are not re-forwarded — loop guard.
  useEffect(() => {
    return addWidgetSignalListener((detail) => {
      const store = useAppStore.getState()
      const rules = store.config.automationRules ?? []
      const localActions = evaluateWidgetRules(rules, detail, store.visualState as STATE)
      for (const { targetWidgetId, action } of localActions) {
        dispatchWidgetChainAction({ targetWidgetId, action, sourceSignal: detail })
      }
      if (!isSyntheticSignalPayload(detail.payload)) {
        socket.emit('widget:signal', { source: detail.source, event: detail.event, payload: detail.payload })
      }
    })
  }, [])

  // Bridge scene renderers into the same signal pipeline (rule actions in,
  // renderer emissions out).
  useEffect(() => initRendererSignalBridge(), [])

  // On connect: atomic initial sync via overlay:sync (replaces three separate channels)
  useEffect(() => {
    const requestRuntimeState = () => {
      socket.emit('overlay:sync', (snapshot: OverlaySyncSnapshot) => {
        if (snapshot.state !== STATE.TRANSITIONING) {
          setVisualState(snapshot.state as Exclude<STATE, typeof STATE.TRANSITIONING>)
        }
        syncDesktopRuntimeState(snapshot.desktop)
        useAppStore.getState().setConfig(snapshot.config)
      })
    }

    if (socket.connected) requestRuntimeState()
    socket.on('connect', requestRuntimeState)

    // Track any socket activity for diagnostics / idle detection
    socket.onAny(markSocketActivity)

    return () => {
      socket.off('connect', requestRuntimeState)
      socket.offAny(markSocketActivity)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
