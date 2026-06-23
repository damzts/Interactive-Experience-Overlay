import { useState } from 'react'
import type { ChatReactionRule, ChatReactionMatch, EventAction, EffectConfig, TwitchEventReaction, TwitchEventKind } from '@ieomlabs/shared'
import type { EffectType } from '@ieomlabs/shared'
import { STATE, BUILT_IN_TRANSITIONS } from '@ieomlabs/shared'
import { useAdminStore } from '../../store/useAdminStore'
import { Button, Toggle } from '../../components/atoms'
import { ConfigPageIntro, ConfigSectionPanel, ConfigCard, Btn, Field } from '../../shared/ui'
import { createEffectDraft, EVENT_EFFECT_TYPES } from '../asset-library/eventPresets'

// ── Shared style constants ────────────────────────────────────────

const INPUT_CLS = 'w-full rounded-lg border border-zinc-700/60 bg-zinc-900/60 px-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 focus:border-cyan-500/50 focus:outline-none'
const HINT_CLS  = 'text-[9px] text-zinc-600 mt-0.5'

// ── EffectCfgEditor ───────────────────────────────────────────────

function EffectCfgEditor({ eff, onChange }: { eff: EffectConfig; onChange: (patch: Partial<Record<string, unknown>>) => void }) {
  const cfg = (eff as unknown as { cfg: Record<string, unknown> }).cfg ?? {}

  if (eff.type === 'notification-box') return (
    <div className="mt-2 space-y-1.5 pl-1">
      <Field label="Title">
        <input type="text" value={String(cfg.title ?? '')} onChange={(e) => onChange({ title: e.target.value })} className={INPUT_CLS} placeholder="Chat reaction!" />
        <p className={HINT_CLS}>Supports {'{user}'}, {'{text}'}, {'{channel}'} (or double braces)</p>
      </Field>
      <Field label="Body">
        <input type="text" value={String(cfg.body ?? '')} onChange={(e) => onChange({ body: e.target.value })} className={INPUT_CLS} placeholder="{{user}} said: {{text}}" />
      </Field>
    </div>
  )

  if (eff.type === 'desktop-notification') return (
    <div className="mt-2 space-y-1.5 pl-1">
      <Field label="Title">
        <input type="text" value={String(cfg.title ?? '')} onChange={(e) => onChange({ title: e.target.value })} className={INPUT_CLS} placeholder="New message!" />
        <p className={HINT_CLS}>Supports {'{user}'}, {'{text}'}, {'{channel}'} (or double braces)</p>
      </Field>
      <Field label="Body">
        <input type="text" value={String(cfg.body ?? '')} onChange={(e) => onChange({ body: e.target.value })} className={INPUT_CLS} placeholder="{{user}}: {{text}}" />
      </Field>
    </div>
  )

  if (eff.type === 'terminal-toast') return (
    <div className="mt-2 pl-1">
      <Field label="Message">
        <input type="text" value={String((cfg.messages as string[] | undefined)?.[0] ?? '')} onChange={(e) => onChange({ messages: [e.target.value] })} className={INPUT_CLS} placeholder="[ CHAT ] {{user}}: {{text}}" />
        <p className={HINT_CLS}>Supports {'{user}'}, {'{text}'}, {'{channel}'} (or double braces)</p>
      </Field>
    </div>
  )

  if (eff.type === 'typewriter') return (
    <div className="mt-2 pl-1">
      <Field label="Text">
        <input type="text" value={String(cfg.text ?? '')} onChange={(e) => onChange({ text: e.target.value })} className={INPUT_CLS} placeholder="{{user}}: {{text}}" />
        <p className={HINT_CLS}>Supports {'{user}'}, {'{text}'}, {'{channel}'} (or double braces)</p>
      </Field>
    </div>
  )

  return null
}

// ── Shared actions + effects editor (reused for both chat & event reactions) ──

interface ActionsEditorProps {
  effects: EffectConfig[]
  actions: EventAction[]
  onChange: (patch: { effects?: EffectConfig[]; actions?: EventAction[] }) => void
  hint?: string
}

function ActionsEditor({ effects, actions, onChange, hint }: ActionsEditorProps) {
  const applications = useAdminStore((s) => s.config.applications)
  const userScenes   = useAdminStore((s) =>
    Object.values(s.config.scenes ?? {}).filter((sc) => sc.id !== STATE.LOBBY && sc.id !== STATE.DESKTOP)
  )

  const updateEffectCfg = (i: number, patch: Partial<Record<string, unknown>>) => {
    const next = [...effects]
    const eff = next[i] as unknown as { type: string; cfg: Record<string, unknown> }
    next[i] = { ...next[i], cfg: { ...eff.cfg, ...patch } } as typeof next[number]
    onChange({ effects: next })
  }

  const addAction = (kind: EventAction['kind']) => {
    let blank: EventAction
    if (kind === 'widget-command') blank = { kind, widgetId: applications[0]?.id ?? '', action: 'toggle' }
    else if (kind === 'scene-change') blank = { kind, target: userScenes[0]?.id ?? '' }
    else if (kind === 'spotify-control') blank = { kind, command: 'play-pause' }
    else blank = { kind: 'transition', transitionId: 'fade' }
    onChange({ actions: [...actions, blank] })
  }

  const updateAction = (i: number, patch: Partial<EventAction>) => {
    const next = [...actions]
    next[i] = { ...next[i], ...patch } as EventAction
    onChange({ actions: next })
  }

  const removeAction = (i: number) => onChange({ actions: actions.filter((_, j) => j !== i) })
  const removeEffect = (i: number) => onChange({ effects: effects.filter((_, j) => j !== i) })

  return (
    <div className="space-y-2">
      {hint && <p className={HINT_CLS + ' mb-1'}>{hint}</p>}

      {effects.map((eff, i) => (
        <div key={`eff-${i}`} className="rounded-xl border border-zinc-700/50 bg-zinc-900/40 px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-zinc-500 shrink-0">Effect</span>
            <select value={eff.type}
              onChange={(e) => {
                const type = e.target.value as EffectType
                const next = [...effects]
                next[i] = createEffectDraft(type)
                onChange({ effects: next })
              }}
              className="flex-1 rounded-lg border border-zinc-700/60 bg-zinc-900/60 px-2 py-1 text-xs text-zinc-200 focus:border-cyan-500/50 focus:outline-none">
              {EVENT_EFFECT_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
            <button type="button" onClick={() => removeEffect(i)} className="text-zinc-600 hover:text-red-400 transition-colors text-xs">✕</button>
          </div>
          <EffectCfgEditor eff={eff} onChange={(patch) => updateEffectCfg(i, patch)} />
        </div>
      ))}

      {actions.map((action, i) => (
        <div key={`act-${i}`} className="rounded-xl border border-zinc-700/50 bg-zinc-900/40 px-3 py-2">
          {action.kind === 'widget-command' && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-zinc-500 shrink-0">Widget</span>
              <select value={action.widgetId} onChange={(e) => updateAction(i, { widgetId: e.target.value } as Partial<EventAction>)}
                className="flex-1 rounded-lg border border-zinc-700/60 bg-zinc-900/60 px-2 py-1 text-xs text-zinc-200 focus:border-cyan-500/50 focus:outline-none">
                {applications.map((a) => <option key={a.id} value={a.id}>{a.label || a.id}</option>)}
              </select>
              <select value={action.action} onChange={(e) => updateAction(i, { action: e.target.value as 'open' | 'close' | 'toggle' } as Partial<EventAction>)}
                className="rounded-lg border border-zinc-700/60 bg-zinc-900/60 px-2 py-1 text-xs text-zinc-200 focus:border-cyan-500/50 focus:outline-none">
                <option value="toggle">Toggle</option>
                <option value="open">Open</option>
                <option value="close">Close</option>
              </select>
              <button type="button" onClick={() => removeAction(i)} className="text-zinc-600 hover:text-red-400 transition-colors text-xs">✕</button>
            </div>
          )}
          {action.kind === 'scene-change' && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-zinc-500 shrink-0">Scene</span>
              <select value={action.target} onChange={(e) => updateAction(i, { target: e.target.value } as Partial<EventAction>)}
                className="flex-1 rounded-lg border border-zinc-700/60 bg-zinc-900/60 px-2 py-1 text-xs text-zinc-200 focus:border-cyan-500/50 focus:outline-none">
                {userScenes.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                {userScenes.length === 0 && <option disabled value="">No user scenes</option>}
              </select>
              <button type="button" onClick={() => removeAction(i)} className="text-zinc-600 hover:text-red-400 transition-colors text-xs">✕</button>
            </div>
          )}
          {action.kind === 'transition' && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-zinc-500 shrink-0">Transition</span>
              <select value={action.transitionId} onChange={(e) => updateAction(i, { transitionId: e.target.value } as Partial<EventAction>)}
                className="flex-1 rounded-lg border border-zinc-700/60 bg-zinc-900/60 px-2 py-1 text-xs text-zinc-200 focus:border-cyan-500/50 focus:outline-none">
                {BUILT_IN_TRANSITIONS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
              <button type="button" onClick={() => removeAction(i)} className="text-zinc-600 hover:text-red-400 transition-colors text-xs">✕</button>
            </div>
          )}
          {action.kind === 'spotify-control' && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-zinc-500 shrink-0">Spotify</span>
              <select value={action.command} onChange={(e) => updateAction(i, { command: e.target.value as typeof action.command } as Partial<EventAction>)}
                className="flex-1 rounded-lg border border-zinc-700/60 bg-zinc-900/60 px-2 py-1 text-xs text-zinc-200 focus:border-cyan-500/50 focus:outline-none">
                <option value="play-pause">Play / Pause</option>
                <option value="next">Next track</option>
                <option value="prev">Previous track</option>
                <option value="stop">Stop</option>
              </select>
              <button type="button" onClick={() => removeAction(i)} className="text-zinc-600 hover:text-red-400 transition-colors text-xs">✕</button>
            </div>
          )}
        </div>
      ))}

      <div className="flex flex-wrap gap-2">
        <button type="button"
          onClick={() => onChange({ effects: [...effects, createEffectDraft('static-burst')] })}
          className="rounded-full border border-zinc-700/60 bg-zinc-900/60 px-2.5 py-1 text-[10px] font-semibold text-zinc-400 transition hover:border-cyan-400/40 hover:text-cyan-200">
          + Effect
        </button>
        {applications.length > 0 && (
          <button type="button" onClick={() => addAction('widget-command')}
            className="rounded-full border border-zinc-700/60 bg-zinc-900/60 px-2.5 py-1 text-[10px] font-semibold text-zinc-400 transition hover:border-cyan-400/40 hover:text-cyan-200">
            + Widget command
          </button>
        )}
        {userScenes.length > 0 && (
          <button type="button" onClick={() => addAction('scene-change')}
            className="rounded-full border border-zinc-700/60 bg-zinc-900/60 px-2.5 py-1 text-[10px] font-semibold text-zinc-400 transition hover:border-cyan-400/40 hover:text-cyan-200">
            + Scene change
          </button>
        )}
        <button type="button" onClick={() => addAction('transition')}
          className="rounded-full border border-zinc-700/60 bg-zinc-900/60 px-2.5 py-1 text-[10px] font-semibold text-zinc-400 transition hover:border-cyan-400/40 hover:text-cyan-200">
          + Transition
        </button>
        <button type="button" onClick={() => addAction('spotify-control')}
          className="rounded-full border border-zinc-700/60 bg-zinc-900/60 px-2.5 py-1 text-[10px] font-semibold text-zinc-400 transition hover:border-emerald-400/40 hover:text-emerald-300">
          + Spotify
        </button>
      </div>
    </div>
  )
}

// ── Chat reaction helpers ─────────────────────────────────────────

function blankRule(): ChatReactionRule {
  return { id: crypto.randomUUID(), label: '', enabled: true, match: { type: 'command', value: '' }, cooldownMs: 10000 }
}

const MATCH_TYPE_LABELS: Record<ChatReactionMatch['type'], string> = {
  keyword: 'Keyword',
  command: 'Command (!)',
  regex: 'Regex',
}

// ── ReactionEditor (chat rules) ───────────────────────────────────

function ReactionEditor({ rule, onSave, onCancel }: {
  rule: ChatReactionRule
  onSave: (r: ChatReactionRule) => void
  onCancel: () => void
}) {
  const [draft, setDraft] = useState<ChatReactionRule>(() => JSON.parse(JSON.stringify(rule)))

  return (
    <div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 p-4 space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Label">
          <input type="text" value={draft.label} onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
            placeholder="e.g. Hype Glitch" className={INPUT_CLS} />
        </Field>
        <Field label="Cooldown (ms)">
          <input type="number" min={0} step={1000} value={draft.cooldownMs ?? 0}
            onChange={(e) => setDraft((d) => ({ ...d, cooldownMs: Number(e.target.value) }))} className={INPUT_CLS} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Match type">
          <select value={draft.match.type}
            onChange={(e) => setDraft((d) => ({ ...d, match: { ...d.match, type: e.target.value as ChatReactionMatch['type'] } }))}
            className={INPUT_CLS}>
            {Object.entries(MATCH_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        <Field label={draft.match.type === 'command' ? 'Command (without !)' : draft.match.type === 'regex' ? 'Pattern' : 'Keyword'}>
          <input type="text" value={draft.match.value}
            onChange={(e) => setDraft((d) => ({ ...d, match: { ...d.match, value: e.target.value } }))}
            placeholder={draft.match.type === 'command' ? 'hype' : draft.match.type === 'regex' ? '\\bhype\\b' : 'hype'}
            className={INPUT_CLS} />
        </Field>
      </div>

      <ActionsEditor
        effects={draft.effects ?? []}
        actions={draft.actions ?? []}
        onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
      />

      <div className="flex justify-end gap-2">
        <Btn type="button" variant="default" onClick={onCancel} className="px-3 py-1.5 text-xs">Cancel</Btn>
        <Button variant="primary" size="sm" onClick={() => onSave(draft)}>Save Rule</Button>
      </div>
    </div>
  )
}

// ── ReactionRow (chat rules) ──────────────────────────────────────

function ReactionRow({ rule, onToggle, onEdit, onDelete }: {
  rule: ChatReactionRule
  onToggle: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-opacity ${
      rule.enabled ? 'border-white/8 bg-white/[0.02]' : 'border-white/4 opacity-50'
    }`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-zinc-200 truncate">{rule.label || <span className="italic text-zinc-500">Unnamed</span>}</span>
          <span className="text-[9px] font-mono text-zinc-500 shrink-0">
            {rule.match.type === 'command' ? `!${rule.match.value}` : rule.match.value}
          </span>
        </div>
        <div className="mt-0.5 text-[10px] text-zinc-600">
          {MATCH_TYPE_LABELS[rule.match.type]}
          {rule.effects?.length ? ` · ${rule.effects.map((e) => e.type).join(', ')}` : ''}
          {rule.cooldownMs ? ` · ${rule.cooldownMs / 1000}s cooldown` : ''}
        </div>
      </div>
      <Toggle checked={rule.enabled} onChange={onToggle} size="sm" label={rule.enabled ? 'On' : 'Off'} />
      <button type="button" onClick={onEdit} className="text-zinc-500 hover:text-cyan-300 transition-colors text-xs">Edit</button>
      <button type="button" onClick={onDelete} className="text-zinc-600 hover:text-red-400 transition-colors text-sm">✕</button>
    </div>
  )
}

// ── EventSub event definitions ────────────────────────────────────

interface EventDef {
  kind: TwitchEventKind
  label: string
  hint: string
}

const EVENT_DEFS: EventDef[] = [
  { kind: 'follow',           label: 'Follow',                hint: 'Variables: {user}' },
  { kind: 'subscribe',        label: 'Subscription',          hint: 'Variables: {user}, {tier}' },
  { kind: 'gift-sub',         label: 'Gift Subscription',     hint: 'Variables: {gifter}, {total}, {tier}' },
  { kind: 'cheer',            label: 'Cheer (Bits)',          hint: 'Variables: {user}, {bits}, {message}' },
  { kind: 'raid',             label: 'Raid',                  hint: 'Variables: {from}, {viewers}' },
  { kind: 'points-redemption',label: 'Channel Points',        hint: 'Variables: {user}, {reward}, {input}' },
  { kind: 'stream-online',    label: 'Stream Online',         hint: 'No variables' },
  { kind: 'stream-offline',   label: 'Stream Offline',        hint: 'No variables' },
  { kind: 'hype-train-begin', label: 'Hype Train Begins',     hint: 'Variables: {level}' },
  { kind: 'hype-train-end',   label: 'Hype Train Ends',       hint: 'Variables: {level}' },
]

// ── EventReactionRow ──────────────────────────────────────────────

function EventReactionRow({ def, reaction, onToggle, onEdit }: {
  def: EventDef
  reaction: TwitchEventReaction | undefined
  onToggle: () => void
  onEdit: () => void
}) {
  const enabled = reaction?.enabled ?? false
  const hasConfig = (reaction?.effects?.length ?? 0) > 0 || (reaction?.actions?.length ?? 0) > 0

  return (
    <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-opacity ${
      enabled ? 'border-white/8 bg-white/[0.02]' : 'border-white/4 opacity-50'
    }`}>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-zinc-200">{def.label}</div>
        <div className="mt-0.5 text-[10px] text-zinc-600">
          {def.hint}
          {hasConfig ? ` · ${(reaction?.effects?.length ?? 0) + (reaction?.actions?.length ?? 0)} action(s)` : ''}
        </div>
      </div>
      <Toggle checked={enabled} onChange={onToggle} size="sm" label={enabled ? 'On' : 'Off'} />
      <button type="button" onClick={onEdit} className="text-zinc-500 hover:text-cyan-300 transition-colors text-xs">
        {hasConfig ? 'Edit' : 'Configure'}
      </button>
    </div>
  )
}

// ── EventReactionEditor ───────────────────────────────────────────

function EventReactionEditor({ def, reaction, onSave, onCancel }: {
  def: EventDef
  reaction: TwitchEventReaction
  onSave: (r: TwitchEventReaction) => void
  onCancel: () => void
}) {
  const [draft, setDraft] = useState<TwitchEventReaction>(() => JSON.parse(JSON.stringify(reaction)))

  return (
    <div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 p-4 space-y-4">
      <div className="text-xs font-semibold text-zinc-200">{def.label}</div>

      <ActionsEditor
        effects={draft.effects ?? []}
        actions={draft.actions ?? []}
        hint={def.hint}
        onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
      />

      <div className="flex justify-end gap-2">
        <Btn type="button" variant="default" onClick={onCancel} className="px-3 py-1.5 text-xs">Cancel</Btn>
        <Button variant="primary" size="sm" onClick={() => onSave(draft)}>Save</Button>
      </div>
    </div>
  )
}

// ── TwitchPanel ───────────────────────────────────────────────────

export function TwitchPanel() {
  const config              = useAdminStore((s) => s.config)
  const saveConfig          = useAdminStore((s) => s.saveConfig)
  const twitchConnected     = useAdminStore((s) => s.twitchConnected)
  const twitchEventSubConnected = useAdminStore((s) => s.twitchEventSubConnected)

  const twitch    = config.twitch    ?? { channel: '', enabled: false }
  const reactions = config.chatReactions ?? []

  // Local twitch connection config draft
  const [channel,     setChannel]     = useState(twitch.channel)
  const [accessToken, setAccessToken] = useState(twitch.accessToken ?? '')
  const [clientId,    setClientId]    = useState(twitch.clientId ?? '')
  const [enabled,     setEnabled]     = useState(twitch.enabled)
  const [twitchDirty, setTwitchDirty] = useState(false)

  // Chat reaction editing state
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null)
  const [newRule, setNewRule] = useState<ChatReactionRule | null>(null)

  // Event reaction editing state
  const [editingEventKind, setEditingEventKind] = useState<TwitchEventKind | null>(null)

  function onTwitchChange(field: Partial<{ channel: string; accessToken: string; clientId: string; enabled: boolean }>) {
    if ('channel'     in field) setChannel(field.channel!)
    if ('accessToken' in field) setAccessToken(field.accessToken!)
    if ('clientId'    in field) setClientId(field.clientId!)
    if ('enabled'     in field) setEnabled(field.enabled!)
    setTwitchDirty(true)
  }

  async function saveTwitch() {
    await saveConfig({
      twitch: {
        ...twitch,
        channel,
        enabled,
        accessToken: accessToken || undefined,
        clientId: clientId || undefined,
      },
    })
    setTwitchDirty(false)
  }

  async function connect() {
    await saveConfig({
      twitch: {
        ...twitch,
        channel,
        accessToken: accessToken || undefined,
        clientId: clientId || undefined,
        enabled: true,
      },
    })
    setEnabled(true)
    setTwitchDirty(false)
  }

  async function disconnect() {
    await saveConfig({
      twitch: {
        ...twitch,
        channel,
        accessToken: accessToken || undefined,
        clientId: clientId || undefined,
        enabled: false,
      },
    })
    setEnabled(false)
    setTwitchDirty(false)
  }

  // Chat reactions
  async function saveRule(updated: ChatReactionRule) {
    const next = editingRuleId === 'new'
      ? [...reactions, updated]
      : reactions.map((r) => r.id === updated.id ? updated : r)
    await saveConfig({ chatReactions: next })
    setEditingRuleId(null)
    setNewRule(null)
  }

  async function toggleRule(id: string) {
    await saveConfig({ chatReactions: reactions.map((r) => r.id === id ? { ...r, enabled: !r.enabled } : r) })
  }

  async function deleteRule(id: string) {
    await saveConfig({ chatReactions: reactions.filter((r) => r.id !== id) })
  }

  // Event reactions
  function getEventReaction(kind: TwitchEventKind): TwitchEventReaction {
    return (twitch.eventReactions ?? []).find((r) => r.event === kind)
      ?? { event: kind, enabled: false }
  }

  async function toggleEventReaction(kind: TwitchEventKind) {
    const current = getEventReaction(kind)
    const next = upsertEventReaction(twitch.eventReactions ?? [], { ...current, enabled: !current.enabled })
    await saveConfig({ twitch: { ...twitch, channel, enabled, accessToken: accessToken || undefined, clientId: clientId || undefined, eventReactions: next } })
  }

  async function saveEventReaction(updated: TwitchEventReaction) {
    const next = upsertEventReaction(twitch.eventReactions ?? [], updated)
    await saveConfig({ twitch: { ...twitch, channel, enabled, accessToken: accessToken || undefined, clientId: clientId || undefined, eventReactions: next } })
    setEditingEventKind(null)
  }

  return (
    <div className="space-y-5">
      <ConfigPageIntro title="Twitch" eyebrow="Engine">
        Connect to a Twitch channel for live chat and channel events. Chat works anonymously (no token). EventSub events (follows, subs, raids, etc.) require an OAuth token and a Twitch app Client ID.
      </ConfigPageIntro>

      {/* ── Connection ── */}
      <ConfigSectionPanel label="Connection">
        <ConfigCard>
          {/* IRC status */}
          <div className="flex items-center gap-4 mb-3">
            <div className="flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full shrink-0 ${twitchConnected ? 'bg-emerald-400' : 'bg-zinc-700'}`} />
              <span className={`text-xs font-semibold ${twitchConnected ? 'text-emerald-400' : 'text-zinc-500'}`}>
                {twitchConnected ? `Chat connected` : 'Chat disconnected'}
              </span>
              {twitchConnected && twitch.channel && (
                <span className="text-[10px] font-mono text-zinc-400">#{twitch.channel}</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full shrink-0 ${twitchEventSubConnected ? 'bg-violet-400' : 'bg-zinc-700'}`} />
              <span className={`text-xs font-semibold ${twitchEventSubConnected ? 'text-violet-400' : 'text-zinc-500'}`}>
                {twitchEventSubConnected ? 'EventSub connected' : 'EventSub disconnected'}
              </span>
            </div>
          </div>

          <div className="space-y-3">
            <Field label="Channel (without #)">
              <input type="text" value={channel} onChange={(e) => onTwitchChange({ channel: e.target.value })}
                placeholder="mychannel" className={INPUT_CLS} />
            </Field>
            <Field label="OAuth Token (optional — leave blank for anonymous read-only chat)">
              <input type="password" value={accessToken} onChange={(e) => onTwitchChange({ accessToken: e.target.value })}
                placeholder="oauth:…" className={INPUT_CLS} />
            </Field>
            <Field label="Client ID (required for EventSub — from dev.twitch.tv)">
              <input type="text" value={clientId} onChange={(e) => onTwitchChange({ clientId: e.target.value })}
                placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" className={INPUT_CLS} />
              <p className={HINT_CLS}>
                Token needs scopes: moderator:read:followers · channel:read:subscriptions · bits:read · channel:read:redemptions · channel:read:hype_train
              </p>
            </Field>
          </div>

          <div className="mt-3 flex items-center justify-between gap-2">
            <div className="flex gap-2">
              {enabled ? (
                <Btn type="button" variant="default" onClick={() => { void disconnect() }} className="px-3 py-1.5 text-xs">
                  Disconnect
                </Btn>
              ) : (
                <Button variant="primary" size="sm" onClick={() => { void connect() }}>
                  Connect
                </Button>
              )}
            </div>
            {twitchDirty && (
              <Button variant="primary" size="sm" onClick={() => { void saveTwitch() }}>Save</Button>
            )}
          </div>
        </ConfigCard>
      </ConfigSectionPanel>

      {/* ── Event Reactions (EventSub) ── */}
      <ConfigSectionPanel label="Event Reactions">
        <div className="space-y-2">
          {EVENT_DEFS.map((def) => {
            const reaction = (twitch.eventReactions ?? []).find((r) => r.event === def.kind)
            return editingEventKind === def.kind ? (
              <EventReactionEditor
                key={def.kind}
                def={def}
                reaction={getEventReaction(def.kind)}
                onSave={(r) => { void saveEventReaction(r) }}
                onCancel={() => setEditingEventKind(null)}
              />
            ) : (
              <EventReactionRow
                key={def.kind}
                def={def}
                reaction={reaction}
                onToggle={() => { void toggleEventReaction(def.kind) }}
                onEdit={() => setEditingEventKind(def.kind)}
              />
            )
          })}
        </div>
        <p className="mt-3 text-[9px] text-zinc-600">
          All events also emit kernel signals (twitch:follow, twitch:raid, etc.) available in Automation Rules and Widget Wires.
        </p>
      </ConfigSectionPanel>

      {/* ── Chat Reactions ── */}
      <ConfigSectionPanel label={`Chat Reactions${reactions.length ? ` (${reactions.length})` : ''}`}>
        {reactions.length === 0 && editingRuleId !== 'new' && (
          <div className="text-[10px] text-zinc-600 italic mb-3">No reactions configured.</div>
        )}

        <div className="space-y-2">
          {reactions.map((rule) => (
            editingRuleId === rule.id ? (
              <ReactionEditor key={rule.id} rule={rule} onSave={saveRule} onCancel={() => setEditingRuleId(null)} />
            ) : (
              <ReactionRow
                key={rule.id}
                rule={rule}
                onToggle={() => { void toggleRule(rule.id) }}
                onEdit={() => setEditingRuleId(rule.id)}
                onDelete={() => { void deleteRule(rule.id) }}
              />
            )
          ))}

          {editingRuleId === 'new' && newRule && (
            <ReactionEditor rule={newRule} onSave={saveRule} onCancel={() => { setEditingRuleId(null); setNewRule(null) }} />
          )}
        </div>

        {editingRuleId !== 'new' && (
          <div className="mt-3">
            <button type="button"
              onClick={() => { setNewRule(blankRule()); setEditingRuleId('new') }}
              className="flex w-full items-center gap-1.5 rounded-xl border border-dashed border-white/10 px-3 py-2 text-[11px] text-zinc-500 transition-colors hover:border-violet-500/35 hover:bg-violet-500/8 hover:text-violet-200">
              <span>+</span> New Reaction Rule
            </button>
          </div>
        )}
      </ConfigSectionPanel>
    </div>
  )
}

// ── helpers ───────────────────────────────────────────────────────

function upsertEventReaction(list: TwitchEventReaction[], updated: TwitchEventReaction): TwitchEventReaction[] {
  const exists = list.some((r) => r.event === updated.event)
  return exists ? list.map((r) => r.event === updated.event ? updated : r) : [...list, updated]
}
