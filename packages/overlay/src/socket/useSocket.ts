import { useEffect } from 'react'
import { STATE } from '@ieomlabs/shared'
import type { DesktopRuntimeStatePayload } from '@ieomlabs/shared'
import { socket } from './client'
import { useAppStore } from '../store/useAppStore'
import { useSignalReceiver } from './useSignalReceiver'
import { addWidgetSignalListener, dispatchWidgetChainAction } from '../desktop/widgetSimulationEvents'

/** Connects all socket events to the app store. Mount once — inside App. */
export function useSocket() {
  const markSocketActivity = useAppStore((s) => s.markSocketActivity)
  const setVisualState     = useAppStore((s) => s.setVisualState)
  const syncDesktopRuntimeState = useAppStore((s) => s.syncDesktopRuntimeState)

  // Mount all signal handlers from signalMap
  useSignalReceiver()

  // Evaluate reactive chains locally on the DOM bus — no kernel round-trip needed.
  // open/close/toggle still go to the kernel (they mutate authoritative open state).
  useEffect(() => {
    return addWidgetSignalListener((detail) => {
      const chains = useAppStore.getState().config.reactiveChains ?? []
      const matches = chains.filter(
        (c) => c.enabled && c.triggerWidgetId === detail.source && c.triggerEvent === detail.event
      )
      for (const chain of matches) {
        if (chain.targetAction === 'open' || chain.targetAction === 'close' || chain.targetAction === 'toggle') {
          socket.emit('widget:signal', { source: detail.source, event: detail.event, payload: detail.payload })
          return
        }
        dispatchWidgetChainAction({ targetWidgetId: chain.targetWidgetId, action: chain.targetAction, sourceSignal: detail })
      }
    })
  }, [])

  // On connect: fetch current state via queries (not signals — signals are push-only)
  useEffect(() => {
    const requestRuntimeState = () => {
      socket.emit('state:request', (state: STATE) => {
        if (state !== STATE.TRANSITIONING) {
          setVisualState(state as Exclude<STATE, typeof STATE.TRANSITIONING>)
        }
      })
      socket.emit('desktop:state:request', (payload: DesktopRuntimeStatePayload) => {
        syncDesktopRuntimeState(payload)
      })
      // Initial config fetch
      fetch('/api/config').then((r) => r.json()).then(useAppStore.getState().setConfig).catch(() => {})
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
