import { useCallback, useEffect, useRef, useState } from 'react'
import { getEffectLabel } from '@ieomlabs/shared'
import type { EffectConfig, EffectStormConfig, EffectType } from '@ieomlabs/shared'
import { createBlankEffectStorm } from '@ieomlabs/shared'
import { useAdminStore } from '../../store/useAdminStore'
import { socket } from '../../socket/client'
import {
  Btn, ConfigApplyBar, ConfigPageIntro, ConfigCard,
  Toggle, Slider, isSameDraft,
} from '../../shared/ui'
import { EFFECT_CATEGORIES, createEffectDraft } from '../media-library/eventPresets'

// ── StormCard ────────────────────────────────────────────────────────
// One card per storm — its own enable toggle, interval, jitter, and pool.
// Collapsed by default; expands to show full configuration.

function StormCard({
  storm,
  onChange,
  onRemove,
}: {
  storm: EffectStormConfig
  onChange: (patch: Partial<EffectStormConfig>) => void
  onRemove: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [selectedType, setSelectedType] = useState<EffectType>('screen-shake')

  const addToPool = () => {
    const draft = createEffectDraft(selectedType)
    onChange({ pool: [...storm.pool, draft] })
  }

  const removeFromPool = (index: number) => {
    onChange({ pool: storm.pool.filter((_, i) => i !== index) })
  }

  const firePreview = () => {
    if (!storm.pool.length) return
    const effect = storm.pool[Math.floor(Math.random() * storm.pool.length)]
    socket.emit('event:preview', {
      id: 'storm-preview',
      label: storm.label || 'Storm Preview',
      icon: '🌩',
      color: 'text-violet-400',
      desc: '',
      effects: [effect],
      auto: { enabled: false, mode: 'interval' as const, intervalMin: 15, idleMin: 5, chance: 1, cooldownMin: 0 },
    })
  }

  return (
    <ConfigCard className="flex min-w-0 flex-col gap-3 p-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <span className="text-base shrink-0">🌩</span>
          <input
            type="text"
            value={storm.label}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => onChange({ label: e.target.value })}
            placeholder="Storm name"
            className="min-w-0 flex-1 truncate bg-transparent text-xs font-semibold text-zinc-200 focus:outline-none"
          />
        </button>
        <Toggle checked={storm.enabled} onChange={(v) => onChange({ enabled: v })} />
      </div>

      <div className="flex items-center justify-between text-[10px] text-zinc-500">
        <span>
          {storm.pool.length} effect{storm.pool.length !== 1 ? 's' : ''} · every ~{storm.intervalSeconds}s
        </span>
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="rounded-md border border-zinc-700/80 bg-zinc-900/80 px-2 py-1 text-[10px] font-medium text-zinc-300 transition hover:border-zinc-600/80 hover:text-zinc-100"
        >
          {expanded ? 'Collapse' : 'Expand'}
        </button>
      </div>

      {expanded && (
        <div className="space-y-4 border-t border-white/8 pt-3">
          <Slider
            label="Interval"
            value={storm.intervalSeconds}
            min={1}
            max={300}
            step={1}
            unit="s"
            onChange={(v) => onChange({ intervalSeconds: v })}
          />

          <Slider
            label="Jitter"
            value={storm.jitterFactor ?? 0.3}
            min={0}
            max={0.8}
            step={0.05}
            onChange={(v) => onChange({ jitterFactor: v })}
          />

          <Slider
            label="Effects/tick"
            value={storm.countPerTick ?? 1}
            min={1}
            max={Math.max(1, storm.pool.length) || 10}
            step={1}
            unit=""
            onChange={(v) => onChange({ countPerTick: v })}
          />

          {/* Pool editor */}
          <div>
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Effect Pool <span className="font-normal text-zinc-600">({storm.pool.length})</span>
            </div>

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

            {storm.pool.length === 0 ? (
              <div className="text-[10px] text-zinc-600 italic">No effects in pool. Add effects above to enable this storm.</div>
            ) : (
              <div className="space-y-1.5">
                {storm.pool.map((eff: EffectConfig, i: number) => (
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

          <div className="flex items-center justify-between border-t border-zinc-800/60 pt-3">
            <button
              type="button"
              onClick={onRemove}
              className="rounded-md border border-red-500/45 bg-red-500/12 px-2.5 py-1 text-[11px] font-semibold text-red-200 transition hover:border-red-400/60 hover:bg-red-500/20 hover:text-red-50"
            >
              Remove Storm
            </button>
            {storm.pool.length > 0 && (
              <button
                type="button"
                onClick={firePreview}
                className="rounded-md border border-violet-500/35 bg-violet-500/10 px-3 py-1.5 text-[11px] font-semibold text-violet-300 transition hover:border-violet-400/60 hover:bg-violet-500/20 hover:text-violet-100"
              >
                ▶ Preview Random
              </button>
            )}
          </div>
        </div>
      )}
    </ConfigCard>
  )
}

// ── EffectAmbiancePanel ("Effect Storms") ────────────────────────────

export function EffectAmbiancePanel() {
  const rawStorms = useAdminStore((s) => s.config.effectStorms)
  const legacyEffectAmbiance = useAdminStore((s) => s.config.effectAmbiance)
  const saveConfig = useAdminStore((s) => s.saveConfig)

  const sourceStorms: EffectStormConfig[] = rawStorms ?? (legacyEffectAmbiance?.pool.length
    ? [{
        id: 'effect-ambiance-migrated',
        label: 'Effect Ambiance',
        enabled: legacyEffectAmbiance.enabled,
        pool: legacyEffectAmbiance.pool,
        intervalSeconds: legacyEffectAmbiance.intervalSeconds,
        jitterFactor: legacyEffectAmbiance.jitterFactor,
        countPerTick: legacyEffectAmbiance.countPerTick,
      }]
    : [])

  const [draft, setDraft] = useState<EffectStormConfig[]>(() => structuredClone(sourceStorms))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const dirty = !isSameDraft(draft, sourceStorms)

  useEffect(() => {
    if (dirty) return
    setDraft((prev) => (isSameDraft(prev, sourceStorms) ? prev : structuredClone(sourceStorms)))
    setSaved(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, rawStorms, legacyEffectAmbiance])

  useEffect(() => () => { if (savedTimer.current) clearTimeout(savedTimer.current) }, [])

  const update = useCallback((updater: (list: EffectStormConfig[]) => void) => {
    setDraft((prev) => {
      const next = structuredClone(prev)
      updater(next)
      setSaved(false)
      return next
    })
  }, [])

  const handleChangeStorm = (id: string, patch: Partial<EffectStormConfig>) => {
    update((list) => {
      const storm = list.find((s) => s.id === id)
      if (storm) Object.assign(storm, patch)
    })
  }

  const addStorm = () => {
    update((list) => { list.push(createBlankEffectStorm()) })
  }

  const removeStorm = (id: string) => {
    update((list) => {
      const idx = list.findIndex((s) => s.id === id)
      if (idx !== -1) list.splice(idx, 1)
    })
  }

  const apply = useCallback(async () => {
    if (!dirty) return
    setSaving(true)
    await saveConfig({ effectStorms: draft })
    setSaving(false)
    if (savedTimer.current) clearTimeout(savedTimer.current)
    setSaved(true)
    savedTimer.current = setTimeout(() => setSaved(false), 1500)
  }, [dirty, saveConfig, draft])

  const reset = useCallback(() => {
    setDraft(structuredClone(sourceStorms))
    setSaved(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawStorms, legacyEffectAmbiance])

  return (
    <div className="space-y-5">
      <ConfigPageIntro title="Effect Storms">
        Independent ambient effect loops — each storm has its own enable switch, timer interval, and
        effect pool, and runs concurrently with the others. Create a light "sparkle" storm alongside a
        rare "chaos" storm, for example.
      </ConfigPageIntro>

      {draft.length === 0 ? (
        <div className="text-xs text-zinc-600 italic px-1">No storms yet. Create one to start firing ambient effects on a timer.</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {draft.map((storm) => (
            <StormCard
              key={storm.id}
              storm={storm}
              onChange={(patch) => handleChangeStorm(storm.id, patch)}
              onRemove={() => removeStorm(storm.id)}
            />
          ))}
        </div>
      )}

      <Btn type="button" variant="ghost" onClick={addStorm} className="w-full justify-center border-dashed border-zinc-700/80 py-2 text-xs">
        + Add Storm
      </Btn>

      <ConfigApplyBar
        label="Effect Storms"
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
