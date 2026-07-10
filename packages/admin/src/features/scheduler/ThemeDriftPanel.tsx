import { useCallback, useEffect, useRef, useState } from 'react'
import { DEFAULT_DESKTOP_THEME_DRIFT } from '@ieomlabs/shared'
import type { DesktopThemeDriftConfig } from '@ieomlabs/shared'
import { useAdminStore } from '../../store/useAdminStore'
import { socket } from '../../socket/client'
import {
  Btn, ConfigApplyBar, ConfigPageIntro, ConfigSectionPanel,
  Toggle, Slider, isSameDraft,
} from '../../shared/ui'

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
    if (!window.confirm('Clear all runtime overrides (theme rotation, temporary event patches, etc.)? This affects the live overlay immediately.')) return
    setClearing(true)
    socket.emit('runtime:config:reset', () => setClearing(false))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-semibold text-zinc-200">Theme Rotation</div>
          <div className="text-[10px] text-zinc-500 mt-0.5">
            Ambiently varies the desktop art style over time. Each enabled group independently rolls a chance to
            change on every tick — the change sticks as the new look (a runtime override) until the next rotation or
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

// ── ThemeDriftPanel ──────────────────────────────────────────────────

export function ThemeDriftPanel() {
  const rawThemeDrift = useAdminStore((s) => s.config.desktopThemeDrift)
  const themeDrift: DesktopThemeDriftConfig = rawThemeDrift ?? DEFAULT_DESKTOP_THEME_DRIFT
  const saveConfig    = useAdminStore((s) => s.saveConfig)

  const [draft, setDraft] = useState<DesktopThemeDriftConfig>(() => structuredClone(themeDrift))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const dirty = !isSameDraft(draft, themeDrift)

  useEffect(() => {
    if (dirty) return
    setDraft((prev) => (isSameDraft(prev, themeDrift) ? prev : structuredClone(themeDrift)))
    setSaved(false)
  }, [dirty, themeDrift])

  useEffect(() => () => { if (savedTimer.current) clearTimeout(savedTimer.current) }, [])

  const handleChange = (patch: Partial<DesktopThemeDriftConfig>) => {
    setDraft((prev) => {
      const next = { ...prev, ...patch }
      setSaved(false)
      return next
    })
  }

  const apply = useCallback(async () => {
    if (!dirty) return
    setSaving(true)
    await saveConfig({ desktopThemeDrift: draft })
    setSaving(false)
    if (savedTimer.current) clearTimeout(savedTimer.current)
    setSaved(true)
    savedTimer.current = setTimeout(() => setSaved(false), 1500)
  }, [dirty, saveConfig, draft])

  const reset = useCallback(() => {
    setDraft(structuredClone(themeDrift))
    setSaved(false)
  }, [themeDrift])

  return (
    <div className="space-y-5">
      <ConfigPageIntro title="Theme Rotation">
        Ambiently varies the desktop art style over time as a runtime override, independent of your saved theme.
      </ConfigPageIntro>

      <ConfigSectionPanel label="Theme rotation">
        <ThemeDriftSection config={draft} onChange={handleChange} />
      </ConfigSectionPanel>

      <ConfigApplyBar
        label="Theme Rotation"
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
