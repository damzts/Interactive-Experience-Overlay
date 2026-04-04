import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAdminStore } from '../store/useAdminStore'
import { withDesktopAmbianceDefaults, type DesktopAmbianceConfig, type Application } from '@ieom/shared'
import { Toggle, Slider, isSameDraft, IconGlyph, ConfigApplyBar, ConfigCard, ConfigNotice, ConfigPageIntro, ConfigSectionPanel } from '../components/ui'

function createDefaultBehavior(enabled = false): DesktopAmbianceConfig['widgetSimulation']['behaviors'][string] {
  return {
    enabled,
    openChance: 0.18,
    closeChance: 0.12,
    interactChance: 0.65,
  }
}

function formatRelativeTime(timestamp: number | null) {
  if (!timestamp) return 'Never'
  const diffMs = Date.now() - timestamp
  if (diffMs < 1000) return 'Just now'
  const seconds = Math.round(diffMs / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  return `${hours}h ago`
}

function formatFutureTime(timestamp: number | null) {
  if (!timestamp) return 'Not scheduled'
  const diffMs = timestamp - Date.now()
  if (diffMs <= 0) return 'Due now'
  const seconds = Math.ceil(diffMs / 1000)
  if (seconds < 60) return `In ${seconds}s`
  const minutes = Math.ceil(seconds / 60)
  return `In ${minutes}m`
}

function WidgetBehaviorEditor({
  app,
  behavior,
  onChange,
}: {
  app: Application,
  behavior: DesktopAmbianceConfig['widgetSimulation']['behaviors'][string],
  onChange: (updater: (draft: DesktopAmbianceConfig['widgetSimulation']['behaviors'][string]) => void) => void
}) {
  return (
    <ConfigCard>
      <div className="mb-3 flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-zinc-800/80 bg-zinc-900/80">
          <IconGlyph icon={app.icon} label={app.label} />
        </div>
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-300/80">Widget Behavior</div>
          <div className="truncate text-sm font-medium text-zinc-100">{app.label}</div>
        </div>
        <div className="flex-1" />
        <Toggle
          checked={behavior.enabled}
          onChange={(checked) => onChange((d) => { d.enabled = checked })}
          label={behavior.enabled ? 'Enabled' : 'Disabled'}
        />
      </div>
      {behavior.enabled && (
        <div className="space-y-2 border-t border-zinc-800/80 pt-3">
          <Slider
            label="Open Chance"
            value={behavior.openChance}
            min={0}
            max={1}
            step={0.05}
            onChange={(val) => onChange((d) => { d.openChance = val })}
            unit="%"
          />
          <Slider
            label="Close Chance"
            value={behavior.closeChance}
            min={0}
            max={1}
            step={0.05}
            onChange={(val) => onChange((d) => { d.closeChance = val })}
            unit="%"
          />
          <Slider
            label="Interact Chance"
            value={behavior.interactChance ?? 0.65}
            min={0}
            max={1}
            step={0.05}
            onChange={(val) => onChange((d) => { d.interactChance = val })}
            unit="%"
          />
        </div>
      )}
    </ConfigCard>
  )
}

export function AmbiancePanel() {
  const allApps      = useAdminStore((s) => s.config.applications)
  const rawDesktopAmbiance = useAdminStore((s) => s.config.desktopAmbiance)
  const saveConfig   = useAdminStore((s) => s.saveConfig)
  const openWidgetIds = useAdminStore((s) => s.openWidgetIds)
  const simulationLeaderId = useAdminStore((s) => s.simulationLeaderId)
  const ambianceAcceptedCount = useAdminStore((s) => s.ambianceAcceptedCount)
  const ambianceRejectedCount = useAdminStore((s) => s.ambianceRejectedCount)
  const runtimeDiagnostics = useAdminStore((s) => s.runtimeDiagnostics)
  const sourceConfig = useMemo(
    () => withDesktopAmbianceDefaults(rawDesktopAmbiance),
    [rawDesktopAmbiance],
  )

  const [form, setForm] = useState<DesktopAmbianceConfig>(() => structuredClone(sourceConfig))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const widgetApps = useMemo(() => allApps.filter((app) => app.appType === 'widget'), [allApps])

  const dirty = !isSameDraft(form, sourceConfig)

  useEffect(() => {
    // Do not clobber in-progress edits when remote config updates arrive.
    if (dirty) return
    setForm((prev) => (isSameDraft(prev, sourceConfig) ? prev : structuredClone(sourceConfig)))
    setSaved(false)
  }, [dirty, sourceConfig])

  useEffect(() => {
    return () => {
      if (savedTimer.current) clearTimeout(savedTimer.current)
    }
  }, [])

  const update = useCallback(<K extends keyof DesktopAmbianceConfig>(key: K, updater: (d: DesktopAmbianceConfig[K]) => void) => {
    setForm((prev) => {
      const next = structuredClone(prev)
      updater(next[key])
      setSaved(false)
      return next
    })
  }, [])
  
  const updateBehavior = useCallback((widgetId: string, updater: (d: DesktopAmbianceConfig['widgetSimulation']['behaviors'][string]) => void) => {
    update('widgetSimulation', (ws) => {
      if (!ws.behaviors[widgetId]) {
        ws.behaviors[widgetId] = createDefaultBehavior(false)
      }
      updater(ws.behaviors[widgetId])
    })
  }, [update])

  const ensureWidgetBehaviors = useCallback((enableAllWhenEmpty: boolean) => {
    update('widgetSimulation', (ws) => {
      const currentEnabledCount = Object.values(ws.behaviors).filter((behavior) => behavior?.enabled).length
      widgetApps.forEach((app) => {
        if (!ws.behaviors[app.id]) {
          ws.behaviors[app.id] = createDefaultBehavior(enableAllWhenEmpty && currentEnabledCount === 0)
        }
      })

      if (enableAllWhenEmpty && currentEnabledCount === 0) {
        widgetApps.forEach((app) => {
          ws.behaviors[app.id] = {
            ...createDefaultBehavior(true),
            ...ws.behaviors[app.id],
            enabled: true,
          }
        })
      }
    })
  }, [update, widgetApps])

  const apply = useCallback(async () => {
    if (!dirty) return
    setSaving(true)
    await saveConfig({ desktopAmbiance: form })
    setSaving(false)
    if (savedTimer.current) clearTimeout(savedTimer.current)
    setSaved(true)
    savedTimer.current = setTimeout(() => setSaved(false), 1500)
  }, [dirty, saveConfig, form])

  const reset = useCallback(() => {
    setForm(structuredClone(sourceConfig))
    setSaved(false)
  }, [sourceConfig])

  const simConfig = form.widgetSimulation
  const scheduler = runtimeDiagnostics.scheduler
  const ambiance = runtimeDiagnostics.ambiance
  const activeAutoEvents = scheduler.events.filter((eventDef) => eventDef.enabled)

  return (
    <div className="w-full max-w-none space-y-0 pt-1">
      <ConfigPageIntro title="Desktop Ambiance">
        Configure the background simulation that makes the desktop feel occupied. These controls decide when widget activity happens and how aggressive the automation becomes.
      </ConfigPageIntro>
      <ConfigNotice tone="warning" className="mb-4">
        Changes are staged locally. Use Save Changes to apply them.
      </ConfigNotice>
      <ConfigApplyBar label="Ambiance Settings" dirty={dirty} saving={saving} saved={saved} onApply={apply} onReset={reset} alwaysShow />
      <div className="space-y-0 pt-3">
      <ConfigSectionPanel label="Widget Simulation" first>
        <div className="space-y-4">
          <ConfigNotice>
            Widget simulation periodically evaluates open, close, and interaction chances using the thresholds below.
          </ConfigNotice>
          <Toggle
            checked={simConfig.enabled}
            onChange={(checked) => {
              update('widgetSimulation', (d) => { d.enabled = checked })
              if (checked) {
                ensureWidgetBehaviors(true)
              }
            }}
            label="Enable Widget Simulation"
          />
          <ConfigCard className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-200">Live Diagnostics</span>
              <span className="text-[10px] text-zinc-500">Leader: {simulationLeaderId ?? 'none'}</span>
              <span className="text-[10px] text-zinc-500">Open widgets: {openWidgetIds.length}</span>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/65 p-3">
                <div className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Scheduler Tick</div>
                <div className="mt-1 text-lg font-semibold text-zinc-100">{Math.round(scheduler.tickMs / 1000)}s</div>
                <div className="mt-1 text-[11px] text-zinc-500">Last eval: {formatRelativeTime(scheduler.lastEvaluatedAt)}</div>
              </div>
              <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/65 p-3">
                <div className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Last Activity</div>
                <div className="mt-1 text-lg font-semibold text-zinc-100">{formatRelativeTime(scheduler.lastActivityAt)}</div>
                <div className="mt-1 text-[11px] text-zinc-500">State: {scheduler.currentState}</div>
              </div>
              <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/65 p-3">
                <div className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Ambiance Loop</div>
                <div className="mt-1 text-lg font-semibold text-zinc-100">{ambiance.intervalSeconds}s</div>
                <div className="mt-1 text-[11px] text-zinc-500">Last tick: {formatRelativeTime(ambiance.lastTickAt)}</div>
              </div>
              <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/65 p-3">
                <div className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Last Sim Action</div>
                <div className="mt-1 text-sm font-semibold text-zinc-100">{ambiance.lastAction ? `${ambiance.lastAction} ${ambiance.lastActionWidgetId ?? ''}`.trim() : 'None yet'}</div>
                <div className="mt-1 text-[11px] text-zinc-500">{formatRelativeTime(ambiance.lastActionAt)}</div>
              </div>
            </div>
            <div className="grid gap-3 lg:grid-cols-[1.2fr,0.8fr]">
              <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/65 p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Scheduler Queue</div>
                  <div className="text-[10px] text-zinc-600">{activeAutoEvents.length} active events</div>
                </div>
                {activeAutoEvents.length === 0 ? (
                  <div className="text-[11px] text-zinc-500">No auto-events are enabled.</div>
                ) : (
                  <div className="space-y-2">
                    {activeAutoEvents.map((eventDef) => (
                      <div key={eventDef.id} className="rounded-lg border border-zinc-800/70 bg-zinc-900/55 px-3 py-2">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-xs font-medium text-zinc-100">{eventDef.label}</div>
                            <div className="text-[10px] text-zinc-500">{eventDef.mode === 'interval' ? `Interval every ~${eventDef.intervalMin}m` : `Idle after ${eventDef.idleMin}m`}</div>
                          </div>
                          <div className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${eventDef.due ? 'bg-amber-500/15 text-amber-200' : 'bg-cyan-500/10 text-cyan-200'}`}>
                            {eventDef.mode === 'interval' ? formatFutureTime(eventDef.nextRunAt) : (eventDef.idleTriggered ? 'Idle fired' : 'Waiting')}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/65 p-3 space-y-2">
                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Ambiance Runtime</div>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-zinc-400">Status</span>
                  <span className={ambiance.enabled ? 'text-emerald-300' : 'text-zinc-500'}>{ambiance.enabled ? 'Enabled' : 'Disabled'}</span>
                </div>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-zinc-400">Leader</span>
                  <span className="text-right text-zinc-100">
                    {ambiance.leaderSocketId
                      ? ambiance.leaderSocketId.slice(0, 8)
                      : 'No overlay leader'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-zinc-400">Pending phase</span>
                  <span className="text-zinc-100">{ambiance.pendingPhase ?? 'Idle'}</span>
                </div>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-zinc-400">Widgets in pool</span>
                  <span className="text-zinc-100">{ambiance.enabledWidgetCount}</span>
                </div>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-zinc-400">Open / max</span>
                  <span className="text-zinc-100">{ambiance.openWidgetCount} / {ambiance.maxOpenWidgets}</span>
                </div>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-zinc-400">Accepted / rejected</span>
                  <span className="text-zinc-100">{ambianceAcceptedCount} / {ambianceRejectedCount}</span>
                </div>
                <div className="rounded-lg border border-zinc-800/70 bg-zinc-900/55 px-3 py-2 text-[11px] text-zinc-400">
                  {ambiance.lastSkipReason ? `Last skip: ${ambiance.lastSkipReason}` : 'Last tick produced an action or is waiting for the current one to finish.'}
                </div>
              </div>
            </div>
          </ConfigCard>
          {simConfig.enabled && (
            <div className="space-y-4 border-l border-zinc-800/80 pl-4">
              <ConfigCard>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <div className="mb-1 text-xs text-zinc-400">Evaluation Interval</div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={simConfig.intervalSeconds}
                        onChange={(e) => update('widgetSimulation', (d) => { d.intervalSeconds = Number(e.target.value) })}
                        className="w-28 text-sm"
                        min={1}
                      />
                      <span className="text-xs text-zinc-500">seconds</span>
                    </div>
                    <div className="mt-1 text-[10px] text-zinc-600">
                      How often the AI should consider performing an action.
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 text-xs text-zinc-400">Max Open Widgets</div>
                    <input
                      type="number"
                      value={simConfig.maxOpenWidgets ?? 2}
                      onChange={(e) => update('widgetSimulation', (d) => { d.maxOpenWidgets = Math.max(1, Math.min(6, Number(e.target.value) || 2)) })}
                      className="w-28 text-sm"
                      min={1}
                      max={6}
                    />
                  </div>
                </div>
                <div className="mt-4">
                  <Slider
                    label="Open While One Open"
                    value={simConfig.openWhileOneOpenChance ?? 0.35}
                    min={0}
                    max={1}
                    step={0.05}
                    onChange={(val) => update('widgetSimulation', (d) => { d.openWhileOneOpenChance = val })}
                    unit="%"
                  />
                </div>
              </ConfigCard>
              <div>
                <div className="mb-2 px-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Widget Behaviors</div>
                {widgetApps.length === 0 ? (
                  <ConfigNotice tone="info">No widgets are available yet. Create a widget before configuring simulated behavior.</ConfigNotice>
                ) : (
                  <div className="space-y-3">
                    {widgetApps.map((app) => (
                      <WidgetBehaviorEditor
                        key={app.id}
                        app={app}
                        behavior={simConfig.behaviors[app.id] ?? createDefaultBehavior(false)}
                        onChange={(updater) => updateBehavior(app.id, updater)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          {!simConfig.enabled && (
            <ConfigNotice tone="info">
              Enable widget simulation to expose cadence and per-widget behavior controls.
            </ConfigNotice>
          )}
        </div>
      </ConfigSectionPanel>
      </div>
    </div>
  )
}
