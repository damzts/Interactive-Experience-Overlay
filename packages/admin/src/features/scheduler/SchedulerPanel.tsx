import { useEffect, useRef, useState } from 'react'
import { STATE } from '@ieomlabs/shared'
import type { EffectAmbianceConfig, EffectConfig, EffectType, EventConfig, AutoTrigger } from '@ieomlabs/shared'
import { useAdminStore } from '../../store/useAdminStore'
import { socket } from '../../socket/client'
import {
  ConfigCard, ConfigPageIntro, ConfigSectionPanel,
  Toggle, Slider, ConfigChoiceButton,
} from '../../shared/ui'
import { EFFECT_CATEGORIES, createEffectDraft } from '../media-library/eventPresets'

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
}: {
  event: EventConfig
  diag: { nextRunAt: number | null; due: boolean; idleTriggered: boolean } | undefined
  onChange: (patch: Partial<AutoTrigger>) => void
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
                  <option key={t} value={t}>{t}</option>
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

// ── SchedulerPanel ─────────────────────────────────────────────────

export function SchedulerPanel() {
  const events         = useAdminStore((s) => s.config.sourceEvents ?? [])
  const rawAmbiance    = useAdminStore((s) => s.config.effectAmbiance)
  const effectAmbiance: EffectAmbianceConfig = rawAmbiance ?? DEFAULT_EFFECT_AMBIANCE
  const saveConfig     = useAdminStore((s) => s.saveConfig)
  const diag           = useAdminStore((s) => s.runtimeDiagnostics.scheduler)

  // tick every second so countdowns refresh
  const [, setTick] = useState(0)
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => {
    tickRef.current = setInterval(() => setTick((n) => n + 1), 1000)
    return () => { if (tickRef.current) clearInterval(tickRef.current) }
  }, [])

  const diagByEventId = Object.fromEntries(diag.events.map((e) => [e.id, e]))

  const handleChange = (eventId: string, patch: Partial<AutoTrigger>) => {
    const next = events.map((e) =>
      e.id === eventId ? { ...e, auto: { ...e.auto, ...patch } } : e,
    )
    void saveConfig({ sourceEvents: next })
  }

  const handleAmbianceChange = (patch: Partial<EffectAmbianceConfig>) => {
    void saveConfig({ effectAmbiance: { ...effectAmbiance, ...patch } })
  }

  return (
    <div className="space-y-5">
      <ConfigPageIntro title="Scheduler">
        Automatic event triggers. Each event fires based on its mode, timing, and chance roll.
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

      {events.length === 0 ? (
        <div className="text-xs text-zinc-600 italic px-1">No events configured. Create events in the Asset Library.</div>
      ) : (
        <ConfigSectionPanel label="Events">
          <div className="space-y-2">
            {events.map((event) => (
              <EventRow
                key={event.id}
                event={event}
                diag={diagByEventId[event.id]}
                onChange={(patch) => handleChange(event.id, patch)}
              />
            ))}
          </div>
        </ConfigSectionPanel>
      )}

      <ConfigSectionPanel label="Effect ambiance">
        <EffectAmbianceSection config={effectAmbiance} onChange={handleAmbianceChange} />
      </ConfigSectionPanel>
    </div>
  )
}
