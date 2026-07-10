import { useCallback, useEffect, useRef, useState } from 'react'
import { withPersonaDefaults } from '@ieomlabs/shared'
import type { PersonaConfig } from '@ieomlabs/shared'
import { useAdminStore } from '../../store/useAdminStore'
import { getTtsVoices } from '../../api/ttsApi'
import {
  ConfigApplyBar, ConfigPageIntro, ConfigSectionPanel,
  isSameDraft,
} from '../../shared/ui'
import { patchPersonaDraft } from '../scheduler/personaDraft'

// ── Text-to-Speech ───────────────────────────────────────────────────

function TtsSection({
  config,
  onChange,
}: {
  config: PersonaConfig
  onChange: (patch: Partial<PersonaConfig>) => void
}) {
  const [voices, setVoices] = useState<string[]>([])
  useEffect(() => {
    let cancelled = false
    getTtsVoices(config.ttsProvider)
      .then((names) => { if (!cancelled) setVoices(names) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [config.ttsProvider])

  // Keep a configured-but-uninstalled voice selectable so it isn't silently lost.
  const voiceOptions = config.voice.ttsVoice && !voices.includes(config.voice.ttsVoice)
    ? [config.voice.ttsVoice, ...voices]
    : voices

  const activeProfile = config.profiles.find((p) => p.id === config.activeProfileId)

  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs font-semibold text-zinc-200">Text-to-Speech</div>
        <div className="text-[10px] text-zinc-500 mt-0.5">
          TTS engine and voice used when the persona speaks. Voice character (pitch, robotic
          filter, rate) is tuned in Ambiance → Persona.
          {activeProfile && <> Editing voice for profile: <span className="text-zinc-300">{activeProfile.name}</span>.</>}
        </div>
      </div>

      <div className="flex gap-2">
        <div className="w-44 shrink-0">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">TTS engine</div>
          <input
            type="text"
            value={config.ttsProvider ?? ''}
            onChange={(e) => onChange({ ttsProvider: e.target.value || undefined })}
            placeholder="sapi (default)"
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[11px] font-mono text-zinc-200 outline-none focus:border-white/25"
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            TTS voice <span className="normal-case font-normal text-zinc-600">(installed on this machine)</span>
          </div>
          <select
            value={config.voice.ttsVoice ?? ''}
            onChange={(e) => onChange({ voice: { ...config.voice, ttsVoice: e.target.value || undefined } })}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[11px] text-zinc-200 outline-none focus:border-white/25 [&>option]:bg-zinc-900"
          >
            <option value="">(system default)</option>
            {voiceOptions.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  )
}

// ── TtsPanel ─────────────────────────────────────────────────────────

export function TtsPanel() {
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
      setSaved(false)
      return patchPersonaDraft(prev, patch)
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
      <ConfigPageIntro title="TTS">
        Provider connection for the persona's text-to-speech engine.
      </ConfigPageIntro>

      <ConfigSectionPanel label="Text-to-Speech">
        <TtsSection config={draft} onChange={handleChange} />
      </ConfigSectionPanel>

      <ConfigApplyBar
        label="TTS"
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
