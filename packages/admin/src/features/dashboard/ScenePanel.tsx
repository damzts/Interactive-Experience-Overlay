import { useCallback, useEffect, useRef, useState } from 'react'
import { STATE, RENDERER_CATALOG, resolveWindowInstance } from '@ieomlabs/shared'
import type { Scene, Sequence, SequenceStep, WindowInstance, TierName } from '@ieomlabs/shared'
import { useAdminStore } from '../../store/useAdminStore'
import { Btn, ConfigApplyBar, isSameDraft } from '../../shared/ui'
import { ConfigPanel } from '../../components/organisms'
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

// ── WindowsPanel ──────────────────────────────────────────────────
// Left: inline-expandable renderer list + add button
// Right: scene preview (drag canvas) only

const TIERS: TierName[] = ['background', 'particles', 'content', 'post', 'transition']

function RendererRow({
  win,
  windowPresets,
  expanded,
  onToggleExpand,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}: {
  win: WindowInstance
  windowPresets: ReturnType<typeof useAdminStore.getState>['config']['windowPresets']
  expanded: boolean
  onToggleExpand: () => void
  onChange: (updated: WindowInstance) => void
  onRemove: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  isFirst: boolean
  isLast: boolean
}) {
  const captureSources = useAdminStore((s) => s.config.captureSources ?? [])
  const resolved = resolveWindowInstance(win, windowPresets)
  const rt = resolved?.rendererType ?? win.rendererType ?? ''
  const meta = RENDERER_CATALOG.find((c) => c.id === rt)
  const cfg = win.config ?? {}

  const updateField = (key: string, value: unknown) =>
    onChange({ ...win, config: { ...win.config, [key]: value } })

  const updateRendererType = (rendererType: string) => {
    const entry = RENDERER_CATALOG.find((c) => c.id === rendererType)
    onChange({ ...win, rendererType, windowPresetId: undefined, config: entry?.defaultConfig ? { ...entry.defaultConfig } : {} })
  }

  return (
    <div className="mb-1.5">
      {/* collapsed / header row */}
      <div
        className={
          'group flex items-center gap-1.5 rounded-xl border px-2.5 py-2 cursor-pointer transition-colors ' +
          (expanded
            ? 'border-cyan-400/30 bg-cyan-500/10 text-zinc-100'
            : 'border-white/5 bg-white/[0.02] text-zinc-400 hover:border-white/12 hover:bg-white/[0.04] hover:text-zinc-200')
        }
        onClick={onToggleExpand}
      >
        {/* visibility dot */}
        <button type="button" title={win.visible ? 'Hide' : 'Show'}
          onClick={(e) => { e.stopPropagation(); onChange({ ...win, visible: !win.visible }) }}
          className={'h-1.5 w-1.5 shrink-0 rounded-full transition-colors ' + (win.visible ? 'bg-emerald-400' : 'bg-zinc-700 hover:bg-zinc-500')}
        />
        {/* lock toggle */}
        <button type="button" title={win.locked ? 'Unlock (allow drag/resize in canvas)' : 'Lock (exclude from drag canvas)'}
          onClick={(e) => { e.stopPropagation(); onChange({ ...win, locked: !win.locked }) }}
          className={'shrink-0 text-[11px] leading-none transition-colors ' + (win.locked ? 'text-amber-400' : 'text-zinc-700 opacity-0 group-hover:opacity-100 hover:text-zinc-400')}
        >
          {win.locked ? '🔒' : '🔓'}
        </button>
        <span className="shrink-0 text-[12px] leading-none">{meta?.icon ?? '▣'}</span>
        <span className="min-w-0 flex-1 truncate text-[11px] font-medium leading-tight">
          {meta?.label ?? (rt || 'Unset')}
        </span>
        <span className="shrink-0 rounded bg-white/[0.06] px-1 py-0.5 text-[9px] leading-none text-zinc-500">{win.tier ?? 'content'}</span>
        {/* reorder */}
        <div className="flex shrink-0 flex-col gap-px opacity-0 group-hover:opacity-100 transition-opacity">
          <button type="button" onClick={(e) => { e.stopPropagation(); onMoveUp() }} disabled={isFirst}
            className="px-0.5 text-[9px] leading-none text-zinc-500 hover:text-zinc-300 disabled:opacity-20">↑</button>
          <button type="button" onClick={(e) => { e.stopPropagation(); onMoveDown() }} disabled={isLast}
            className="px-0.5 text-[9px] leading-none text-zinc-500 hover:text-zinc-300 disabled:opacity-20">↓</button>
        </div>
        <button type="button" onClick={(e) => { e.stopPropagation(); onRemove() }}
          className="shrink-0 px-0.5 text-[10px] text-zinc-600 opacity-0 transition-all hover:text-red-400 group-hover:opacity-100">
          ✕
        </button>
      </div>

      {/* inline expanded config */}
      {expanded && (
        <div className="mx-1 mb-2 space-y-2 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2.5">
          {/* Renderer type */}
          <div>
            <div className="text-[10px] text-zinc-600 mb-0.5">Type</div>
            <select value={rt} onChange={(e) => updateRendererType(e.target.value)} className="w-full text-xs">
              <option value="">— choose —</option>
              {RENDERER_CATALOG.map((c) => (
                <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
              ))}
            </select>
          </div>

          {/* Tier */}
          <div>
            <div className="text-[10px] text-zinc-600 mb-0.5">Tier</div>
            <select value={win.tier ?? 'content'}
              onChange={(e) => onChange({ ...win, tier: e.target.value as TierName })}
              className="w-full text-xs">
              {TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {/* Renderer-specific fields */}
          {meta?.fields && meta.fields.length > 0 && (
            <div className="space-y-2 border-t border-white/8 pt-2">
              {meta.fields.map((field) => {
                const val = cfg[field.key]

                // screen-share: widgetId → capture source picker (must be first, before type checks)
                if (rt === 'screen-share' && field.key === 'widgetId') return (
                  <div key={field.key}>
                    <div className="text-[10px] text-zinc-600 mb-0.5">Capture Source</div>
                    {captureSources.length === 0 ? (
                      <div className="rounded border border-white/8 bg-white/[0.02] px-2.5 py-1.5 text-[10px] italic text-zinc-600">
                        No sources — add one above.
                      </div>
                    ) : (
                      <select value={String(val ?? '')}
                        onChange={(e) => updateField('widgetId', e.target.value)}
                        className="w-full text-xs">
                        <option value="">— select source —</option>
                        {captureSources.map((src) => (
                          <option key={src.id} value={src.id}>{src.name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                )

                if (field.type === 'boolean') return (
                  <label key={field.key} className="flex cursor-pointer items-center gap-2">
                    <input type="checkbox" checked={Boolean(val)}
                      onChange={(e) => updateField(field.key, e.target.checked)}
                      className="h-3.5 w-3.5 accent-cyan-400" />
                    <span className="text-[11px] text-zinc-400">{field.label}</span>
                  </label>
                )
                if (field.type === 'select') return (
                  <div key={field.key}>
                    <div className="text-[10px] text-zinc-600 mb-0.5">{field.label}</div>
                    <select value={String(val ?? '')}
                      onChange={(e) => updateField(field.key, e.target.value)}
                      className="w-full text-xs">
                      {field.options?.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                )
                if (field.type === 'number') return (
                  <div key={field.key}>
                    <div className="text-[10px] text-zinc-600 mb-0.5">{field.label}</div>
                    <input type="number" value={val != null ? Number(val) : ''}
                      min={field.min} max={field.max} step={field.step}
                      onChange={(e) => updateField(field.key, Number(e.target.value))}
                      className="w-full text-xs" />
                  </div>
                )
                if (field.type === 'color') return (
                  <div key={field.key} className="flex items-center gap-2">
                    <span className="flex-1 text-[10px] text-zinc-600">{field.label}</span>
                    <input type="color" value={String(val ?? '#000000')}
                      onChange={(e) => updateField(field.key, e.target.value)}
                      className="h-6 w-10 cursor-pointer rounded border-0 bg-transparent p-0" />
                  </div>
                )
                return (
                  <div key={field.key}>
                    <div className="text-[10px] text-zinc-600 mb-0.5">{field.label}</div>
                    <input type="text" value={String(val ?? '')} placeholder={field.placeholder ?? ''}
                      onChange={(e) => updateField(field.key, e.target.value)}
                      className="w-full text-xs" />
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function WindowsPanel({
  windows,
  windowPresets,
  selectedId,
  onSelect,
  onChange,
  onChangePosition,
}: {
  windows: WindowInstance[]
  windowPresets: ReturnType<typeof useAdminStore.getState>['config']['windowPresets']
  selectedId: string | null
  onSelect: (id: string | null) => void
  onChange: (next: WindowInstance[]) => void
  onChangePosition: (id: string, pos: { x: number; y: number; width: number; height: number }) => void
}) {
  const sorted = [...windows].sort((a, b) => a.zIndex - b.zIndex)
  const dragId = useRef<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)

  const reorder = (fromId: string, toId: string) => {
    if (fromId === toId) return
    const ordered = [...windows].sort((a, b) => a.zIndex - b.zIndex)
    const fromIdx = ordered.findIndex((w) => w.id === fromId)
    const toIdx   = ordered.findIndex((w) => w.id === toId)
    if (fromIdx < 0 || toIdx < 0) return
    const next = [...ordered]
    const [moved] = next.splice(fromIdx, 1)
    next.splice(toIdx, 0, moved)
    onChange(next.map((w, idx) => ({ ...w, zIndex: idx })))
  }

  const moveUp = (id: string) => {
    const ordered = [...windows].sort((a, b) => a.zIndex - b.zIndex)
    const i = ordered.findIndex((w) => w.id === id)
    if (i <= 0) return
    ;[ordered[i - 1], ordered[i]] = [ordered[i], ordered[i - 1]]
    onChange(ordered.map((w, idx) => ({ ...w, zIndex: idx })))
  }
  const moveDown = (id: string) => {
    const ordered = [...windows].sort((a, b) => a.zIndex - b.zIndex)
    const i = ordered.findIndex((w) => w.id === id)
    if (i < 0 || i === ordered.length - 1) return
    ;[ordered[i], ordered[i + 1]] = [ordered[i + 1], ordered[i]]
    onChange(ordered.map((w, idx) => ({ ...w, zIndex: idx })))
  }
  const addWindow = () => {
    const newWin: WindowInstance = {
      id: `win-${Date.now()}`,
      position: { x: 0, y: 0, width: 1920, height: 1080 },
      zIndex: windows.length,
      visible: true,
    }
    onChange([...windows, newWin])
    onSelect(newWin.id)
  }

  return (
    <div className="flex gap-3 min-h-0">
      {/* ── Left: renderer list ───────────────────────────── */}
      <div className="flex w-[220px] shrink-0 flex-col overflow-y-auto max-h-[70vh]">
        {sorted.map((w, idx) => (
          <div
            key={w.id}
            draggable
            onDragStart={() => { dragId.current = w.id }}
            onDragEnd={() => { dragId.current = null; setDragOverId(null) }}
            onDragOver={(e) => { e.preventDefault(); setDragOverId(w.id) }}
            onDrop={(e) => { e.preventDefault(); if (dragId.current) reorder(dragId.current, w.id); setDragOverId(null) }}
            className={dragOverId === w.id && dragId.current !== w.id ? 'border-t-2 border-cyan-400' : ''}
          >
            <RendererRow
              win={w}
              windowPresets={windowPresets}
              expanded={selectedId === w.id}
              onToggleExpand={() => onSelect(selectedId === w.id ? null : w.id)}
              onChange={(updated) => onChange(windows.map((x) => x.id === w.id ? updated : x))}
              onRemove={() => { onChange(windows.filter((x) => x.id !== w.id)); if (selectedId === w.id) onSelect(null) }}
              onMoveUp={() => moveUp(w.id)}
              onMoveDown={() => moveDown(w.id)}
              isFirst={idx === 0}
              isLast={idx === sorted.length - 1}
            />
          </div>
        ))}
        <button type="button" onClick={addWindow}
          className="mt-1 flex items-center gap-1.5 rounded-xl border border-dashed border-white/10 px-3 py-2 text-[11px] text-zinc-500 transition-colors hover:border-cyan-500/35 hover:bg-cyan-500/8 hover:text-cyan-200">
          <span className="w-4 shrink-0 text-center text-sm">+</span>
          <span>Add renderer</span>
        </button>
      </div>

      {/* ── Right: preview only ───────────────────────────── */}
      <div className="flex flex-1 min-w-0 flex-col">
        <ScenePreview
          windows={windows}
          selectedId={selectedId}
          onSelect={onSelect}
          onChangePosition={onChangePosition}
        />
      </div>
    </div>
  )
}

// ── ScenePanel ────────────────────────────────────────────────────

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
        <WindowsPanel
          windows={draft.windows}
          windowPresets={windowPresets}
          selectedId={selectedWindowId}
          onSelect={setSelectedWindowId}
          onChange={(next) => update((d) => { d.windows = next })}
          onChangePosition={(id, pos) => update((d) => {
            const w = d.windows.find((x) => x.id === id)
            if (w) w.position = pos
          })}
        />
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
