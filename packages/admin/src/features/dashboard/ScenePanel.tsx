import { useCallback, useEffect, useRef, useState } from 'react'
import { STATE, withOverlayStyleDefaults } from '@ieom/shared'
import type { Application, OverlayStyle, Scene, SourceInstance } from '@ieom/shared'
import { useAdminStore } from '../../store/useAdminStore'
import { ConfigApplyBar, isSameDraft } from '../../shared/ui'
import { ConfigPanel } from '../../components/organisms'
import { TransitionList, compactTransitionSteps } from './TransitionPicker'
import { StyleSections } from './StyleEditor'
import { SourcesEditor } from './SceneConfig'
import { AppForm, type AppFormHandle } from './AppForm'

type ScenePanelDraft = {
  introTransitions: any[]
  exitTransitions:  any[]
  style:            OverlayStyle
  sources:          SourceInstance[]
  musicTrack:       string
}

function buildScenePanelDraft(
  sceneId: string,
  config: ReturnType<typeof useAdminStore.getState>['config'],
): ScenePanelDraft {
  const scene = config.scenes[sceneId] as (Scene & { introTransitions?: any[]; exitTransitions?: any[] }) | undefined
  const isLobby   = sceneId === STATE.LOBBY
  const isDesktop = sceneId === STATE.DESKTOP
  const linkedApp = !isLobby && !isDesktop
    ? config.applications.find((a) => a.targetSceneId === sceneId)
    : undefined

  return {
    introTransitions: structuredClone(
      isLobby || isDesktop ? (scene?.introTransitions ?? []) : (linkedApp?.introTransitions ?? [])
    ),
    exitTransitions: structuredClone(
      isLobby || isDesktop ? (scene?.exitTransitions ?? []) : (linkedApp?.exitTransitions ?? [])
    ),
    style:      structuredClone(withOverlayStyleDefaults(scene?.style, config.overlayStyle)),
    sources:    structuredClone(scene?.sources ?? []),
    musicTrack: scene?.musicTrack ?? '',
  }
}

export function ScenePanel({ sceneId, app, onDelete }: { sceneId: string; app?: Application; onDelete?: () => void }) {
  const config        = useAdminStore((s) => s.config)
  const saveConfig    = useAdminStore((s) => s.saveConfig)
  const sourcePresets = config.sourcePresets ?? []

  const isLobby   = sceneId === STATE.LOBBY
  const isDesktop = sceneId === STATE.DESKTOP
  const isUser    = !isLobby && !isDesktop

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
    const compactIntro = compactTransitionSteps(draft.introTransitions)
    const compactExit  = compactTransitionSteps(draft.exitTransitions)

    if (isLobby) {
      await saveConfig({
        scenes: {
          [STATE.LOBBY]: {
            ...scene,
            style: draft.style,
            introTransitions: compactIntro.length ? compactIntro : undefined,
            exitTransitions:  compactExit.length  ? compactExit  : undefined,
          },
        },
      })
    } else if (isDesktop) {
      await saveConfig({
        scenes: {
          [STATE.DESKTOP]: {
            ...scene,
            style: draft.style,
            introTransitions: compactIntro.length ? compactIntro : undefined,
            exitTransitions:  compactExit.length  ? compactExit  : undefined,
          },
        },
      })
    } else {
      const linkedApp = config.applications.find((a) => a.targetSceneId === sceneId)
      const nextScene: Scene = {
        ...scene as Scene,
        style: draft.style,
        sources: draft.sources,
        musicTrack: draft.musicTrack.trim() || undefined,
      }
      const applications = linkedApp
        ? config.applications.map((a) => a.id === linkedApp.id
            ? {
                ...a,
                introTransitions: compactIntro.length ? compactIntro : undefined,
                exitTransitions:  compactExit.length  ? compactExit  : undefined,
              }
            : a)
        : config.applications
      await saveConfig({ scenes: { [sceneId]: nextScene }, applications })
    }

    setSaving(false)
    if (savedTimer.current) clearTimeout(savedTimer.current)
    setSaved(true)
    savedTimer.current = setTimeout(() => setSaved(false), 1500)
    await appFormRef.current?.apply()
  }, [config, draft, isLobby, isDesktop, sceneId, saveConfig])

  const reset = useCallback(() => {
    setDraft(buildScenePanelDraft(sceneId, config))
    setSaved(false)
    appFormRef.current?.reset()
  }, [sceneId, config])

  const label = isLobby ? 'Lobby Scene' : isDesktop ? 'Desktop Scene' : 'Scene Configuration'

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
                { key: 'introTransitions' as const, label: 'Intro (entering)' },
                { key: 'exitTransitions'  as const, label: 'Exit (leaving)'   },
              ]).map(({ key, label: tLabel }) => (
                <div key={key}>
                  <div className="text-[10px] text-[var(--color-text-muted)] mb-1">{tLabel}</div>
                  <TransitionList
                    value={draft[key]}
                    onChange={(steps) => update((d) => { d[key] = steps })}
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
