/**
 * useSignalReceiver — mounts all kernel signal handlers in one pass.
 *
 * Iterates signalHandlers on mount, registers each handler on the socket,
 * and cleans up on unmount. Replaces the imperative socket.on() calls
 * scattered across useSceneEvents, useDesktopEvents, useConfigSync.
 *
 * Dev mode: logs each incoming signal to the console when VITE_DEBUG_SIGNALS=true.
 */

import { useEffect } from 'react'
import { socket } from './client'
import { useAppStore } from '../store/useAppStore'
import { signalHandlers } from './signalMap'
import type { ServerToClientEvents } from '@ieomlabs/shared'

const DEBUG = import.meta.env.VITE_DEBUG_SIGNALS === 'true'

export function useSignalReceiver() {
  const store = useAppStore.getState

  useEffect(() => {
    const off: Array<() => void> = []

    for (const [event, handler] of Object.entries(signalHandlers) as Array<
      [keyof ServerToClientEvents, (payload: any, store: any) => void]
    >) {
      const wrapped = (payload: unknown) => {
        if (DEBUG) console.debug(`[signal] ${event}`, payload)
        handler(payload, store())
      }
      socket.on(event as any, wrapped)
      off.push(() => socket.off(event as any, wrapped))
    }

    return () => off.forEach((fn) => fn())
  // Mount once — signalHandlers is static
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
