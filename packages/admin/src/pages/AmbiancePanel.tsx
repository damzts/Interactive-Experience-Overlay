import { useCallback, useEffect, useRef, useState } from 'react'
import { useAdminStore } from '../store/useAdminStore'
import { withDesktopAmbianceDefaults, type DesktopAmbianceConfig, type Application } from '@ieom/shared'
import { Panel, Toggle, Slider, isSameDraft, IconGlyph, ConfigApplyBar } from '../components/ui'

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
    <div className="border border-zinc-700/80 rounded-lg p-3">
      <div className="flex items-center gap-2 mb-3">
        <IconGlyph icon={app.icon} label={app.label} />
        <span className="text-xs font-medium text-zinc-300">{app.label}</span>
        <div className="flex-1" />
        <Toggle
          checked={behavior.enabled}
          onChange={(checked) => onChange((d) => { d.enabled = checked })}
          label={behavior.enabled ? 'Enabled' : 'Disabled'}
        />
      </div>
      {behavior.enabled && (
        <div className="space-y-2">
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
        </div>
      )}
    </div>
  )
}

export function AmbiancePanel() {
  const allApps      = useAdminStore((s) => s.config.applications)
  const sourceConfig = useAdminStore((s) => withDesktopAmbianceDefaults(s.config.desktopAmbiance))
  const saveConfig   = useAdminStore((s) => s.saveConfig)

  const [form, setForm] = useState<DesktopAmbianceConfig>(() => structuredClone(sourceConfig))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const dirty = !isSameDraft(form, sourceConfig)

  useEffect(() => {
    setForm(structuredClone(sourceConfig))
    setSaved(false)
  }, [sourceConfig])

  const update = useCallback(<K extends keyof DesktopAmbianceConfig>(key: K, updater: (d: DesktopAmbianceConfig[K]) => void, autoSave?: boolean) => {
    setForm((prev) => {
      const next = structuredClone(prev)
      updater(next[key])
      if (autoSave) {
        setSaving(true)
        saveConfig({ desktopAmbiance: next }).then(() => {
          setSaving(false)
          setSaved(true)
          if (savedTimer.current) clearTimeout(savedTimer.current)
          savedTimer.current = setTimeout(() => setSaved(false), 1500)
        })
      } else {
        setSaved(false)
      }
      return next
    })
  }, [saveConfig])
  
  const updateBehavior = useCallback((widgetId: string, updater: (d: DesktopAmbianceConfig['widgetSimulation']['behaviors'][string]) => void) => {
    update('widgetSimulation', (ws) => {
      if (!ws.behaviors[widgetId]) {
        ws.behaviors[widgetId] = { enabled: false, openChance: 0.1, closeChance: 0.1 }
      }
      updater(ws.behaviors[widgetId])
    }, true)
  }, [update])

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

  const widgetApps = allApps.filter((app) => app.appType === 'widget')
  const simConfig = form.widgetSimulation

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-zinc-200">Desktop Ambiance</h2>
      <div className="text-xs text-zinc-400 max-w-prose">
        Configure background AI simulations to make the desktop feel more alive and dynamic.
        This system can perform actions automatically, like opening and closing widgets.
      </div>
      <ConfigApplyBar label="Ambiance Settings" dirty={dirty} saving={saving} saved={saved} onApply={apply} onReset={reset} />
      <Panel title="Widget Simulation">
        <div className="space-y-4">
          <Toggle
            checked={simConfig.enabled}
            onChange={(checked) => update('widgetSimulation', (d) => { d.enabled = checked }, true)}
            label="Enable Widget Simulation"
          />
          {simConfig.enabled && (
            <div className="pl-4 border-l border-zinc-700 space-y-4">
              <div>
                <div className="text-xs text-zinc-400 mb-1">Evaluation Interval</div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={simConfig.intervalSeconds}
                    onChange={(e) => update('widgetSimulation', (d) => { d.intervalSeconds = Number(e.target.value) }, true)}
                    className="w-24 text-sm"
                    min={1}
                  />
                  <span className="text-xs text-zinc-500">seconds</span>
                </div>
                <div className="text-[10px] text-zinc-600 mt-1">
                  How often the AI should consider performing an action.
                </div>
              </div>
              <div>
                <div className="text-xs text-zinc-400 mb-2">Widget Behaviors</div>
                <div className="space-y-2">
                  {widgetApps.map((app) => (
                    <WidgetBehaviorEditor
                      key={app.id}
                      app={app}
                      behavior={simConfig.behaviors[app.id] ?? { enabled: false, openChance: 0.1, closeChance: 0.1 }}
                      onChange={(updater) => updateBehavior(app.id, updater)}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </Panel>
    </div>
  )
}
