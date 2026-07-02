import { useEffect, useState, useCallback } from 'react'
import type { AutomationRule, AutomationActionKind } from '@ieomlabs/shared'
import { NAVIGABLE_STATES } from '@ieomlabs/shared'
import { useAdminStore } from '../../store/useAdminStore'
import { fetchAutomationRules, createAutomationRule, patchAutomationRule, deleteAutomationRule } from '../../api/automationApi'
import { createEffectDraft, EVENT_EFFECT_TYPES } from '../media-library/eventPresets'
import { ConfigPageIntro, ConfigSectionPanel } from '../../shared/ui'
import { Button, Toggle } from '../../components/atoms'
import type { EffectType } from '@ieomlabs/shared'

const SUGGESTED_EVENTS = [
  'twitch:follow', 'twitch:subscribe', 'twitch:gift-sub', 'twitch:cheer',
  'twitch:raid', 'twitch:points:redemption', 'scene:changed',
]

const ACTION_KINDS: AutomationActionKind[] = ['overlay:show', 'widget:toggle', 'scene:change', 'desktop:notify']

function widgetLabel(appId: string, apps: { id: string; label: string }[]): string {
  return apps.find((a) => a.id === appId)?.label ?? appId
}

function summarizeAction(rule: AutomationRule): string {
  const { kind, params } = rule.action
  if (kind === 'overlay:show') {
    const effects = (params['effects'] as { type: string }[] | undefined) ?? []
    return effects.map((e) => e.type).join(', ') || 'overlay:show'
  }
  if (kind === 'widget:toggle') return `toggle ${params['widgetId'] ?? '?'}`
  if (kind === 'scene:change') return `→ ${params['sceneId'] ?? '?'}`
  if (kind === 'desktop:notify') return String(params['title'] ?? 'notify')
  return kind
}

export function AutomationPanel() {
  const applications = useAdminStore((s) => s.config.applications)

  const [rules, setRules] = useState<AutomationRule[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)

  const [event, setEvent] = useState('')
  const [matchKey, setMatchKey] = useState('')
  const [matchValue, setMatchValue] = useState('')
  const [actionKind, setActionKind] = useState<AutomationActionKind>('overlay:show')

  const [effectType, setEffectType] = useState<EffectType>('level-up')
  const [effectCfgJson, setEffectCfgJson] = useState(() => JSON.stringify(createEffectDraft('level-up').cfg, null, 2))
  const [widgetId, setWidgetId] = useState('')
  const [sceneId, setSceneId] = useState<string>(NAVIGABLE_STATES[0] ?? '')
  const [notifyTitle, setNotifyTitle] = useState('')
  const [notifyBody, setNotifyBody] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setRules(await fetchAutomationRules())
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  const canAdd = event.trim().length > 0 && (
    (actionKind === 'overlay:show') ||
    (actionKind === 'widget:toggle' && widgetId) ||
    (actionKind === 'scene:change' && sceneId) ||
    (actionKind === 'desktop:notify' && notifyTitle.trim().length > 0)
  )

  async function handleAdd() {
    if (!canAdd) return
    setAdding(true)
    try {
      let params: Record<string, unknown> = {}
      if (actionKind === 'overlay:show') {
        let cfg: Record<string, unknown>
        try { cfg = JSON.parse(effectCfgJson) } catch { cfg = {} }
        params = { id: `automation-${Date.now()}`, effects: [{ type: effectType, cfg }] }
      } else if (actionKind === 'widget:toggle') {
        params = { widgetId }
      } else if (actionKind === 'scene:change') {
        params = { sceneId }
      } else if (actionKind === 'desktop:notify') {
        params = { title: notifyTitle, body: notifyBody }
      }

      const match = matchKey.trim() ? { [matchKey.trim()]: matchValue } : undefined
      const rule = await createAutomationRule({
        enabled: true,
        condition: { event: event.trim(), match },
        action: { kind: actionKind, params },
      })
      setRules((prev) => [...prev, rule])
      setEvent(''); setMatchKey(''); setMatchValue('')
      setWidgetId(''); setNotifyTitle(''); setNotifyBody('')
    } finally { setAdding(false) }
  }

  async function handleToggle(rule: AutomationRule) {
    const updated = await patchAutomationRule(rule.id, { enabled: !rule.enabled })
    setRules((prev) => prev.map((r) => r.id === updated.id ? updated : r))
  }

  async function handleDelete(id: string) {
    await deleteAutomationRule(id)
    setRules((prev) => prev.filter((r) => r.id !== id))
  }

  return (
    <div className="space-y-5">
      <ConfigPageIntro
        icon="🤖"
        title="Automation"
        description="Fire any action when a kernel event happens — Twitch follows/subs/raids, scene changes, or anything else on the event bus. When a condition matches, the action runs automatically."
      />

      <ConfigSectionPanel label="New Rule">
        <div className="space-y-3">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">Trigger event</div>
            <input
              list="automation-event-suggestions"
              value={event}
              onChange={(e) => setEvent(e.target.value)}
              placeholder="e.g. twitch:subscribe"
              className="w-full text-xs font-mono"
            />
            <datalist id="automation-event-suggestions">
              {SUGGESTED_EVENTS.map((ev) => <option key={ev} value={ev} />)}
            </datalist>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                Match field <span className="normal-case font-normal text-zinc-600">(optional)</span>
              </div>
              <input value={matchKey} onChange={(e) => setMatchKey(e.target.value)} placeholder="e.g. tier" className="w-full text-xs font-mono" />
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">Equals</div>
              <input value={matchValue} onChange={(e) => setMatchValue(e.target.value)} placeholder="e.g. 3000" className="w-full text-xs font-mono" disabled={!matchKey.trim()} />
            </div>
          </div>

          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">Action</div>
            <select value={actionKind} onChange={(e) => setActionKind(e.target.value as AutomationActionKind)} className="w-full text-xs">
              {ACTION_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>

          {actionKind === 'overlay:show' && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">Effect</div>
                <select
                  value={effectType}
                  onChange={(e) => {
                    const t = e.target.value as EffectType
                    setEffectType(t)
                    setEffectCfgJson(JSON.stringify(createEffectDraft(t).cfg, null, 2))
                  }}
                  className="w-full text-xs"
                >
                  {EVENT_EFFECT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">Config (JSON)</div>
                <textarea
                  value={effectCfgJson}
                  onChange={(e) => setEffectCfgJson(e.target.value)}
                  rows={4}
                  className="w-full text-[10px] font-mono"
                />
              </div>
            </div>
          )}

          {actionKind === 'widget:toggle' && (
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">Widget</div>
              <select value={widgetId} onChange={(e) => setWidgetId(e.target.value)} className="w-full text-xs">
                <option value="">Select a widget…</option>
                {applications.map((app) => <option key={app.id} value={app.id}>{app.label}</option>)}
              </select>
            </div>
          )}

          {actionKind === 'scene:change' && (
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">Scene</div>
              <select value={sceneId} onChange={(e) => setSceneId(e.target.value)} className="w-full text-xs">
                {NAVIGABLE_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}

          {actionKind === 'desktop:notify' && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">Title</div>
                <input value={notifyTitle} onChange={(e) => setNotifyTitle(e.target.value)} className="w-full text-xs" />
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">Body</div>
                <input value={notifyBody} onChange={(e) => setNotifyBody(e.target.value)} className="w-full text-xs" />
              </div>
            </div>
          )}

          <div className="flex items-center justify-end pt-1">
            <Button variant="primary" size="sm" disabled={!canAdd || adding} loading={adding} onClick={handleAdd}>
              Add Rule
            </Button>
          </div>
        </div>
      </ConfigSectionPanel>

      <ConfigSectionPanel label={`Active Rules${rules.length ? ` (${rules.length})` : ''}`}>
        {loading ? (
          <div className="text-[10px] text-zinc-600 italic">Loading…</div>
        ) : rules.length === 0 ? (
          <div className="text-[10px] text-zinc-600 italic">No automation rules configured yet.</div>
        ) : (
          <div className="space-y-2">
            {rules.map((rule) => (
              <div
                key={rule.id}
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-opacity ${
                  rule.enabled ? 'border-white/8 bg-white/[0.02]' : 'border-white/4 bg-transparent opacity-50'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="font-mono text-[10px] text-emerald-400 truncate">{rule.condition.event}</span>
                    {rule.condition.match && Object.keys(rule.condition.match).length > 0 && (
                      <span className="font-mono text-[9px] text-cyan-500/80 shrink-0">
                        [{Object.entries(rule.condition.match).map(([k, v]) => `${k}=${v}`).join(', ')}]
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-zinc-500">
                    <span>→</span>
                    <span className="text-violet-400 font-medium truncate">{rule.action.kind}</span>
                    <span className="text-zinc-600">›</span>
                    <span className="font-mono text-zinc-400 truncate">
                      {rule.action.kind === 'widget:toggle'
                        ? widgetLabel(String(rule.action.params['widgetId'] ?? ''), applications)
                        : summarizeAction(rule)}
                    </span>
                  </div>
                </div>
                <Toggle checked={rule.enabled} onChange={() => handleToggle(rule)} size="sm" label={rule.enabled ? 'Enabled' : 'Disabled'} />
                <button
                  type="button"
                  aria-label="Delete rule"
                  onClick={() => handleDelete(rule.id)}
                  className="text-zinc-600 hover:text-red-400 transition-colors text-sm"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </ConfigSectionPanel>
    </div>
  )
}
