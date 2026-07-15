import { useCallback, useSyncExternalStore } from 'react'
import { screenSharePublisherRegistry } from './screenSharePublisherRegistry'

export interface ScreenSharePublisherState {
  /** True while a share is active for this widgetId (publishing to the overlay). */
  active: boolean
  error: string | null
  /** Non-fatal: share is live but no audio track was captured (see registry). */
  warning: string | null
  /** Begin capture — must be called from a click handler (getDisplayMedia requires a user gesture). */
  start: () => void
  /** Stop sharing and tear down the publisher connection. */
  stop: () => void
}

/**
 * Thin view over the module-level screenSharePublisherRegistry for one
 * widgetId. Mounting/unmounting this hook (e.g. switching which widget's
 * config panel is open) does NOT start or stop the underlying share — the
 * connection's lifetime is owned entirely by the registry and only ends via
 * explicit stop(), the browser's native "Stop sharing" UI, or the peer
 * connection failing.
 *
 * getDisplayMedia() only works from a genuine user-gesture call stack, which
 * is why this lives in admin (where a human clicks buttons) rather than the
 * overlay (a passive OBS render target with no one to click anything).
 */
export function useScreenSharePublisher(widgetId: string, audio: boolean): ScreenSharePublisherState {
  const subscribe = useCallback(
    (onStoreChange: () => void) => screenSharePublisherRegistry.subscribe(widgetId, onStoreChange),
    [widgetId],
  )
  const getSnapshot = useCallback(
    () => screenSharePublisherRegistry.getSnapshot(widgetId),
    [widgetId],
  )

  const snapshot = useSyncExternalStore(subscribe, getSnapshot)

  const start = useCallback(() => {
    void screenSharePublisherRegistry.start(widgetId, audio)
  }, [widgetId, audio])

  const stop = useCallback(() => {
    screenSharePublisherRegistry.stop(widgetId)
  }, [widgetId])

  return { active: snapshot.active, error: snapshot.error, warning: snapshot.warning, start, stop }
}
