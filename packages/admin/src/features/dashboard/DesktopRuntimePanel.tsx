/**
 * DesktopRuntimePanel — configuration panel for the Desktop runtime.
 *
 * The Desktop is a lifecycle manager: it owns the Win98 widget runtime,
 * manages application windows, taskbar, and notifications.
 * It is not a user scene. Its configuration covers:
 *   - Sources: overlay sources rendered in the Desktop context (e.g. builtin:effects)
 *   - Desktop: OS chrome — themes, icons, widgets, screensaver (via DesktopThemeEditor)
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { STATE } from '@ieom/shared'
import type { Scene, SourceInstance } from '@ieom/shared'
import { useAdminStore } from '../../store/useAdminStore'
import { ConfigApplyBar, isSameDraft } from '../../shared/ui'
import { SourcesEditor } from './SceneConfig'
import { ScenePreview } from './ScenePreview'
import { DesktopThemeEditor } from './DesktopThemePanel'

export function DesktopRuntimePanel() {
  const config        = useAdminStore((s) => s.config)
  const saveConfig    = useAdminStore((s) => s.saveConfig)
  const sourcePresets = config.sourcePresets ?? []

  const scene = config.scenes[STATE.DESKTOP] as Scene | undefined
  const baseSources = scene?.sources ?? []

  const [sources, setSources] = useState<SourceInstance[]>(() => structuredClone(baseSources))
  const [tab, setTab]         = useState<'desktop' | 'sources'>('desktop')
  const [saving, setSaving]   = useState(false)
  const [saved,  setSaved]    = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const dirty = !isSameDraft(sources, baseSources)

  // Cleanup savedTimer on unmount
  useEffect(() => () => { if (savedTimer.current) clearTimeout(savedTimer.current) }, [])

  const apply = useCallback(async () => {
    setSaving(true)
    await saveConfig({ scenes: { [STATE.DESKTOP]: { ...scene, sources } } })
    setSaving(false)
    if (savedTimer.current) clearTimeout(savedTimer.current)
    setSaved(true)
    savedTimer.current = setTimeout(() => setSaved(false), 1500)
  }, [scene, sources, saveConfig])

  const reset = useCallback(() => {
    setSources(structuredClone(baseSources))
    setSaved(false)
  }, [baseSources])

  return (
    <div className="space-y-3">
      <div className="flex gap-1 rounded-xl bg-white/[0.04] p-1">
        {(['desktop', 'sources'] as const).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)}
            className={'flex-1 rounded-lg py-1.5 text-xs font-medium capitalize transition-colors ' +
              (tab === t ? 'bg-white/10 text-white shadow' : 'text-zinc-500 hover:text-zinc-300')}>
            {t === 'desktop' ? 'Desktop OS' : 'Sources'}
          </button>
        ))}
      </div>

      {tab === 'sources' && (
        <div className="space-y-3">
          <ScenePreview sources={sources} selectedId={selectedId} onSelect={setSelectedId}
            onChangePosition={(id, pos) => setSources((prev) => prev.map((s) => s.id === id ? { ...s, position: pos } : s))} />
          <SourcesEditor sources={sources} sourcePresets={sourcePresets} onChange={setSources} />
        </div>
      )}

      {tab === 'desktop' && <DesktopThemeEditor />}

      {tab === 'sources' && (
        <ConfigApplyBar label="Desktop Runtime" dirty={dirty} saving={saving} saved={saved} onApply={apply} onReset={reset} alwaysShow />
      )}
    </div>
  )
}
