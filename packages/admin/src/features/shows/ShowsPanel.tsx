import { useCallback, useEffect, useState } from 'react'
import type { ShowDefinition, ShowStep, EventAction } from '@ieomlabs/shared'
import { useAdminStore } from '../../store/useAdminStore'
import { fetchRunningShowIds, runShow, cancelShow } from '../../api/showsApi'
import { Button } from '../../components/atoms'
import { ConfigPageIntro, ConfigSectionPanel, ConfigCard, Btn } from '../../shared/ui'
import { normalizeDraftEventAction } from '../media-library/eventPresets'

// ── Helpers ──────────────────────────────────────────────────────────

function blankShow(): ShowDefinition {
  return { id: crypto.randomUUID(), label: 'New Show', steps: [] }
}

function blankStep(): ShowStep {
  return { delayMs: 0, label: '', action: { kind: 'obs-stream', cfg: { action: 'start' } } }
}

function describeAction(action: EventAction): string {
  switch (action.kind) {
    case 'obs-stream':    return `OBS ${action.cfg.action}`
    case 'widget-command': return `Widget ${action.cfg.action}: ${action.cfg.widgetId}`
    case 'widget-layout': return `Layout: ${action.cfg.layoutId}`
    default: return action.kind
  }
}

// ── StepEditor ───────────────────────────────────────────────────────

function StepEditor({ step, onChange, onRemove }: {
  step: ShowStep
  onChange: (s: ShowStep) => void
  onRemove: () => void
}) {
  const applications = useAdminStore((s) => s.config.applications)
  const widgetLayouts = useAdminStore((s) => s.config.widgetLayouts ?? [])

  const setActionKind = (kind: EventAction['kind']) => {
    let action: EventAction
    if (kind === 'obs-stream') action = { kind: 'obs-stream', cfg: { action: 'start' } }
    else if (kind === 'widget-command') action = { kind: 'widget-command', cfg: { widgetId: applications[0]?.id ?? '', action: 'toggle' } }
    else action = { kind: 'widget-layout', cfg: { layoutId: widgetLayouts[0]?.id ?? '' } }
    onChange({ ...step, action })
  }

  const a = step.action

  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.02] p-3 space-y-2">
      <div className="flex items-center gap-2">
        {/* delay */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-zinc-500 shrink-0">+</span>
          <input
            type="number"
            min={0}
            step={500}
            value={step.delayMs}
            onChange={(e) => onChange({ ...step, delayMs: Number(e.target.value) })}
            className="w-20 rounded-lg border border-zinc-700/60 bg-zinc-900/60 px-2 py-1 text-xs text-zinc-200 focus:border-cyan-500/50 focus:outline-none"
          />
          <span className="text-[10px] text-zinc-600">ms</span>
        </div>
        {/* label */}
        <input
          type="text"
          placeholder="label (optional)"
          value={step.label ?? ''}
          onChange={(e) => onChange({ ...step, label: e.target.value })}
          className="flex-1 min-w-0 rounded-lg border border-zinc-700/60 bg-zinc-900/60 px-2 py-1 text-xs text-zinc-300 placeholder-zinc-600 focus:border-cyan-500/50 focus:outline-none"
        />
        <button type="button" onClick={onRemove} className="text-zinc-600 hover:text-red-400 transition-colors text-sm shrink-0">✕</button>
      </div>

      <div className="flex items-center gap-2">
        {/* action kind */}
        <select
          value={a.kind}
          onChange={(e) => setActionKind(e.target.value as EventAction['kind'])}
          className="rounded-lg border border-zinc-700/60 bg-zinc-900/60 px-2 py-1 text-xs text-zinc-300 focus:border-cyan-500/50 focus:outline-none"
        >
          <option value="obs-stream">OBS Stream</option>
          <option value="widget-command">Widget Command</option>
          <option value="widget-layout">Widget Layout</option>
        </select>

        {a.kind === 'obs-stream' && (
          <select
            value={a.cfg.action}
            onChange={(e) => onChange({ ...step, action: { ...a, cfg: { ...a.cfg, action: e.target.value as 'start' | 'stop' } } })}
            className="rounded-lg border border-zinc-700/60 bg-zinc-900/60 px-2 py-1 text-xs text-zinc-300 focus:border-cyan-500/50 focus:outline-none"
          >
            <option value="start">Start</option>
            <option value="stop">Stop</option>
          </select>
        )}

        {a.kind === 'widget-command' && (
          <>
            <select
              value={a.cfg.widgetId}
              onChange={(e) => onChange({ ...step, action: { ...a, cfg: { ...a.cfg, widgetId: e.target.value } } })}
              className="flex-1 min-w-0 rounded-lg border border-zinc-700/60 bg-zinc-900/60 px-2 py-1 text-xs text-zinc-300 focus:border-cyan-500/50 focus:outline-none"
            >
              {applications.map((app) => (
                <option key={app.id} value={app.id}>{app.label}</option>
              ))}
            </select>
            <select
              value={a.cfg.action}
              onChange={(e) => onChange({ ...step, action: { ...a, cfg: { ...a.cfg, action: e.target.value as 'open' | 'close' | 'toggle' } } })}
              className="rounded-lg border border-zinc-700/60 bg-zinc-900/60 px-2 py-1 text-xs text-zinc-300 focus:border-cyan-500/50 focus:outline-none"
            >
              <option value="open">Open</option>
              <option value="close">Close</option>
              <option value="toggle">Toggle</option>
            </select>
          </>
        )}

        {a.kind === 'widget-layout' && (
          <select
            value={a.cfg.layoutId}
            onChange={(e) => onChange({ ...step, action: { ...a, cfg: { ...a.cfg, layoutId: e.target.value } } })}
            className="flex-1 min-w-0 rounded-lg border border-zinc-700/60 bg-zinc-900/60 px-2 py-1 text-xs text-zinc-300 focus:border-cyan-500/50 focus:outline-none"
          >
            {widgetLayouts.length === 0 && <option value="">No layouts</option>}
            {widgetLayouts.map((l) => (
              <option key={l.id} value={l.id}>{l.label}</option>
            ))}
          </select>
        )}
      </div>
    </div>
  )
}

// ── ShowEditor ───────────────────────────────────────────────────────

function ShowEditor({ show, onSave, onCancel }: {
  show: ShowDefinition
  onSave: (s: ShowDefinition) => void
  onCancel: () => void
}) {
  // Steps saved before widget-command/widget-layout joined ACTION_CATALOG
  // store their config flat on the action — lift to { kind, cfg } so the
  // step editor renders them.
  const [draft, setDraft] = useState<ShowDefinition>(() => {
    const clone: ShowDefinition = JSON.parse(JSON.stringify(show))
    return { ...clone, steps: clone.steps.map((s) => ({ ...s, action: normalizeDraftEventAction(s.action) as EventAction })) }
  })

  const addStep = () => setDraft((d) => ({ ...d, steps: [...d.steps, blankStep()] }))
  const updateStep = (i: number, s: ShowStep) => setDraft((d) => ({ ...d, steps: d.steps.map((x, j) => j === i ? s : x) }))
  const removeStep = (i: number) => setDraft((d) => ({ ...d, steps: d.steps.filter((_, j) => j !== i) }))

  return (
    <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={draft.label}
          onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
          placeholder="Show name"
          className="flex-1 rounded-lg border border-zinc-700/60 bg-zinc-900/60 px-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 focus:border-cyan-500/50 focus:outline-none"
        />
      </div>

      <div className="space-y-2">
        {draft.steps.map((step, i) => (
          <StepEditor key={i} step={step} onChange={(s) => updateStep(i, s)} onRemove={() => removeStep(i)} />
        ))}
        <button
          type="button"
          onClick={addStep}
          className="flex w-full items-center gap-1.5 rounded-xl border border-dashed border-white/10 px-3 py-2 text-[11px] text-zinc-500 transition-colors hover:border-cyan-500/35 hover:bg-cyan-500/8 hover:text-cyan-200"
        >
          <span>+</span> Add Step
        </button>
      </div>

      <div className="flex justify-end gap-2">
        <Btn type="button" variant="default" onClick={onCancel} className="px-3 py-1.5 text-xs">Cancel</Btn>
        <Button variant="primary" size="sm" onClick={() => onSave(draft)}>Save Show</Button>
      </div>
    </div>
  )
}

// ── ShowRow ──────────────────────────────────────────────────────────

function ShowRow({ show, running, onRun, onCancel, onEdit, onDelete }: {
  show: ShowDefinition
  running: boolean
  onRun: () => void
  onCancel: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-all ${
      running ? 'border-cyan-500/30 bg-cyan-500/8' : 'border-white/8 bg-white/[0.02]'
    }`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-zinc-200 truncate">{show.label}</span>
          {running && <span className="text-[9px] font-bold text-cyan-400 tracking-widest shrink-0">RUNNING</span>}
        </div>
        <div className="mt-0.5 text-[10px] text-zinc-600">
          {show.steps.length === 0 ? 'No steps' : show.steps.map((s, i) => (
            <span key={i} className="mr-2 text-zinc-500">
              <span className="text-zinc-600">{s.delayMs}ms</span>
              {' '}
              <span className="text-zinc-400">{describeAction(s.action)}</span>
              {i < show.steps.length - 1 && <span className="text-zinc-700"> ·</span>}
            </span>
          ))}
        </div>
      </div>

      {running ? (
        <Btn type="button" variant="warning" onClick={onCancel} className="px-3 py-1.5 text-xs shrink-0">Cancel</Btn>
      ) : (
        <Btn type="button" variant="default" onClick={onRun} className="px-3 py-1.5 text-xs shrink-0">▶ Run</Btn>
      )}
      <button type="button" onClick={onEdit} className="text-zinc-500 hover:text-cyan-300 transition-colors text-xs">Edit</button>
      <button type="button" onClick={onDelete} className="text-zinc-600 hover:text-red-400 transition-colors text-sm">✕</button>
    </div>
  )
}

// ── ShowsPanel ───────────────────────────────────────────────────────

export function ShowsPanel() {
  const config    = useAdminStore((s) => s.config)
  const saveConfig = useAdminStore((s) => s.saveConfig)

  const shows = config.shows ?? []

  const [runningIds, setRunningIds] = useState<string[]>([])
  const [editingId,  setEditingId]  = useState<string | null>(null) // 'new' or show.id
  const [newShow,    setNewShow]    = useState<ShowDefinition | null>(null)

  const refreshRunning = useCallback(async () => {
    try {
      const ids = await fetchRunningShowIds()
      setRunningIds(ids)
    } catch { /* server may not be connected */ }
  }, [])

  // Poll running shows every 3s
  useEffect(() => {
    void refreshRunning()
    const id = setInterval(() => { void refreshRunning() }, 3000)
    return () => clearInterval(id)
  }, [refreshRunning])

  async function handleRun(id: string) {
    await runShow(id)
    await refreshRunning()
  }

  async function handleCancel(id: string) {
    await cancelShow(id)
    await refreshRunning()
  }

  function handleEdit(show: ShowDefinition) {
    setEditingId(show.id)
    setNewShow(null)
  }

  function handleNewShow() {
    setNewShow(blankShow())
    setEditingId('new')
  }

  async function handleSaveEdit(updated: ShowDefinition) {
    if (editingId === 'new' && newShow) {
      await saveConfig({ shows: [...shows, updated] })
    } else {
      await saveConfig({ shows: shows.map((s) => s.id === updated.id ? updated : s) })
    }
    setEditingId(null)
    setNewShow(null)
  }

  async function handleDelete(id: string) {
    await saveConfig({ shows: shows.filter((s) => s.id !== id) })
  }

  return (
    <div className="space-y-5">
      <ConfigPageIntro title="Show Sequencer" eyebrow="Engine">
        Scripted show pipelines. Each show is an ordered list of timed steps — OBS stream start, widget commands, layout changes. Fire them from the Run button or via automation rules.
      </ConfigPageIntro>

      <ConfigSectionPanel label={`Shows${shows.length ? ` (${shows.length})` : ''}`}>
        {shows.length === 0 && editingId !== 'new' && (
          <div className="text-[10px] text-zinc-600 italic mb-3">No shows configured.</div>
        )}

        <div className="space-y-2">
          {shows.map((show) => (
            editingId === show.id ? (
              <ShowEditor
                key={show.id}
                show={show}
                onSave={handleSaveEdit}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <ShowRow
                key={show.id}
                show={show}
                running={runningIds.includes(show.id)}
                onRun={() => { void handleRun(show.id) }}
                onCancel={() => { void handleCancel(show.id) }}
                onEdit={() => handleEdit(show)}
                onDelete={() => { void handleDelete(show.id) }}
              />
            )
          ))}

          {editingId === 'new' && newShow && (
            <ShowEditor show={newShow} onSave={handleSaveEdit} onCancel={() => { setEditingId(null); setNewShow(null) }} />
          )}
        </div>

        {editingId !== 'new' && (
          <div className="mt-3">
            <button
              type="button"
              onClick={handleNewShow}
              className="flex w-full items-center gap-1.5 rounded-xl border border-dashed border-white/10 px-3 py-2 text-[11px] text-zinc-500 transition-colors hover:border-cyan-500/35 hover:bg-cyan-500/8 hover:text-cyan-200"
            >
              <span>+</span> New Show
            </button>
          </div>
        )}
      </ConfigSectionPanel>

      {runningIds.length > 0 && (
        <ConfigCard className="border-cyan-500/20 bg-cyan-500/5">
          <div className="text-[10px] font-semibold text-cyan-300 mb-1">Running</div>
          <div className="text-[10px] text-zinc-400 space-y-0.5">
            {runningIds.map((id) => {
              const show = shows.find((s) => s.id === id)
              return (
                <div key={id} className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse shrink-0" />
                  <span>{show?.label ?? id}</span>
                </div>
              )
            })}
          </div>
        </ConfigCard>
      )}
    </div>
  )
}
