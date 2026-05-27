import { useEffect } from 'react'
import type { AppConfig } from '@ieom/shared'
import type { RuntimeConfigOverridePayload } from '@ieom/shared'
import { socket } from './client'
import { useAppStore } from '../store/useAppStore'

/** Syncs config state from server: initial fetch + live config:update / config:patch / runtime:config:override */
export function useConfigSync() {
  const setConfig = useAppStore((s) => s.setConfig)
  const patchConfig = useAppStore((s) => s.patchConfig)
  const setRuntimeConfigOverride = useAppStore((s) => s.setRuntimeConfigOverride)

  useEffect(() => {
    const onConfigUpdate = (config: AppConfig) => setConfig(config)
    const onConfigPatch = (updates: Partial<AppConfig>) => patchConfig(updates)
    const onRuntimeConfigOverride = (updates: RuntimeConfigOverridePayload) => setRuntimeConfigOverride(updates)

    fetch('/api/config').then((r) => r.json()).then(setConfig).catch(() => {})

    socket.on('config:update', onConfigUpdate)
    socket.on('config:patch', onConfigPatch)
    socket.on('runtime:config:override', onRuntimeConfigOverride)

    return () => {
      socket.off('config:update', onConfigUpdate)
      socket.off('config:patch', onConfigPatch)
      socket.off('runtime:config:override', onRuntimeConfigOverride)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
