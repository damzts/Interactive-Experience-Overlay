import { useCallback, useEffect, useRef, useState } from 'react'
import { withPersonaDefaults } from '@ieomlabs/shared'
import type { AvatarPreset, PersonaBrainConfig, PersonaConfig, PersonaEventLine, PersonaProfile } from '@ieomlabs/shared'
import { useAdminStore } from '../../store/useAdminStore'
import { socket } from '../../socket/client'
import { Card } from '../../components/molecules/Card'
import {
  ConfigApplyBar, ConfigPageIntro, ConfigSectionPanel, ConfigNotice,
  Toggle, Slider, ConfigChoiceButton, isSameDraft,
} from '../../shared/ui'
import { patchPersonaDraft } from './personaDraft'

// ── Config (trigger/cooldown/voice/event lines) ──────────────────────

const TRIGGER_MODES: Array<{ id: PersonaConfig['triggerMode']; label: string }> = [
  { id: 'command', label: 'Command' },
  { id: 'keyword', label: 'Keyword' },
  { id: 'chance',  label: 'Chance' },
  { id: 'all',     label: 'All messages' },
]

function PersonaConfigSection({
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
          <div className="text-xs font-semibold text-zinc-200">Config</div>
          <div className="text-[10px] text-zinc-500 mt-0.5">
            Picks a chat message and speaks it in the overlay through a robotic voice filter, with a caption
            bubble — a chat-to-voice bridge you can react to live. These settings belong to this profile.
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

// ── Avatar reference (picker only — editing happens in Graphics → Avatar) ──

function AvatarReferenceSection({
  avatarPresets,
  avatarPresetId,
  onChange,
  onOpenAvatar,
}: {
  avatarPresets: AvatarPreset[]
  avatarPresetId: string | undefined
  onChange: (id: string | undefined) => void
  onOpenAvatar?: () => void
}) {
  const selected = avatarPresets.find((p) => p.id === avatarPresetId)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-semibold text-zinc-200">Avatar</div>
          <div className="text-[10px] text-zinc-500 mt-0.5">
            Character art shown while this profile speaks. Avatars are built in Graphics → Avatar —
            pick one to reference here, or create/edit one there.
          </div>
        </div>
        <button
          type="button"
          onClick={onOpenAvatar}
          className="shrink-0 rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 text-[11px] text-zinc-300 hover:border-white/25"
        >
          Open Graphics → Avatar
        </button>
      </div>

      <div className="flex items-center gap-2">
        {selected?.images[0] && (
          <img src={selected.images[0]} alt="" className="h-12 w-9 shrink-0 rounded object-contain border border-white/10 bg-white/5" />
        )}
        <select
          value={avatarPresetId ?? ''}
          onChange={(e) => onChange(e.target.value || undefined)}
          className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[11px] text-zinc-200 outline-none focus:border-white/25 [&>option]:bg-zinc-900"
        >
          <option value="">(none — avatar never shows)</option>
          {avatarPresets.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {avatarPresets.length === 0 && (
        <div className="text-[10px] italic text-zinc-600">
          No avatars saved yet — create one in Graphics → Avatar.
        </div>
      )}
    </div>
  )
}

// ── Brain (LLM behavior — connection lives in Integrations → AI) ──

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
          An LLM behind this profile — she summarizes what chat is saying, talks with you in the
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
            in-character LLM reply instead of an echo, spoken over the overlay.
          </div>
        </div>
        <Toggle checked={brain.replyToViewers} onChange={(v) => onChange({ replyToViewers: v })} />
      </div>

      {brain.replyToViewers && (
        <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
          <div>
            <div className="text-[11px] font-semibold text-zinc-300">Also post replies to Twitch chat</div>
            <div className="text-[10px] text-zinc-500 mt-0.5">
              Publicly visible in your channel's chat, not just spoken over the overlay. Requires an
              access token with the <span className="font-mono">chat:edit</span> scope in Twitch settings —
              otherwise this silently does nothing.
            </div>
          </div>
          <Toggle checked={brain.postRepliesToChat} onChange={(v) => onChange({ postRepliesToChat: v })} />
        </div>
      )}

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
            chat has been saying. Uses the applied (saved) config, for whichever profile is active.
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

// ── Profile cards ──────────────────────────────────────────────────

function ProfileCard({
  profile,
  active,
  avatarThumb,
  onActivate,
  onEdit,
}: {
  profile: PersonaProfile
  active: boolean
  avatarThumb?: string
  onActivate: () => void
  onEdit: () => void
}) {
  return (
    <Card
      variant="interactive"
      padding="sm"
      glow={active ? 'primary' : 'none'}
      onClick={onActivate}
      className={`flex flex-col items-center gap-1.5 text-center animate-card-entrance ${active ? 'border-[var(--color-primary-400)]' : ''}`}
    >
      {avatarThumb ? (
        <img src={avatarThumb} alt="" className="h-16 w-12 rounded object-contain border border-white/10 bg-white/5" />
      ) : (
        <span className="text-2xl leading-none">🙂</span>
      )}
      <span className="text-xs font-medium text-[var(--color-text-primary)] truncate w-full">{profile.name}</span>
      <span className="text-[9px] text-[var(--color-text-muted)]">
        {profile.brain.enabled ? `Brain: ${profile.brain.provider}` : 'No brain'}
      </span>
      {active && <span className="text-[10px] font-medium text-[var(--color-primary-400)]">Active</span>}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onEdit() }}
        className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-zinc-300 hover:border-white/25"
      >
        Edit
      </button>
    </Card>
  )
}

function ProfilesSection({
  profiles,
  activeId,
  avatarPresets,
  editingId,
  onActivate,
  onEdit,
  onAdd,
}: {
  profiles: PersonaProfile[]
  activeId: string
  avatarPresets: AvatarPreset[]
  editingId: string | null
  onActivate: (id: string) => void
  onEdit: (id: string) => void
  onAdd: () => void
}) {
  return (
    <div className="space-y-3">
      <div className="text-[10px] text-zinc-500">
        A profile is Config (trigger/cooldown/voice/event reactions) + Avatar (by reference) + Brain,
        selected as a unit. Tap a card to activate it; Edit opens its Config/Avatar/Brain.
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
        {profiles.map((profile) => (
          <ProfileCard
            key={profile.id}
            profile={profile}
            active={profile.id === activeId}
            avatarThumb={avatarPresets.find((p) => p.id === profile.avatarPresetId)?.images[0]}
            onActivate={() => onActivate(profile.id)}
            onEdit={() => onEdit(profile.id)}
          />
        ))}
        <button
          type="button"
          onClick={onAdd}
          className="flex flex-col items-center justify-center gap-1 rounded-[var(--radius-lg)] border border-dashed border-white/15 px-3 py-4 text-zinc-500 transition-colors hover:border-cyan-400/40 hover:text-cyan-200"
        >
          <span className="text-xl leading-none">+</span>
          <span className="text-[10px]">New Profile</span>
        </button>
      </div>
      {editingId && (
        <div className="text-[10px] text-zinc-600">Editing: {profiles.find((p) => p.id === editingId)?.name}</div>
      )}
    </div>
  )
}

// ── PersonaPanel ─────────────────────────────────────────────────────

export function PersonaPanel({ onOpenAvatar }: { onOpenAvatar?: () => void }) {
  const rawPersona = useAdminStore((s) => s.config.persona)
  const avatarPresets = useAdminStore((s) => s.config.avatarPresets ?? [])
  const persona: PersonaConfig = withPersonaDefaults(rawPersona, avatarPresets)
  const saveConfig = useAdminStore((s) => s.saveConfig)

  const [draft, setDraft] = useState<PersonaConfig>(() => structuredClone(persona))
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null)
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
  // so the editor below immediately edits/reflects the new identity.
  const flattenProfile = (cfg: PersonaConfig, profile: PersonaProfile): PersonaConfig => ({
    ...cfg,
    activeProfileId: profile.id,
    ttsProvider: profile.ttsProvider,
    voice: structuredClone(profile.voice),
    brain: structuredClone(profile.brain),
    triggerMode: profile.triggerMode,
    triggerValue: profile.triggerValue,
    chance: profile.chance,
    cooldownMs: profile.cooldownMs,
    maxChars: profile.maxChars,
    duckAmount: profile.duckAmount,
    eventLines: structuredClone(profile.eventLines),
    avatar: avatarPresets.find((p) => p.id === profile.avatarPresetId) ?? cfg.avatar,
  })

  const activateProfile = (id: string) => {
    setDraft((prev) => {
      const profile = prev.profiles.find((p) => p.id === id)
      if (!profile) return prev
      setSaved(false)
      return flattenProfile(prev, profile)
    })
  }

  const editProfile = (id: string) => {
    setEditingProfileId(id)
    if (id !== draft.activeProfileId) activateProfile(id)
  }

  const renameEditingProfile = (name: string) => {
    setDraft((prev) => {
      setSaved(false)
      return {
        ...prev,
        profiles: prev.profiles.map((p) => (p.id === (editingProfileId ?? prev.activeProfileId) ? { ...p, name } : p)),
      }
    })
  }

  const setEditingProfileAvatar = (avatarPresetId: string | undefined) => {
    setDraft((prev) => {
      setSaved(false)
      const targetId = editingProfileId ?? prev.activeProfileId
      const next = {
        ...prev,
        profiles: prev.profiles.map((p) => (p.id === targetId ? { ...p, avatarPresetId } : p)),
      }
      if (targetId === prev.activeProfileId) {
        next.avatar = avatarPresets.find((p) => p.id === avatarPresetId) ?? { mode: 'pop-in' as const, images: [], corner: 'bottom-right' as const, widthPx: 260, lingerMs: 4000 }
      }
      return next
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
      const next = flattenProfile({ ...prev, profiles: [...prev.profiles, profile] }, profile)
      setEditingProfileId(profile.id)
      return next
    })
  }

  const deleteEditingProfile = () => {
    setDraft((prev) => {
      if (prev.profiles.length <= 1) return prev
      const targetId = editingProfileId ?? prev.activeProfileId
      const profiles = prev.profiles.filter((p) => p.id !== targetId)
      setSaved(false)
      setEditingProfileId(null)
      return targetId === prev.activeProfileId ? flattenProfile({ ...prev, profiles }, profiles[0]) : { ...prev, profiles }
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
    setEditingProfileId(null)
    setSaved(false)
  }, [persona])

  const editingProfile = draft.profiles.find((p) => p.id === (editingProfileId ?? draft.activeProfileId))

  return (
    <div className="space-y-5">
      <ConfigPageIntro title="Persona">
        A chat-to-voice companion — picks chat messages and speaks them in the overlay. Profiles are
        named identities: Config + Avatar + Brain, selected as a unit.
      </ConfigPageIntro>

      <ConfigSectionPanel label="Profiles">
        <ProfilesSection
          profiles={draft.profiles}
          activeId={draft.activeProfileId}
          avatarPresets={avatarPresets}
          editingId={editingProfileId}
          onActivate={activateProfile}
          onEdit={editProfile}
          onAdd={addProfile}
        />
      </ConfigSectionPanel>

      {editingProfile && (
        <>
          <ConfigSectionPanel label={`Editing: ${editingProfile.name}`}>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={editingProfile.name}
                onChange={(e) => renameEditingProfile(e.target.value)}
                placeholder="Profile name"
                className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[11px] text-zinc-200 outline-none focus:border-white/25"
              />
              <button
                type="button"
                onClick={deleteEditingProfile}
                disabled={draft.profiles.length <= 1}
                className="shrink-0 rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 text-[11px] text-zinc-300 hover:border-red-400/50 hover:text-red-400 disabled:opacity-40 disabled:hover:border-white/10 disabled:hover:text-zinc-300"
              >
                Delete profile
              </button>
            </div>
          </ConfigSectionPanel>

          <ConfigSectionPanel label="Config">
            <PersonaConfigSection config={draft} onChange={handleChange} />
          </ConfigSectionPanel>

          <ConfigSectionPanel label="Avatar">
            <AvatarReferenceSection
              avatarPresets={avatarPresets}
              avatarPresetId={editingProfile.avatarPresetId}
              onChange={setEditingProfileAvatar}
              onOpenAvatar={onOpenAvatar}
            />
          </ConfigSectionPanel>

          <ConfigSectionPanel label="Brain">
            <BrainSection
              brain={draft.brain}
              onChange={(patch) => handleChange({ brain: { ...draft.brain, ...patch } })}
            />
          </ConfigSectionPanel>
        </>
      )}

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
