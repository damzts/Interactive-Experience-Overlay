import { useEffect, useState, useCallback, useMemo } from 'react'
import type { AutomationRule, AutomationTrigger, WidgetIntentManifest } from '@ieomlabs/shared'
import { STATE, findRendererCatalogEntry, PUBLIC_KERNEL_SIGNALS } from '@ieomlabs/shared'
import { useAdminStore } from '../../store/useAdminStore'
import {
  fetchAutomationRules, fetchAutomationManifests,
  createAutomationRule, patchAutomationRule, deleteAutomationRule,
} from '../../api/automationApi'
import { getEventActionLabel, isBlankAction, type DraftEventAction } from '../media-library/eventPresets'
import { ConfigSectionPanel, ConfigNotice } from '../../shared/ui'
import { ActionFields } from '../../shared/ActionFields'
import { Button, Toggle } from '../../components/atoms'
import { MediaSearchInput } from '../media-library/MediaLibraryPanel'
import { LibraryItemBtn } from '../media-library/mediaLibraryUi'

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

function AddBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mb-1 flex w-full items-center gap-1.5 rounded-xl border border-dashed border-white/10 px-3 py-2 text-[11px] text-zinc-500 transition-colors hover:border-cyan-500/35 hover:bg-cyan-500/8 hover:text-cyan-200"
    >
      <span className="w-4 shrink-0 text-center text-sm">+</span>
      <span>{label}</span>
    </button>
  )
}

// ── Rule editor (right panel) ─────────────────────────────────────

function RuleEditor({
  peers,
  emitterPeers,
  peerById,
  navigableSceneIds,
  applications,
  onAdd,
  adding,
}: {
  peers: SignalPeer[]
  emitterPeers: SignalPeer[]
  peerById: Map<string, SignalPeer>
  navigableSceneIds: string[]
  applications: { id: string; label: string }[]
  onAdd: (trigger: AutomationTrigger, action: DraftEventAction) => Promise<void>
  adding: boolean
}) {
  const [triggerSource, setTriggerSource] = useState<'kernel' | 'widget'>('kernel')
  const [event, setEvent] = useState('')
  const [matchKey, setMatchKey] = useState('')
  const [matchValue, setMatchValue] = useState('')
  const [srcWidgetId, setSrcWidgetId] = useState('')
  const [srcEvent, setSrcEvent] = useState('')
  const [sceneFilter, setSceneFilter] = useState<STATE[]>([])
  const [cooldownSec, setCooldownSec] = useState('')
  const [everyN, setEveryN] = useState('')
  const [windowCount, setWindowCount] = useState('')
  const [windowSec, setWindowSec] = useState('')
  const [actionDraft, setActionDraft] = useState<DraftEventAction>({ kind: '' })

  const triggerReady = triggerSource === 'kernel'
    ? event.trim().length > 0
    : srcEvent.trim().length > 0
  const canAdd = triggerReady && !isBlankAction(actionDraft)

  const srcEvents = srcWidgetId ? (peerById.get(srcWidgetId)?.emits ?? []) : []

  const handleSubmit = async () => {
    if (!canAdd || isBlankAction(actionDraft)) return
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

    await onAdd(trigger, actionDraft)

    // Reset form
    setEvent(''); setMatchKey(''); setMatchValue('')
    setSrcWidgetId(''); setSrcEvent(''); setSceneFilter([])
    setCooldownSec(''); setEveryN(''); setWindowCount(''); setWindowSec('')
    setActionDraft({ kind: '' })
  }

  return (
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
            Scene condition <span className="normal-case font-normal text-zinc-600">(optional)</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
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
            <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">Every Nth</div>
            <input value={everyN} onChange={(e) => setEveryN(e.target.value)} placeholder="off" inputMode="numeric" className="w-full text-xs font-mono" />
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">N within…</div>
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
          <Button variant="primary" size="sm" disabled={!canAdd || adding} loading={adding} onClick={handleSubmit}>
            Add Rule
          </Button>
        </div>
      </div>
    </ConfigSectionPanel>
  )
}

// ── Rule detail view (right panel when a rule is selected) ─────────

function RuleDetail({
  rule,
  peers,
  onToggle,
  onDelete,
}: {
  rule: AutomationRule
  peers: SignalPeer[]
  onToggle: (rule: AutomationRule) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  return (
    <div className="space-y-4">
      <div
        className={`rounded-xl border px-4 py-4 transition-opacity ${
          rule.enabled ? 'border-white/8 bg-white/[0.02]' : 'border-white/4 bg-transparent opacity-60'
        }`}
      >
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0 space-y-2">
            {/* Trigger */}
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-1">Trigger</div>
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className={`rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide shrink-0 ${
                  rule.trigger.source === 'widget' ? 'bg-violet-500/15 text-violet-300' : 'bg-emerald-500/15 text-emerald-300'
                }`}>
                  {rule.trigger.source}
                </span>
                <span className="font-mono text-[10px] text-emerald-400">{summarizeTrigger(rule.trigger, peers)}</span>
                {rule.trigger.match && Object.keys(rule.trigger.match).length > 0 && (
                  <span className="font-mono text-[9px] text-cyan-500/80">
                    [{Object.entries(rule.trigger.match).map(([k, v]) => `${k}=${v}`).join(', ')}]
                  </span>
                )}
                {rule.trigger.sceneIs && rule.trigger.sceneIs.length > 0 && (
                  <span className="font-mono text-[9px] text-cyan-500/80">[{rule.trigger.sceneIs.join(', ')}]</span>
                )}
                {(rule.trigger.cooldownMs || rule.trigger.everyN || rule.trigger.windowCount) && (
                  <span className="font-mono text-[9px] text-amber-500/80">
                    [{[
                      rule.trigger.cooldownMs ? `cd ${rule.trigger.cooldownMs / 1000}s` : null,
                      rule.trigger.everyN ? `every ${rule.trigger.everyN}` : null,
                      rule.trigger.windowCount ? `${rule.trigger.windowCount} in ${(rule.trigger.windowMs ?? 60000) / 1000}s` : null,
                    ].filter(Boolean).join(', ')}]
                  </span>
                )}
              </div>
            </div>

            {/* Action */}
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-1">Action</div>
              <div className="flex items-center gap-1.5 text-[10px] text-zinc-400">
                <span className="text-violet-400 font-medium">{getEventActionLabel(rule.action.kind)}</span>
                <span className="text-zinc-600">›</span>
                <span className="font-mono truncate">{summarizeAction(rule, peers)}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2 shrink-0">
            <Toggle checked={rule.enabled} onChange={() => onToggle(rule)} size="sm" label={rule.enabled ? 'Enabled' : 'Disabled'} />
            <button
              type="button"
              aria-label="Delete rule"
              onClick={() => onDelete(rule.id)}
              className="text-zinc-600 hover:text-red-400 transition-colors text-xs"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── AutomationPanel ────────────────────────────────────────────────

export function AutomationPanel() {
  const applications = useAdminStore((s) => s.config.applications)
  const scenes = useAdminStore((s) => s.config.scenes)

  const [rules, setRules] = useState<AutomationRule[]>([])
  const [manifests, setManifests] = useState<WidgetIntentManifest[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  // null = "new rule" form, string = selected rule id
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const manifestByType = new Map(manifests.map((m) => [m.componentType, m]))
  const navigableSceneIds = Object.keys(scenes ?? {})

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

  const handleAdd = async (trigger: AutomationTrigger, action: DraftEventAction) => {
    setAdding(true)
    try {
      const rule = await createAutomationRule({ enabled: true, trigger, action })
      setRules((prev) => [...prev, rule])
      setSelectedId(rule.id)
    } finally { setAdding(false) }
  }

  const handleToggle = async (rule: AutomationRule) => {
    const updated = await patchAutomationRule(rule.id, { enabled: !rule.enabled })
    setRules((prev) => prev.map((r) => r.id === updated.id ? updated : r))
  }

  const handleDelete = async (id: string) => {
    await deleteAutomationRule(id)
    setRules((prev) => {
      const next = prev.filter((r) => r.id !== id)
      // If we deleted the selected rule, select the next one or fall back to "new"
      if (selectedId === id) {
        setSelectedId(next[0]?.id ?? null)
      }
      return next
    })
  }

  const filteredRules = useMemo(() => {
    if (!search.trim()) return rules
    const q = search.toLowerCase()
    return rules.filter((r) =>
      summarizeTrigger(r.trigger, peers).toLowerCase().includes(q) ||
      getEventActionLabel(r.action.kind).toLowerCase().includes(q) ||
      summarizeAction(r, peers).toLowerCase().includes(q)
    )
  }, [rules, search, peers])

  const selectedRule = rules.find((r) => r.id === selectedId) ?? null

  return (
    <div className="grid h-full min-h-0 grid-cols-[220px_minmax(0,1fr)] gap-5 border-t border-[var(--color-border-default)] pt-4 overflow-hidden">
      {/* ── Left sidebar: search + rule list ── */}
      <div className="flex min-h-0 flex-col gap-3 overflow-y-auto">
        <MediaSearchInput value={search} onChange={setSearch} placeholder="Search rules…" />
        <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
          {loading ? (
            <div className="text-[10px] text-zinc-600 italic px-1">Loading…</div>
          ) : filteredRules.length === 0 && rules.length > 0 ? (
            <ConfigNotice tone="info">No rules match this filter.</ConfigNotice>
          ) : filteredRules.length === 0 ? (
            <div className="text-[10px] text-zinc-600 italic px-1">No rules yet.</div>
          ) : (
            filteredRules.map((rule) => (
              <LibraryItemBtn
                key={rule.id}
                active={selectedId === rule.id}
                onClick={() => setSelectedId(rule.id)}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm leading-none">{rule.trigger.source === 'widget' ? '📡' : '⚡'}</span>
                  <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">
                    {summarizeTrigger(rule.trigger, peers)}
                  </span>
                  {!rule.enabled && (
                    <span className="shrink-0 rounded-full bg-zinc-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
                      off
                    </span>
                  )}
                </div>
                <div className="mt-1 text-[10px] text-zinc-500 truncate">
                  → {getEventActionLabel(rule.action.kind)}
                  <span className="ml-1 text-zinc-600">{summarizeAction(rule, peers)}</span>
                </div>
              </LibraryItemBtn>
            ))
          )}
        </div>
        <AddBtn label="New Rule" onClick={() => setSelectedId(null)} />
      </div>

      {/* ── Right: editor / detail ── */}
      <div className="min-w-0 min-h-0 overflow-y-auto pr-1 space-y-5">
        {selectedRule ? (
          <RuleDetail
            rule={selectedRule}
            peers={peers}
            onToggle={handleToggle}
            onDelete={handleDelete}
          />
        ) : (
          <RuleEditor
            peers={peers}
            emitterPeers={emitterPeers}
            peerById={peerById}
            navigableSceneIds={navigableSceneIds}
            applications={applications}
            onAdd={handleAdd}
            adding={adding}
          />
        )}
      </div>
    </div>
  )
}
