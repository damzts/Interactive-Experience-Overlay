import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAdminStore } from '../../store/useAdminStore'
import { withDesktopAmbianceDefaults, type DesktopAmbianceConfig, type Application } from '@ieom/shared'
import { Toggle, Slider, isSameDraft, IconGlyph, ConfigApplyBar, ConfigCard, ConfigNotice, ConfigPageIntro, ConfigSectionPanel } from '../../shared/ui'
import { socket } from '../../socket/client'

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

function formatDateTime(timestamp: number | null) {
  if (!timestamp) return 'Never'
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
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
  const [resyncing, setResyncing] = useState(false)
  const [historyCopyState, setHistoryCopyState] = useState<'idle' | 'copied' | 'error'>('idle')
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
  const requestOverlayResync = useCallback(() => {
    setResyncing(true)
    socket.emit('overlay:force-resync', { reason: 'admin-panel-manual-resync' })
    window.setTimeout(() => setResyncing(false), 800)
  }, [])

  const copyHistory = useCallback(async () => {
    if (!ambiance.history.length) return

    const text = ambiance.history
      .map((entry) => {
        const metadata = [
          entry.widgetId,
          entry.action,
          entry.actionId,
          entry.leaderSocketId,
        ].filter(Boolean).join(' | ')

        return [
          `${formatDateTime(entry.timestamp)} ${entry.type}`,
          entry.message,
          metadata,
        ].filter(Boolean).join('\n')
      })
      .join('\n\n')

    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable')
      await navigator.clipboard.writeText(text)
      setHistoryCopyState('copied')
      window.setTimeout(() => setHistoryCopyState('idle'), 1500)
    } catch {
      setHistoryCopyState('error')
      window.setTimeout(() => setHistoryCopyState('idle'), 1800)
    }
  }, [ambiance.history])

  const clearHistory = useCallback(() => {
    if (!ambiance.history.length) return
    socket.emit('ambiance:history:clear')
    setHistoryCopyState('idle')
  }, [ambiance.history.length])

  return (
    <div className="w-full max-w-none space-y-0 pt-1">
      <ConfigPageIntro title="Desktop Ambiance">
        Control desktop ambiance.
      </ConfigPageIntro>
      <ConfigApplyBar label="Ambiance Settings" dirty={dirty} saving={saving} saved={saved} onApply={apply} onReset={reset} alwaysShow />
      <div className="space-y-0 pt-3">
      <ConfigSectionPanel label="Widget Simulation" first>
        <div className="space-y-4">
          <ConfigNotice>
            Adjust cadence and widget behavior.
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
          <ConfigCard>
            <div className="mb-4 grid gap-4 md:grid-cols-2">
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
                  Action cadence.
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
            <Slider
              label="Open While One Open"
              value={simConfig.openWhileOneOpenChance ?? 0.35}
              min={0}
              max={1}
              step={0.05}
              onChange={(val) => update('widgetSimulation', (d) => { d.openWhileOneOpenChance = val })}
              unit="%"
            />
          </ConfigCard>
          {!simConfig.enabled && (
            <ConfigNotice tone="info">
              Enable widget simulation to expose cadence and per-widget behavior controls.
            </ConfigNotice>
          )}
        </div>
      </ConfigSectionPanel>
      <ConfigSectionPanel label="Ambiance Runtime">
        <div className="space-y-3">
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={requestOverlayResync}
              className="rounded-md border border-zinc-700/80 bg-zinc-900/80 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-300 transition hover:border-cyan-400/40 hover:text-cyan-200"
            >
              {resyncing ? 'Resyncing...' : 'Force Resync'}
            </button>
          </div>
          <ConfigCard className="space-y-2">
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
              <span className="text-zinc-400">Leader ready</span>
              <span className={ambiance.leaderReady ? 'text-emerald-300' : 'text-amber-300'}>{ambiance.leaderReady ? 'Ready' : 'Not ready'}</span>
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
            <div className="rounded-lg border border-zinc-800/70 bg-zinc-900/55 px-5 py-4 text-[11px] text-zinc-400">
              {ambiance.lastSkipReason ? `Last skip: ${ambiance.lastSkipReason}` : 'No skip reason.'}
            </div>
            <div className="border-t border-zinc-800/70 pt-2">
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <div className="text-zinc-400">Last activity</div>
                    <div className="text-[11px] text-zinc-500">{scheduler.currentState}</div>
                  </div>
                  <div className="text-right text-zinc-100">{formatRelativeTime(scheduler.lastActivityAt)}</div>
                </div>
                <div className="flex items-start justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <div className="text-zinc-400">Ambiance loop</div>
                    <div className="text-[11px] text-zinc-500">Tick {formatRelativeTime(ambiance.lastTickAt)}</div>
                  </div>
                  <div className="text-right text-zinc-100">{ambiance.intervalSeconds}s</div>
                </div>
                <div className="flex items-start justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <div className="text-zinc-400">Last sim action</div>
                    <div className="text-[11px] text-zinc-500">{formatRelativeTime(ambiance.lastActionAt)}</div>
                  </div>
                  <div className="text-right text-zinc-100">{ambiance.lastAction ? `${ambiance.lastAction} ${ambiance.lastActionWidgetId ?? ''}`.trim() : 'None yet'}</div>
                </div>
              </div>
            </div>
          </ConfigCard>
        </div>
      </ConfigSectionPanel>
      <ConfigSectionPanel label="Widget Behaviors">
        {simConfig.enabled ? (
          <div className="space-y-4">
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
        ) : (
          <ConfigNotice tone="info">
            Enable widget simulation to expose cadence and per-widget behavior controls.
          </ConfigNotice>
        )}
      </ConfigSectionPanel>
      <ConfigSectionPanel label="Ambiance History">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex-1 text-[10px] text-zinc-500">Lifecycle log</div>
            <span className="rounded-full border border-zinc-800 bg-zinc-950/70 px-2 py-1 text-[10px] font-mono text-zinc-500">
              {ambiance.history.length} entr{ambiance.history.length === 1 ? 'y' : 'ies'}
            </span>
            <button
              type="button"
              onClick={copyHistory}
              disabled={!ambiance.history.length}
              className="rounded-md border border-zinc-700/80 bg-zinc-900/80 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-300 transition hover:border-cyan-400/40 hover:text-cyan-200 disabled:cursor-not-allowed disabled:opacity-40"
              title="Copy the full ambiance history to the clipboard"
            >
              {historyCopyState === 'copied' ? 'Copied' : historyCopyState === 'error' ? 'Copy Failed' : 'Copy All'}
            </button>
            <button
              type="button"
              onClick={clearHistory}
              disabled={!ambiance.history.length}
              className="rounded-md border border-red-500/30 bg-red-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-red-200 transition hover:border-red-400/50 hover:text-red-100 disabled:cursor-not-allowed disabled:opacity-40"
              title="Clear the ambiance history"
            >
              Clear
            </button>
          </div>
          {ambiance.history.length === 0 ? (
            <ConfigNotice tone="info">No lifecycle events recorded yet.</ConfigNotice>
          ) : (
            <div className="max-h-[28rem] space-y-2 overflow-y-auto rounded-lg border border-zinc-800/70 bg-zinc-900/55 p-3">
              {ambiance.history.slice(0, 50).map((entry) => (
                <ConfigCard key={entry.id}>
                  <div className="flex items-center justify-between gap-3 text-[10px] uppercase tracking-[0.12em] text-zinc-500">
                    <span>{entry.type}</span>
                    <span>{formatDateTime(entry.timestamp)}</span>
                  </div>
                  <div className="mt-1 text-sm text-zinc-100">{entry.message}</div>
                  <div className="mt-1 text-[11px] text-zinc-500">
                    {[entry.widgetId, entry.action, entry.leaderSocketId ? entry.leaderSocketId.slice(0, 8) : null].filter(Boolean).join(' · ') || 'No extra metadata'}
                  </div>
                </ConfigCard>
              ))}
            </div>
          )}
        </div>
      </ConfigSectionPanel>
      </div>
    </div>
  )
}
