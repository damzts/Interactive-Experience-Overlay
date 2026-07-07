import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { STATE, getEffectLabel, withDesktopAmbianceDefaults, DEFAULT_DESKTOP_THEME_DRIFT } from '@ieomlabs/shared'
import type { DesktopAmbianceConfig, DesktopThemeDriftConfig, EffectAmbianceConfig, EffectConfig, EffectType, EventConfig, AutoTrigger, ConfigPreset } from '@ieomlabs/shared'
import { useAdminStore } from '../../store/useAdminStore'
import { socket } from '../../socket/client'
import { fetchPresets } from '../../api/presetsApi'
import {
  Btn, ConfigCard, ConfigApplyBar, ConfigPageIntro, ConfigSectionPanel,
  Toggle, Slider, ConfigChoiceButton, isSameDraft,
} from '../../shared/ui'
import { EFFECT_CATEGORIES, createEffectDraft } from '../media-library/eventPresets'
import {
  createDefaultNavBehavior, createDefaultWidgetBehavior,
  WidgetAmbianceSection, LayoutAmbianceSection, SceneAmbianceSection,
} from './DesktopAmbianceSections'
import type { AmbianceUpdater } from './DesktopAmbianceSections'

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

const ALL_STATES: STATE[] = [STATE.LOBBY, STATE.DESKTOP]

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
    actions: [{ kind: 'preset-apply', presetId: preset.id }],
    auto: { enabled: true, mode: 'interval', intervalMin: 30, idleMin: 10, chance: 1, cooldownMin: 0 },
  }
}

const DEFAULT_EFFECT_AMBIANCE: EffectAmbianceConfig = {
  enabled: false,
  pool: [],
  intervalSeconds: 30,
  jitterFactor: 0.3,
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
              This event has no actions or effects — it will be skipped by the scheduler even if enabled. Add actions or effects in the Asset Library → Events tab.
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
              {ALL_STATES.map((s) => {
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

// ── EffectAmbianceSection ──────────────────────────────────────────

function EffectAmbianceSection({
  config,
  onChange,
}: {
  config: EffectAmbianceConfig
  onChange: (patch: Partial<EffectAmbianceConfig>) => void
}) {
  const [selectedType, setSelectedType] = useState<EffectType>('screen-shake')

  const addToPool = () => {
    const draft = createEffectDraft(selectedType)
    onChange({ pool: [...config.pool, draft] })
  }

  const removeFromPool = (index: number) => {
    onChange({ pool: config.pool.filter((_, i) => i !== index) })
  }

  const firePreview = () => {
    if (!config.pool.length) return
    const effect = config.pool[Math.floor(Math.random() * config.pool.length)]
    socket.emit('event:preview', {
      id: 'ambiance-preview',
      label: 'Ambiance Preview',
      icon: '✨',
      color: 'text-violet-400',
      desc: '',
      effects: [effect],
      auto: { enabled: false, mode: 'interval' as const, intervalMin: 15, idleMin: 5, chance: 1, cooldownMin: 0 },
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-semibold text-zinc-200">Effect Ambiance</div>
          <div className="text-[10px] text-zinc-500 mt-0.5">Randomly fires overlay effects on a timer in the background.</div>
        </div>
        <Toggle checked={config.enabled} onChange={(v) => onChange({ enabled: v })} />
      </div>

      <Slider
        label="Interval"
        value={config.intervalSeconds}
        min={1}
        max={300}
        step={1}
        unit="s"
        onChange={(v) => onChange({ intervalSeconds: v })}
      />

      <Slider
        label="Jitter"
        value={config.jitterFactor ?? 0.3}
        min={0}
        max={0.8}
        step={0.05}
        onChange={(v) => onChange({ jitterFactor: v })}
      />

      <Slider
        label="Effects per tick"
        value={config.countPerTick ?? 1}
        min={1}
        max={Math.max(1, config.pool.length) || 10}
        step={1}
        unit=""
        onChange={(v) => onChange({ countPerTick: v })}
      />

      {/* Pool editor */}
      <div>
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          Effect Pool <span className="font-normal text-zinc-600">({config.pool.length} effect{config.pool.length !== 1 ? 's' : ''})</span>
        </div>

        {/* Add picker */}
        <div className="flex gap-2 mb-3">
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value as EffectType)}
            className="flex-1 rounded-md border border-white/10 bg-zinc-900 px-2 py-1.5 text-[11px] text-zinc-200 focus:border-violet-500/50 focus:outline-none"
          >
            {EFFECT_CATEGORIES.filter(c => c.label !== 'Audio').map((cat) => (
              <optgroup key={cat.label} label={cat.label}>
                {cat.effects.map((t) => (
                  <option key={t} value={t}>{getEffectLabel(t)}</option>
                ))}
              </optgroup>
            ))}
          </select>
          <button
            type="button"
            onClick={addToPool}
            className="rounded-md border border-violet-500/40 bg-violet-500/10 px-3 py-1.5 text-[11px] font-semibold text-violet-300 hover:border-violet-400/60 hover:bg-violet-500/20 hover:text-violet-100 transition"
          >
            + Add
          </button>
        </div>

        {/* Pool list */}
        {config.pool.length === 0 ? (
          <div className="text-[10px] text-zinc-600 italic">No effects in pool. Add effects above to enable ambiance mode.</div>
        ) : (
          <div className="space-y-1.5">
            {config.pool.map((eff: EffectConfig, i: number) => (
              <div key={i} className="flex items-center justify-between rounded-lg border border-white/6 bg-white/[0.02] px-3 py-2">
                <span className="text-[10px] font-mono text-violet-300 truncate">{eff.type}</span>
                <button
                  type="button"
                  onClick={() => removeFromPool(i)}
                  className="text-zinc-600 hover:text-rose-400 transition text-xs ml-2 shrink-0"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Preview button */}
      {config.pool.length > 0 && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={firePreview}
            className="rounded-md border border-violet-500/35 bg-violet-500/10 px-3 py-1.5 text-[11px] font-semibold text-violet-300 transition hover:border-violet-400/60 hover:bg-violet-500/20 hover:text-violet-100"
          >
            ▶ Preview Random
          </button>
        </div>
      )}
    </div>
  )
}

// ── ThemeDriftSection ────────────────────────────────────────────────

const DRIFT_GROUP_LABELS: Record<keyof DesktopThemeDriftConfig['groups'], { label: string; desc: string }> = {
  theme:      { label: 'Theme + Skin', desc: 'DesktopTheme and widget skin/shape swap together — the biggest visual change.' },
  colors:     { label: 'Colors', desc: 'Widget accent and text color.' },
  motion:     { label: 'Motion', desc: 'Icon animation, arrangement, and motion intensity.' },
  atmosphere: { label: 'Atmosphere', desc: 'Widget theme animation, atmosphere, glow, and shadow.' },
}

function ThemeDriftSection({
  config,
  onChange,
}: {
  config: DesktopThemeDriftConfig
  onChange: (patch: Partial<DesktopThemeDriftConfig>) => void
}) {
  const [clearing, setClearing] = useState(false)

  const setGroup = (key: keyof DesktopThemeDriftConfig['groups'], patch: Partial<DesktopThemeDriftConfig['groups'][typeof key]>) => {
    onChange({ groups: { ...config.groups, [key]: { ...config.groups[key], ...patch } } })
  }

  const clearRuntimeConfig = () => {
    if (!window.confirm('Clear all runtime overrides (theme drift, temporary event patches, etc.)? This affects the live overlay immediately.')) return
    setClearing(true)
    socket.emit('runtime:config:reset', () => setClearing(false))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-semibold text-zinc-200">Theme Drift</div>
          <div className="text-[10px] text-zinc-500 mt-0.5">
            Ambiently varies the desktop art style over time. Each enabled group independently rolls a chance to
            change on every tick — the change sticks as the new look (a runtime override) until the next drift or
            a runtime config reset. Nothing here is saved to your base theme.
          </div>
        </div>
        <Toggle checked={config.enabled} onChange={(v) => onChange({ enabled: v })} />
      </div>

      <Slider
        label="Interval"
        value={config.intervalSeconds}
        min={5}
        max={600}
        step={5}
        unit="s"
        onChange={(v) => onChange({ intervalSeconds: v })}
      />

      <Slider
        label="Jitter"
        value={config.tickJitterFactor ?? 0.2}
        min={0}
        max={0.8}
        step={0.05}
        onChange={(v) => onChange({ tickJitterFactor: v })}
      />

      <div className="space-y-3">
        {(Object.keys(DRIFT_GROUP_LABELS) as Array<keyof DesktopThemeDriftConfig['groups']>).map((key) => {
          const group = config.groups[key]
          const meta = DRIFT_GROUP_LABELS[key]
          return (
            <div key={key} className="rounded-xl border border-white/6 bg-white/[0.02] px-4 py-3 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-semibold text-zinc-300">{meta.label}</div>
                  <div className="text-[10px] text-zinc-600">{meta.desc}</div>
                </div>
                <Toggle checked={group.enabled} onChange={(v) => setGroup(key, { enabled: v })} />
              </div>
              <Slider
                label="Chance per tick"
                value={group.chance}
                min={0}
                max={1}
                step={0.05}
                onChange={(v) => setGroup(key, { chance: v })}
              />
            </div>
          )
        })}
      </div>

      <div className="flex justify-end border-t border-zinc-800/60 pt-3">
        <Btn variant="danger" onClick={clearRuntimeConfig} disabled={clearing}>
          {clearing ? 'Clearing…' : 'Clear Runtime Config'}
        </Btn>
      </div>
    </div>
  )
}

// ── PresetRotationSection ────────────────────────────────────────────

function PresetRotationSection({
  events,
  diagByEventId,
  onAutoChange,
  onAdd,
  onDelete,
}: {
  events: EventConfig[]
  diagByEventId: Record<string, { nextRunAt: number | null; due: boolean; idleTriggered: boolean }>
  onAutoChange: (eventId: string, patch: Partial<AutoTrigger>) => void
  onAdd: (preset: ConfigPreset) => void
  onDelete: (eventId: string) => void
}) {
  const [presets, setPresets] = useState<ConfigPreset[]>([])
  const [selectedPresetId, setSelectedPresetId] = useState('')

  useEffect(() => { void fetchPresets().then(setPresets).catch(() => {}) }, [])

  const handleAdd = () => {
    const preset = presets.find((p) => p.id === selectedPresetId)
    if (!preset) return
    onAdd(preset)
    setSelectedPresetId('')
  }

  return (
    <div className="space-y-4">
      <div className="text-[10px] text-zinc-500">
        Randomly swaps the entire config to a saved preset on a timer — same engine as Effect Ambiance and
        Theme Drift, but the whole thematic (skin, ambiance, sounds, everything the preset captured) changes
        at once instead of just one layer. Presets are managed in System → Presets.
      </div>

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

      {events.length === 0 ? (
        <div className="text-[10px] text-zinc-600 italic">No preset rotations configured.</div>
      ) : (
        <div className="space-y-2">
          {events.map((event) => (
            <EventRow
              key={event.id}
              event={event}
              diag={diagByEventId[event.id]}
              onChange={(patch) => onAutoChange(event.id, patch)}
              onDelete={() => onDelete(event.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── SchedulerPanel ─────────────────────────────────────────────────

type SchedulerDraft = {
  sourceEvents: EventConfig[]
  effectAmbiance: EffectAmbianceConfig
  desktopThemeDrift: DesktopThemeDriftConfig
  desktopAmbiance: DesktopAmbianceConfig
}

export function SchedulerPanel() {
  const events         = useAdminStore((s) => s.config.sourceEvents ?? [])
  const rawAmbiance    = useAdminStore((s) => s.config.effectAmbiance)
  const effectAmbiance: EffectAmbianceConfig = rawAmbiance ?? DEFAULT_EFFECT_AMBIANCE
  const rawThemeDrift  = useAdminStore((s) => s.config.desktopThemeDrift)
  const themeDrift: DesktopThemeDriftConfig = rawThemeDrift ?? DEFAULT_DESKTOP_THEME_DRIFT
  const saveConfig     = useAdminStore((s) => s.saveConfig)
  const diag           = useAdminStore((s) => s.runtimeDiagnostics.scheduler)

  const allApps            = useAdminStore((s) => s.config.applications)
  const allLayouts         = useAdminStore((s) => s.config.widgetLayouts ?? [])
  const allScenes          = useAdminStore((s) => s.config.scenes ?? {})
  const rawDesktopAmbiance = useAdminStore((s) => s.config.desktopAmbiance)

  // tick every second so countdowns refresh
  const [, setTick] = useState(0)
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => {
    tickRef.current = setInterval(() => setTick((n) => n + 1), 1000)
    return () => { if (tickRef.current) clearInterval(tickRef.current) }
  }, [])

  const diagByEventId = Object.fromEntries(diag.events.map((e) => [e.id, e]))

  const userLayouts = allLayouts.filter((l) => l.source === 'user')
  const sceneEntries: Array<{ id: string; label: string; icon: string }> = [
    { id: STATE.LOBBY,   label: 'Lobby',   icon: '🌐' },
    { id: STATE.DESKTOP, label: 'Desktop', icon: '🖥' },
    ...Object.values(allScenes)
      .filter((s) => s.id !== STATE.LOBBY && s.id !== STATE.DESKTOP)
      .map((s) => ({ id: s.id, label: s.label, icon: '🎬' })),
  ]

  // ── Unified page draft (Events, Effect Ambiance, Theme Drift, Desktop Ambiance) ──
  const sourceDraft: SchedulerDraft = useMemo(() => ({
    sourceEvents: events,
    effectAmbiance,
    desktopThemeDrift: themeDrift,
    desktopAmbiance: withDesktopAmbianceDefaults(rawDesktopAmbiance),
  }), [events, effectAmbiance, themeDrift, rawDesktopAmbiance])

  const [draft, setDraft] = useState<SchedulerDraft>(() => structuredClone(sourceDraft))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const dirty = !isSameDraft(draft, sourceDraft)

  useEffect(() => {
    if (dirty) return
    setDraft((prev) => (isSameDraft(prev, sourceDraft) ? prev : structuredClone(sourceDraft)))
    setSaved(false)
  }, [dirty, sourceDraft])

  useEffect(() => () => { if (savedTimer.current) clearTimeout(savedTimer.current) }, [])

  const update = useCallback(<K extends keyof SchedulerDraft>(key: K, updater: (d: SchedulerDraft[K]) => void) => {
    setDraft((prev) => {
      const next = structuredClone(prev)
      updater(next[key])
      setSaved(false)
      return next
    })
  }, [])

  const handleChange = (eventId: string, patch: Partial<AutoTrigger>) => {
    update('sourceEvents', (list) => {
      const ev = list.find((e) => e.id === eventId)
      if (ev) ev.auto = { ...ev.auto, ...patch }
    })
  }

  const handleAddPresetRotation = (preset: ConfigPreset) => {
    update('sourceEvents', (list) => { list.push(blankPresetRotationEvent(preset)) })
  }

  const handleDeletePresetRotation = (eventId: string) => {
    update('sourceEvents', (list) => {
      const i = list.findIndex((e) => e.id === eventId)
      if (i >= 0) list.splice(i, 1)
    })
  }

  const handleAmbianceChange = (patch: Partial<EffectAmbianceConfig>) => {
    update('effectAmbiance', (d) => Object.assign(d, patch))
  }

  const handleThemeDriftChange = (patch: Partial<DesktopThemeDriftConfig>) => {
    update('desktopThemeDrift', (d) => Object.assign(d, patch))
  }

  const updateAmbiance: AmbianceUpdater = useCallback((key, updater) => {
    update('desktopAmbiance', (d) => updater(d[key]))
  }, [update])

  const enableAllAmbianceTargets = useCallback(() => {
    updateAmbiance('widgetSimulation', (ws) => {
      ws.enabled = true
      allApps.forEach((app) => {
        ws.behaviors[app.id] = { ...createDefaultWidgetBehavior(true), ...ws.behaviors[app.id], enabled: true }
      })
      userLayouts.forEach((l) => {
        if (!ws.layoutBehaviors) ws.layoutBehaviors = {}
        ws.layoutBehaviors[l.id] = { ...createDefaultNavBehavior(true), ...ws.layoutBehaviors?.[l.id], enabled: true }
      })
      sceneEntries.forEach((s) => {
        if (!ws.sceneBehaviors) ws.sceneBehaviors = {}
        ws.sceneBehaviors[s.id] = { ...createDefaultNavBehavior(true), ...ws.sceneBehaviors?.[s.id], enabled: true }
      })
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updateAmbiance, allApps, userLayouts, sceneEntries.length])

  const apply = useCallback(async () => {
    if (!dirty) return
    setSaving(true)
    await saveConfig({
      sourceEvents: draft.sourceEvents,
      effectAmbiance: draft.effectAmbiance,
      desktopThemeDrift: draft.desktopThemeDrift,
      desktopAmbiance: draft.desktopAmbiance,
    })
    setSaving(false)
    if (savedTimer.current) clearTimeout(savedTimer.current)
    setSaved(true)
    savedTimer.current = setTimeout(() => setSaved(false), 1500)
  }, [dirty, saveConfig, draft])

  const reset = useCallback(() => {
    setDraft(structuredClone(sourceDraft))
    setSaved(false)
  }, [sourceDraft])

  const simConfig = draft.desktopAmbiance.widgetSimulation
  const totalAmbianceEnabled =
    Object.values(simConfig.behaviors).filter((b) => b?.enabled).length +
    Object.values(simConfig.layoutBehaviors ?? {}).filter((b) => b?.enabled).length +
    Object.values(simConfig.sceneBehaviors ?? {}).filter((b) => b?.enabled).length

  return (
    <div className="space-y-5">
      <ConfigPageIntro title="Scheduler">
        Automatic event triggers and ambient background systems: effects, theme drift, and desktop AI simulation.
      </ConfigPageIntro>

      <ConfigSectionPanel label="Engine status">
        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <div className="rounded-xl border border-white/6 bg-white/[0.02] px-5 py-4">
            <div className="text-[9px] uppercase tracking-wider text-zinc-600 mb-0.5">Next fire</div>
            <div className="text-zinc-300 font-medium">{formatRelative(diag.nextFireAt)}</div>
          </div>
          <div className="rounded-xl border border-white/6 bg-white/[0.02] px-5 py-4">
            <div className="text-[9px] uppercase tracking-wider text-zinc-600 mb-0.5">Active events</div>
            <div className="text-zinc-300 font-medium">{diag.activeEventCount}</div>
          </div>
          <div className="rounded-xl border border-white/6 bg-white/[0.02] px-5 py-4">
            <div className="text-[9px] uppercase tracking-wider text-zinc-600 mb-0.5">Last processed</div>
            <div className="text-zinc-400">{formatAgo(diag.lastProcessedAt)}</div>
          </div>
          <div className="rounded-xl border border-white/6 bg-white/[0.02] px-5 py-4">
            <div className="text-[9px] uppercase tracking-wider text-zinc-600 mb-0.5">Last fired</div>
            <div className="text-zinc-400">
              {diag.lastTriggeredEventId
                ? `${diag.lastTriggeredEventId} · ${formatAgo(diag.lastTriggeredAt)}`
                : '—'}
            </div>
          </div>
        </div>
      </ConfigSectionPanel>

      {(() => {
        const plainEvents = draft.sourceEvents.filter((e) => !isPresetRotationEvent(e))
        return plainEvents.length === 0 ? (
          <div className="text-xs text-zinc-600 italic px-1">No events configured. Create events in the Asset Library.</div>
        ) : (
          <ConfigSectionPanel label="Events">
            <div className="space-y-2">
              {plainEvents.map((event) => (
                <EventRow
                  key={event.id}
                  event={event}
                  diag={diagByEventId[event.id]}
                  onChange={(patch) => handleChange(event.id, patch)}
                />
              ))}
            </div>
          </ConfigSectionPanel>
        )
      })()}

      <ConfigSectionPanel label="Preset rotation">
        <PresetRotationSection
          events={draft.sourceEvents.filter(isPresetRotationEvent)}
          diagByEventId={diagByEventId}
          onAutoChange={handleChange}
          onAdd={handleAddPresetRotation}
          onDelete={handleDeletePresetRotation}
        />
      </ConfigSectionPanel>

      <ConfigSectionPanel label="Effect ambiance">
        <EffectAmbianceSection config={draft.effectAmbiance} onChange={handleAmbianceChange} />
      </ConfigSectionPanel>

      <ConfigSectionPanel label="Theme drift">
        <ThemeDriftSection config={draft.desktopThemeDrift} onChange={handleThemeDriftChange} />
      </ConfigSectionPanel>

      <ConfigSectionPanel label="Widget ambiance">
        <WidgetAmbianceSection
          form={draft.desktopAmbiance}
          update={updateAmbiance}
          allApps={allApps}
          onEnableAll={enableAllAmbianceTargets}
          showEnableAll={!simConfig.enabled || totalAmbianceEnabled === 0}
        />
      </ConfigSectionPanel>

      <ConfigSectionPanel label="Layout ambiance">
        <LayoutAmbianceSection form={draft.desktopAmbiance} update={updateAmbiance} userLayouts={userLayouts} />
      </ConfigSectionPanel>

      <ConfigSectionPanel label="Scene ambiance">
        <SceneAmbianceSection form={draft.desktopAmbiance} update={updateAmbiance} sceneEntries={sceneEntries} />
      </ConfigSectionPanel>

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
