import { useEffect, useMemo, useRef, useState } from 'react'
import { withDesktopConfigDefaults } from '@ieom/shared'
import type { WidgetLayoutDefinition, WidgetLayoutItem } from '@ieom/shared'
import { socket } from '../../socket/client'
import { useAdminStore } from '../../store/useAdminStore'
import { Btn, ConfigApplyBar, ConfigSectionPanel, IconGlyph, isSameDraft, OverlayCanvas } from '../../shared/ui'
import { normalizeWidgetLayoutsForEditor } from './widgetHelpers'

// ── WidgetCanvas ──────────────────────────────────────────────────────

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
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const enabledItems = items.filter((i) => i.enabled)
  const selectedItem = items.find((i) => i.widgetId === selectedId) ?? null

  return (
    <div className="space-y-4">
      {/* Toggle buttons */}
      <div className="flex flex-wrap gap-2">
        {items.map((item) => {
          const app = widgetApps.find((a) => a.id === item.widgetId)
          if (!app) return null
          const isSelected = selectedId === item.widgetId
          return (
            <button key={item.widgetId} type="button"
              onClick={() => {
                if (readonly) return
                onChange(item.widgetId, { enabled: !item.enabled })
                if (!item.enabled) setSelectedId(item.widgetId)
                else if (isSelected) setSelectedId(null)
              }}
              className={['flex flex-col items-center gap-1 rounded-xl border px-3 py-2.5 text-center transition-colors',
                readonly ? item.enabled ? 'border-cyan-400/35 bg-cyan-500/10 text-cyan-300 cursor-default' : 'border-zinc-700/60 bg-zinc-900/40 text-zinc-500 cursor-default'
                  : item.enabled ? isSelected ? 'border-cyan-400/60 bg-cyan-500/15 text-cyan-200 shadow-[0_0_0_1px_rgba(34,211,238,0.2)]' : 'border-cyan-400/35 bg-cyan-500/10 text-cyan-300'
                    : 'border-zinc-700/60 bg-zinc-900/40 text-zinc-500 hover:border-zinc-600/60 hover:text-zinc-400',
              ].join(' ')}
            >
              <IconGlyph icon={app.icon} label={app.label} size={18} />
              <span className="text-[10px] font-medium leading-none">{app.label}</span>
            </button>
          )
        })}
      </div>

      <OverlayCanvas
        items={enabledItems.map((i) => ({ id: i.widgetId, x: i.x, y: i.y, width: i.width, height: i.height }))}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onChange={readonly ? undefined : (id, patch) => onChange(id, patch)}
        readonly={readonly}
        emptyMessage="Enable widgets above to preview their positions"
        renderItem={(canvasItem, isSelected) => {
          const app = widgetApps.find((a) => a.id === canvasItem.id)
          if (!app) return null
          return (
            <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-1 pointer-events-none">
              <IconGlyph icon={app.icon} label={app.label} size={14} />
              <span className={`max-w-full truncate text-[9px] font-medium ${isSelected ? 'text-cyan-200' : 'text-zinc-400'}`}>{app.label}</span>
            </div>
          )
        }}
      />

      {selectedItem?.enabled && (
        <div className="grid grid-cols-3 gap-2 text-[10px] text-zinc-500">
          <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/55 px-5 py-4">x: {Math.round(selectedItem.x)}</div>
          <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/55 px-5 py-4">y: {Math.round(selectedItem.y)}</div>
          <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/55 px-5 py-4">{Math.round(selectedItem.width)} × {Math.round(selectedItem.height)}</div>
        </div>
      )}
      <div className="text-[10px] text-zinc-600">{readonly ? 'System layout — read-only preview' : 'Click to toggle · Drag to move · Corner handles to resize'}</div>
    </div>
  )
}

// ── WidgetLayoutPanel ─────────────────────────────────────────────────

export function WidgetLayoutPanel({ layoutId, onDeleted }: { layoutId: string; onDeleted: () => void }) {
  const config               = useAdminStore((s) => s.config)
  const saveConfig           = useAdminStore((s) => s.saveConfig)
  const desktopConfig = useMemo(() => withDesktopConfigDefaults(config.desktopConfig), [config.desktopConfig])
  const widgetApps    = useMemo(() => config.applications.filter((app) => app.appType === 'widget'), [config.applications])
  const sourceLayouts = useMemo(() => normalizeWidgetLayoutsForEditor(desktopConfig.widgetLayouts, widgetApps, desktopConfig), [desktopConfig, widgetApps])
  const sourceLayout  = useMemo(() => sourceLayouts.find((layout) => layout.id === layoutId) ?? null, [layoutId, sourceLayouts])

  const [layout,  setLayout]  = useState<WidgetLayoutDefinition | null>(sourceLayout)
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setLayout(sourceLayout ? structuredClone(sourceLayout) : null)
    setSaved(false)
  }, [sourceLayout])

  useEffect(() => () => {
    if (savedTimer.current) clearTimeout(savedTimer.current)
  }, [])

  if (!sourceLayout || !layout) return <div className="text-zinc-600 text-xs italic p-4">Layout not found.</div>

  const dirty = !isSameDraft(layout, sourceLayout)
  const persistLayout = async (nextLayout: WidgetLayoutDefinition) => {
    setSaving(true)
    await saveConfig({ desktopConfig: { ...desktopConfig, widgetLayouts: sourceLayouts.map((entry) => entry.id === layoutId ? nextLayout : entry) } })
    setSaving(false)
    if (savedTimer.current) clearTimeout(savedTimer.current)
    setSaved(true)
    savedTimer.current = setTimeout(() => setSaved(false), 1500)
  }

  const updateLayout = (updater: (draft: WidgetLayoutDefinition) => void) => {
    setLayout((prev) => { if (!prev) return prev; const next = structuredClone(prev); updater(next); return next })
    setSaved(false)
  }

  const deleteLayout = async () => {
    if (layout.source === 'system') return
    setSaving(true)
    await saveConfig({ desktopConfig: { ...desktopConfig, widgetLayouts: sourceLayouts.filter((entry) => entry.id !== layoutId) } })
    setSaving(false)
    onDeleted()
  }

  return (
    <div className="space-y-4">
      <ConfigApplyBar label={layout.label} dirty={dirty} saving={saving} saved={saved}
        onApply={() => void persistLayout(layout)} onReset={() => setLayout(structuredClone(sourceLayout))} alwaysShow />
      <div style={{display:'flex',flexDirection:'column',gap:'1.25rem',paddingTop:'1rem'}}>
        <ConfigSectionPanel label="Layout Configuration" first>
          <div className="space-y-4">
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

            {layout.source === 'system' && <div className="text-[10px] text-zinc-500">Built-in layout — read-only.</div>}

            <WidgetCanvas
              items={layout.items}
              widgetApps={widgetApps}
              readonly={layout.source === 'system'}
              onChange={(widgetId, patch) => updateLayout((draft) => {
                const row = draft.items.find((item) => item.widgetId === widgetId)
                if (row) Object.assign(row, patch)
              })}
            />

            <Btn type="button" variant="primary" onClick={() => socket.emit('widget:layout:apply', layout.id)} className="w-full px-2.5 py-1 text-[10px]">
              Test Layout
            </Btn>

            {layout.source !== 'system' && (
              <Btn type="button" variant="danger" onClick={() => { void deleteLayout() }} className="w-full px-2.5 py-1 text-[10px]">
                Delete Layout
              </Btn>
            )}
          </div>
        </ConfigSectionPanel>
      </div>
    </div>
  )
}
