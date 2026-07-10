import { useEffect, useState, useCallback } from 'react'
import type { AutomationRule, AutomationTrigger, WidgetIntentManifest } from '@ieomlabs/shared'
import { STATE, findRendererCatalogEntry, PUBLIC_KERNEL_SIGNALS } from '@ieomlabs/shared'
import { useAdminStore } from '../../store/useAdminStore'
import {
  fetchAutomationRules, fetchAutomationManifests,
  createAutomationRule, patchAutomationRule, deleteAutomationRule,
} from '../../api/automationApi'
import { getEventActionLabel, isBlankAction, type DraftEventAction } from '../media-library/eventPresets'
import { ConfigPageIntro, ConfigSectionPanel } from '../../shared/ui'
import { ActionFields } from '../../shared/ActionFields'
import { Button, Toggle } from '../../components/atoms'

// Every public kernel event is a valid trigger — derived from the shared
// allowlist so new manager events show up here automatically.
const SUGGESTED_EVENTS = [...PUBLIC_KERNEL_SIGNALS, 'scene:changed']

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
  const action = rule.action
  if (action.kind === 'widget-command') {
    // Rules saved before widget-command joined ACTION_CATALOG store the
    // config flat on the action instead of under cfg.
    const c = ('cfg' in action ? action.cfg : action) as { widgetId: string; action: string }
    return `${widgetLabel(c.widgetId, apps)} › ${c.action}`
  }
  if ('cfg' in action) {
    if (action.kind === 'scene-change') return `→ ${action.cfg.target}`
    if (action.kind === 'desktop-notify') return action.cfg.title
    if (action.kind === 'signal-emit') return `emit ${action.cfg.event}`
  }
  return getEventActionLabel(action.kind)
}

/** A signal-capable target: a widget application or a scene-renderer window instance. */
interface SignalPeer {
  id: string
  label: string
  emits: readonly { event: string; label: string }[]
  accepts: readonly { action: string; label: string }[]
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
  // Stateful conditions (all optional; empty = off)
  const [cooldownSec, setCooldownSec] = useState('')
  const [everyN, setEveryN] = useState('')
  const [windowCount, setWindowCount] = useState('')
  const [windowSec, setWindowSec] = useState('')

  // ── Action state — same vocabulary Events use (ActionFields + ACTION_CATALOG) ──
  const [actionDraft, setActionDraft] = useState<DraftEventAction>({ kind: '' })

  const manifestByType = new Map(manifests.map((m) => [m.componentType, m]))

  // Scene ids are data-driven: every scene in config, including the built-in DESKTOP.
  const navigableSceneIds = Object.keys(scenes ?? {})

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
  const canAdd = triggerReady && !isBlankAction(actionDraft)

  async function handleAdd() {
    if (!canAdd || isBlankAction(actionDraft)) return
    setAdding(true)
    try {
      const match = matchKey.trim() ? { [matchKey.trim()]: matchValue } : undefined
      const num = (v: string) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : undefined }
      const stateful = {
        cooldownMs: num(cooldownSec) ? num(cooldownSec)! * 1000 : undefined,
        everyN: num(everyN),
        windowCount: num(windowCount),
        windowMs: num(windowCount) && num(windowSec) ? num(windowSec)! * 1000 : undefined,
      }
      const trigger: AutomationTrigger = triggerSource === 'kernel'
        ? { source: 'kernel', event: event.trim(), match, sceneIs: sceneFilter.length ? sceneFilter : undefined, ...stateful }
        : { source: 'widget', event: srcEvent.trim(), widgetId: srcWidgetId || undefined, match, sceneIs: sceneFilter.length ? sceneFilter : undefined, ...stateful }

      const rule = await createAutomationRule({
        enabled: true,
        trigger,
        action: actionDraft,
      })
      setRules((prev) => [...prev, rule])
      setEvent(''); setMatchKey(''); setMatchValue('')
      setSrcWidgetId(''); setSrcEvent(''); setSceneFilter([])
      setCooldownSec(''); setEveryN(''); setWindowCount(''); setWindowSec('')
      setActionDraft({ kind: '' })
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
              {navigableSceneIds.map((s) => (
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

          {/* ── Stateful conditions ── */}
          <div className="grid grid-cols-4 gap-2">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                Cooldown <span className="normal-case font-normal text-zinc-600">(s)</span>
              </div>
              <input value={cooldownSec} onChange={(e) => setCooldownSec(e.target.value)} placeholder="off" inputMode="numeric" className="w-full text-xs font-mono" />
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                Every Nth
              </div>
              <input value={everyN} onChange={(e) => setEveryN(e.target.value)} placeholder="off" inputMode="numeric" className="w-full text-xs font-mono" />
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                N within…
              </div>
              <input value={windowCount} onChange={(e) => setWindowCount(e.target.value)} placeholder="off" inputMode="numeric" className="w-full text-xs font-mono" />
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                …window <span className="normal-case font-normal text-zinc-600">(s)</span>
              </div>
              <input value={windowSec} onChange={(e) => setWindowSec(e.target.value)} placeholder="60" inputMode="numeric" className="w-full text-xs font-mono" disabled={!windowCount.trim()} />
            </div>
          </div>

          {/* ── Action ── */}
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">Action</div>
            <ActionFields
              action={actionDraft}
              onChange={setActionDraft}
              widgetApps={applications}
            />
          </div>

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
                    {(rule.trigger.cooldownMs || rule.trigger.everyN || rule.trigger.windowCount) && (
                      <span className="font-mono text-[9px] text-amber-500/80 shrink-0">
                        [{[
                          rule.trigger.cooldownMs ? `cd ${rule.trigger.cooldownMs / 1000}s` : null,
                          rule.trigger.everyN ? `every ${rule.trigger.everyN}` : null,
                          rule.trigger.windowCount ? `${rule.trigger.windowCount} in ${(rule.trigger.windowMs ?? 60000) / 1000}s` : null,
                        ].filter(Boolean).join(', ')}]
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-zinc-500">
                    <span>→</span>
                    <span className="text-violet-400 font-medium truncate">{getEventActionLabel(rule.action.kind)}</span>
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
