import { useEffect } from 'react'
import { DEFAULT_DESKTOP_NOTIFICATION_DURATION_MS } from '@ieom/shared'
import type { DesktopNotificationPayload, DesktopRecycleBinPayload, ObsStatusPayload } from '@ieom/shared'
import { socket } from './client'
import { useAppStore } from '../store/useAppStore'
import { dispatchWidgetSimulationIntent } from '../desktop/widgetSimulationEvents'
import type { WidgetSimulationIntentPayload } from '@ieom/shared'

/** Handles desktop runtime events: widgets, notifications, recycle-bin, OBS status, camera */
export function useDesktopEvents() {
  const enqueueDesktopNotification = useAppStore((s) => s.enqueueDesktopNotification)
  const setRecycleBinFull = useAppStore((s) => s.setRecycleBinFull)
  const setCameraOwnerSocketId = useAppStore((s) => s.setCameraOwnerSocketId)
  const setObsConnected = useAppStore((s) => s.setObsConnected)

  useEffect(() => {
    const onWidgetToggle = (widgetId: string) => {
      useAppStore.getState().toggleWidget(widgetId)
    }

    const onDesktopNotify = (payload: DesktopNotificationPayload) => {
      enqueueDesktopNotification({
        ...payload,
        durationMs: payload.durationMs ?? DEFAULT_DESKTOP_NOTIFICATION_DURATION_MS,
      })
    }

    const onDesktopRecycleBin = (payload: DesktopRecycleBinPayload) => {
      setRecycleBinFull(payload.full)
    }

    const onCameraOwner = (payload: { socketId: string | null }) => {
      setCameraOwnerSocketId(payload.socketId)
    }

    const onObsStatus = (payload: ObsStatusPayload) => {
      setObsConnected(payload.connected)
    }

    const onWidgetSimulationIntent = (payload: WidgetSimulationIntentPayload) => {
      dispatchWidgetSimulationIntent(payload)
    }

    socket.on('widget:toggle', onWidgetToggle)
    socket.on('desktop:notify', onDesktopNotify)
    socket.on('desktop:recycle-bin', onDesktopRecycleBin)
    socket.on('camera:owner', onCameraOwner)
    socket.on('obs:status', onObsStatus)
    socket.on('widget:simulate:intent', onWidgetSimulationIntent)

    return () => {
      socket.off('widget:toggle', onWidgetToggle)
      socket.off('desktop:notify', onDesktopNotify)
      socket.off('desktop:recycle-bin', onDesktopRecycleBin)
      socket.off('camera:owner', onCameraOwner)
      socket.off('obs:status', onObsStatus)
      socket.off('widget:simulate:intent', onWidgetSimulationIntent)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
