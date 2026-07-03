import { useCallback, useEffect, useRef, useState } from 'react'
import { STATE, withOverlayStyleDefaults } from '@ieomlabs/shared'
import type { OverlayStyle, Scene, WindowInstance, TransitionStep } from '@ieomlabs/shared'
import { useAdminStore } from '../../store/useAdminStore'
import { ConfigApplyBar, isSameDraft } from '../../shared/ui'
import { ConfigPanel } from '../../components/organisms'
import { SourcesEditor } from './SceneConfig'
import { ScenePreview } from './ScenePreview'
import { TransitionChipPicker } from './TransitionPicker'

type ScenePanelDraft = {
  label:       string
  onEntry:     TransitionStep[]
  onExit:      TransitionStep[]
  style:       OverlayStyle
  windows:     WindowInstance[]
  showDesktop: boolean
}

function buildDraft(
  sceneId: string,
  config: ReturnType<typeof useAdminStore.getState>['config'],
): ScenePanelDraft {
  const scene = config.scenes[sceneId] as Scene | undefined
  return {
    label:       scene?.label ?? sceneId,
    onEntry:     structuredClone(scene?.onEntry?.map((id) => ({ id })) ?? []),
    onExit:      structuredClone(scene?.onExit?.map((id) => ({ id })) ?? []),
    style:       structuredClone(withOverlayStyleDefaults(scene?.style)),
    windows:     structuredClone(scene?.windows ?? []),
    showDesktop: scene?.showDesktop ?? false,
  }
}

export function ScenePanel({ sceneId, onDeleted }: { sceneId: string; onDeleted?: () => void }) {
  const config        = useAdminStore((s) => s.config)
  const saveConfig    = useAdminStore((s) => s.saveConfig)
  const isDesktop     = sceneId === STATE.DESKTOP
  const isUser        = sceneId !== STATE.LOBBY && sceneId !== STATE.DESKTOP
  const isSystemScene = !isUser
  const windowPresets = config.windowPresets ?? []

  const baseDraft = buildDraft(sceneId, config)
  const [draft,  setDraft]  = useState<ScenePanelDraft>(baseDraft)
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)
  const [tab,    setTab]    = useState<'windows' | 'settings'>('windows')
  const [selectedWindowId, setSelectedWindowId] = useState<string | null>(null)
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const dirty = !isSameDraft(draft, baseDraft)

  useEffect(() => {
    setDraft(buildDraft(sceneId, config))
    setSaved(false)
    setSelectedWindowId(null)
  }, [sceneId])

  useEffect(() => () => { if (savedTimer.current) clearTimeout(savedTimer.current) }, [])

  const update = useCallback((updater: (d: ScenePanelDraft) => void) => {
    setDraft((prev) => { const next = structuredClone(prev); updater(next); return next })
    setSaved(false)
  }, [])

  const apply = useCallback(async () => {
    setSaving(true)
    const scene = (config.scenes[sceneId] ?? {}) as Scene
    const nextScene: Scene = {
      ...scene,
      label:       draft.label.trim() || sceneId,
      windows:     draft.windows,
      showDesktop: draft.showDesktop,
      onEntry:     draft.onEntry.filter((s) => s.id).map((s) => s.id),
      onExit:      draft.onExit.filter((s) => s.id).map((s) => s.id),
      ...(isDesktop ? {} : { style: draft.style }),
    }
    await saveConfig({ scenes: { ...config.scenes, [sceneId]: nextScene } })
    setSaving(false)
    if (savedTimer.current) clearTimeout(savedTimer.current)
    setSaved(true)
    savedTimer.current = setTimeout(() => setSaved(false), 1500)
  }, [config, draft, sceneId, saveConfig, isDesktop])

  const reset = useCallback(() => {
    setDraft(buildDraft(sceneId, config))
    setSaved(false)
  }, [sceneId, config])

  const label = isDesktop ? 'Desktop' : sceneId === STATE.LOBBY ? 'Lobby' : 'Scene'

  return (
    <div className="space-y-3">
      {/* Tab bar */}
      <div className="flex gap-1 rounded-xl bg-white/[0.04] p-1">
        {(['windows', 'settings'] as const).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)}
            className={'flex-1 rounded-lg py-1.5 text-xs font-medium capitalize transition-colors ' +
              (tab === t ? 'bg-white/10 text-white shadow' : 'text-zinc-500 hover:text-zinc-300')}>
            {t === 'windows' ? 'Windows' : 'Settings'}
          </button>
        ))}
      </div>

      {/* ── Windows tab ──────────────────────────────────── */}
      {tab === 'windows' && (
        <div className="space-y-3">
          <ScenePreview
            windows={draft.windows}
            selectedId={selectedWindowId}
            onSelect={setSelectedWindowId}
            onChangePosition={(id, pos) => update((d) => {
              const w = d.windows.find((x) => x.id === id)
              if (w) w.position = pos
            })}
          />
          <SourcesEditor
            sources={draft.windows}
            windowPresets={windowPresets}
            onChange={(next) => update((d) => { d.windows = next })}
          />
        </div>
      )}

      {/* ── Settings tab ─────────────────────────────────── */}
      {tab === 'settings' && (
        <div className="space-y-4 pt-1">
          {/* Scene Name */}
          {isUser && (
            <ConfigPanel title="Scene Name">
              <input type="text" placeholder="Scene name"
                value={draft.label}
                onChange={(e) => update((d) => { d.label = e.target.value })}
                className="w-full text-xs" />
            </ConfigPanel>
          )}

          {/* Show Desktop */}
          {!isDesktop && (
            <label className="flex items-center gap-3 cursor-pointer select-none px-1">
              <input type="checkbox" checked={draft.showDesktop}
                onChange={(e) => update((d) => { d.showDesktop = e.target.checked })}
                className="h-4 w-4 rounded border-zinc-600 bg-zinc-800 accent-cyan-400" />
              <span className="text-xs text-[var(--color-text-primary)]">Show Win98 desktop while this scene is active</span>
            </label>
          )}

          {/* Transitions — two columns */}
          <ConfigPanel title="Transitions">
            <div className="grid grid-cols-2 gap-4">
              <TransitionChipPicker label="On Entry" steps={draft.onEntry}
                onChange={(steps) => update((d) => { d.onEntry = steps })} />
              <TransitionChipPicker label="On Exit" steps={draft.onExit}
                onChange={(steps) => update((d) => { d.onExit = steps })} />
            </div>
          </ConfigPanel>

        </div>
      )}

      {isUser && (
        <button onClick={async () => {
          const sceneIdToDelete = sceneId
          const updatedScenes = Object.fromEntries(
            Object.entries(config.scenes).filter(([id]) => id !== sceneIdToDelete)
          )
          await saveConfig({ scenes: updatedScenes })
          onDeleted?.()
        }}
          className={'text-xs px-2 py-1 rounded border transition-colors ' + (
            isSystemScene
              ? 'border-[var(--color-border-default)] text-[var(--color-text-muted)] cursor-not-allowed'
              : 'text-[var(--color-danger-400)] hover:text-[var(--color-danger-400)] border-[var(--color-danger-500)]/50 hover:border-[var(--color-danger-400)]'
          )}>
          {isSystemScene ? 'Protected' : 'Delete Scene'}
        </button>
      )}

      <ConfigApplyBar label={label} dirty={dirty} saving={saving} saved={saved} onApply={apply} onReset={reset} alwaysShow />
    </div>
  )
}
