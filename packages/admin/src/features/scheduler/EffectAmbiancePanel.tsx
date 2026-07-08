import { useCallback, useEffect, useRef, useState } from 'react'
import { getEffectLabel } from '@ieomlabs/shared'
import type { EffectAmbianceConfig, EffectConfig, EffectType } from '@ieomlabs/shared'
import { useAdminStore } from '../../store/useAdminStore'
import { socket } from '../../socket/client'
import {
  ConfigApplyBar, ConfigPageIntro, ConfigSectionPanel,
  Toggle, Slider, isSameDraft,
} from '../../shared/ui'
import { EFFECT_CATEGORIES, createEffectDraft } from '../media-library/eventPresets'

const DEFAULT_EFFECT_AMBIANCE: EffectAmbianceConfig = {
  enabled: false,
  pool: [],
  intervalSeconds: 30,
  jitterFactor: 0.3,
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

// ── EffectAmbiancePanel ──────────────────────────────────────────────

export function EffectAmbiancePanel() {
  const rawAmbiance = useAdminStore((s) => s.config.effectAmbiance)
  const effectAmbiance: EffectAmbianceConfig = rawAmbiance ?? DEFAULT_EFFECT_AMBIANCE
  const saveConfig  = useAdminStore((s) => s.saveConfig)

  const [draft, setDraft] = useState<EffectAmbianceConfig>(() => structuredClone(effectAmbiance))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const dirty = !isSameDraft(draft, effectAmbiance)

  useEffect(() => {
    if (dirty) return
    setDraft((prev) => (isSameDraft(prev, effectAmbiance) ? prev : structuredClone(effectAmbiance)))
    setSaved(false)
  }, [dirty, effectAmbiance])

  useEffect(() => () => { if (savedTimer.current) clearTimeout(savedTimer.current) }, [])

  const handleChange = (patch: Partial<EffectAmbianceConfig>) => {
    setDraft((prev) => {
      const next = { ...prev, ...patch }
      setSaved(false)
      return next
    })
  }

  const apply = useCallback(async () => {
    if (!dirty) return
    setSaving(true)
    await saveConfig({ effectAmbiance: draft })
    setSaving(false)
    if (savedTimer.current) clearTimeout(savedTimer.current)
    setSaved(true)
    savedTimer.current = setTimeout(() => setSaved(false), 1500)
  }, [dirty, saveConfig, draft])

  const reset = useCallback(() => {
    setDraft(structuredClone(effectAmbiance))
    setSaved(false)
  }, [effectAmbiance])

  return (
    <div className="space-y-5">
      <ConfigPageIntro title="Effect Ambiance">
        Randomly fires overlay effects from a pool on a timer — an ambient background layer of visual noise.
      </ConfigPageIntro>

      <ConfigSectionPanel label="Effect ambiance">
        <EffectAmbianceSection config={draft} onChange={handleChange} />
      </ConfigSectionPanel>

      <ConfigApplyBar
        label="Effect Ambiance"
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
