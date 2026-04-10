import { useEffect, useMemo, useRef, useState } from 'react'
import { DEFAULT_SYSTEM_WIDGET_LAYOUTS, withDesktopConfigDefaults } from '@ieom/shared'
import type { WidgetLayoutDefinition, WidgetLayoutSnapshot } from '@ieom/shared'
import { socket } from '../../socket/client'
import { useAdminStore } from '../../store/useAdminStore'
import { Btn, ConfigApplyBar, ConfigCard, ConfigNotice, ConfigSectionPanel, IconGlyph, isSameDraft } from '../ui'
import { WIDGET_HEIGHT_MAX, WIDGET_HEIGHT_MIN, WIDGET_WIDTH_MAX, WIDGET_WIDTH_MIN } from './constants'
import {
  buildWidgetLayoutItem,
  clampWidgetDimension,
  createWidgetLayoutFromCurrentState,
  createWidgetLayoutSnapshot,
  normalizeWidgetLayoutsForEditor,
} from './widgetHelpers'

// ── WidgetLayoutPanel ─────────────────────────────────────────────────

export function WidgetLayoutPanel({ layoutId, onDeleted }: { layoutId: string; onDeleted: () => void }) {
  const config               = useAdminStore((s) => s.config)
  const runtimeConfigOverride = useAdminStore((s) => s.runtimeConfigOverride)
  const saveConfig           = useAdminStore((s) => s.saveConfig)
  const openWidgetIds        = useAdminStore((s) => s.openWidgetIds)
  const desktopConfig = useMemo(() => withDesktopConfigDefaults(config.desktopConfig), [config.desktopConfig])
  const widgetApps    = useMemo(() => config.applications.filter((app) => app.appType === 'widget'), [config.applications])
  const sourceLayouts = useMemo(() => normalizeWidgetLayoutsForEditor(desktopConfig.widgetLayouts, widgetApps, desktopConfig), [desktopConfig, widgetApps])
  const sourceLayout  = useMemo(() => sourceLayouts.find((layout) => layout.id === layoutId) ?? null, [layoutId, sourceLayouts])

  const [layout,            setLayout]            = useState<WidgetLayoutDefinition | null>(sourceLayout)
  const [saving,            setSaving]            = useState(false)
  const [saved,             setSaved]             = useState(false)
  const [saveDefaultArmed,  setSaveDefaultArmed]  = useState(false)
  const [factoryResetArmed, setFactoryResetArmed] = useState(false)
  const [clearingOverride,  setClearingOverride]  = useState(false)
  const [clearOverrideError, setClearOverrideError] = useState<string | null>(null)
  const savedTimer       = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveDefaultTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const factoryResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setLayout(sourceLayout ? structuredClone(sourceLayout) : null)
    setClearingOverride(false); setClearOverrideError(null); setFactoryResetArmed(false); setSaved(false)
  }, [sourceLayout])

  useEffect(() => () => {
    if (savedTimer.current) clearTimeout(savedTimer.current)
    if (saveDefaultTimer.current) clearTimeout(saveDefaultTimer.current)
    if (factoryResetTimer.current) clearTimeout(factoryResetTimer.current)
  }, [])

  if (!sourceLayout || !layout) return <div className="text-zinc-600 text-xs italic p-4">Layout not found.</div>

  const dirty = !isSameDraft(layout, sourceLayout)
  const layoutWidgetIds = layout.items.map((item) => item.widgetId)
  const runtimeWidgetPositions = runtimeConfigOverride.desktopConfig?.widgetPositions ?? {}
  const runtimeWidgetSizes     = runtimeConfigOverride.desktopConfig?.widgetSizes ?? {}
  const runtimeWidgetZIndices  = runtimeConfigOverride.desktopConfig?.widgetZIndices ?? {}
  const hasRuntimeOverride = layoutWidgetIds.some((id) => id in runtimeWidgetPositions || id in runtimeWidgetSizes || id in runtimeWidgetZIndices)
  const activeRuntimeOverrideCount = layoutWidgetIds.filter((id) => id in runtimeWidgetPositions || id in runtimeWidgetSizes || id in runtimeWidgetZIndices).length
  const defaultSnapshot = sourceLayout.defaultConfig ? structuredClone(sourceLayout.defaultConfig) : createWidgetLayoutSnapshot(sourceLayout)
  const factorySystemLayout = sourceLayout.source === 'system'
    ? DEFAULT_SYSTEM_WIDGET_LAYOUTS.find((entry) => entry.id === sourceLayout.id)
    : undefined

  const applySnapshotToLayout = (target: WidgetLayoutDefinition, snapshot: WidgetLayoutSnapshot): WidgetLayoutDefinition => ({
    ...target, label: snapshot.label, icon: snapshot.icon, description: snapshot.description, items: structuredClone(snapshot.items),
  })

  const persistLayout = async (nextLayout: WidgetLayoutDefinition) => {
    setSaving(true)
    await saveConfig({ desktopConfig: { ...desktopConfig, widgetLayouts: sourceLayouts.map((entry) => entry.id === layoutId ? nextLayout : entry) } })
    setSaving(false)
    if (savedTimer.current) clearTimeout(savedTimer.current)
    setSaved(true)
    savedTimer.current = setTimeout(() => setSaved(false), 1500)
  }

  const reset = () => { setLayout(structuredClone(sourceLayout)); setSaveDefaultArmed(false); setSaved(false) }

  const updateLayout = (updater: (draft: WidgetLayoutDefinition) => void) => {
    setLayout((prev) => { if (!prev) return prev; const next = structuredClone(prev); updater(next); return next })
    setSaved(false)
  }

  const restoreDefaults = async () => {
    await persistLayout({ ...applySnapshotToLayout(layout, defaultSnapshot), defaultConfig: structuredClone(sourceLayout.defaultConfig ?? defaultSnapshot) })
    setSaveDefaultArmed(false)
  }

  const buildFactoryResetLayout = (): WidgetLayoutDefinition => {
    if (factorySystemLayout) {
      const [normalizedFactoryLayout] = normalizeWidgetLayoutsForEditor([factorySystemLayout], widgetApps, desktopConfig)
      if (normalizedFactoryLayout) {
        return { ...normalizedFactoryLayout, defaultConfig: structuredClone(sourceLayout.defaultConfig ?? normalizedFactoryLayout.defaultConfig) }
      }
    }
    return { ...layout, items: widgetApps.map((app, index) => buildWidgetLayoutItem(app, index, desktopConfig, false)), defaultConfig: structuredClone(sourceLayout.defaultConfig ?? defaultSnapshot) }
  }

  const performFactoryReset = async () => {
    if (!factoryResetArmed) {
      setFactoryResetArmed(true)
      if (factoryResetTimer.current) clearTimeout(factoryResetTimer.current)
      factoryResetTimer.current = setTimeout(() => setFactoryResetArmed(false), 3500)
      return
    }
    if (factoryResetTimer.current) clearTimeout(factoryResetTimer.current)
    await persistLayout(buildFactoryResetLayout())
    setFactoryResetArmed(false)
  }

  const saveCurrentAsDefault = async () => {
    if (!saveDefaultArmed) {
      setSaveDefaultArmed(true)
      if (saveDefaultTimer.current) clearTimeout(saveDefaultTimer.current)
      saveDefaultTimer.current = setTimeout(() => setSaveDefaultArmed(false), 3500)
      return
    }
    if (saveDefaultTimer.current) clearTimeout(saveDefaultTimer.current)
    await persistLayout({ ...layout, defaultConfig: createWidgetLayoutSnapshot(layout) })
    setSaveDefaultArmed(false)
  }

  const captureCurrentIntoLayout = () => {
    const nextLayout = createWidgetLayoutFromCurrentState('current', widgetApps, desktopConfig, openWidgetIds)
    updateLayout((draft) => { draft.items = nextLayout.items.map((item) => ({ ...item })) })
  }

  const deleteLayout = async () => {
    if (layout.source === 'system') return
    setSaving(true)
    await saveConfig({ desktopConfig: { ...desktopConfig, widgetLayouts: sourceLayouts.filter((entry) => entry.id !== layoutId) } })
    setSaving(false)
    onDeleted()
  }

  const applyLayout = async () => { await persistLayout(layout); socket.emit('widget:layout:apply', layoutId) }

  const clearLayoutOverride = () => {
    if (!hasRuntimeOverride || clearingOverride) return
    setClearingOverride(true)
    setClearOverrideError(null)
    socket.emit('runtime:config:override:widget-layout:clear', layoutWidgetIds, (err: string | null) => {
      setClearingOverride(false)
      if (err) { setClearOverrideError(err); return }
      setClearOverrideError(null)
    })
  }

  return (
    <div className="space-y-3">
      <ConfigApplyBar label={layout.label} dirty={dirty} saving={saving} saved={saved}
        onApply={() => { void persistLayout(layout) }} onReset={() => { void restoreDefaults() }} alwaysShow />
      <div className="space-y-0 pt-3">
        <ConfigSectionPanel label="Runtime Override" first>
          <div className="space-y-2.5">
            <div className="flex gap-2 items-start">
              <input type="text" value={layout.icon}
                onChange={(e) => updateLayout((draft) => { draft.icon = e.target.value || '📐' })}
                className="w-10 text-center font-mono text-xs" />
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-center gap-2">
                  <input type="text" value={layout.label}
                    onChange={(e) => updateLayout((draft) => { draft.label = e.target.value })}
                    className="flex-1 text-xs" placeholder="Layout label" />
                  <span className={'text-[9px] font-bold uppercase tracking-[0.16em] px-2 py-0.5 rounded-full border shrink-0 ' + (
                    layout.source === 'system' ? 'border-amber-500/30 bg-amber-500/10 text-amber-200' : 'border-cyan-500/30 bg-cyan-500/10 text-cyan-200'
                  )}>{layout.source}</span>
                </div>
                <input type="text" value={layout.description ?? ''}
                  onChange={(e) => updateLayout((draft) => { draft.description = e.target.value })}
                  className="w-full text-[11px]" placeholder="Optional description" />
              </div>
            </div>
            <ConfigCard className="space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="mt-1 text-[11px] text-zinc-200">
                    {hasRuntimeOverride ? `Active for ${activeRuntimeOverrideCount} ${activeRuntimeOverrideCount === 1 ? 'widget' : 'widgets'}` : 'No active override'}
                  </div>
                </div>
              </div>
              <div className="text-[10px] leading-relaxed text-zinc-500">
                Removes live runtime position, size, and stack-order overrides for every widget included in this layout without changing the saved layout definition.
              </div>
            </ConfigCard>
            {clearOverrideError && <ConfigNotice tone="danger">{clearOverrideError}</ConfigNotice>}
            <div className="flex gap-2">
              <Btn type="button" variant="primary" onClick={() => { void applyLayout() }} className="flex-1 px-2.5 py-1 text-[10px]">Apply</Btn>
              <Btn type="button" onClick={clearLayoutOverride} disabled={!hasRuntimeOverride || clearingOverride} className="px-2.5 py-1 text-[10px]">
                {clearingOverride ? 'Clearing Override...' : 'Clear Override'}
              </Btn>
              <Btn type="button" variant={layout.source === 'system' ? 'ghost' : 'danger'}
                onClick={() => { void deleteLayout() }} disabled={layout.source === 'system'} className="px-2.5 py-1 text-[10px]">
                {layout.source === 'system' ? 'Protected' : 'Delete'}
              </Btn>
            </div>
          </div>
        </ConfigSectionPanel>

        <ConfigSectionPanel label="Layout Configuration">
          <div className="space-y-2.5">
            {layout.source === 'system' && <div className="text-[10px] text-zinc-500">Built-in taskbar layout. Persistent, not removable.</div>}
            <div className="flex justify-end">
              <div className="flex flex-wrap justify-end gap-2">
                <Btn type="button" variant={factoryResetArmed ? 'danger' : 'ghost'} onClick={() => { void performFactoryReset() }} className="px-2.5 py-1 text-[10px]">
                  {factoryResetArmed ? 'Confirm Factory Reset' : 'Perform Factory Reset'}
                </Btn>
                <Btn type="button" onClick={() => captureCurrentIntoLayout()} className="px-2.5 py-1 text-[10px]">Use Current</Btn>
              </div>
            </div>
            <div className="space-y-1.5">
              {layout.items.map((item) => {
                const app = widgetApps.find((entry) => entry.id === item.widgetId)
                if (!app) return null
                return (
                  <div key={item.widgetId} className="rounded border border-zinc-800/80 bg-zinc-950/40 px-2 py-1.5 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <input type="checkbox" checked={item.enabled}
                        onChange={(e) => updateLayout((draft) => { const row = draft.items.find((entry) => entry.widgetId === item.widgetId); if (row) row.enabled = e.target.checked })} />
                      <div className="w-5 h-5 rounded border border-zinc-700 bg-zinc-900 flex items-center justify-center shrink-0">
                        <IconGlyph icon={app.icon} label={app.label} size={14} />
                      </div>
                      <div className="flex-1 min-w-0 text-[11px] text-zinc-200 truncate">{app.label}</div>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-[9px] uppercase tracking-wider text-zinc-500">Stack Order</span>
                        <input type="number" min={-999} max={999} value={item.focusPriority}
                          onChange={(e) => updateLayout((draft) => { const row = draft.items.find((entry) => entry.widgetId === item.widgetId); if (row) row.focusPriority = Math.max(-999, Math.min(999, Math.round(Number(e.target.value) || 0))) })}
                          className="w-14 font-mono text-[11px]" />
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-1.5">
                      {(['x', 'y', 'width', 'height'] as const).map((field) => (
                        <div key={field}>
                          <div className="text-[9px] text-zinc-500 mb-0.5 uppercase tracking-wider">{field === 'width' ? 'W' : field === 'height' ? 'H' : field.toUpperCase()}</div>
                          <input type="number"
                            min={field === 'width' ? WIDGET_WIDTH_MIN : field === 'height' ? WIDGET_HEIGHT_MIN : 0}
                            max={field === 'width' ? WIDGET_WIDTH_MAX : field === 'height' ? WIDGET_HEIGHT_MAX : undefined}
                            value={item[field]}
                            onChange={(e) => updateLayout((draft) => {
                              const row = draft.items.find((entry) => entry.widgetId === item.widgetId)
                              if (!row) return
                              const v = Number(e.target.value) || 0
                              if (field === 'width')  row.width  = clampWidgetDimension(v, WIDGET_WIDTH_MIN,  WIDGET_WIDTH_MAX,  row.width)
                              else if (field === 'height') row.height = clampWidgetDimension(v, WIDGET_HEIGHT_MIN, WIDGET_HEIGHT_MAX, row.height)
                              else row[field] = Math.max(0, Math.round(v))
                            })}
                            className="w-full font-mono text-[11px]" />
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </ConfigSectionPanel>
      </div>
    </div>
  )
}
