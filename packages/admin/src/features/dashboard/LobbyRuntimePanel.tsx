/**
 * LobbyRuntimePanel — configuration panel for the Lobby runtime.
 *
 * The Lobby is a lifecycle manager: a permanent 3D environment shell.
 * It is not a user scene. Its configuration covers:
 *   - Windows: overlay windows rendered on top of the 3D room
 *   - 3D Room: lighting, fog, world, atmosphere, props (via LobbyThemeEditor)
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { STATE, withOverlayStyleDefaults } from '@ieomlabs/shared'
import type { Scene, WindowInstance } from '@ieomlabs/shared'
import { useAdminStore } from '../../store/useAdminStore'
import { ConfigApplyBar, isSameDraft } from '../../shared/ui'
import { SourcesEditor } from './SceneConfig'
import { ScenePreview } from './ScenePreview'
import { LobbyThemeEditor } from './LobbyThemePanel'
import { ConfigPanel } from '../../components/organisms'

export function LobbyRuntimePanel() {
  const config        = useAdminStore((s) => s.config)
  const saveConfig    = useAdminStore((s) => s.saveConfig)
  const windowPresets = config.windowPresets ?? []

  const scene = config.scenes[STATE.LOBBY] as Scene | undefined
  const baseWindows = scene?.windows ?? []

  const [windows, setWindows] = useState<WindowInstance[]>(() => structuredClone(baseWindows))
  const [tab, setTab]         = useState<'windows' | 'room'>('room')
  const [saving, setSaving]   = useState(false)
  const [saved,  setSaved]    = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const dirty = !isSameDraft(windows, baseWindows)

  useEffect(() => () => { if (savedTimer.current) clearTimeout(savedTimer.current) }, [])

  const apply = useCallback(async () => {
    setSaving(true)
    await saveConfig({ scenes: { [STATE.LOBBY]: { ...scene, windows } } })
    setSaving(false)
    if (savedTimer.current) clearTimeout(savedTimer.current)
    setSaved(true)
    savedTimer.current = setTimeout(() => setSaved(false), 1500)
  }, [scene, windows, saveConfig])

  const reset = useCallback(() => {
    setWindows(structuredClone(baseWindows))
    setSaved(false)
  }, [baseWindows])

  return (
    <div className="space-y-3">
      <div className="flex gap-1 rounded-xl bg-white/[0.04] p-1">
        {(['room', 'windows'] as const).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)}
            className={'flex-1 rounded-lg py-1.5 text-xs font-medium capitalize transition-colors ' +
              (tab === t ? 'bg-white/10 text-white shadow' : 'text-zinc-500 hover:text-zinc-300')}>
            {t === 'room' ? '3D Room' : 'Windows'}
          </button>
        ))}
      </div>

      {tab === 'windows' && (
        <div className="space-y-3">
          <ScenePreview windows={windows} selectedId={selectedId} onSelect={setSelectedId}
            onChangePosition={(id, pos) => setWindows((prev) => prev.map((w) => w.id === id ? { ...w, position: pos } : w))} />
          <SourcesEditor sources={windows} windowPresets={windowPresets} onChange={setWindows} />
        </div>
      )}

      {tab === 'room' && <LobbyThemeEditor />}

      {tab === 'windows' && (
        <ConfigApplyBar label="Lobby Runtime" dirty={dirty} saving={saving} saved={saved} onApply={apply} onReset={reset} alwaysShow />
      )}
    </div>
  )
}
