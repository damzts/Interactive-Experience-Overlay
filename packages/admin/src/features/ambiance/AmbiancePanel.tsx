import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAdminStore } from '../../store/useAdminStore'
import { withDesktopAmbianceDefaults, type DesktopAmbianceConfig, type Application } from '@ieomlabs/shared'
import { Slider, isSameDraft, IconGlyph, ConfigApplyBar, ConfigPageIntro } from '../../shared/ui'
import { Toggle, Button } from '../../components/atoms'
import { Card } from '../../components/molecules'
import { ConfigPanel } from '../../components/organisms'
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

/** Notice component for informational/warning messages within config panels */
function Notice({ tone = 'info', children }: { tone?: 'info' | 'warning' | 'danger' | 'success'; children: React.ReactNode }) {
  const toneStyles: Record<string, string> = {
    info: 'border-[var(--color-primary-400)]/25 bg-[var(--color-primary-500)]/10 text-[var(--color-primary-100)]',
    warning: 'border-[var(--color-accent-400)]/30 bg-[var(--color-accent-500)]/12 text-[var(--color-accent-100)]',
    danger: 'border-[var(--color-danger-400)]/30 bg-[var(--color-danger-500)]/12 text-[var(--color-danger-400)]',
    success: 'border-[var(--color-success-400)]/30 bg-[var(--color-success-500)]/12 text-[var(--color-success-400)]',
  }
  return (
    <div className={`rounded-[var(--radius-lg)] border px-3 py-2.5 text-sm shadow-[var(--shadow-sm)] backdrop-blur ${toneStyles[tone]}`}>
      {children}
    </div>
  )
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
    <Card variant="default" padding="sm">
      <div className="mb-3 flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-bg-base)]">
          <IconGlyph icon={app.icon} label={app.label} />
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-[var(--color-text-primary)]">{app.label}</div>
        </div>
        <div className="flex-1" />
        <Toggle
          checked={behavior.enabled}
          onChange={(checked) => onChange((d) => { d.enabled = checked })}
          size="md"
          label={behavior.enabled ? 'Enabled' : 'Disabled'}
        />
      </div>
      {behavior.enabled && (
        <div className="space-y-2 border-t border-[var(--color-border-default)] pt-3">
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
    </Card>
  )
}

export function AmbiancePanel() {
  const allApps      = useAdminStore((s) => s.config.applications)
  const rawDesktopAmbiance = useAdminStore((s) => s.config.desktopAmbiance)
  const saveConfig   = useAdminStore((s) => s.saveConfig)
  const openWidgetIds = useAdminStore((s) => s.openWidgetIds)
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
  const widgetApps = allApps

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
      <div className="space-y-6 pt-3">
      <ConfigPanel title="Widget Simulation" collapsible>
        <div className="space-y-4">
          <Notice>
            Adjust cadence and widget behavior.
          </Notice>
          <Toggle
            checked={simConfig.enabled}
            onChange={(checked) => {
              update('widgetSimulation', (d) => { d.enabled = checked })
              if (checked) {
                ensureWidgetBehaviors(true)
              }
            }}
            size="md"
            label="Enable Widget Simulation"
          />
          <Card variant="default" padding="md">
            <div className="mb-4 grid gap-4 md:grid-cols-2">
              <div>
                <div className="mb-1 text-xs text-[var(--color-text-secondary)]">Evaluation Interval</div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={simConfig.intervalSeconds}
                    onChange={(e) => update('widgetSimulation', (d) => { d.intervalSeconds = Number(e.target.value) })}
                    className="w-28 rounded-[var(--radius-sm)] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-2.5 py-1.5 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-primary-500)] focus:ring-2 focus:ring-[var(--color-primary-400)]/25"
                    min={1}
                  />
                  <span className="text-xs text-[var(--color-text-muted)]">seconds</span>
                </div>
                <div className="mt-1 text-[10px] text-[var(--color-text-muted)]">
                  Action cadence.
                </div>
              </div>
              <div>
                <div className="mb-1 text-xs text-[var(--color-text-secondary)]">Max Open Widgets</div>
                <input
                  type="number"
                  value={simConfig.maxOpenWidgets ?? 2}
                  onChange={(e) => update('widgetSimulation', (d) => { d.maxOpenWidgets = Math.max(1, Math.min(6, Number(e.target.value) || 2)) })}
                  className="w-28 rounded-[var(--radius-sm)] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-2.5 py-1.5 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-primary-500)] focus:ring-2 focus:ring-[var(--color-primary-400)]/25"
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
          </Card>
          {!simConfig.enabled && (
            <Notice tone="info">
              Enable widget simulation to expose cadence and per-widget behavior controls.
            </Notice>
          )}
        </div>
      </ConfigPanel>

<ConfigPanel title="Ambiance Runtime" collapsible>
        <div className="space-y-3">
          <div className="flex items-center justify-end gap-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={requestOverlayResync}
              disabled={resyncing}
            >
              {resyncing ? 'Resyncing...' : 'Force Resync'}
            </Button>
          </div>
          <Card variant="default" padding="md" className="space-y-2">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-[var(--color-text-secondary)]">Status</span>
              <span className={ambiance.enabled ? 'text-[var(--color-success-400)]' : 'text-[var(--color-text-muted)]'}>{ambiance.enabled ? 'Enabled' : 'Disabled'}</span>
            </div>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-[var(--color-text-secondary)]">Leader</span>
              <span className="text-right text-[var(--color-text-primary)]">
                {ambiance.leaderSocketId
                  ? ambiance.leaderSocketId.slice(0, 8)
                  : 'No overlay leader'}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-[var(--color-text-secondary)]">Pending phase</span>
              <span className="text-[var(--color-text-primary)]">{ambiance.pendingPhase ?? 'Idle'}</span>
            </div>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-[var(--color-text-secondary)]">Leader ready</span>
              <span className={ambiance.leaderReady ? 'text-[var(--color-success-400)]' : 'text-[var(--color-accent-400)]'}>{ambiance.leaderReady ? 'Ready' : 'Not ready'}</span>
            </div>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-[var(--color-text-secondary)]">Widgets in pool</span>
              <span className="text-[var(--color-text-primary)]">{ambiance.enabledWidgetCount}</span>
            </div>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-[var(--color-text-secondary)]">Open / max</span>
              <span className="text-[var(--color-text-primary)]">{ambiance.openWidgetCount} / {ambiance.maxOpenWidgets}</span>
            </div>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-[var(--color-text-secondary)]">Accepted / rejected</span>
              <span className="text-[var(--color-text-primary)]">{ambianceAcceptedCount} / {ambianceRejectedCount}</span>
            </div>
            <div className="rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-bg-base)] px-3 py-2 text-[11px] text-[var(--color-text-secondary)]">
              {ambiance.lastSkipReason ? `Last skip: ${ambiance.lastSkipReason}` : 'No skip reason.'}
            </div>
            <div className="border-t border-[var(--color-border-default)] pt-2">
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <div className="text-[var(--color-text-secondary)]">Ambiance loop</div>
                    <div className="text-[11px] text-[var(--color-text-muted)]">Tick {formatRelativeTime(ambiance.lastTickAt)}</div>
                  </div>
                  <div className="text-right text-[var(--color-text-primary)]">{ambiance.intervalSeconds}s</div>
                </div>
                <div className="flex items-start justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <div className="text-[var(--color-text-secondary)]">Last sim action</div>
                    <div className="text-[11px] text-[var(--color-text-muted)]">{formatRelativeTime(ambiance.lastActionAt)}</div>
                  </div>
                  <div className="text-right text-[var(--color-text-primary)]">{ambiance.lastAction ? `${ambiance.lastAction} ${ambiance.lastActionWidgetId ?? ''}`.trim() : 'None yet'}</div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </ConfigPanel>

      <ConfigPanel title="Widget Behaviors" collapsible>
        {simConfig.enabled ? (
          <div className="space-y-4">
            {widgetApps.length === 0 ? (
              <Notice tone="info">No widgets are available yet. Create a widget before configuring simulated behavior.</Notice>
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
          <Notice tone="info">
            Enable widget simulation to expose cadence and per-widget behavior controls.
          </Notice>
        )}
      </ConfigPanel>

      <ConfigPanel title="Ambiance History" collapsible>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex-1 text-[10px] text-[var(--color-text-muted)]">Lifecycle log</div>
            <span className="rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-base)] px-2 py-1 text-[10px] font-mono text-[var(--color-text-muted)]">
              {ambiance.history.length} entr{ambiance.history.length === 1 ? 'y' : 'ies'}
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={copyHistory}
              disabled={!ambiance.history.length}
            >
              {historyCopyState === 'copied' ? 'Copied' : historyCopyState === 'error' ? 'Copy Failed' : 'Copy All'}
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={clearHistory}
              disabled={!ambiance.history.length}
            >
              Clear
            </Button>
          </div>
          {ambiance.history.length === 0 ? (
            <Notice tone="info">No lifecycle events recorded yet.</Notice>
          ) : (
            <div className="max-h-[28rem] space-y-2 overflow-y-auto rounded-[var(--radius-lg)] border border-[var(--color-border-default)] bg-[var(--color-bg-base)] p-3">
              {ambiance.history.slice(0, 50).map((entry) => (
                <Card variant="default" padding="sm" key={entry.id}>
                  <div className="flex items-center justify-between gap-3 text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-muted)]">
                    <span>{entry.type}</span>
                    <span>{formatDateTime(entry.timestamp)}</span>
                  </div>
                  <div className="mt-1 text-sm text-[var(--color-text-primary)]">{entry.message}</div>
                  <div className="mt-1 text-[11px] text-[var(--color-text-muted)]">
                    {[entry.widgetId, entry.action, entry.leaderSocketId ? entry.leaderSocketId.slice(0, 8) : null].filter(Boolean).join(' · ') || 'No extra metadata'}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </ConfigPanel>

      </div>
      <ConfigApplyBar label="Ambiance Settings" dirty={dirty} saving={saving} saved={saved} onApply={apply} onReset={reset} alwaysShow />
    </div>
  )
}
