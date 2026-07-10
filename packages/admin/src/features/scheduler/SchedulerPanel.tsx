import { useCallback, useEffect, useRef, useState } from 'react'
import type { EventConfig, AutoTrigger } from '@ieomlabs/shared'
import { useAdminStore } from '../../store/useAdminStore'
import { socket } from '../../socket/client'
import {
  ConfigCard, ConfigApplyBar, ConfigPageIntro, ConfigSectionPanel,
  Toggle, Slider, ConfigChoiceButton, Btn, isSameDraft,
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

/** A sourceEvents entry created by the Preset Rotation quick-create form —
 *  its only action is swapping the whole config to a saved config preset
 *  (not to be confused with an Effect/Action preset). These live in the
 *  same sourceEvents array but are edited exclusively in the dedicated
 *  Preset Rotation tab (Ambiance → Preset Rotation), so they're filtered
 *  out of the plain Scheduler list here. */
function isPresetRotationEvent(event: EventConfig): boolean {
  return event.actions?.length === 1 && event.actions[0].kind === 'preset-apply'
}

const PRESET_TYPE_BADGE: Record<'effect' | 'action', { label: string; className: string }> = {
  effect: { label: 'Effect', className: 'bg-cyan-500/10 text-cyan-300' },
  action: { label: 'Action', className: 'bg-violet-500/10 text-violet-300' },
}

function PresetTypeBadge({ presetType }: { presetType?: 'effect' | 'action' }) {
  const badge = presetType ? PRESET_TYPE_BADGE[presetType] : null
  return (
    <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] ${badge ? badge.className : 'bg-zinc-500/10 text-zinc-400'}`}>
      {badge ? badge.label : 'Legacy'}
    </span>
  )
}

// ── Blank slot card ──────────────────────────────────────────────────
// A freshly added, unassigned schedule slot — pick a preset inline to
// turn it into a real ScheduleRow. Mirrors an empty StormCard.

function BlankScheduleSlot({
  candidates,
  onPick,
  onRemove,
}: {
  candidates: EventConfig[]
  onPick: (eventId: string) => void
  onRemove: () => void
}) {
  return (
    <ConfigCard className="flex min-w-0 flex-col gap-3 p-4">
      <div className="flex items-center gap-2">
        <span className="text-base shrink-0">⚡</span>
        <span className="min-w-0 flex-1 truncate text-xs font-semibold text-zinc-500">New schedule slot</span>
        <button
          type="button"
          onClick={onRemove}
          title="Remove"
          className="text-zinc-600 hover:text-red-400 transition-colors text-sm"
        >
          ✕
        </button>
      </div>
      <select
        defaultValue=""
        onChange={(e) => { if (e.target.value) onPick(e.target.value) }}
        disabled={candidates.length === 0}
        className="w-full text-xs"
      >
        <option value="" disabled>
          {candidates.length === 0 ? 'No more presets available' : '— choose a preset —'}
        </option>
        {candidates.map((event) => (
          <option key={event.id} value={event.id}>
            {event.icon ? `${event.icon} ` : ''}{event.label}
          </option>
        ))}
      </select>
    </ConfigCard>
  )
}

// ── ScheduleRow ──────────────────────────────────────────────────────

function ScheduleRow({
  event,
  diag,
  onChange,
  onRemove,
}: {
  event: EventConfig
  diag: { nextRunAt: number | null; due: boolean; idleTriggered: boolean } | undefined
  onChange: (patch: Partial<AutoTrigger>) => void
  onRemove: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const auto = event.auto
  const hasWork = event.effects.length > 0 || (event.actions?.length ?? 0) > 0
  const sceneIds = useAdminStore((s) => Object.keys(s.config.scenes ?? {}))

  return (
    <ConfigCard className="flex min-w-0 flex-col gap-3 p-4">
      <div
        className="flex w-full cursor-pointer items-center gap-2"
        onClick={() => setExpanded((e) => !e)}
      >
        <span className="text-base shrink-0">{event.icon || '⚡'}</span>
        <span className="min-w-0 flex-1 truncate text-xs font-semibold text-zinc-200">{event.label}</span>
        <PresetTypeBadge presetType={event.presetType} />
        <div
          className="flex items-center gap-2 shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <Toggle
            checked={auto.enabled}
            onChange={(v) => onChange({ enabled: v })}
          />
          <button
            type="button"
            onClick={onRemove}
            title="Remove from schedule"
            className="text-zinc-600 hover:text-red-400 transition-colors text-sm"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between text-[10px] text-zinc-500">
        <span className="truncate">
          {auto.enabled
            ? auto.mode === 'interval'
              ? `interval · ${auto.intervalMin}m · ${Math.round(auto.chance * 100)}% chance`
              : `idle · after ${auto.idleMin}m idle · ${Math.round(auto.chance * 100)}% chance`
            : 'disabled'}
        </span>
        <span className="flex items-center gap-1.5 shrink-0">
          {!hasWork && auto.enabled && (
            <span className="text-[9px] font-bold text-rose-400 tracking-widest">NO WORK</span>
          )}
          {diag?.due && (
            <span className="text-[9px] font-bold text-amber-400 tracking-widest">DUE</span>
          )}
          {auto.enabled && diag?.nextRunAt && (
            <span className="tabular-nums">{formatRelative(diag.nextRunAt)}</span>
          )}
        </span>
      </div>

      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="self-start rounded-md border border-zinc-700/80 bg-zinc-900/80 px-2 py-1 text-[10px] font-medium text-zinc-300 transition hover:border-zinc-600/80 hover:text-zinc-100"
      >
        {expanded ? 'Collapse' : 'Expand'}
      </button>

      {expanded && (
        <div className="space-y-4 border-t border-white/8 pt-3">
          {!hasWork && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/8 px-4 py-3 text-[10px] text-rose-300">
              This preset is empty — it will be skipped by the scheduler even if enabled. Configure it in Events.
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
            <div className="flex flex-wrap gap-1.5">
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

// ── SchedulerPanel ─────────────────────────────────────────────────

export function SchedulerPanel() {
  const allEvents   = useAdminStore((s) => s.config.sourceEvents ?? [])
  const events      = allEvents.filter((e) => !isPresetRotationEvent(e))
  const saveConfig  = useAdminStore((s) => s.saveConfig)
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
  // Which preset ids are shown on the schedule. Rather than auto-listing
  // every saved preset, the Scheduler starts empty — only presets the user
  // has explicitly added (via "+ Add Preset", or that already had
  // scheduling turned on from a previous session) show up here.
  const [visibleIds, setVisibleIds] = useState<Set<string>>(
    () => new Set(events.filter((e) => e.auto.enabled).map((e) => e.id)),
  )
  // Blank slots added via "+ Add Preset" that don't have a preset chosen
  // yet — each renders as an empty card with an inline picker, mirroring
  // Effect Storms' "+ Add Storm" creating an unconfigured card in place.
  const [blankSlots, setBlankSlots] = useState<string[]>([])
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

  const handleChange = (eventId: string, patch: Partial<AutoTrigger>) => {
    update((list) => {
      const ev = list.find((e) => e.id === eventId)
      if (ev) ev.auto = { ...ev.auto, ...patch }
    })
  }

  const visibleRows = draft.filter((e) => visibleIds.has(e.id))
  const addCandidates = draft.filter((e) => !visibleIds.has(e.id))

  const addBlankSlot = () => {
    setBlankSlots((prev) => [...prev, crypto.randomUUID()])
  }

  const removeBlankSlot = (slotId: string) => {
    setBlankSlots((prev) => prev.filter((id) => id !== slotId))
  }

  const pickPresetForSlot = (slotId: string, eventId: string) => {
    setVisibleIds((prev) => new Set(prev).add(eventId))
    setBlankSlots((prev) => prev.filter((id) => id !== slotId))
  }

  const removePreset = (eventId: string) => {
    // Removing from the schedule just hides + disables it here — the
    // preset itself (its effects/actions) is untouched and stays available
    // in Events / Input Engine / Preset Rotation.
    setVisibleIds((prev) => {
      const next = new Set(prev)
      next.delete(eventId)
      return next
    })
    handleChange(eventId, { enabled: false })
  }

  const apply = useCallback(async () => {
    if (!dirty) return
    setSaving(true)
    // Preset rotation events (Ambiance → Preset Rotation) live in the same
    // sourceEvents array — preserve them here so saving the plain Scheduler
    // list never clobbers rotations configured in the other tab.
    const presetEvents = allEvents.filter(isPresetRotationEvent)
    await saveConfig({ sourceEvents: [...draft, ...presetEvents] })
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
      <ConfigPageIntro title="Scheduler">
        Schedules saved presets — Effect or Action — to fire automatically on an interval or
        after idle time, with a chance and cooldown. Add a preset to put it on the schedule;
        presets themselves (their effects or actions) are authored in Events.
      </ConfigPageIntro>

      {visibleRows.length === 0 && blankSlots.length === 0 ? (
        <div className="text-xs text-zinc-600 italic px-1">Nothing scheduled yet. Add a preset to get started.</div>
      ) : (
        <ConfigSectionPanel label="Scheduled Presets">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {visibleRows.map((event) => (
              <ScheduleRow
                key={event.id}
                event={event}
                diag={diagByEventId[event.id]}
                onChange={(patch) => handleChange(event.id, patch)}
                onRemove={() => removePreset(event.id)}
              />
            ))}
            {blankSlots.map((slotId) => (
              <BlankScheduleSlot
                key={slotId}
                candidates={addCandidates}
                onPick={(eventId) => pickPresetForSlot(slotId, eventId)}
                onRemove={() => removeBlankSlot(slotId)}
              />
            ))}
          </div>
        </ConfigSectionPanel>
      )}

      <Btn type="button" variant="ghost" onClick={addBlankSlot} className="w-full justify-center border-dashed border-zinc-700/80 py-2 text-xs">
        + Add Preset
      </Btn>

      <ConfigApplyBar
        label="Scheduler"
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
