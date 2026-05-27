import { useEffect } from 'react'
import { socket } from './client'
import { useAppStore } from '../store/useAppStore'
import { useConfigSync } from './useConfigSync'
import { useSceneEvents } from './useSceneEvents'
import { useDesktopEvents } from './useDesktopEvents'
import { useCursorMirror } from './useCursorMirror'

/** Connects all socket events to the app store. Mount once — inside App. */
export function useSocket() {
  const markSocketActivity = useAppStore((s) => s.markSocketActivity)

  useConfigSync()
  useSceneEvents()
  useDesktopEvents()
  useCursorMirror()

  // Track any socket activity for diagnostics / idle detection
  useEffect(() => {
    socket.onAny(markSocketActivity)
    return () => { socket.offAny(markSocketActivity) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}

