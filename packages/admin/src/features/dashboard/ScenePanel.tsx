import { useCallback, useEffect, useRef, useState } from 'react'
import { STATE } from '@ieomlabs/shared'
import type { Scene, Sequence, SequenceStep, WindowInstance } from '@ieomlabs/shared'
import { useAdminStore } from '../../store/useAdminStore'
import { Btn, ConfigApplyBar, isSameDraft } from '../../shared/ui'
import { ConfigPanel } from '../../components/organisms'
import { SourcesEditor } from './SceneConfig'
import { ScenePreview } from './ScenePreview'
import { DesktopThemeEditor } from './DesktopThemePanel'
import { fetchSequences } from '../../api/sequencesApi'
import { StepListEditor } from '../sequences/StepListEditor'
import { socket } from '../../socket/client'

type ScenePanelDraft = {
  label:           string
  introSequenceId: string | undefined
  exitSequenceId:  string | undefined
  introSteps:  SequenceStep[]
  exitSteps:   SequenceStep[]
  windows:     WindowInstance[]
  showDesktop: boolean
}

function buildDraft(
  sceneId: string,
  config: ReturnType<typeof useAdminStore.getState>['config'],
): ScenePanelDraft {
  const scene = config.scenes[sceneId] as Scene | undefined
  return {
    label:           scene?.label ?? sceneId,
    introSequenceId: scene?.introSequenceId,
    exitSequenceId:  scene?.exitSequenceId,
    introSteps:  structuredClone(scene?.introSteps ?? []),
    exitSteps:   structuredClone(scene?.exitSteps ?? []),
    windows:     structuredClone(scene?.windows ?? []),
    showDesktop: scene?.showDesktop ?? false,
  }
}

export function ScenePanel({ sceneId, onDeleted }: { sceneId: string; onDeleted?: () => void }) {
  const config        = useAdminStore((s) => s.config)
  const saveConfig    = useAdminStore((s) => s.saveConfig)
  const isDesktop     = sceneId === STATE.DESKTOP
  const isUser        = !isDesktop
  const isSystemScene = isDesktop
  const windowPresets = config.windowPresets ?? []

  const baseDraft = buildDraft(sceneId, config)
  const [draft,  setDraft]  = useState<ScenePanelDraft>(baseDraft)
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)
  const [tab,    setTab]    = useState<'windows' | 'settings' | 'desktop-os'>('windows')
  const [selectedWindowId, setSelectedWindowId] = useState<string | null>(null)
  const [sequences, setSequences] = useState<Sequence[]>([])
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { void fetchSequences().then(setSequences) }, [])

  const dirty = !isSameDraft(draft, baseDraft)

  // The steps that would actually run for each slot right now — the
  // selected existing Sequence's steps take priority, falling back to the
  // drafted scene-specific inline steps. Mirrors resolvePipelines' runtime
  // priority so "Test" always previews what would really play.
  const activeIntroSteps = draft.introSequenceId
    ? sequences.find((s) => s.id === draft.introSequenceId)?.steps ?? []
    : draft.introSteps
  const activeExitSteps = draft.exitSequenceId
    ? sequences.find((s) => s.id === draft.exitSequenceId)?.steps ?? []
    : draft.exitSteps

  const testSteps = useCallback((steps: SequenceStep[]) => {
    if (steps.length) socket.emit('transition:preview', steps)
  }, [])

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
    try {
      const scene = (config.scenes[sceneId] ?? {}) as Scene
      const nextScene: Scene = {
        ...scene,
        label:       draft.label.trim() || sceneId,
        windows:     draft.windows,
        showDesktop: draft.showDesktop,
        introSequenceId: draft.introSequenceId,
        exitSequenceId:  draft.exitSequenceId,
        // An existing Sequence always takes priority — never persist both
        // introSequenceId and introSteps (or exitSequenceId/exitSteps)
        // populated for the same slot.
        introSteps: draft.introSequenceId ? undefined : draft.introSteps,
        exitSteps:  draft.exitSequenceId ? undefined : draft.exitSteps,
      }
      await saveConfig({ scenes: { ...config.scenes, [sceneId]: nextScene } })
      if (savedTimer.current) clearTimeout(savedTimer.current)
      setSaved(true)
      savedTimer.current = setTimeout(() => setSaved(false), 1500)
    } finally {
      setSaving(false)
    }
  }, [config, draft, sceneId, saveConfig])

  const reset = useCallback(() => {
    setDraft(buildDraft(sceneId, config))
    setSaved(false)
  }, [sceneId, config])

  const label = isDesktop ? 'Desktop' : 'Scene'
  const tabs = isDesktop ? (['windows', 'settings', 'desktop-os'] as const) : (['windows', 'settings'] as const)
  const tabLabels: Record<typeof tabs[number], string> = { windows: 'Windows', settings: 'Settings', 'desktop-os': 'Desktop OS' }

  return (
    <div className="space-y-3">
      {/* Tab bar */}
      <div className="flex gap-1 rounded-xl bg-white/[0.04] p-1">
        {tabs.map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)}
            className={'flex-1 rounded-lg py-1.5 text-xs font-medium capitalize transition-colors ' +
              (tab === t ? 'bg-white/10 text-white shadow' : 'text-zinc-500 hover:text-zinc-300')}>
            {tabLabels[t]}
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

          {/* Sequences — On Entry / On Exit, each with an existing-sequence
              picker and a fallback inline scene-specific step editor. The
              existing Sequence always takes priority at runtime/save time. */}
          <ConfigPanel title="On Entry" description="Runs when entering this scene">
            <div className="space-y-3">
              <label className="block text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">
                Existing Sequence
                <select className="mt-1 w-full text-xs" value={draft.introSequenceId ?? ''}
                  onChange={(e) => update((d) => { d.introSequenceId = e.target.value || undefined })}>
                  <option value="">— none —</option>
                  {sequences.map((seq) => <option key={seq.id} value={seq.id}>{seq.label}</option>)}
                </select>
              </label>

              <div className={draft.introSequenceId ? 'opacity-40 pointer-events-none' : ''}>
                <div className="mb-1.5 text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">
                  Scene-specific Sequence <span className="normal-case font-normal">(used only when no existing Sequence is selected above)</span>
                </div>
                <StepListEditor steps={draft.introSteps} onChange={(next) => update((d) => { d.introSteps = next })} />
              </div>

              {activeIntroSteps.length > 0 && (
                <div className="flex justify-end">
                  <Btn variant="ghost" onClick={() => testSteps(activeIntroSteps)}>Test On Entry ▶</Btn>
                </div>
              )}
            </div>
          </ConfigPanel>

          <ConfigPanel title="On Exit" description="Runs when leaving this scene">
            <div className="space-y-3">
              <label className="block text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">
                Existing Sequence
                <select className="mt-1 w-full text-xs" value={draft.exitSequenceId ?? ''}
                  onChange={(e) => update((d) => { d.exitSequenceId = e.target.value || undefined })}>
                  <option value="">— none —</option>
                  {sequences.map((seq) => <option key={seq.id} value={seq.id}>{seq.label}</option>)}
                </select>
              </label>

              <div className={draft.exitSequenceId ? 'opacity-40 pointer-events-none' : ''}>
                <div className="mb-1.5 text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">
                  Scene-specific Sequence <span className="normal-case font-normal">(used only when no existing Sequence is selected above)</span>
                </div>
                <StepListEditor steps={draft.exitSteps} onChange={(next) => update((d) => { d.exitSteps = next })} />
              </div>

              {activeExitSteps.length > 0 && (
                <div className="flex justify-end">
                  <Btn variant="ghost" onClick={() => testSteps(activeExitSteps)}>Test On Exit ▶</Btn>
                </div>
              )}
            </div>
          </ConfigPanel>

          <div className="text-[10px] text-zinc-500 leading-relaxed px-1">
            Background, particles, and effects are renderer windows now — add them from the Windows tab (e.g. `builtin:background`, `builtin:particles`, `builtin:effects`) instead of a style panel.
          </div>
        </div>
      )}

      {/* ── Desktop OS tab ───────────────────────────────── */}
      {tab === 'desktop-os' && isDesktop && <DesktopThemeEditor />}

      {tab !== 'desktop-os' && isUser && (
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

      {tab !== 'desktop-os' && (
        <ConfigApplyBar label={label} dirty={dirty} saving={saving} saved={saved} onApply={apply} onReset={reset} alwaysShow />
      )}
    </div>
  )
}
