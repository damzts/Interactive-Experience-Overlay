import { useCallback, useEffect, useRef, useState } from 'react'
import type { EventConfig, AutoTrigger, ConfigPreset } from '@ieomlabs/shared'
import { useAdminStore } from '../../store/useAdminStore'
import { socket } from '../../socket/client'
import { fetchPresets } from '../../api/presetsApi'
import {
  ConfigCard, ConfigApplyBar, ConfigPageIntro, ConfigSectionPanel,
  Toggle, Slider, ConfigChoiceButton, isSameDraft,
} from '../../shared/ui'

// ── Helpers ────────────────────────────────────────────────────────

function formatRelative(ts: number | null): string {
  if (!ts) return '—'
  const d = ts - Date.now()
  if (d <= 0) return 'now'
  const s = Math.ceil(d / 1000)
  if (s < 60) return `in ${s}s`
  return `in ${Math.ceil(s / 60)}m`
}

function formatAgo(ts: number | null): string {
  if (!ts) return '—'
  const d = Date.now() - ts
  if (d < 1000) return 'just now'
  const s = Math.round(d / 1000)
  if (s < 60) return `${s}s ago`
  return `${Math.round(s / 60)}m ago`
}

/** A sourceEvents entry created by the Preset Rotation quick-create form —
 *  its only action is swapping the whole config to a saved preset. */
function isPresetRotationEvent(event: EventConfig): boolean {
  return event.actions?.length === 1 && event.actions[0].kind === 'preset-apply'
}

function blankPresetRotationEvent(preset: ConfigPreset): EventConfig {
  return {
    id: crypto.randomUUID(),
    label: `🎭 ${preset.label}`,
    icon: '💾',
    color: 'text-fuchsia-400',
    desc: `Swaps the whole config to preset "${preset.label}"`,
    effects: [],
    actions: [{ kind: 'preset-apply', cfg: { presetId: preset.id } }],
    auto: { enabled: true, mode: 'interval', intervalMin: 30, idleMin: 10, chance: 1, cooldownMin: 0 },
  }
}

// ── EventRow ───────────────────────────────────────────────────────

function EventRow({
  event,
  diag,
  onChange,
  onDelete,
}: {
  event: EventConfig
  diag: { nextRunAt: number | null; due: boolean; idleTriggered: boolean } | undefined
  onChange: (patch: Partial<AutoTrigger>) => void
  onDelete?: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const auto = event.auto
  const hasWork = event.effects.length > 0 || (event.actions?.length ?? 0) > 0
  const sceneIds = useAdminStore((s) => Object.keys(s.config.scenes ?? {}))

  return (
    <ConfigCard>
      <div
        className="flex w-full cursor-pointer items-center gap-3"
        onClick={() => setExpanded((e) => !e)}
      >
        <span className="text-base shrink-0">{event.icon || '⚡'}</span>
        <span className="flex-1 min-w-0">
          <span className="block text-xs font-semibold text-zinc-200 truncate">{event.label}</span>
          <span className="block text-[10px] text-zinc-500 truncate">
            {auto.enabled
              ? auto.mode === 'interval'
                ? `interval · ${auto.intervalMin}m · ${Math.round(auto.chance * 100)}% chance`
                : `idle · after ${auto.idleMin}m idle · ${Math.round(auto.chance * 100)}% chance`
              : 'disabled'}
            {' · '}{event.actions?.length ?? 0} actions · {event.effects.length} fx
          </span>
        </span>
        <div
          className="flex items-center gap-2 shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          {!hasWork && auto.enabled && (
            <span className="text-[9px] font-bold text-rose-400 tracking-widest">NO WORK</span>
          )}
          {diag?.due && (
            <span className="text-[9px] font-bold text-amber-400 tracking-widest">DUE</span>
          )}
          {auto.enabled && diag?.nextRunAt && (
            <span className="text-[10px] text-zinc-500 tabular-nums">{formatRelative(diag.nextRunAt)}</span>
          )}
          <Toggle
            checked={auto.enabled}
            onChange={(v) => onChange({ enabled: v })}
          />
          {onDelete && (
            <button type="button" onClick={onDelete} className="text-zinc-600 hover:text-red-400 transition-colors text-sm">✕</button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="mt-4 space-y-4 border-t border-white/8 pt-4">
          {!hasWork && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/8 px-4 py-3 text-[10px] text-rose-300">
              This event has no actions or effects — it will be skipped by the scheduler even if enabled. Add actions or effects in Graphics → Effects.
            </div>
          )}

          {/* Mode */}
          <div>
            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Mode</div>
            <div className="flex gap-1.5">
              <ConfigChoiceButton selected={auto.mode === 'interval'} onClick={() => onChange({ mode: 'interval' })}>
                Interval
              </ConfigChoiceButton>
              <ConfigChoiceButton selected={auto.mode === 'idle'} onClick={() => onChange({ mode: 'idle' })}>
                Idle
              </ConfigChoiceButton>
            </div>
          </div>

          {auto.mode === 'interval' && (
            <Slider label="Interval (min)" value={auto.intervalMin} min={1} max={120} step={1}
              unit=" min"
              onChange={(v) => onChange({ intervalMin: v })} />
          )}
          {auto.mode === 'idle' && (
            <Slider label="Idle threshold" value={auto.idleMin} min={1} max={120} step={1}
              unit=" min"
              onChange={(v) => onChange({ idleMin: v })} />
          )}

          <Slider label="Chance" value={auto.chance} min={0} max={1} step={0.05}
            onChange={(v) => onChange({ chance: v })} />

          <Slider label="Cooldown" value={auto.cooldownMin} min={0} max={60} step={1}
            unit=" min"
            onChange={(v) => onChange({ cooldownMin: v })} />

          {/* Allowed states */}
          <div>
            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Allowed scenes <span className="font-normal text-zinc-600">(empty = any)</span>
            </div>
            <div className="flex gap-1.5">
              {sceneIds.map((s) => {
                const active = (auto.allowedStates ?? []).includes(s)
                return (
                  <ConfigChoiceButton key={s} selected={active} onClick={() => {
                    const cur = auto.allowedStates ?? []
                    onChange({ allowedStates: active ? cur.filter((x) => x !== s) : [...cur, s] })
                  }}>
                    {s}
                  </ConfigChoiceButton>
                )
              })}
            </div>
          </div>

          {/* Diagnostics */}
          {diag && (
            <div className="rounded-xl border border-white/6 bg-white/[0.02] px-5 py-4 text-[10px] text-zinc-500 space-y-0.5">
              <div>Next run: <span className="text-zinc-400">{formatRelative(diag.nextRunAt)}</span></div>
              {diag.idleTriggered && <div className="text-zinc-600">Idle already triggered this session</div>}
            </div>
          )}

          {/* Fire Now */}
          <div className="flex justify-end">
            <button
              type="button"
              disabled={!hasWork}
              onClick={() => socket.emit('event:preview', event)}
              className="rounded-md border border-cyan-500/35 bg-cyan-500/10 px-3 py-1.5 text-[11px] font-semibold text-cyan-300 transition hover:border-cyan-400/60 hover:bg-cyan-500/20 hover:text-cyan-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              ▶ Fire Now
            </button>
          </div>
        </div>
      )}
    </ConfigCard>
  )
}

// ── PresetRotationPanel ──────────────────────────────────────────────

/** Dedicated Ambiance tab for preset rotation — randomly swaps the entire
 *  config to a saved preset on a timer, using the same scheduler engine as
 *  plain Events. Presets themselves are managed in Settings → Presets. */
export function PresetRotationPanel() {
  const events      = useAdminStore((s) => (s.config.sourceEvents ?? []).filter(isPresetRotationEvent))
  const saveConfig  = useAdminStore((s) => s.saveConfig)
  const allEvents   = useAdminStore((s) => s.config.sourceEvents ?? [])
  const diag        = useAdminStore((s) => s.runtimeDiagnostics.scheduler)

  // tick every second so countdowns refresh
  const [, setTick] = useState(0)
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => {
    tickRef.current = setInterval(() => setTick((n) => n + 1), 1000)
    return () => { if (tickRef.current) clearInterval(tickRef.current) }
  }, [])

  const diagByEventId = Object.fromEntries(diag.events.map((e) => [e.id, e]))

  const [draft, setDraft] = useState<EventConfig[]>(() => structuredClone(events))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const dirty = !isSameDraft(draft, events)

  useEffect(() => {
    if (dirty) return
    setDraft((prev) => (isSameDraft(prev, events) ? prev : structuredClone(events)))
    setSaved(false)
  }, [dirty, events])

  useEffect(() => () => { if (savedTimer.current) clearTimeout(savedTimer.current) }, [])

  const update = useCallback((updater: (list: EventConfig[]) => void) => {
    setDraft((prev) => {
      const next = structuredClone(prev)
      updater(next)
      setSaved(false)
      return next
    })
  }, [])

  const [presets, setPresets] = useState<ConfigPreset[]>([])
  const [selectedPresetId, setSelectedPresetId] = useState('')

  useEffect(() => { void fetchPresets().then(setPresets).catch(() => {}) }, [])

  const handleChange = (eventId: string, patch: Partial<AutoTrigger>) => {
    update((list) => {
      const ev = list.find((e) => e.id === eventId)
      if (ev) ev.auto = { ...ev.auto, ...patch }
    })
  }

  const handleAdd = () => {
    const preset = presets.find((p) => p.id === selectedPresetId)
    if (!preset) return
    update((list) => { list.push(blankPresetRotationEvent(preset)) })
    setSelectedPresetId('')
  }

  const handleDelete = (eventId: string) => {
    update((list) => {
      const i = list.findIndex((e) => e.id === eventId)
      if (i >= 0) list.splice(i, 1)
    })
  }

  const apply = useCallback(async () => {
    if (!dirty) return
    setSaving(true)
    // Preset rotation events live in the same sourceEvents array as plain
    // scheduled presets (Ambiance → Scheduler) — merge our draft back with
    // whatever non-rotation events currently exist so neither tab clobbers
    // the other.
    const plainEvents = allEvents.filter((e) => !isPresetRotationEvent(e))
    await saveConfig({ sourceEvents: [...plainEvents, ...draft] })
    setSaving(false)
    if (savedTimer.current) clearTimeout(savedTimer.current)
    setSaved(true)
    savedTimer.current = setTimeout(() => setSaved(false), 1500)
  }, [dirty, saveConfig, draft, allEvents])

  const reset = useCallback(() => {
    setDraft(structuredClone(events))
    setSaved(false)
  }, [events])

  return (
    <div className="space-y-5">
      <ConfigPageIntro title="Preset Rotation">
        Randomly swaps the entire config to a saved preset on a timer — same engine as the plain
        Events tab, except the whole thematic (skin, ambiance, sounds, everything the preset
        captured) changes at once instead of just one layer. Presets are managed in
        Settings → Presets.
      </ConfigPageIntro>

      <div className="flex gap-2">
        <select
          value={selectedPresetId}
          onChange={(e) => setSelectedPresetId(e.target.value)}
          className="flex-1 rounded-md border border-white/10 bg-zinc-900 px-2 py-1.5 text-[11px] text-zinc-200 focus:border-fuchsia-500/50 focus:outline-none"
        >
          <option value="">
            {presets.length === 0 ? 'No presets saved yet' : 'Select a preset…'}
          </option>
          {presets.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
        <button
          type="button"
          onClick={handleAdd}
          disabled={!selectedPresetId}
          className="rounded-md border border-fuchsia-500/40 bg-fuchsia-500/10 px-3 py-1.5 text-[11px] font-semibold text-fuchsia-300 hover:border-fuchsia-400/60 hover:bg-fuchsia-500/20 hover:text-fuchsia-100 transition disabled:cursor-not-allowed disabled:opacity-40"
        >
          + Add Rotation
        </button>
      </div>

      {draft.length === 0 ? (
        <div className="text-[10px] text-zinc-600 italic">No preset rotations configured.</div>
      ) : (
        <ConfigSectionPanel label="Rotations">
          <div className="space-y-2">
            {draft.map((event) => (
              <EventRow
                key={event.id}
                event={event}
                diag={diagByEventId[event.id]}
                onChange={(patch) => handleChange(event.id, patch)}
                onDelete={() => handleDelete(event.id)}
              />
            ))}
          </div>
        </ConfigSectionPanel>
      )}

      <ConfigApplyBar
        label="Preset Rotation"
        dirty={dirty}
        saving={saving}
        saved={saved}
        onApply={apply}
        onReset={reset}
        alwaysShow
      />
    </div>
  )
}
