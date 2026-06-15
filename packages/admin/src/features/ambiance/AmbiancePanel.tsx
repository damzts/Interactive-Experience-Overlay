import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAdminStore } from '../../store/useAdminStore'
import { STATE, withDesktopAmbianceDefaults, type AmbianceNavBehavior, type AmbianceWidgetBehavior, type DesktopAmbianceConfig, type Application } from '@ieomlabs/shared'
import { Slider, isSameDraft, IconGlyph, ConfigApplyBar, ConfigPageIntro } from '../../shared/ui'
import { Toggle, Button } from '../../components/atoms'
import { Card } from '../../components/molecules'
import { ConfigPanel } from '../../components/organisms'
import { socket } from '../../socket/client'

// ── Defaults ──────────────────────────────────────────────────────

function createDefaultWidgetBehavior(enabled = false): AmbianceWidgetBehavior {
  return { enabled, openChance: 0.18, closeChance: 0.12, interactChance: 0.65 }
}

function createDefaultNavBehavior(enabled = false): AmbianceNavBehavior {
  return { enabled, selectChance: 0.2 }
}

// ── Helpers ───────────────────────────────────────────────────────

function formatRelativeTime(timestamp: number | null) {
  if (!timestamp) return 'Never'
  const diffMs = Date.now() - timestamp
  if (diffMs < 1000) return 'Just now'
  const s = Math.round(diffMs / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m ago`
  return `${Math.round(m / 60)}h ago`
}

function TypeBadge({ kind }: { kind: 'widget' | 'layout' | 'scene' }) {
  const styles: Record<string, string> = {
    widget: 'bg-[var(--color-primary-500)]/15 text-[var(--color-primary-300)]',
    layout: 'bg-[var(--color-accent-500)]/15 text-[var(--color-accent-300)]',
    scene:  'bg-[var(--color-success-500)]/15 text-[var(--color-success-300)]',
  }
  return (
    <span className={`rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-widest ${styles[kind]}`}>
      {kind}
    </span>
  )
}

// ── Target behavior cards ─────────────────────────────────────────

function WidgetTargetCard({
  app,
  behavior,
  onChange,
}: {
  app: Application
  behavior: AmbianceWidgetBehavior
  onChange: (updater: (d: AmbianceWidgetBehavior) => void) => void
}) {
  return (
    <Card variant="default" padding="sm">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-bg-base)]">
          <IconGlyph icon={app.icon} label={app.label} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-[var(--color-text-primary)]">{app.label}</span>
            <TypeBadge kind="widget" />
          </div>
        </div>
        <Toggle
          checked={behavior.enabled}
          onChange={(checked) => onChange((d) => { d.enabled = checked })}
          size="sm"
          label={behavior.enabled ? 'On' : 'Off'}
        />
      </div>
      {behavior.enabled && (
        <div className="mt-3 space-y-2 border-t border-[var(--color-border-default)] pt-3">
          <Slider label="Open" value={behavior.openChance} min={0} max={1} step={0.05}
            onChange={(v) => onChange((d) => { d.openChance = v })} unit="%" />
          <Slider label="Close" value={behavior.closeChance} min={0} max={1} step={0.05}
            onChange={(v) => onChange((d) => { d.closeChance = v })} unit="%" />
          <Slider label="Interact" value={behavior.interactChance ?? 0.65} min={0} max={1} step={0.05}
            onChange={(v) => onChange((d) => { d.interactChance = v })} unit="%" />
        </div>
      )}
    </Card>
  )
}

function NavTargetCard({
  icon,
  label,
  kind,
  behavior,
  sliderLabel,
  onChange,
}: {
  icon: string
  label: string
  kind: 'layout' | 'scene'
  behavior: AmbianceNavBehavior
  sliderLabel: string
  onChange: (updater: (d: AmbianceNavBehavior) => void) => void
}) {
  return (
    <Card variant="default" padding="sm">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-bg-base)] text-base">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-[var(--color-text-primary)]">{label}</span>
            <TypeBadge kind={kind} />
          </div>
        </div>
        <Toggle
          checked={behavior.enabled}
          onChange={(checked) => onChange((d) => { d.enabled = checked })}
          size="sm"
          label={behavior.enabled ? 'On' : 'Off'}
        />
      </div>
      {behavior.enabled && (
        <div className="mt-3 border-t border-[var(--color-border-default)] pt-3">
          <Slider label={sliderLabel} value={behavior.selectChance} min={0} max={1} step={0.05}
            onChange={(v) => onChange((d) => { d.selectChance = v })} unit="%" />
        </div>
      )}
    </Card>
  )
}

// ── Main panel ────────────────────────────────────────────────────

export function AmbiancePanel() {
  const allApps            = useAdminStore((s) => s.config.applications)
  const allLayouts         = useAdminStore((s) => s.config.widgetLayouts ?? [])
  const allScenes          = useAdminStore((s) => s.config.scenes ?? {})
  const rawDesktopAmbiance = useAdminStore((s) => s.config.desktopAmbiance)
  const saveConfig         = useAdminStore((s) => s.saveConfig)
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

  const userLayouts = allLayouts.filter((l) => l.source === 'user')
  const sceneEntries: Array<{ id: string; label: string; icon: string }> = [
    { id: STATE.LOBBY,   label: 'Lobby',   icon: '🌐' },
    { id: STATE.DESKTOP, label: 'Desktop', icon: '🖥' },
    ...Object.values(allScenes)
      .filter((s) => s.id !== STATE.LOBBY && s.id !== STATE.DESKTOP)
      .map((s) => ({ id: s.id, label: s.label, icon: '🎬' })),
  ]

  const dirty = !isSameDraft(form, sourceConfig)

  useEffect(() => {
    if (dirty) return
    setForm((prev) => (isSameDraft(prev, sourceConfig) ? prev : structuredClone(sourceConfig)))
    setSaved(false)
  }, [dirty, sourceConfig])

  useEffect(() => () => { if (savedTimer.current) clearTimeout(savedTimer.current) }, [])

  const update = useCallback(<K extends keyof DesktopAmbianceConfig>(key: K, updater: (d: DesktopAmbianceConfig[K]) => void) => {
    setForm((prev) => {
      const next = structuredClone(prev)
      updater(next[key])
      setSaved(false)
      return next
    })
  }, [])

  const updateWidgetBehavior = useCallback((id: string, updater: (d: AmbianceWidgetBehavior) => void) => {
    update('widgetSimulation', (ws) => {
      if (!ws.behaviors[id]) ws.behaviors[id] = createDefaultWidgetBehavior(false)
      updater(ws.behaviors[id])
    })
  }, [update])

  const updateNavBehavior = useCallback((kind: 'layout' | 'scene', id: string, updater: (d: AmbianceNavBehavior) => void) => {
    update('widgetSimulation', (ws) => {
      const key = kind === 'layout' ? 'layoutBehaviors' : 'sceneBehaviors'
      if (!ws[key]) ws[key] = {}
      if (!ws[key]![id]) ws[key]![id] = createDefaultNavBehavior(false)
      updater(ws[key]![id])
    })
  }, [update])

  const enableAll = useCallback(() => {
    update('widgetSimulation', (ws) => {
      ws.enabled = true
      allApps.forEach((app) => {
        ws.behaviors[app.id] = { ...createDefaultWidgetBehavior(true), ...ws.behaviors[app.id], enabled: true }
      })
      userLayouts.forEach((l) => {
        if (!ws.layoutBehaviors) ws.layoutBehaviors = {}
        ws.layoutBehaviors[l.id] = { ...createDefaultNavBehavior(true), ...ws.layoutBehaviors?.[l.id], enabled: true }
      })
      sceneEntries.forEach((s) => {
        if (!ws.sceneBehaviors) ws.sceneBehaviors = {}
        ws.sceneBehaviors[s.id] = { ...createDefaultNavBehavior(true), ...ws.sceneBehaviors?.[s.id], enabled: true }
      })
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [update, allApps, userLayouts, sceneEntries.length])

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
  const ambiance  = runtimeDiagnostics.ambiance

  const totalEnabled =
    Object.values(simConfig.behaviors).filter((b) => b?.enabled).length +
    Object.values(simConfig.layoutBehaviors ?? {}).filter((b) => b?.enabled).length +
    Object.values(simConfig.sceneBehaviors ?? {}).filter((b) => b?.enabled).length

  const clearHistory = useCallback(() => {
    socket.emit('ambiance:history:clear')
  }, [])

  return (
    <div className="w-full max-w-none space-y-0 pt-1">
      <ConfigPageIntro title="Desktop Ambiance">
        Simulates an AI agent using the Desktop OS — opens widgets, applies layouts, and switches scenes through the Start Menu.
        Useful for hands-free streaming so you can focus on gameplay instead of managing the overlay.
      </ConfigPageIntro>

      <div className="space-y-6 pt-3">

        {/* ── Global settings ──────────────────────────────────────── */}
        <ConfigPanel title="AI Simulation" collapsible>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Toggle
                checked={simConfig.enabled}
                onChange={(checked) => update('widgetSimulation', (d) => { d.enabled = checked })}
                size="md"
                label={simConfig.enabled ? 'Active' : 'Inactive'}
              />
              {!simConfig.enabled && (
                <Button variant="secondary" size="sm" onClick={enableAll}>
                  Enable all targets
                </Button>
              )}
              {simConfig.enabled && totalEnabled === 0 && (
                <Button variant="secondary" size="sm" onClick={enableAll}>
                  Enable all targets
                </Button>
              )}
            </div>

            <Card variant="default" padding="md">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <div className="mb-1 text-xs font-medium text-[var(--color-text-secondary)]">Tick Interval</div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={simConfig.intervalSeconds}
                      min={1}
                      onChange={(e) => update('widgetSimulation', (d) => { d.intervalSeconds = Number(e.target.value) })}
                      className="w-24 rounded-[var(--radius-sm)] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-2.5 py-1.5 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-primary-500)] focus:ring-2 focus:ring-[var(--color-primary-400)]/25"
                    />
                    <span className="text-xs text-[var(--color-text-muted)]">seconds between decisions</span>
                  </div>
                </div>
                <div>
                  <div className="mb-1 text-xs font-medium text-[var(--color-text-secondary)]">Max Concurrent Widgets</div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={simConfig.maxOpenWidgets ?? 2}
                      min={1}
                      max={6}
                      onChange={(e) => update('widgetSimulation', (d) => { d.maxOpenWidgets = Math.max(1, Math.min(6, Number(e.target.value) || 2)) })}
                      className="w-24 rounded-[var(--radius-sm)] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-2.5 py-1.5 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-primary-500)] focus:ring-2 focus:ring-[var(--color-primary-400)]/25"
                    />
                    <span className="text-xs text-[var(--color-text-muted)]">widgets open at once</span>
                  </div>
                </div>
              </div>
              <div className="mt-4 space-y-4">
                <div>
                  <Slider
                    label="Second Widget Chance"
                    value={simConfig.openWhileOneOpenChance ?? 0.35}
                    min={0}
                    max={1}
                    step={0.05}
                    onChange={(val) => update('widgetSimulation', (d) => { d.openWhileOneOpenChance = val })}
                    unit="%"
                  />
                  <div className="mt-0.5 text-[10px] text-[var(--color-text-muted)]">
                    Chance to open a second widget when one is already open instead of interacting with it
                  </div>
                </div>
              </div>
            </Card>

            <div className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-muted)] pt-1">
              Feel &amp; Variation
            </div>
            <Card variant="default" padding="md" className="space-y-4">
              <div>
                <Slider
                  label="Cursor Speed"
                  value={simConfig.cursorSpeedMultiplier ?? 1.0}
                  min={0.25}
                  max={3}
                  step={0.05}
                  onChange={(val) => update('widgetSimulation', (d) => { d.cursorSpeedMultiplier = val })}
                />
                <div className="mt-0.5 text-[10px] text-[var(--color-text-muted)]">
                  Scales all cursor movement durations. 0.5 = snappy, 2.0 = deliberate. Default 1.0.
                </div>
              </div>
              <div>
                <Slider
                  label="Tick Jitter"
                  value={simConfig.tickJitterFactor ?? 0.2}
                  min={0}
                  max={0.8}
                  step={0.05}
                  onChange={(val) => update('widgetSimulation', (d) => { d.tickJitterFactor = val })}
                  unit="%"
                />
                <div className="mt-0.5 text-[10px] text-[var(--color-text-muted)]">
                  Random ±variance on the tick interval so the AI doesn't fire on a fixed schedule. 0.2 = ±20%.
                </div>
              </div>
              <div>
                <Slider
                  label="Move Jitter"
                  value={simConfig.moveJitter ?? 0.3}
                  min={0}
                  max={1}
                  step={0.05}
                  onChange={(val) => update('widgetSimulation', (d) => { d.moveJitter = val })}
                  unit="%"
                />
                <div className="mt-0.5 text-[10px] text-[var(--color-text-muted)]">
                  Per-step speed variance so each menu navigation feels slightly different. Higher = more organic.
                </div>
              </div>
              <div>
                <Slider
                  label="Pause After Action"
                  value={simConfig.pauseAfterActionMs ?? 0}
                  min={0}
                  max={5000}
                  step={100}
                  onChange={(val) => update('widgetSimulation', (d) => { d.pauseAfterActionMs = val })}
                />
                <div className="mt-0.5 text-[10px] text-[var(--color-text-muted)]">
                  Extra delay (ms) after each completed action — simulates the AI reading the result before moving on.
                </div>
              </div>
            </Card>
          </div>
        </ConfigPanel>

        {/* ── Simulation pool ───────────────────────────────────────── */}
        <ConfigPanel
          title={`Simulation Pool${totalEnabled > 0 ? ` — ${totalEnabled} active` : ''}`}
          collapsible
        >
          <div className="space-y-5">
            <div className="text-sm text-[var(--color-text-secondary)]">
              Configure which Desktop OS elements the AI can interact with each tick.
              Widgets are opened, closed, or interacted with. Layouts and scenes are selected through the Start Menu.
            </div>

            {/* Widgets */}
            {allApps.length > 0 && (
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">
                  Widgets
                </div>
                <div className="space-y-2">
                  {allApps.map((app) => (
                    <WidgetTargetCard
                      key={app.id}
                      app={app}
                      behavior={simConfig.behaviors[app.id] ?? createDefaultWidgetBehavior(false)}
                      onChange={(updater) => updateWidgetBehavior(app.id, updater)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Layouts */}
            {userLayouts.length > 0 && (
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">
                  Layouts
                </div>
                <div className="space-y-2">
                  {userLayouts.map((layout) => (
                    <NavTargetCard
                      key={layout.id}
                      icon={layout.icon || '📐'}
                      label={layout.label}
                      kind="layout"
                      behavior={simConfig.layoutBehaviors?.[layout.id] ?? createDefaultNavBehavior(false)}
                      sliderLabel="Apply Chance"
                      onChange={(updater) => updateNavBehavior('layout', layout.id, updater)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Scenes */}
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">
                Scenes
              </div>
              <div className="space-y-2">
                {sceneEntries.map((scene) => (
                  <NavTargetCard
                    key={scene.id}
                    icon={scene.icon}
                    label={scene.label}
                    kind="scene"
                    behavior={simConfig.sceneBehaviors?.[scene.id] ?? createDefaultNavBehavior(false)}
                    sliderLabel="Switch Chance"
                    onChange={(updater) => updateNavBehavior('scene', scene.id, updater)}
                  />
                ))}
              </div>
            </div>

            {allApps.length === 0 && userLayouts.length === 0 && (
              <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-default)] px-4 py-6 text-center text-sm text-[var(--color-text-muted)]">
                No widgets or layouts configured yet.
              </div>
            )}
          </div>
        </ConfigPanel>

        {/* ── Runtime diagnostics ───────────────────────────────────── */}
        <ConfigPanel title="Runtime" collapsible>
          <div className="space-y-3">
            <div className="flex items-center justify-end">
              <Button variant="secondary" size="sm" onClick={clearHistory}>
                Clear History
              </Button>
            </div>
            <Card variant="default" padding="md" className="space-y-2">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-[var(--color-text-secondary)]">Status</span>
                <span className={ambiance.enabled ? 'text-[var(--color-success-400)]' : 'text-[var(--color-text-muted)]'}>
                  {ambiance.enabled ? 'Running' : 'Stopped'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-[var(--color-text-secondary)]">Overlay leader</span>
                <span className="font-mono text-xs text-[var(--color-text-primary)]">
                  {ambiance.leaderSocketId ? ambiance.leaderSocketId.slice(0, 8) : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-[var(--color-text-secondary)]">Phase</span>
                <span className="text-[var(--color-text-primary)]">{ambiance.pendingPhase ?? 'Idle'}</span>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-[var(--color-text-secondary)]">Active targets</span>
                <span className="text-[var(--color-text-primary)]">{totalEnabled}</span>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-[var(--color-text-secondary)]">Open / max widgets</span>
                <span className="text-[var(--color-text-primary)]">{ambiance.openWidgetCount} / {ambiance.maxOpenWidgets}</span>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-[var(--color-text-secondary)]">Accepted / rejected</span>
                <span className="text-[var(--color-text-primary)]">{ambianceAcceptedCount} / {ambianceRejectedCount}</span>
              </div>
              {ambiance.lastSkipReason && (
                <div className="rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-bg-base)] px-3 py-2 text-[11px] text-[var(--color-text-muted)]">
                  Skip: {ambiance.lastSkipReason}
                </div>
              )}
              <div className="border-t border-[var(--color-border-default)] pt-2 space-y-2">
                <div className="flex items-start justify-between gap-3 text-sm">
                  <div>
                    <div className="text-[var(--color-text-secondary)]">Tick</div>
                    <div className="text-[11px] text-[var(--color-text-muted)]">{formatRelativeTime(ambiance.lastTickAt)}</div>
                  </div>
                  <div className="text-right text-[var(--color-text-primary)]">{ambiance.intervalSeconds}s</div>
                </div>
                <div className="flex items-start justify-between gap-3 text-sm">
                  <div>
                    <div className="text-[var(--color-text-secondary)]">Last action</div>
                    <div className="text-[11px] text-[var(--color-text-muted)]">{formatRelativeTime(ambiance.lastActionAt)}</div>
                  </div>
                  <div className="text-right text-[var(--color-text-primary)]">
                    {ambiance.lastAction
                      ? `${ambiance.lastAction} ${ambiance.lastActionWidgetId ?? ''}`.trim()
                      : '—'}
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </ConfigPanel>

      </div>
      <ConfigApplyBar label="Ambiance" dirty={dirty} saving={saving} saved={saved} onApply={apply} onReset={reset} alwaysShow />
    </div>
  )
}
