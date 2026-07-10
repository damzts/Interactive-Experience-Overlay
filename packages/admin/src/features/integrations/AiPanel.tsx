import { useCallback, useEffect, useRef, useState } from 'react'
import { withPersonaDefaults } from '@ieomlabs/shared'
import type { PersonaBrainConfig, PersonaConfig } from '@ieomlabs/shared'
import { useAdminStore } from '../../store/useAdminStore'
import {
  ConfigApplyBar, ConfigPageIntro, ConfigSectionPanel,
  Toggle, ConfigChoiceButton, isSameDraft,
} from '../../shared/ui'
import { patchPersonaDraft } from '../scheduler/personaDraft'

// ── Brain connection ─────────────────────────────────────────────────

const BRAIN_PROVIDERS: Array<{ id: PersonaBrainConfig['provider']; label: string }> = [
  { id: 'anthropic', label: 'Haiku (Anthropic)' },
  { id: 'ollama',    label: 'Ollama (local)' },
]

function BrainConnectionSection({
  brain,
  onChange,
}: {
  brain: PersonaBrainConfig
  onChange: (patch: Partial<PersonaBrainConfig>) => void
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-semibold text-zinc-200">LLM brain</div>
          <div className="text-[10px] text-zinc-500 mt-0.5">
            The LLM behind the persona. Optional — the persona works without it (echoes chat);
            a brain adds summaries, console chat, and real replies. Behavior (personality,
            replies) is configured in Ambiance → Persona.
          </div>
        </div>
        <Toggle checked={brain.enabled} onChange={(v) => onChange({ enabled: v })} />
      </div>

      <div>
        <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Provider</div>
        <div className="flex gap-1.5">
          {BRAIN_PROVIDERS.map((p) => (
            <ConfigChoiceButton key={p.id} selected={brain.provider === p.id} onClick={() => onChange({ provider: p.id })}>
              {p.label}
            </ConfigChoiceButton>
          ))}
        </div>
        <div className="mt-1 text-[10px] text-zinc-600">
          {brain.provider === 'anthropic'
            ? 'Needs the ANTHROPIC_API_KEY environment variable set for the server (never stored in config).'
            : 'Needs Ollama running locally with the model pulled (e.g. `ollama pull llama3.2`).'}
        </div>
      </div>

      <div className="flex gap-2">
        <div className="flex-1">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Model</div>
          <input
            type="text"
            value={brain.model}
            onChange={(e) => onChange({ model: e.target.value })}
            placeholder={brain.provider === 'anthropic' ? 'claude-haiku-4-5 (default)' : 'llama3.2 (default)'}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[11px] font-mono text-zinc-200 outline-none focus:border-white/25"
          />
        </div>
        {brain.provider === 'ollama' && (
          <div className="flex-1">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Ollama URL</div>
            <input
              type="text"
              value={brain.ollamaUrl}
              onChange={(e) => onChange({ ollamaUrl: e.target.value })}
              placeholder="http://localhost:11434"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[11px] font-mono text-zinc-200 outline-none focus:border-white/25"
            />
          </div>
        )}
      </div>
    </div>
  )
}

// ── AiPanel ──────────────────────────────────────────────────────────

export function AiPanel() {
  const rawPersona = useAdminStore((s) => s.config.persona)
  const avatarPresets = useAdminStore((s) => s.config.avatarPresets)
  const persona: PersonaConfig = withPersonaDefaults(rawPersona, avatarPresets)
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
      <ConfigPageIntro title="AI">
        Provider connection for the persona's LLM brain.
      </ConfigPageIntro>

      <ConfigSectionPanel label="Brain connection">
        <BrainConnectionSection
          brain={draft.brain}
          onChange={(patch) => handleChange({ brain: { ...draft.brain, ...patch } })}
        />
      </ConfigSectionPanel>

      <ConfigApplyBar
        label="AI"
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
