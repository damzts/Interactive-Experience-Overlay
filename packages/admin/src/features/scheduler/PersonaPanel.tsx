import { useCallback, useEffect, useRef, useState } from 'react'
import { withPersonaDefaults } from '@ieomlabs/shared'
import type { PersonaAvatarConfig, PersonaConfig, PersonaEventLine } from '@ieomlabs/shared'
import { useAdminStore } from '../../store/useAdminStore'
import { getPersonaAvatarImages } from '../../api/mediaApi'
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
      <Slider label="Duck music while speaking" value={config.duckAmount} min={0} max={1} step={0.05} onChange={(v) => onChange({ duckAmount: v })} />

      <div className="rounded-xl border border-white/6 bg-white/[0.02] px-4 py-3 space-y-2">
        <div className="text-[11px] font-semibold text-zinc-300">Voice</div>
        <Slider label="Pitch" value={config.voice.pitchSemitones} min={-12} max={12} step={1} unit=" st" onChange={(v) => setVoice({ pitchSemitones: v })} />
        <Slider label="Robotic intensity" value={config.voice.roboticIntensity} min={0} max={1} step={0.05} onChange={(v) => setVoice({ roboticIntensity: v })} />
        <Slider label="Speech rate" value={config.voice.rate} min={-10} max={10} step={1} onChange={(v) => setVoice({ rate: v })} />
        <div>
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            TTS voice name <span className="normal-case font-normal text-zinc-600">(installed SAPI voice, blank = system default)</span>
          </div>
          <input
            type="text"
            value={config.voice.ttsVoice ?? ''}
            onChange={(e) => setVoice({ ttsVoice: e.target.value || undefined })}
            placeholder="e.g. Microsoft Zira Desktop"
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[11px] text-zinc-200 outline-none focus:border-white/25"
          />
        </div>
      </div>

      <EventLinesSection lines={config.eventLines} onChange={(eventLines) => onChange({ eventLines })} />
    </div>
  )
}

// ── Event reactions ──────────────────────────────────────────────────

function EventLinesSection({
  lines,
  onChange,
}: {
  lines: PersonaEventLine[]
  onChange: (lines: PersonaEventLine[]) => void
}) {
  const update = (idx: number, patch: Partial<PersonaEventLine>) =>
    onChange(lines.map((l, i) => (i === idx ? { ...l, ...patch } : l)))

  return (
    <div className="rounded-xl border border-white/6 bg-white/[0.02] px-4 py-3 space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] font-semibold text-zinc-300">Event reactions</div>
          <div className="text-[10px] text-zinc-500 mt-0.5">
            Spoken lines for kernel events (raids, scene changes, silence…). {'{field}'} placeholders
            resolve from the event payload — e.g. <span className="font-mono">welcome raiders from {'{from}'}!</span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onChange([...lines, { event: '', template: '', chance: 1, enabled: true }])}
          className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-zinc-300 hover:border-white/25"
        >
          + Add
        </button>
      </div>

      {lines.length === 0 && (
        <div className="text-[10px] italic text-zinc-600">No event reactions yet.</div>
      )}

      {lines.map((line, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <Toggle checked={line.enabled ?? true} onChange={(v) => update(idx, { enabled: v })} />
          <input
            type="text"
            value={line.event}
            onChange={(e) => update(idx, { event: e.target.value })}
            placeholder="twitch:raid"
            className="w-40 shrink-0 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-[11px] font-mono text-zinc-200 outline-none focus:border-white/25"
          />
          <input
            type="text"
            value={line.template}
            onChange={(e) => update(idx, { template: e.target.value })}
            placeholder="welcome raiders from {from}!"
            className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-[11px] text-zinc-200 outline-none focus:border-white/25"
          />
          <input
            type="number"
            min={0} max={1} step={0.05}
            value={line.chance ?? 1}
            onChange={(e) => update(idx, { chance: Math.max(0, Math.min(1, Number(e.target.value))) })}
            title="Chance 0–1"
            className="w-16 shrink-0 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-[11px] font-mono text-zinc-200 outline-none focus:border-white/25"
          />
          <button
            type="button"
            aria-label="Delete event reaction"
            onClick={() => onChange(lines.filter((_, i) => i !== idx))}
            className="text-zinc-600 hover:text-red-400 transition-colors text-sm"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}

// ── Avatar ───────────────────────────────────────────────────────────

const AVATAR_MODES: Array<{ id: PersonaAvatarConfig['mode']; label: string }> = [
  { id: 'pop-in',     label: 'Pop in when speaking' },
  { id: 'persistent', label: 'Always visible' },
]

const AVATAR_CORNERS: Array<{ id: PersonaAvatarConfig['corner']; label: string }> = [
  { id: 'bottom-right', label: 'Bottom right' },
  { id: 'bottom-left',  label: 'Bottom left' },
  { id: 'top-right',    label: 'Top right' },
  { id: 'top-left',     label: 'Top left' },
]

function AvatarSection({
  avatar,
  onChange,
}: {
  avatar: PersonaAvatarConfig
  onChange: (patch: Partial<PersonaAvatarConfig>) => void
}) {
  const [available, setAvailable] = useState<string[]>([])
  const [manualUrl, setManualUrl] = useState('')

  useEffect(() => {
    let cancelled = false
    getPersonaAvatarImages()
      .then((images) => { if (!cancelled) setAvailable(images) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  const toggleImage = (url: string) =>
    onChange({
      images: avatar.images.includes(url)
        ? avatar.images.filter((u) => u !== url)
        : [...avatar.images, url],
    })

  const addManual = () => {
    const url = manualUrl.trim()
    if (!url || avatar.images.includes(url)) return
    onChange({ images: [...avatar.images, url] })
    setManualUrl('')
  }

  // Picker shows everything on disk plus any configured URLs not found by the scan.
  const gallery = [...available, ...avatar.images.filter((u) => !available.includes(u))]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-semibold text-zinc-200">Avatar</div>
          <div className="text-[10px] text-zinc-500 mt-0.5">
            Character art (transparent png/webp) that appears on the overlay and moves with the
            persona's live voice. Drop images into <span className="font-mono">assets/persona/</span> to
            see them here.
          </div>
        </div>
        <Toggle checked={avatar.enabled} onChange={(v) => onChange({ enabled: v })} />
      </div>

      <div>
        <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Mode</div>
        <div className="flex gap-1.5">
          {AVATAR_MODES.map((mode) => (
            <ConfigChoiceButton key={mode.id} selected={avatar.mode === mode.id} onClick={() => onChange({ mode: mode.id })}>
              {mode.label}
            </ConfigChoiceButton>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Corner</div>
        <div className="flex gap-1.5">
          {AVATAR_CORNERS.map((corner) => (
            <ConfigChoiceButton key={corner.id} selected={avatar.corner === corner.id} onClick={() => onChange({ corner: corner.id })}>
              {corner.label}
            </ConfigChoiceButton>
          ))}
        </div>
      </div>

      <Slider label="Width" value={avatar.widthPx} min={120} max={520} step={10} unit="px" onChange={(v) => onChange({ widthPx: v })} />
      {avatar.mode === 'pop-in' && (
        <Slider label="Linger after speaking" value={avatar.lingerMs} min={0} max={10_000} step={500} unit="ms" onChange={(v) => onChange({ lingerMs: v })} />
      )}

      <div className="rounded-xl border border-white/6 bg-white/[0.02] px-4 py-3 space-y-2">
        <div className="text-[11px] font-semibold text-zinc-300">
          Poses <span className="font-normal text-zinc-500">— click to select; a random selected pose is used per appearance</span>
        </div>

        {gallery.length === 0 && (
          <div className="text-[10px] italic text-zinc-600">
            No images found under <span className="font-mono">assets/persona/</span>.
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {gallery.map((url) => {
            const selected = avatar.images.includes(url)
            return (
              <button
                key={url}
                type="button"
                onClick={() => toggleImage(url)}
                title={url}
                className={`relative h-24 w-20 overflow-hidden rounded-lg border transition-colors ${
                  selected ? 'border-sky-400/80 bg-sky-400/10' : 'border-white/10 bg-white/5 hover:border-white/25'
                }`}
              >
                <img src={url} alt="" loading="lazy" className="h-full w-full object-contain" />
                {selected && (
                  <span className="absolute right-1 top-1 rounded bg-sky-400/90 px-1 text-[9px] font-bold text-zinc-900">✓</span>
                )}
              </button>
            )
          })}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={manualUrl}
            onChange={(e) => setManualUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addManual() }}
            placeholder="/assets/persona/ene/pose.webp"
            className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-[11px] font-mono text-zinc-200 outline-none focus:border-white/25"
          />
          <button
            type="button"
            onClick={addManual}
            className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-zinc-300 hover:border-white/25"
          >
            + Add URL
          </button>
        </div>
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

      <ConfigSectionPanel label="Avatar">
        <AvatarSection
          avatar={draft.avatar}
          onChange={(patch) => handleChange({ avatar: { ...draft.avatar, ...patch } })}
        />
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
