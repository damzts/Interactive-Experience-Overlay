import { useEffect, useMemo, useRef, useState } from 'react'
import { withDesktopConfigDefaults } from '@ieom/shared'
import type { WidgetLayoutDefinition, WidgetLayoutItem, WidgetLayoutSnapshot } from '@ieom/shared'
import { socket } from '../../socket/client'
import { useAdminStore } from '../../store/useAdminStore'
import { Btn, ConfigApplyBar, ConfigCard, ConfigNotice, ConfigSectionPanel, IconGlyph, isSameDraft, OverlayPreview, OverlayPreviewItem } from '../../shared/ui'
import {
  createWidgetLayoutFromCurrentState,
  createWidgetLayoutSnapshot,
  normalizeWidgetLayoutsForEditor,
} from './widgetHelpers'

// ── WidgetCanvas ──────────────────────────────────────────────────────

type Corner = 'nw' | 'ne' | 'sw' | 'se'

function WidgetCanvas({
  items,
  widgetApps,
  readonly = false,
  onChange,
}: {
  items: WidgetLayoutItem[]
  widgetApps: { id: string; label: string; icon: string }[]
  readonly?: boolean
  onChange: (widgetId: string, patch: Partial<Pick<WidgetLayoutItem, 'x' | 'y' | 'width' | 'height' | 'enabled'>>) => void
}) {
  const stageRef = useRef<HTMLDivElement>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [dragging, setDragging] = useState<{
    widgetId: string; pointerId: number
    startClientX: number; startClientY: number
    startX: number; startY: number
  } | null>(null)
  const [resizing, setResizing] = useState<{
    widgetId: string; corner: Corner; pointerId: number
    startClientX: number; startClientY: number
    startX: number; startY: number; startW: number; startH: number
  } | null>(null)
  const movedRef = useRef(false)

  const enabledItems = items.filter((i) => i.enabled)
  const selectedItem = items.find((i) => i.widgetId === selectedId) ?? null

  const getStageScale = () => {
    const rect = stageRef.current?.getBoundingClientRect()
    return rect ? { sx: 1920 / rect.width, sy: 1080 / rect.height } : { sx: 1, sy: 1 }
  }

  // ── drag (move) ──
  const onItemPointerDown = (e: React.PointerEvent<HTMLDivElement>, item: WidgetLayoutItem) => {
    if (readonly) return
    e.preventDefault(); e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    movedRef.current = false
    setSelectedId(item.widgetId)
    setDragging({ widgetId: item.widgetId, pointerId: e.pointerId, startClientX: e.clientX, startClientY: e.clientY, startX: item.x, startY: item.y })
  }
  const onItemPointerMove = (e: React.PointerEvent<HTMLDivElement>, item: WidgetLayoutItem) => {
    if (!dragging || dragging.widgetId !== item.widgetId || dragging.pointerId !== e.pointerId) return
    const { sx, sy } = getStageScale()
    const dx = (e.clientX - dragging.startClientX) * sx
    const dy = (e.clientY - dragging.startClientY) * sy
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) movedRef.current = true
    onChange(item.widgetId, {
      x: Math.max(0, Math.min(1920 - item.width,  Math.round(dragging.startX + dx))),
      y: Math.max(0, Math.min(1080 - item.height, Math.round(dragging.startY + dy))),
    })
  }
  const onItemPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragging?.pointerId !== e.pointerId) return
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
    setDragging(null)
  }

  // ── resize ──
  const onHandlePointerDown = (e: React.PointerEvent<HTMLDivElement>, item: WidgetLayoutItem, corner: Corner) => {
    if (readonly) return
    e.preventDefault(); e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    setResizing({ widgetId: item.widgetId, corner, pointerId: e.pointerId, startClientX: e.clientX, startClientY: e.clientY, startX: item.x, startY: item.y, startW: item.width, startH: item.height })
  }
  const onHandlePointerMove = (e: React.PointerEvent<HTMLDivElement>, item: WidgetLayoutItem) => {
    if (!resizing || resizing.widgetId !== item.widgetId || resizing.pointerId !== e.pointerId) return
    const { sx, sy } = getStageScale()
    const dx = (e.clientX - resizing.startClientX) * sx
    const dy = (e.clientY - resizing.startClientY) * sy
    const { corner, startX, startY, startW, startH } = resizing
    let x = startX, y = startY, w = startW, h = startH
    if (corner === 'se') { w = startW + dx; h = startH + dy }
    if (corner === 'sw') { x = startX + dx; w = startW - dx; h = startH + dy }
    if (corner === 'ne') { y = startY + dy; w = startW + dx; h = startH - dy }
    if (corner === 'nw') { x = startX + dx; y = startY + dy; w = startW - dx; h = startH - dy }
    onChange(item.widgetId, {
      x: Math.max(0, Math.round(x)),
      y: Math.max(0, Math.round(y)),
      width:  Math.max(120, Math.min(1920, Math.round(w))),
      height: Math.max(80,  Math.min(1080, Math.round(h))),
    })
  }
  const onHandlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (resizing?.pointerId !== e.pointerId) return
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
    setResizing(null)
  }

  const CORNERS: { corner: Corner; className: string }[] = [
    { corner: 'nw', className: 'top-0 left-0 cursor-nw-resize -translate-x-1/2 -translate-y-1/2' },
    { corner: 'ne', className: 'top-0 right-0 cursor-ne-resize translate-x-1/2 -translate-y-1/2' },
    { corner: 'sw', className: 'bottom-0 left-0 cursor-sw-resize -translate-x-1/2 translate-y-1/2' },
    { corner: 'se', className: 'bottom-0 right-0 cursor-se-resize translate-x-1/2 translate-y-1/2' },
  ]

  return (
    <div className="space-y-3">
      {/* Toggle buttons — all widgets */}
      <div className="flex flex-wrap gap-2">
        {items.map((item) => {
          const app = widgetApps.find((a) => a.id === item.widgetId)
          if (!app) return null
          const isSelected = selectedId === item.widgetId
          return (
            <button
              key={item.widgetId}
              type="button"
              onClick={() => {
                if (readonly) return
                onChange(item.widgetId, { enabled: !item.enabled })
                if (!item.enabled) setSelectedId(item.widgetId)
                else if (isSelected) setSelectedId(null)
              }}
              className={[
                'flex flex-col items-center gap-1 rounded-xl border px-3 py-2.5 text-center transition-colors',
                readonly
                  ? item.enabled
                    ? 'border-cyan-400/35 bg-cyan-500/10 text-cyan-300 cursor-default'
                    : 'border-zinc-700/60 bg-zinc-900/40 text-zinc-500 cursor-default'
                  : item.enabled
                    ? isSelected
                      ? 'border-cyan-400/60 bg-cyan-500/15 text-cyan-200 shadow-[0_0_0_1px_rgba(34,211,238,0.2)]'
                      : 'border-cyan-400/35 bg-cyan-500/10 text-cyan-300'
                    : 'border-zinc-700/60 bg-zinc-900/40 text-zinc-500 hover:border-zinc-600/60 hover:text-zinc-400',
              ].join(' ')}
            >
              <IconGlyph icon={app.icon} label={app.label} size={18} />
              <span className="text-[10px] font-medium leading-none">{app.label}</span>
            </button>
          )
        })}
      </div>

      {/* Preview canvas — enabled widgets only */}
      <OverlayPreview stageRef={stageRef}>
        {enabledItems.map((item) => {
          const app = widgetApps.find((a) => a.id === item.widgetId)
          if (!app) return null
          const isSelected = selectedId === item.widgetId
          const isDragging = dragging?.widgetId === item.widgetId
          return (
            <OverlayPreviewItem
              key={item.widgetId}
              x={item.x} y={item.y} width={item.width} height={item.height}
              className={[
                'rounded-lg border select-none',
                isSelected
                  ? 'border-cyan-400/60 bg-cyan-500/12 shadow-[0_0_0_1px_rgba(34,211,238,0.25)] z-10'
                  : 'border-zinc-600/50 bg-zinc-900/40',
                readonly ? 'cursor-default' : isDragging ? 'cursor-grabbing' : 'cursor-grab',
              ].join(' ')}
              onPointerDown={(e) => onItemPointerDown(e, item)}
              onPointerMove={(e) => onItemPointerMove(e, item)}
              onPointerUp={onItemPointerUp}
              onPointerCancel={onItemPointerUp}
              onClick={() => { if (!movedRef.current) setSelectedId(item.widgetId) }}
            >
              <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-1 pointer-events-none">
                <IconGlyph icon={app.icon} label={app.label} size={14} />
                <span className={`max-w-full truncate text-[9px] font-medium ${isSelected ? 'text-cyan-200' : 'text-zinc-400'}`}>{app.label}</span>
              </div>

              {/* Corner resize handles — only on selected */}
              {isSelected && CORNERS.map(({ corner, className }) => (
                <div
                  key={corner}
                  className={`absolute z-20 h-3 w-3 rounded-sm border-2 border-cyan-400 bg-zinc-900 ${className}`}
                  onPointerDown={(e) => onHandlePointerDown(e, item, corner)}
                  onPointerMove={(e) => onHandlePointerMove(e, item)}
                  onPointerUp={onHandlePointerUp}
                  onPointerCancel={onHandlePointerUp}
                />
              ))}
            </OverlayPreviewItem>
          )
        })}
        {enabledItems.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-[11px] text-zinc-600">Enable widgets above to preview their positions</div>
        )}
      </OverlayPreview>

      {/* Coordinate readout for selected widget */}
      {selectedItem?.enabled && (
        <div className="grid grid-cols-3 gap-2 text-[10px] text-zinc-500">
          <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/55 px-3 py-2">x: {Math.round(selectedItem.x)}</div>
          <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/55 px-3 py-2">y: {Math.round(selectedItem.y)}</div>
          <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/55 px-3 py-2">{Math.round(selectedItem.width)} × {Math.round(selectedItem.height)}</div>
        </div>
      )}
      <div className="text-[10px] text-zinc-600">{readonly ? 'System layout — read-only preview' : 'Click to toggle · Drag to move · Corner handles to resize'}</div>
    </div>
  )
}

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
  const [clearingOverride,  setClearingOverride]  = useState(false)
  const [clearOverrideError, setClearOverrideError] = useState<string | null>(null)
  const savedTimer       = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveDefaultTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setLayout(sourceLayout ? structuredClone(sourceLayout) : null)
    setClearingOverride(false); setClearOverrideError(null); setSaved(false)
  }, [sourceLayout])

  useEffect(() => () => {
    if (savedTimer.current) clearTimeout(savedTimer.current)
    if (saveDefaultTimer.current) clearTimeout(saveDefaultTimer.current)
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

  const applyLayout = () => {
    socket.emit('widget:layout:apply:items', layout.items)
    void persistLayout(layout)
  }

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
        onApply={() => { void applyLayout() }} onReset={() => { void restoreDefaults() }} alwaysShow />
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
          <div className="space-y-3">
            {layout.source === 'system' && <div className="text-[10px] text-zinc-500">Built-in taskbar layout. Persistent, not removable.</div>}
            <div className="flex justify-end">
              <Btn type="button" onClick={() => captureCurrentIntoLayout()} className="px-2.5 py-1 text-[10px]">Use Current</Btn>
            </div>
            <WidgetCanvas
              items={layout.items}
              widgetApps={widgetApps}
              readonly={layout.source === 'system'}
              onChange={(widgetId, patch) => updateLayout((draft) => {
                const row = draft.items.find((item) => item.widgetId === widgetId)
                if (row) Object.assign(row, patch)
              })}
            />
            <div className="text-[10px] text-zinc-600">Click a widget to toggle on/off · Drag to reposition</div>
          </div>
        </ConfigSectionPanel>
      </div>
    </div>
  )
}
