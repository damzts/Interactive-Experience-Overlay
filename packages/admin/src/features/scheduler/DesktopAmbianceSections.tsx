import { useCallback } from 'react'
import type { AmbianceNavBehavior, AmbianceWidgetBehavior, DesktopAmbianceConfig, Application } from '@ieomlabs/shared'
import { ConfigCard, IconGlyph, Toggle, Slider, Btn } from '../../shared/ui'

// ── Defaults ──────────────────────────────────────────────────────

export function createDefaultWidgetBehavior(enabled = false): AmbianceWidgetBehavior {
  return { enabled, openChance: 0.18, closeChance: 0.12, interactChance: 0.65 }
}

export function createDefaultNavBehavior(enabled = false): AmbianceNavBehavior {
  return { enabled, selectChance: 0.2 }
}

// ── Helpers ───────────────────────────────────────────────────────

function TypeBadge({ kind }: { kind: 'widget' | 'layout' | 'scene' }) {
  const styles: Record<string, string> = {
    widget: 'bg-cyan-500/15 text-cyan-300',
    layout: 'bg-violet-500/15 text-violet-300',
    scene:  'bg-emerald-500/15 text-emerald-300',
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
    <ConfigCard className="p-3">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/8 bg-black/20">
          <IconGlyph icon={app.icon} label={app.label} size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[11px] font-semibold text-zinc-200">{app.label}</span>
            <TypeBadge kind="widget" />
          </div>
        </div>
        <Toggle
          checked={behavior.enabled}
          onChange={(checked) => onChange((d) => { d.enabled = checked })}
        />
      </div>
      {behavior.enabled && (
        <div className="mt-2.5 space-y-1 border-t border-white/8 pt-2.5">
          <Slider label="Open" value={behavior.openChance} min={0} max={1} step={0.05}
            onChange={(v) => onChange((d) => { d.openChance = v })} />
          <Slider label="Close" value={behavior.closeChance} min={0} max={1} step={0.05}
            onChange={(v) => onChange((d) => { d.closeChance = v })} />
          <Slider label="Interact" value={behavior.interactChance ?? 0.65} min={0} max={1} step={0.05}
            onChange={(v) => onChange((d) => { d.interactChance = v })} />
        </div>
      )}
    </ConfigCard>
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
    <ConfigCard className="p-3">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/8 bg-black/20 text-sm">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[11px] font-semibold text-zinc-200">{label}</span>
            <TypeBadge kind={kind} />
          </div>
        </div>
        <Toggle
          checked={behavior.enabled}
          onChange={(checked) => onChange((d) => { d.enabled = checked })}
        />
      </div>
      {behavior.enabled && (
        <div className="mt-2.5 border-t border-white/8 pt-2.5">
          <Slider label={sliderLabel} value={behavior.selectChance} min={0} max={1} step={0.05}
            onChange={(v) => onChange((d) => { d.selectChance = v })} />
        </div>
      )}
    </ConfigCard>
  )
}

// ── Shared types ──────────────────────────────────────────────────

export type AmbianceUpdater = <K extends keyof DesktopAmbianceConfig>(
  key: K,
  updater: (d: DesktopAmbianceConfig[K]) => void,
) => void

// ── Widget ambiance (engine settings + per-widget behaviors) ──────

export function WidgetAmbianceSection({
  form,
  update,
  allApps,
  onEnableAll,
  showEnableAll,
}: {
  form: DesktopAmbianceConfig
  update: AmbianceUpdater
  allApps: Application[]
  onEnableAll: () => void
  showEnableAll: boolean
}) {
  const simConfig = form.widgetSimulation

  const updateWidgetBehavior = useCallback((id: string, updater: (d: AmbianceWidgetBehavior) => void) => {
    update('widgetSimulation', (ws) => {
      if (!ws.behaviors[id]) ws.behaviors[id] = createDefaultWidgetBehavior(false)
      updater(ws.behaviors[id])
    })
  }, [update])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-semibold text-zinc-200">Engine settings</div>
          <div className="text-[10px] text-zinc-500 mt-0.5">
            Tuning for the shared tick loop that drives widget, layout, and scene interaction. The master
            switch above turns the whole engine on or off.
          </div>
        </div>
        {showEnableAll && (
          <Btn variant="default" onClick={onEnableAll} className="shrink-0">Enable all targets</Btn>
        )}
      </div>

      <Slider
        label="Tick interval"
        value={simConfig.intervalSeconds}
        min={1}
        max={300}
        step={1}
        unit="s"
        onChange={(v) => update('widgetSimulation', (d) => { d.intervalSeconds = v })}
      />

      <Slider
        label="Max open widgets"
        value={simConfig.maxOpenWidgets ?? 2}
        min={1}
        max={6}
        step={1}
        onChange={(v) => update('widgetSimulation', (d) => { d.maxOpenWidgets = Math.max(1, Math.min(6, v)) })}
      />

      <Slider
        label="Second widget chance"
        value={simConfig.openWhileOneOpenChance ?? 0.35}
        min={0}
        max={1}
        step={0.05}
        onChange={(v) => update('widgetSimulation', (d) => { d.openWhileOneOpenChance = v })}
      />

      <div className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Feel &amp; variation</div>

      <Slider
        label="Cursor speed"
        value={simConfig.cursorSpeedMultiplier ?? 1.0}
        min={0.25}
        max={3}
        step={0.05}
        onChange={(v) => update('widgetSimulation', (d) => { d.cursorSpeedMultiplier = v })}
      />

      <Slider
        label="Tick jitter"
        value={simConfig.tickJitterFactor ?? 0.2}
        min={0}
        max={0.8}
        step={0.05}
        onChange={(v) => update('widgetSimulation', (d) => { d.tickJitterFactor = v })}
      />

      <Slider
        label="Move jitter"
        value={simConfig.moveJitter ?? 0.3}
        min={0}
        max={1}
        step={0.05}
        onChange={(v) => update('widgetSimulation', (d) => { d.moveJitter = v })}
      />

      <Slider
        label="Pause after action"
        value={simConfig.pauseAfterActionMs ?? 0}
        min={0}
        max={5000}
        step={100}
        unit="ms"
        onChange={(v) => update('widgetSimulation', (d) => { d.pauseAfterActionMs = v })}
      />

      <div className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Widgets</div>

      {allApps.length === 0 ? (
        <div className="text-xs text-zinc-600 italic px-1">No widgets configured.</div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {allApps.map((app) => (
            <WidgetTargetCard
              key={app.id}
              app={app}
              behavior={simConfig.behaviors[app.id] ?? createDefaultWidgetBehavior(false)}
              onChange={(updater) => updateWidgetBehavior(app.id, updater)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function LayoutAmbianceSection({
  form,
  update,
  userLayouts,
}: {
  form: DesktopAmbianceConfig
  update: AmbianceUpdater
  userLayouts: Array<{ id: string; label: string; icon?: string }>
}) {
  const simConfig = form.widgetSimulation

  const updateNavBehavior = useCallback((id: string, updater: (d: AmbianceNavBehavior) => void) => {
    update('widgetSimulation', (ws) => {
      if (!ws.layoutBehaviors) ws.layoutBehaviors = {}
      if (!ws.layoutBehaviors[id]) ws.layoutBehaviors[id] = createDefaultNavBehavior(false)
      updater(ws.layoutBehaviors[id])
    })
  }, [update])

  if (userLayouts.length === 0) {
    return <div className="text-xs text-zinc-600 italic px-1">No layouts configured.</div>
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {userLayouts.map((layout) => (
        <NavTargetCard
          key={layout.id}
          icon={layout.icon || '📐'}
          label={layout.label}
          kind="layout"
          behavior={simConfig.layoutBehaviors?.[layout.id] ?? createDefaultNavBehavior(false)}
          sliderLabel="Apply chance"
          onChange={(updater) => updateNavBehavior(layout.id, updater)}
        />
      ))}
    </div>
  )
}

export function SceneAmbianceSection({
  form,
  update,
  sceneEntries,
}: {
  form: DesktopAmbianceConfig
  update: AmbianceUpdater
  sceneEntries: Array<{ id: string; label: string; icon: string }>
}) {
  const simConfig = form.widgetSimulation

  const updateNavBehavior = useCallback((id: string, updater: (d: AmbianceNavBehavior) => void) => {
    update('widgetSimulation', (ws) => {
      if (!ws.sceneBehaviors) ws.sceneBehaviors = {}
      if (!ws.sceneBehaviors[id]) ws.sceneBehaviors[id] = createDefaultNavBehavior(false)
      updater(ws.sceneBehaviors[id])
    })
  }, [update])

  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {sceneEntries.map((scene) => (
        <NavTargetCard
          key={scene.id}
          icon={scene.icon}
          label={scene.label}
          kind="scene"
          behavior={simConfig.sceneBehaviors?.[scene.id] ?? createDefaultNavBehavior(false)}
          sliderLabel="Switch chance"
          onChange={(updater) => updateNavBehavior(scene.id, updater)}
        />
      ))}
    </div>
  )
}

