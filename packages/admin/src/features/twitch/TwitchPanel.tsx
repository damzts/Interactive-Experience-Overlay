import { useState } from 'react'
import type { ChatReactionRule, ChatReactionMatch } from '@ieomlabs/shared'
import { useAdminStore } from '../../store/useAdminStore'
import { Button, Toggle } from '../../components/atoms'
import { ConfigPageIntro, ConfigSectionPanel, ConfigCard, Btn, Field } from '../../shared/ui'

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

// ── ReactionEditor ───────────────────────────────────────────────────

function ReactionEditor({ rule, onSave, onCancel }: {
  rule: ChatReactionRule
  onSave: (r: ChatReactionRule) => void
  onCancel: () => void
}) {
  const [draft, setDraft] = useState<ChatReactionRule>(() => JSON.parse(JSON.stringify(rule)))

  return (
    <div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Label">
          <input
            type="text"
            value={draft.label}
            onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
            placeholder="e.g. Hype Glitch"
            className="w-full rounded-lg border border-zinc-700/60 bg-zinc-900/60 px-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 focus:border-cyan-500/50 focus:outline-none"
          />
        </Field>
        <Field label="Cooldown (ms)">
          <input
            type="number"
            min={0}
            step={1000}
            value={draft.cooldownMs ?? 0}
            onChange={(e) => setDraft((d) => ({ ...d, cooldownMs: Number(e.target.value) }))}
            className="w-full rounded-lg border border-zinc-700/60 bg-zinc-900/60 px-3 py-1.5 text-xs text-zinc-200 focus:border-cyan-500/50 focus:outline-none"
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Match type">
          <select
            value={draft.match.type}
            onChange={(e) => setDraft((d) => ({ ...d, match: { ...d.match, type: e.target.value as ChatReactionMatch['type'] } }))}
            className="w-full rounded-lg border border-zinc-700/60 bg-zinc-900/60 px-3 py-1.5 text-xs text-zinc-200 focus:border-cyan-500/50 focus:outline-none"
          >
            {Object.entries(MATCH_TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </Field>
        <Field label={draft.match.type === 'command' ? 'Command (without !)' : draft.match.type === 'regex' ? 'Pattern' : 'Keyword'}>
          <input
            type="text"
            value={draft.match.value}
            onChange={(e) => setDraft((d) => ({ ...d, match: { ...d.match, value: e.target.value } }))}
            placeholder={draft.match.type === 'command' ? 'hype' : draft.match.type === 'regex' ? '\\bhype\\b' : 'hype'}
            className="w-full rounded-lg border border-zinc-700/60 bg-zinc-900/60 px-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 focus:border-cyan-500/50 focus:outline-none"
          />
        </Field>
      </div>

      <Field label="Effects (comma-separated types, e.g. glitch, static-burst)">
        <input
          type="text"
          value={(draft.effects ?? []).map((e) => e.type).join(', ')}
          onChange={(e) => {
            const types = e.target.value.split(',').map((t) => t.trim()).filter(Boolean)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            setDraft((d) => ({ ...d, effects: types.map((type) => ({ type }) as any) }))
          }}
          placeholder="glitch, static-burst"
          className="w-full rounded-lg border border-zinc-700/60 bg-zinc-900/60 px-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 focus:border-cyan-500/50 focus:outline-none"
        />
      </Field>

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
