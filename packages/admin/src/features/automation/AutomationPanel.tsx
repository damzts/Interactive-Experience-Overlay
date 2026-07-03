import { useEffect, useState, useCallback } from 'react'
import type { AutomationRule, AutomationActionKind, AutomationTrigger, WidgetIntentManifest, EffectType } from '@ieomlabs/shared'
import { STATE, NAVIGABLE_STATES, findRendererCatalogEntry } from '@ieomlabs/shared'
import { useAdminStore } from '../../store/useAdminStore'
import {
  fetchAutomationRules, fetchAutomationManifests,
  createAutomationRule, patchAutomationRule, deleteAutomationRule,
} from '../../api/automationApi'
import { createEffectDraft, EVENT_EFFECT_TYPES } from '../media-library/eventPresets'
import { ConfigPageIntro, ConfigSectionPanel } from '../../shared/ui'
import { Button, Toggle } from '../../components/atoms'

const SUGGESTED_EVENTS = [
  'twitch:follow', 'twitch:subscribe', 'twitch:gift-sub', 'twitch:cheer',
  'twitch:raid', 'twitch:points:redemption', 'scene:changed',
]

const ACTION_KINDS: AutomationActionKind[] = [
  'overlay:show', 'widget:action', 'widget:toggle', 'scene:change', 'desktop:notify', 'signal:emit',
]

/** Actions every widget accepts without declaring them in its manifest */
const BUILT_IN_ACTIONS = [
  { action: 'open',   label: 'Open' },
  { action: 'close',  label: 'Close' },
  { action: 'toggle', label: 'Toggle' },
]

function widgetLabel(appId: string, apps: { id: string; label: string }[]): string {
  return apps.find((a) => a.id === appId)?.label ?? appId
}

function summarizeTrigger(trigger: AutomationTrigger, apps: { id: string; label: string }[]): string {
  if (trigger.source === 'widget') {
    const who = trigger.widgetId ? widgetLabel(trigger.widgetId, apps) : 'any widget'
    return `${who} › ${trigger.event}`
  }
  return trigger.event
}

function summarizeAction(rule: AutomationRule, apps: { id: string; label: string }[]): string {
  const { kind, params } = rule.action
  if (kind === 'overlay:show') {
    const effects = (params['effects'] as { type: string }[] | undefined) ?? []
    return effects.map((e) => e.type).join(', ') || 'overlay:show'
  }
  if (kind === 'widget:action') return `${widgetLabel(String(params['targetWidgetId'] ?? '?'), apps)} › ${params['action'] ?? '?'}`
  if (kind === 'widget:toggle') return `toggle ${widgetLabel(String(params['widgetId'] ?? '?'), apps)}`
  if (kind === 'scene:change') return `→ ${params['sceneId'] ?? '?'}`
  if (kind === 'desktop:notify') return String(params['title'] ?? 'notify')
  if (kind === 'signal:emit') return `emit ${params['event'] ?? '?'}`
  return kind
}

/** A signal-capable target: a widget application or a scene-renderer window instance. */
interface SignalPeer {
  id: string
  label: string
  emits: Array<{ event: string; label: string }>
  accepts: Array<{ action: string; label: string }>
}

export function AutomationPanel() {
  const applications = useAdminStore((s) => s.config.applications)
  const scenes = useAdminStore((s) => s.config.scenes)

  const [rules, setRules] = useState<AutomationRule[]>([])
  const [manifests, setManifests] = useState<WidgetIntentManifest[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)

  // ── Trigger state ────────────────────────────────────────────────
  const [triggerSource, setTriggerSource] = useState<'kernel' | 'widget'>('kernel')
  const [event, setEvent] = useState('')
  const [matchKey, setMatchKey] = useState('')
  const [matchValue, setMatchValue] = useState('')
  const [srcWidgetId, setSrcWidgetId] = useState('')
  const [srcEvent, setSrcEvent] = useState('')
  const [sceneFilter, setSceneFilter] = useState<STATE[]>([])

  // ── Action state ─────────────────────────────────────────────────
  const [actionKind, setActionKind] = useState<AutomationActionKind>('overlay:show')
  const [effectType, setEffectType] = useState<EffectType>('level-up')
  const [effectCfgJson, setEffectCfgJson] = useState(() => JSON.stringify(createEffectDraft('level-up').cfg, null, 2))
  const [widgetId, setWidgetId] = useState('')
  const [dstWidgetId, setDstWidgetId] = useState('')
  const [dstAction, setDstAction] = useState('')
  const [sceneId, setSceneId] = useState<string>(NAVIGABLE_STATES[0] ?? '')
  const [notifyTitle, setNotifyTitle] = useState('')
  const [notifyBody, setNotifyBody] = useState('')
  const [emitEvent, setEmitEvent] = useState('')
  const [emitPayloadJson, setEmitPayloadJson] = useState('')

  const manifestByType = new Map(manifests.map((m) => [m.componentType, m]))

  // Widgets and scene-renderer instances form one flat list of signal peers.
  const peers: SignalPeer[] = [
    ...applications
      .filter((app) => app.widgetComponent)
      .map((app): SignalPeer => {
        const m = manifestByType.get(app.widgetComponent!)
        return { id: app.id, label: app.label, emits: m?.emits ?? [], accepts: m?.accepts ?? [] }
      }),
    ...Object.values(scenes).flatMap((scene) =>
      (scene.windows ?? []).flatMap((win): SignalPeer[] => {
        const entry = findRendererCatalogEntry(win.rendererType)
        if (!entry || (!entry.emits?.length && !entry.accepts?.length)) return []
        return [{
          id: win.id,
          label: `${entry.label} (${scene.label})`,
          emits: entry.emits ?? [],
          accepts: entry.accepts ?? [],
        }]
      }),
    ),
  ]
  const peerById = new Map(peers.map((p) => [p.id, p]))

  const emitterPeers = peers.filter((p) => p.emits.length > 0)
  const receiverPeers = peers.filter((p) => p.accepts.length > 0)
  const dstIsWidget = !!applications.find((a) => a.id === dstWidgetId)
  const dstActions = dstWidgetId
    ? [...(dstIsWidget ? BUILT_IN_ACTIONS : []), ...(peerById.get(dstWidgetId)?.accepts ?? [])]
    : []

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [r, m] = await Promise.all([fetchAutomationRules(), fetchAutomationManifests()])
      setRules(r)
      setManifests(m)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  const triggerReady = triggerSource === 'kernel'
    ? event.trim().length > 0
    : srcEvent.trim().length > 0
  const actionReady = (
    (actionKind === 'overlay:show') ||
    (actionKind === 'widget:action' && dstWidgetId && dstAction) ||
    (actionKind === 'widget:toggle' && widgetId) ||
    (actionKind === 'scene:change' && sceneId) ||
    (actionKind === 'desktop:notify' && notifyTitle.trim().length > 0) ||
    (actionKind === 'signal:emit' && emitEvent.trim().length > 0)
  )
  const canAdd = triggerReady && actionReady

  async function handleAdd() {
    if (!canAdd) return
    setAdding(true)
    try {
      let params: Record<string, unknown> = {}
      if (actionKind === 'overlay:show') {
        let cfg: Record<string, unknown>
        try { cfg = JSON.parse(effectCfgJson) } catch { cfg = {} }
        params = { id: `automation-${Date.now()}`, effects: [{ type: effectType, cfg }] }
      } else if (actionKind === 'widget:action') {
        params = { targetWidgetId: dstWidgetId, action: dstAction }
      } else if (actionKind === 'widget:toggle') {
        params = { widgetId }
      } else if (actionKind === 'scene:change') {
        params = { sceneId }
      } else if (actionKind === 'desktop:notify') {
        params = { title: notifyTitle, body: notifyBody }
      } else if (actionKind === 'signal:emit') {
        let payload: unknown
        try { payload = emitPayloadJson.trim() ? JSON.parse(emitPayloadJson) : undefined } catch { payload = undefined }
        params = payload === undefined ? { event: emitEvent.trim() } : { event: emitEvent.trim(), payload }
      }

      const match = matchKey.trim() ? { [matchKey.trim()]: matchValue } : undefined
      const trigger: AutomationTrigger = triggerSource === 'kernel'
        ? { source: 'kernel', event: event.trim(), match, sceneIs: sceneFilter.length ? sceneFilter : undefined }
        : { source: 'widget', event: srcEvent.trim(), widgetId: srcWidgetId || undefined, match, sceneIs: sceneFilter.length ? sceneFilter : undefined }

      const rule = await createAutomationRule({
        enabled: true,
        trigger,
        action: { kind: actionKind, params },
      })
      setRules((prev) => [...prev, rule])
      setEvent(''); setMatchKey(''); setMatchValue('')
      setSrcWidgetId(''); setSrcEvent(''); setSceneFilter([])
      setWidgetId(''); setDstWidgetId(''); setDstAction('')
      setNotifyTitle(''); setNotifyBody(''); setEmitEvent(''); setEmitPayloadJson('')
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

  const srcEvents = srcWidgetId ? (peerById.get(srcWidgetId)?.emits ?? []) : []

  return (
    <div className="space-y-5">
      <ConfigPageIntro
        icon="🤖"
        title="Automation Rules"
        description="Connect any signal to any action. Kernel events (Twitch follows, scene changes) and widget signals (quest completed, storm detected) both trigger the same rule engine — actions range from overlay effects to widget commands to emitting new signals."
      />

      <ConfigSectionPanel label="New Rule">
        <div className="space-y-3">
          {/* ── Trigger source toggle ── */}
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">Trigger</div>
            <div className="flex gap-2">
              {(['kernel', 'widget'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setTriggerSource(s)}
                  className={`rounded-lg px-3 py-1.5 text-xs transition-colors border ${
                    triggerSource === s
                      ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300'
                      : 'border-white/8 bg-white/[0.02] text-zinc-500 hover:border-white/15 hover:text-zinc-300'
                  }`}
                >
                  {s === 'kernel' ? 'Kernel event' : 'Widget signal'}
                </button>
              ))}
            </div>
          </div>

          {triggerSource === 'kernel' ? (
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">Event</div>
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
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                  Source widget <span className="normal-case font-normal text-zinc-600">(blank = any)</span>
                </div>
                <select value={srcWidgetId} onChange={(e) => { setSrcWidgetId(e.target.value); setSrcEvent('') }} className="w-full text-xs">
                  <option value="">Any widget</option>
                  {emitterPeers.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">Signal</div>
                {srcWidgetId && srcEvents.length > 0 ? (
                  <select value={srcEvent} onChange={(e) => setSrcEvent(e.target.value)} className="w-full text-xs font-mono">
                    <option value="">Select a signal…</option>
                    {srcEvents.map((sig) => <option key={sig.event} value={sig.event}>{sig.label} ({sig.event})</option>)}
                  </select>
                ) : (
                  <input value={srcEvent} onChange={(e) => setSrcEvent(e.target.value)} placeholder="e.g. quest:complete" className="w-full text-xs font-mono" />
                )}
              </div>
            </div>
          )}

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

          {/* ── Scene gate ── */}
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">
              Scene condition <span className="normal-case font-normal text-zinc-600">(optional — leave blank to fire in any scene)</span>
            </div>
            <div className="flex items-center gap-2">
              {NAVIGABLE_STATES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSceneFilter((prev) =>
                    prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
                  )}
                  className={`rounded-lg px-3 py-1.5 text-xs transition-colors border ${
                    sceneFilter.includes(s)
                      ? 'border-cyan-500/50 bg-cyan-500/15 text-cyan-300'
                      : 'border-white/8 bg-white/[0.02] text-zinc-500 hover:border-white/15 hover:text-zinc-300'
                  }`}
                >
                  {s}
                </button>
              ))}
              {sceneFilter.length > 0 && (
                <button type="button" onClick={() => setSceneFilter([])} className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors">
                  clear
                </button>
              )}
            </div>
          </div>

          {/* ── Action ── */}
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

          {actionKind === 'widget:action' && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">Target widget / renderer</div>
                <select value={dstWidgetId} onChange={(e) => { setDstWidgetId(e.target.value); setDstAction('') }} className="w-full text-xs">
                  <option value="">Select a target…</option>
                  {applications.map((app) => <option key={app.id} value={app.id}>{app.label}</option>)}
                  {receiverPeers.filter((p) => !applications.some((a) => a.id === p.id)).map((p) => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">Widget action</div>
                <select value={dstAction} onChange={(e) => setDstAction(e.target.value)} className="w-full text-xs font-mono" disabled={!dstWidgetId}>
                  <option value="">Select an action…</option>
                  {dstActions.map((act) => <option key={act.action} value={act.action}>{act.label} ({act.action})</option>)}
                </select>
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

          {actionKind === 'signal:emit' && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">Signal event</div>
                <input value={emitEvent} onChange={(e) => setEmitEvent(e.target.value)} placeholder="e.g. party:time" className="w-full text-xs font-mono" />
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                  Payload JSON <span className="normal-case font-normal text-zinc-600">(optional)</span>
                </div>
                <input value={emitPayloadJson} onChange={(e) => setEmitPayloadJson(e.target.value)} placeholder='{"mood":"hype"}' className="w-full text-xs font-mono" />
              </div>
              <div className="col-span-2 text-[10px] text-zinc-600">
                The emitted signal re-enters the rule engine once — rules triggered by it can do anything except emit another signal (loop guard).
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
                    <span className={`rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide shrink-0 ${
                      rule.trigger.source === 'widget' ? 'bg-violet-500/15 text-violet-300' : 'bg-emerald-500/15 text-emerald-300'
                    }`}>
                      {rule.trigger.source}
                    </span>
                    <span className="font-mono text-[10px] text-emerald-400 truncate">{summarizeTrigger(rule.trigger, peers)}</span>
                    {rule.trigger.match && Object.keys(rule.trigger.match).length > 0 && (
                      <span className="font-mono text-[9px] text-cyan-500/80 shrink-0">
                        [{Object.entries(rule.trigger.match).map(([k, v]) => `${k}=${v}`).join(', ')}]
                      </span>
                    )}
                    {rule.trigger.sceneIs && rule.trigger.sceneIs.length > 0 && (
                      <span className="font-mono text-[9px] text-cyan-500/80 shrink-0">[{rule.trigger.sceneIs.join(', ')}]</span>
                    )}
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-zinc-500">
                    <span>→</span>
                    <span className="text-violet-400 font-medium truncate">{rule.action.kind}</span>
                    <span className="text-zinc-600">›</span>
                    <span className="font-mono text-zinc-400 truncate">{summarizeAction(rule, peers)}</span>
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
