import { useCallback, useEffect, useRef, useState } from 'react'
import { withPersonaDefaults } from '@ieomlabs/shared'
import type { PersonaAvatarConfig, PersonaBrainConfig, PersonaConfig, PersonaEventLine, PersonaProfile } from '@ieomlabs/shared'
import { useAdminStore } from '../../store/useAdminStore'
import { socket } from '../../socket/client'
import { getPersonaAvatarImages } from '../../api/mediaApi'
import {
  ConfigApplyBar, ConfigPageIntro, ConfigSectionPanel, ConfigNotice,
  Toggle, Slider, ConfigChoiceButton, isSameDraft,
} from '../../shared/ui'
import { patchPersonaDraft } from './personaDraft'

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
        <div className="text-[10px] text-zinc-600">
          TTS engine and installed voice are selected in Integrations → AI &amp; Voice.
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

// ── Profiles ─────────────────────────────────────────────────────────

function ProfilesSection({
  profiles,
  activeId,
  onSwitch,
  onRename,
  onAdd,
  onDelete,
}: {
  profiles: PersonaProfile[]
  activeId: string
  onSwitch: (id: string) => void
  onRename: (name: string) => void
  onAdd: () => void
  onDelete: () => void
}) {
  const active = profiles.find((p) => p.id === activeId) ?? profiles[0]

  return (
    <div className="space-y-3">
      <div>
        <div className="text-xs font-semibold text-zinc-200">Active persona</div>
        <div className="text-[10px] text-zinc-500 mt-0.5">
          A profile is who the persona is — voice and character art. Behavior (trigger, cooldown,
          event reactions) is shared. Switch here to swap identities; voice and avatar below edit
          the selected profile.
        </div>
      </div>

      <div className="flex items-center gap-2">
        <select
          value={active?.id ?? ''}
          onChange={(e) => onSwitch(e.target.value)}
          className="w-44 shrink-0 rounded-lg border border-white/10 bg-white/5 px-2 py-2 text-[11px] text-zinc-200 outline-none focus:border-white/25 [&>option]:bg-zinc-900"
        >
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <input
          type="text"
          value={active?.name ?? ''}
          onChange={(e) => onRename(e.target.value)}
          placeholder="Profile name"
          className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[11px] text-zinc-200 outline-none focus:border-white/25"
        />
        <button
          type="button"
          onClick={onAdd}
          className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 text-[11px] text-zinc-300 hover:border-white/25"
        >
          + New
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={profiles.length <= 1}
          className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 text-[11px] text-zinc-300 hover:border-red-400/50 hover:text-red-400 disabled:opacity-40 disabled:hover:border-white/10 disabled:hover:text-zinc-300"
        >
          Delete
        </button>
      </div>
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

// ── Brain (LLM behavior — connection lives in Integrations → AI & Voice) ──

function BrainSection({
  brain,
  onChange,
}: {
  brain: PersonaBrainConfig
  onChange: (patch: Partial<PersonaBrainConfig>) => void
}) {
  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs font-semibold text-zinc-200">Brain</div>
        <div className="text-[10px] text-zinc-500 mt-0.5">
          An LLM behind the persona — she summarizes what chat is saying, talks with you in the
          console below, and can write real replies to viewers instead of echoing them.
        </div>
      </div>

      <div className="text-[10px] text-zinc-600">
        {brain.enabled
          ? <>Brain connected: <span className="font-mono text-zinc-400">{brain.provider}{brain.model ? ` · ${brain.model}` : ''}</span>. </>
          : null}
        Connection (provider, model) is configured in Integrations → AI &amp; Voice.
      </div>

      {!brain.enabled && (
        <ConfigNotice tone="info">
          No brain connected — the persona still works, echoing chat messages in her voice.
          These behavior settings take effect once a brain is enabled in Integrations → AI &amp; Voice.
        </ConfigNotice>
      )}

      <div>
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Personality</div>
        <textarea
          value={brain.personality}
          onChange={(e) => onChange({ personality: e.target.value })}
          rows={4}
          className="w-full resize-y rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[11px] text-zinc-200 outline-none focus:border-white/25"
        />
      </div>

      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] font-semibold text-zinc-300">Reply to viewers</div>
          <div className="text-[10px] text-zinc-500 mt-0.5">
            Trigger-selected chat (see Trigger above, e.g. <span className="font-mono">!say</span>) gets an
            in-character LLM reply instead of an echo. Voice/overlay only — never posted to Twitch chat.
          </div>
        </div>
        <Toggle checked={brain.replyToViewers} onChange={(v) => onChange({ replyToViewers: v })} />
      </div>

      <Slider label="Max reply length" value={brain.maxReplyChars} min={60} max={500} step={10} unit=" ch" onChange={(v) => onChange({ maxReplyChars: v })} />
      <Slider label="Auto-summary interval (0 = off)" value={brain.summaryIntervalMin} min={0} max={60} step={1} unit=" min" onChange={(v) => onChange({ summaryIntervalMin: v })} />
      {brain.summaryIntervalMin > 0 && (
        <Slider label="Skip summary under N new messages" value={brain.summaryMinMessages} min={1} max={50} step={1} onChange={(v) => onChange({ summaryMinMessages: v })} />
      )}
    </div>
  )
}

// ── Console (streamer ↔ persona) ─────────────────────────────────────

function ConsoleSection() {
  const [entries, setEntries] = useState<Array<{ role: 'you' | 'persona'; text: string }>>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [summarizing, setSummarizing] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [entries])

  const send = () => {
    const text = input.trim()
    if (!text || busy) return
    setEntries((prev) => [...prev, { role: 'you', text }])
    setInput('')
    setBusy(true)
    setNotice(null)
    socket.emit('persona:console', { text }, (reply: string | null) => {
      setBusy(false)
      if (reply) setEntries((prev) => [...prev, { role: 'persona', text: reply }])
      else setNotice('No reply — apply the config with the brain enabled and check the provider (ANTHROPIC_API_KEY set / Ollama running).')
    })
  }

  const summarize = () => {
    if (summarizing) return
    setSummarizing(true)
    setNotice(null)
    socket.emit('persona:summarize', (err: string | null) => {
      setSummarizing(false)
      setNotice(err ?? 'Summary spoken on the overlay.')
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-semibold text-zinc-200">Console</div>
          <div className="text-[10px] text-zinc-500 mt-0.5">
            Talk with the persona. Replies show here and are spoken on the overlay; she knows what
            chat has been saying. Uses the applied (saved) config.
          </div>
        </div>
        <button
          type="button"
          onClick={summarize}
          disabled={summarizing}
          className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 text-[11px] text-zinc-300 hover:border-white/25 disabled:opacity-40"
        >
          {summarizing ? 'Summarizing…' : '🗣 Summarize chat now'}
        </button>
      </div>

      <div
        ref={listRef}
        className="h-56 space-y-2 overflow-y-auto rounded-xl border border-white/6 bg-white/[0.02] px-3 py-3"
      >
        {entries.length === 0 && (
          <div className="text-[10px] italic text-zinc-600">Say hi — e.g. “what's chat talking about?”</div>
        )}
        {entries.map((entry, idx) => (
          <div key={idx} className={`flex ${entry.role === 'you' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[80%] rounded-lg px-3 py-1.5 text-[11px] leading-relaxed ${
                entry.role === 'you'
                  ? 'bg-sky-400/15 text-sky-100 border border-sky-400/20'
                  : 'bg-white/5 text-zinc-200 border border-white/10'
              }`}
            >
              {entry.text}
            </div>
          </div>
        ))}
        {busy && <div className="text-[10px] italic text-zinc-500">persona is thinking…</div>}
      </div>

      {notice && <div className="text-[10px] text-amber-300/80">{notice}</div>}

      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') send() }}
          placeholder="Message the persona…"
          className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[11px] text-zinc-200 outline-none focus:border-white/25"
        />
        <button
          type="button"
          onClick={send}
          disabled={busy || input.trim().length === 0}
          className="rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] text-zinc-300 hover:border-white/25 disabled:opacity-40"
        >
          Send
        </button>
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
      setSaved(false)
      return patchPersonaDraft(prev, patch)
    })
  }

  // Profile ops — switching flattens the chosen profile onto the flat fields
  // so every section below immediately edits/reflects the new identity.
  const flattenProfile = (cfg: PersonaConfig, profile: PersonaProfile): PersonaConfig => ({
    ...cfg,
    activeProfileId: profile.id,
    ttsProvider: profile.ttsProvider,
    voice: structuredClone(profile.voice),
    avatar: structuredClone(profile.avatar),
  })

  const switchProfile = (id: string) => {
    setDraft((prev) => {
      const profile = prev.profiles.find((p) => p.id === id)
      if (!profile) return prev
      setSaved(false)
      return flattenProfile(prev, profile)
    })
  }

  const renameProfile = (name: string) => {
    setDraft((prev) => {
      setSaved(false)
      return {
        ...prev,
        profiles: prev.profiles.map((p) => (p.id === prev.activeProfileId ? { ...p, name } : p)),
      }
    })
  }

  const addProfile = () => {
    setDraft((prev) => {
      const src = prev.profiles.find((p) => p.id === prev.activeProfileId) ?? prev.profiles[0]
      const profile: PersonaProfile = {
        ...structuredClone(src),
        id: `profile-${Date.now().toString(36)}`,
        name: `${src.name} copy`,
      }
      setSaved(false)
      return flattenProfile({ ...prev, profiles: [...prev.profiles, profile] }, profile)
    })
  }

  const deleteProfile = () => {
    setDraft((prev) => {
      if (prev.profiles.length <= 1) return prev
      const profiles = prev.profiles.filter((p) => p.id !== prev.activeProfileId)
      setSaved(false)
      return flattenProfile({ ...prev, profiles }, profiles[0])
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

      <ConfigSectionPanel label="Profiles">
        <ProfilesSection
          profiles={draft.profiles}
          activeId={draft.activeProfileId}
          onSwitch={switchProfile}
          onRename={renameProfile}
          onAdd={addProfile}
          onDelete={deleteProfile}
        />
      </ConfigSectionPanel>

      <ConfigSectionPanel label="Persona">
        <PersonaSection config={draft} onChange={handleChange} />
      </ConfigSectionPanel>

      <ConfigSectionPanel label="Avatar">
        <AvatarSection
          avatar={draft.avatar}
          onChange={(patch) => handleChange({ avatar: { ...draft.avatar, ...patch } })}
        />
      </ConfigSectionPanel>

      <ConfigSectionPanel label="Brain">
        <BrainSection
          brain={draft.brain}
          onChange={(patch) => handleChange({ brain: { ...draft.brain, ...patch } })}
        />
      </ConfigSectionPanel>

      <ConfigSectionPanel label="Console">
        <ConsoleSection />
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
