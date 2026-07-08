import { useCallback, useEffect, useRef, useState } from 'react'
import { withPersonaDefaults } from '@ieomlabs/shared'
import type { PersonaConfig } from '@ieomlabs/shared'
import { useAdminStore } from '../../store/useAdminStore'
import {
  ConfigApplyBar, ConfigPageIntro, ConfigSectionPanel,
  Toggle, Slider, ConfigChoiceButton, isSameDraft,
} from '../../shared/ui'

// ── PersonaSection ───────────────────────────────────────────────────

const TRIGGER_MODES: Array<{ id: PersonaConfig['triggerMode']; label: string }> = [
  { id: 'command', label: 'Command' },
  { id: 'keyword', label: 'Keyword' },
  { id: 'chance',  label: 'Chance' },
  { id: 'all',     label: 'All messages' },
]

function PersonaSection({
  config,
  onChange,
}: {
  config: PersonaConfig
  onChange: (patch: Partial<PersonaConfig>) => void
}) {
  const setVoice = (patch: Partial<PersonaConfig['voice']>) => {
    onChange({ voice: { ...config.voice, ...patch } })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-semibold text-zinc-200">Persona</div>
          <div className="text-[10px] text-zinc-500 mt-0.5">
            Picks a chat message and speaks it in the overlay through a robotic voice filter, with a caption
            bubble — a chat-to-voice bridge you can react to live.
          </div>
        </div>
        <Toggle checked={config.enabled} onChange={(v) => onChange({ enabled: v })} />
      </div>

      <div>
        <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Trigger</div>
        <div className="flex gap-1.5">
          {TRIGGER_MODES.map((mode) => (
            <ConfigChoiceButton key={mode.id} selected={config.triggerMode === mode.id} onClick={() => onChange({ triggerMode: mode.id })}>
              {mode.label}
            </ConfigChoiceButton>
          ))}
        </div>
      </div>

      {(config.triggerMode === 'command' || config.triggerMode === 'keyword') && (
        <div>
          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            {config.triggerMode === 'command' ? 'Command (without !)' : 'Keyword'}
          </div>
          <input
            type="text"
            value={config.triggerValue ?? ''}
            onChange={(e) => onChange({ triggerValue: e.target.value })}
            placeholder={config.triggerMode === 'command' ? 'say' : 'ene'}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[11px] text-zinc-200 outline-none focus:border-white/25"
          />
        </div>
      )}

      {config.triggerMode === 'chance' && (
        <Slider label="Chance per message" value={config.chance ?? 0.05} min={0} max={1} step={0.01} onChange={(v) => onChange({ chance: v })} />
      )}

      <Slider label="Cooldown" value={config.cooldownMs} min={0} max={120_000} step={1000} unit="ms" onChange={(v) => onChange({ cooldownMs: v })} />
      <Slider label="Max characters" value={config.maxChars} min={20} max={500} step={10} onChange={(v) => onChange({ maxChars: v })} />

      <div className="rounded-xl border border-white/6 bg-white/[0.02] px-4 py-3 space-y-2">
        <div className="text-[11px] font-semibold text-zinc-300">Voice</div>
        <Slider label="Pitch" value={config.voice.pitchSemitones} min={-12} max={12} step={1} unit=" st" onChange={(v) => setVoice({ pitchSemitones: v })} />
        <Slider label="Robotic intensity" value={config.voice.roboticIntensity} min={0} max={1} step={0.05} onChange={(v) => setVoice({ roboticIntensity: v })} />
        <Slider label="Speech rate" value={config.voice.rate} min={-10} max={10} step={1} onChange={(v) => setVoice({ rate: v })} />
      </div>
    </div>
  )
}

// ── PersonaPanel ─────────────────────────────────────────────────────

export function PersonaPanel() {
  const rawPersona = useAdminStore((s) => s.config.persona)
  const persona: PersonaConfig = withPersonaDefaults(rawPersona)
  const saveConfig = useAdminStore((s) => s.saveConfig)

  const [draft, setDraft] = useState<PersonaConfig>(() => structuredClone(persona))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const dirty = !isSameDraft(draft, persona)

  useEffect(() => {
    if (dirty) return
    setDraft((prev) => (isSameDraft(prev, persona) ? prev : structuredClone(persona)))
    setSaved(false)
  }, [dirty, persona])

  useEffect(() => () => { if (savedTimer.current) clearTimeout(savedTimer.current) }, [])

  const handleChange = (patch: Partial<PersonaConfig>) => {
    setDraft((prev) => {
      const next = { ...prev, ...patch }
      setSaved(false)
      return next
    })
  }

  const apply = useCallback(async () => {
    if (!dirty) return
    setSaving(true)
    await saveConfig({ persona: draft })
    setSaving(false)
    if (savedTimer.current) clearTimeout(savedTimer.current)
    setSaved(true)
    savedTimer.current = setTimeout(() => setSaved(false), 1500)
  }, [dirty, saveConfig, draft])

  const reset = useCallback(() => {
    setDraft(structuredClone(persona))
    setSaved(false)
  }, [persona])

  return (
    <div className="space-y-5">
      <ConfigPageIntro title="Persona">
        A chat-to-voice companion — picks chat messages and speaks them in the overlay.
      </ConfigPageIntro>

      <ConfigSectionPanel label="Persona">
        <PersonaSection config={draft} onChange={handleChange} />
      </ConfigSectionPanel>

      <ConfigApplyBar
        label="Persona"
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
