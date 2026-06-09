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

  // Evaluate widget wires locally on the DOM bus — no kernel round-trip needed.
  // open/close/toggle still go to the kernel (they mutate authoritative open state).
  useEffect(() => {
    return addWidgetSignalListener((detail) => {
      const wires = useAppStore.getState().config.widgetWires ?? []
      const matches = wires.filter(
        (w) => w.enabled && w.triggerWidgetId === detail.source && w.triggerEvent === detail.event
      )
      for (const wire of matches) {
        if (wire.targetAction === 'open' || wire.targetAction === 'close' || wire.targetAction === 'toggle') {
          socket.emit('widget:signal', { source: detail.source, event: detail.event, payload: detail.payload })
          return
        }
        dispatchWidgetChainAction({ targetWidgetId: wire.targetWidgetId, action: wire.targetAction, sourceSignal: detail })
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
