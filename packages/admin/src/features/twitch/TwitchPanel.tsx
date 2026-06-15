import { useState } from 'react'
import type { ChatReactionRule, ChatReactionMatch, EventAction, EffectConfig } from '@ieomlabs/shared'
import type { EffectType } from '@ieomlabs/shared'
import { STATE, BUILT_IN_TRANSITIONS } from '@ieomlabs/shared'
import { useAdminStore } from '../../store/useAdminStore'
import { Button, Toggle } from '../../components/atoms'
import { ConfigPageIntro, ConfigSectionPanel, ConfigCard, Btn, Field } from '../../shared/ui'
import { createEffectDraft, EVENT_EFFECT_TYPES } from '../asset-library/eventPresets'

// ── Helpers ──────────────────────────────────────────────────────────

function blankRule(): ChatReactionRule {
  return {
    id: crypto.randomUUID(),
    label: '',
    enabled: true,
    match: { type: 'command', value: '' },
    cooldownMs: 10000,
  }
}

const MATCH_TYPE_LABELS: Record<ChatReactionMatch['type'], string> = {
  keyword: 'Keyword',
  command: 'Command (!)',
  regex: 'Regex',
}


const INPUT_CLS = 'w-full rounded-lg border border-zinc-700/60 bg-zinc-900/60 px-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 focus:border-cyan-500/50 focus:outline-none'
const HINT_CLS  = 'text-[9px] text-zinc-600 mt-0.5'

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

// ── ReactionEditor ───────────────────────────────────────────────────

function ReactionEditor({ rule, onSave, onCancel }: {
  rule: ChatReactionRule
  onSave: (r: ChatReactionRule) => void
  onCancel: () => void
}) {
  const [draft, setDraft] = useState<ChatReactionRule>(() => JSON.parse(JSON.stringify(rule)))
  const applications = useAdminStore((s) => s.config.applications)
  const userScenes   = useAdminStore((s) =>
    Object.values(s.config.scenes ?? {}).filter((sc) => sc.id !== STATE.LOBBY && sc.id !== STATE.DESKTOP)
  )

  const updateEffectCfg = (i: number, patch: Partial<Record<string, unknown>>) => {
    setDraft((d) => {
      const effects = [...(d.effects ?? [])]
      const eff = effects[i] as unknown as { type: string; cfg: Record<string, unknown> }
      effects[i] = { ...effects[i], cfg: { ...eff.cfg, ...patch } } as typeof effects[number]
      return { ...d, effects }
    })
  }

  const addAction = (kind: EventAction['kind']) => {
    let blank: EventAction
    if (kind === 'widget-command') blank = { kind, widgetId: applications[0]?.id ?? '', action: 'toggle' }
    else if (kind === 'scene-change') blank = { kind, target: userScenes[0]?.id ?? '' }
    else blank = { kind: 'transition', transitionId: 'fade' }
    setDraft((d) => ({ ...d, actions: [...(d.actions ?? []), blank] }))
  }

  const updateAction = (i: number, patch: Partial<EventAction>) => {
    setDraft((d) => {
      const actions = [...(d.actions ?? [])]
      actions[i] = { ...actions[i], ...patch } as EventAction
      return { ...d, actions }
    })
  }

  const removeAction = (i: number) => {
    setDraft((d) => ({ ...d, actions: (d.actions ?? []).filter((_, j) => j !== i) }))
  }

  return (
    <div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 p-4 space-y-4">
      {/* ── Identity ── */}
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

      {/* ── Match ── */}
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

      {/* ── Actions ── */}
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">Actions</div>
        <div className="space-y-2">
          {(draft.effects ?? []).map((eff, i) => (
            <div key={`eff-${i}`} className="rounded-xl border border-zinc-700/50 bg-zinc-900/40 px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-zinc-500 shrink-0">Effect</span>
                <select value={eff.type}
                  onChange={(e) => {
                    const type = e.target.value as EffectType
                    setDraft((d) => {
                      const effects = [...(d.effects ?? [])]
                      effects[i] = createEffectDraft(type)
                      return { ...d, effects }
                    })
                  }}
                  className="flex-1 rounded-lg border border-zinc-700/60 bg-zinc-900/60 px-2 py-1 text-xs text-zinc-200 focus:border-cyan-500/50 focus:outline-none">
                  {EVENT_EFFECT_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
                <button type="button" onClick={() => setDraft((d) => ({ ...d, effects: (d.effects ?? []).filter((_, j) => j !== i) }))}
                  className="text-zinc-600 hover:text-red-400 transition-colors text-xs">✕</button>
              </div>
              <EffectCfgEditor eff={eff} onChange={(patch) => updateEffectCfg(i, patch)} />
            </div>
          ))}

          {(draft.actions ?? []).map((action, i) => (
            <div key={`act-${i}`} className="rounded-xl border border-zinc-700/50 bg-zinc-900/40 px-3 py-2">
              {action.kind === 'widget-command' && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-zinc-500 shrink-0">Widget</span>
                  <select value={action.widgetId}
                    onChange={(e) => updateAction(i, { widgetId: e.target.value } as Partial<EventAction>)}
                    className="flex-1 rounded-lg border border-zinc-700/60 bg-zinc-900/60 px-2 py-1 text-xs text-zinc-200 focus:border-cyan-500/50 focus:outline-none">
                    {applications.map((a) => <option key={a.id} value={a.id}>{a.label || a.id}</option>)}
                  </select>
                  <select value={action.action}
                    onChange={(e) => updateAction(i, { action: e.target.value as 'open' | 'close' | 'toggle' } as Partial<EventAction>)}
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
                  <select value={action.target}
                    onChange={(e) => updateAction(i, { target: e.target.value } as Partial<EventAction>)}
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
                  <select value={action.transitionId}
                    onChange={(e) => updateAction(i, { transitionId: e.target.value } as Partial<EventAction>)}
                    className="flex-1 rounded-lg border border-zinc-700/60 bg-zinc-900/60 px-2 py-1 text-xs text-zinc-200 focus:border-cyan-500/50 focus:outline-none">
                    {BUILT_IN_TRANSITIONS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                  </select>
                  <button type="button" onClick={() => removeAction(i)} className="text-zinc-600 hover:text-red-400 transition-colors text-xs">✕</button>
                </div>
              )}
            </div>
          ))}

          <div className="flex flex-wrap gap-2">
            <button type="button"
              onClick={() => setDraft((d) => ({ ...d, effects: [...(d.effects ?? []), createEffectDraft('static-burst')] }))}
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
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Btn type="button" variant="default" onClick={onCancel} className="px-3 py-1.5 text-xs">Cancel</Btn>
        <Button variant="primary" size="sm" onClick={() => onSave(draft)}>Save Rule</Button>
      </div>
    </div>
  )
}

// ── ReactionRow ──────────────────────────────────────────────────────

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

// ── TwitchPanel ──────────────────────────────────────────────────────

export function TwitchPanel() {
  const config     = useAdminStore((s) => s.config)
  const saveConfig = useAdminStore((s) => s.saveConfig)
  const twitchConnected = useAdminStore((s) => s.twitchConnected)

  const twitch   = config.twitch   ?? { channel: '', enabled: false }
  const reactions = config.chatReactions ?? []

  // Local twitch config draft
  const [channel,     setChannel]     = useState(twitch.channel)
  const [accessToken, setAccessToken] = useState(twitch.accessToken ?? '')
  const [enabled,     setEnabled]     = useState(twitch.enabled)
  const [twitchDirty, setTwitchDirty] = useState(false)

  const [editingRuleId, setEditingRuleId] = useState<string | null>(null)
  const [newRule, setNewRule] = useState<ChatReactionRule | null>(null)

  function onTwitchChange(field: Partial<{ channel: string; accessToken: string; enabled: boolean }>) {
    if ('channel'     in field) setChannel(field.channel!)
    if ('accessToken' in field) setAccessToken(field.accessToken!)
    if ('enabled'     in field) setEnabled(field.enabled!)
    setTwitchDirty(true)
  }

  async function saveTwitch() {
    await saveConfig({
      twitch: {
        channel,
        enabled,
        accessToken: accessToken || undefined,
      },
    })
    setTwitchDirty(false)
  }

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

  return (
    <div className="space-y-5">
      <ConfigPageIntro title="Twitch Chat" eyebrow="Engine">
        Connect to a Twitch channel and react to chat messages automatically. Anonymous read-only mode works with no OAuth token for public channels.
      </ConfigPageIntro>

      {/* ── Connection ── */}
      <ConfigSectionPanel label="Connection">
        <ConfigCard>
          <div className="flex items-center gap-3 mb-3">
            <div className={`h-2 w-2 rounded-full shrink-0 ${twitchConnected ? 'bg-emerald-400' : 'bg-zinc-700'}`} />
            <span className={`text-xs font-semibold ${twitchConnected ? 'text-emerald-400' : 'text-zinc-500'}`}>
              {twitchConnected ? `Connected` : 'Disconnected'}
            </span>
            {twitchConnected && twitch.channel && (
              <span className="text-[10px] font-mono text-zinc-400">#{twitch.channel}</span>
            )}
          </div>

          <div className="space-y-3">
            <Field label="Channel (without #)">
              <input
                type="text"
                value={channel}
                onChange={(e) => onTwitchChange({ channel: e.target.value })}
                placeholder="mychannel"
                className="w-full rounded-lg border border-zinc-700/60 bg-zinc-900/60 px-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 focus:border-cyan-500/50 focus:outline-none"
              />
            </Field>
            <Field label="OAuth Token (optional — leave blank for anonymous read-only)">
              <input
                type="password"
                value={accessToken}
                onChange={(e) => onTwitchChange({ accessToken: e.target.value })}
                placeholder="oauth:…"
                className="w-full rounded-lg border border-zinc-700/60 bg-zinc-900/60 px-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 focus:border-cyan-500/50 focus:outline-none"
              />
            </Field>
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-400">Enabled</span>
              <Toggle
                checked={enabled}
                onChange={() => onTwitchChange({ enabled: !enabled })}
                size="sm"
                label={enabled ? 'On' : 'Off'}
              />
            </div>
          </div>

          {twitchDirty && (
            <div className="mt-3 flex justify-end">
              <Button variant="primary" size="sm" onClick={() => { void saveTwitch() }}>Save &amp; reconnect</Button>
            </div>
          )}
        </ConfigCard>
      </ConfigSectionPanel>

      {/* ── Chat Reactions ── */}
      <ConfigSectionPanel label={`Chat Reactions${reactions.length ? ` (${reactions.length})` : ''}`}>
        {reactions.length === 0 && editingRuleId !== 'new' && (
          <div className="text-[10px] text-zinc-600 italic mb-3">No reactions configured.</div>
        )}

        <div className="space-y-2">
          {reactions.map((rule) => (
            editingRuleId === rule.id ? (
              <ReactionEditor
                key={rule.id}
                rule={rule}
                onSave={saveRule}
                onCancel={() => setEditingRuleId(null)}
              />
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
            <button
              type="button"
              onClick={() => { setNewRule(blankRule()); setEditingRuleId('new') }}
              className="flex w-full items-center gap-1.5 rounded-xl border border-dashed border-white/10 px-3 py-2 text-[11px] text-zinc-500 transition-colors hover:border-violet-500/35 hover:bg-violet-500/8 hover:text-violet-200"
            >
              <span>+</span> New Reaction Rule
            </button>
          </div>
        )}
      </ConfigSectionPanel>
    </div>
  )
}
