import { useCallback, useEffect, useRef, useState } from 'react'
import { STATE, withOverlayStyleDefaults } from '@ieom/shared'
import type { Application, OverlayStyle, Scene, SourceInstance } from '@ieom/shared'
import { useAdminStore } from '../../store/useAdminStore'
import { ConfigApplyBar, isSameDraft } from '../../shared/ui'
import { ConfigPanel } from '../../components/organisms'
import { StyleSections } from './StyleEditor'
import { SourcesEditor } from './SceneConfig'
import { AppForm, type AppFormHandle } from './AppForm'

type ScenePanelDraft = {
  onEntry: string[]
  onExit:  string[]
  style:   OverlayStyle
  sources: SourceInstance[]
  musicTrack: string
}

function buildScenePanelDraft(
  sceneId: string,
  config: ReturnType<typeof useAdminStore.getState>['config'],
): ScenePanelDraft {
  const scene = config.scenes[sceneId] as Scene | undefined
  return {
    onEntry: structuredClone(scene?.onEntry ?? []),
    onExit:  structuredClone(scene?.onExit ?? []),
    style:   structuredClone(withOverlayStyleDefaults(scene?.style)),
    sources: structuredClone(scene?.sources ?? []),
    musicTrack: scene?.musicTrack ?? '',
  }
}

export function ScenePanel({ sceneId, app, onDelete }: { sceneId: string; app?: Application; onDelete?: () => void }) {
  const config        = useAdminStore((s) => s.config)
  const saveConfig    = useAdminStore((s) => s.saveConfig)
  const isUser    = sceneId !== STATE.LOBBY && sceneId !== STATE.DESKTOP
  const sourcePresets = config.sourcePresets ?? []

  const sourceDraft = buildScenePanelDraft(sceneId, config)
  const [draft,  setDraft]  = useState<ScenePanelDraft>(sourceDraft)
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)
  const [tab,    setTab]    = useState<'editor' | 'settings'>('editor')
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const appFormRef = useRef<AppFormHandle>(null)
  const [appDirty, setAppDirty] = useState(false)

  const dirty = !isSameDraft(draft, sourceDraft) || appDirty

  useEffect(() => {
    setDraft(buildScenePanelDraft(sceneId, config))
    setSaved(false)
    setAppDirty(false)
  }, [sceneId])

  useEffect(() => () => {
    if (savedTimer.current) clearTimeout(savedTimer.current)
  }, [])

  const update = useCallback((updater: (d: ScenePanelDraft) => void) => {
    setDraft((prev) => { const next = structuredClone(prev); updater(next); return next })
    setSaved(false)
  }, [])

  const apply = useCallback(async () => {
    setSaving(true)
    const scene = config.scenes[sceneId] ?? {}
    const nextScene: Scene = {
      ...scene as Scene,
      style:      draft.style,
      sources:    draft.sources,
      onEntry:    draft.onEntry.length ? draft.onEntry : undefined,
      onExit:     draft.onExit.length  ? draft.onExit  : undefined,
      musicTrack: draft.musicTrack.trim() || undefined,
    }
    await saveConfig({ scenes: { [sceneId]: nextScene } })
    setSaving(false)
    if (savedTimer.current) clearTimeout(savedTimer.current)
    setSaved(true)
    savedTimer.current = setTimeout(() => setSaved(false), 1500)
    await appFormRef.current?.apply()
  }, [config, draft, sceneId, saveConfig])

  const reset = useCallback(() => {
    setDraft(buildScenePanelDraft(sceneId, config))
    setSaved(false)
    appFormRef.current?.reset()
  }, [sceneId, config])

  const label = sceneId === STATE.LOBBY ? 'Lobby Scene' : sceneId === STATE.DESKTOP ? 'Desktop Scene' : 'Scene Configuration'

  return (
    <div className="space-y-3">
      <div className="flex gap-1 rounded-xl bg-white/[0.04] p-1">
        {(['editor', 'settings'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={
              'flex-1 rounded-lg py-1.5 text-xs font-medium capitalize transition-colors ' +
              (tab === t ? 'bg-white/10 text-white shadow' : 'text-zinc-500 hover:text-zinc-300')
            }
          >
            {t === 'editor' ? 'Editor' : 'Settings'}
          </button>
        ))}
      </div>

      {tab === 'editor' && (
        app && onDelete
          ? <AppForm ref={appFormRef} app={app} onDelete={onDelete} embedded onDirtyChange={setAppDirty} />
          : <div className="text-sm text-zinc-500 italic px-1">No application linked.</div>
      )}

      {tab === 'settings' && (
        <div className="space-y-0 pt-3">
          <ConfigPanel title="Transitions" className="mb-4">
            <div className="space-y-3">
              {([
                { key: 'onEntry' as const, label: 'On Entry' },
                { key: 'onExit'  as const, label: 'On Exit'  },
              ]).map(({ key, label: tLabel }) => (
                <div key={key}>
                  <div className="text-[10px] text-[var(--color-text-muted)] mb-1">{tLabel} — comma-separated transition names</div>
                  <input
                    type="text"
                    value={draft[key].join(', ')}
                    onChange={(e) => update((d) => {
                      d[key] = e.target.value.split(',').map((s) => s.trim()).filter(Boolean)
                    })}
                    placeholder="e.g. fade, slide-left"
                    className="w-full font-mono text-xs"
                  />
                </div>
              ))}
            </div>
          </ConfigPanel>

          {isUser && (
            <ConfigPanel title="Sources" className="mb-4">
              <SourcesEditor
                sources={draft.sources}
                sourcePresets={sourcePresets}
                onChange={(next) => update((d) => { d.sources = next })}
              />
            </ConfigPanel>
          )}

          <StyleSections
            sceneId={sceneId}
            style={draft.style}
            update={(updater) => update((d) => { updater(d.style) })}
          />

          {isUser && (
            <ConfigPanel title="Background Music" className="mb-4">
              <div className="text-[10px] text-[var(--color-text-muted)] mb-2">Loop a music track while this scene is active. Leave blank for silence.</div>
              <input
                type="text"
                placeholder="/assets/audio/music/ambient/track.mp3"
                value={draft.musicTrack}
                onChange={(e) => update((d) => { d.musicTrack = e.target.value })}
                className="w-full font-mono text-xs"
              />
              <div className="text-[10px] text-[var(--color-text-muted)] mt-1">Crossfade: 1.5 s</div>
            </ConfigPanel>
          )}
        </div>
      )}

      <ConfigApplyBar label={label} dirty={dirty} saving={saving} saved={saved} onApply={apply} onReset={reset} alwaysShow />
    </div>
  )
}
