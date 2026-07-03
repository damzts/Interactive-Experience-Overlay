import { useEffect } from 'react'
import { STATE } from '@ieomlabs/shared'
import type { OverlaySyncSnapshot } from '@ieomlabs/shared'
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
      const store = useAppStore.getState()
      const wires = store.config.widgetWires ?? []
      const currentState = store.visualState
      const matches = wires.filter((w) => {
        if (!w.enabled) return false
        if (w.triggerWidgetId !== detail.source || w.triggerEvent !== detail.event) return false
        // Enforce scene condition if set
        if (w.condition?.sceneIs?.length) {
          return w.condition.sceneIs.includes(currentState as STATE)
        }
        return true
      })
      for (const wire of matches) {
        if (wire.targetAction === 'open' || wire.targetAction === 'close' || wire.targetAction === 'toggle') {
          socket.emit('widget:signal', { source: detail.source, event: detail.event, payload: detail.payload })
          return
        }
        dispatchWidgetChainAction({ targetWidgetId: wire.targetWidgetId, action: wire.targetAction, sourceSignal: detail })
      }
    })
  }, [])

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
