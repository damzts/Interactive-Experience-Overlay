import { useEffect, useRef } from 'react'
import type { CursorMirrorPayload, OpenWidgetMenuTimelinePayload } from '@ieom/shared'
import { socket } from './client'
import { runWidgetCursorSimulation } from '../desktop/cursorSimUtils'

/** Handles cursor:mirror and cursor:mirror:menu-timeline events for simulation overlay */
export function useCursorMirror() {
  const menuTimelineLockUntil = useRef(0)

  useEffect(() => {
    const onCursorMirror = (payload: CursorMirrorPayload) => {
      const cursor = (window as any).__cursorOverlayController
      if (!cursor) return
      const now = Date.now()
      const locked = now < menuTimelineLockUntil.current
      if (locked && (payload.kind === 'move' || payload.kind === 'click')) return

      if (payload.kind === 'move') {
        ;(window as any).__cursorMirrorApplying = true
        void cursor.moveTo(payload.x, payload.y, { duration: payload.duration ?? 600 }).finally(() => {
          ;(window as any).__cursorMirrorApplying = false
        })
        return
      }

      if (payload.kind === 'click') {
        ;(window as any).__cursorMirrorApplying = true
        void cursor.click().finally(() => {
          ;(window as any).__cursorMirrorApplying = false
        })
        return
      }

      ;(window as any).__cursorMirrorApplying = true
      cursor.setVisible(payload.visible)
      ;(window as any).__cursorMirrorApplying = false
    }

    const onMirrorMenuTimeline = (payload: OpenWidgetMenuTimelinePayload) => {
      const cursor = (window as any).__cursorOverlayController
      if (!cursor) return
      const totalMs =
        payload.startMoveMs +
        payload.startPostMs +
        payload.steps.reduce((sum, step) => sum + step.moveMs + step.hoverMs + step.postMs, 0)
      menuTimelineLockUntil.current = Date.now() + totalMs + 400
      void runWidgetCursorSimulation(cursor, payload.widgetLabel, {
        startMenu: false,
        menuPath: payload.menuPath,
        visualOnly: true,
        driveCursorVisualOnly: true,
        allowDomActionsInVisualOnly: false,
        debugTag: `mirror:${payload.targetAppId ?? payload.widgetLabel}`,
        targetAppId: payload.targetAppId,
        activateLeafClick: false,
        openFirstLevelOnHover: true,
        closeStartMenuAfterPath: false,
        timingPlan: {
          startMoveMs: payload.startMoveMs,
          startPostMs: payload.startPostMs,
          steps: payload.steps,
        },
      })
    }

    socket.on('cursor:mirror', onCursorMirror)
    socket.on('cursor:mirror:menu-timeline', onMirrorMenuTimeline)

    return () => {
      socket.off('cursor:mirror', onCursorMirror)
      socket.off('cursor:mirror:menu-timeline', onMirrorMenuTimeline)
    }
  }, [])
}
