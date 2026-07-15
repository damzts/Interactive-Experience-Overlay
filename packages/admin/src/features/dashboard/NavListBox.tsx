import { useCallback, useEffect, useState } from 'react'
import { useAdminStore } from '../../store/useAdminStore'
import { STATE, withDesktopConfigDefaults, getWidgetSource } from '@ieomlabs/shared'
import type { Application, CaptureSource, Scene } from '@ieomlabs/shared'
import { socket } from '../../socket/client'
import { IconGlyph } from '../../shared/ui'
import { itemKey } from './types'
import type { SelectedItem } from './types'
import { createWidgetLayoutFromCurrentState } from './widgetHelpers'
import type { MediaRecord } from '../../shared/catalog'
import { useScreenSharePublisher } from '../../hooks/useScreenSharePublisher'

// ── SidebarBtn ─────────────────────────────────────────────────────

export function SidebarBtn({ icon, label, live, statusLabel, statusClassName, active, onClick, onDoubleClick }: {
  icon: React.ReactNode; label: string; live?: boolean; statusLabel?: string; statusClassName?: string; active: boolean
  onClick: () => void; onDoubleClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      title={onDoubleClick ? 'Click to configure · Double-click to activate' : undefined}
      className={'mb-1.5 flex w-full items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-left text-xs transition-all duration-150 ' +
        (active
          ? 'border-cyan-400/30 bg-cyan-500/12 text-zinc-50 shadow-[0_0_0_1px_rgba(34,211,238,0.06)]'
          : 'border-white/5 bg-white/[0.02] text-zinc-400 hover:border-cyan-400/20 hover:bg-white/[0.04] hover:text-zinc-100')}>
      <span className="text-sm w-4 h-4 flex items-center justify-center shrink-0 leading-none overflow-hidden">{icon}</span>
      <span className="flex-1 truncate font-medium">{label}</span>
      {live && <span className="text-[9px] font-bold text-emerald-400 tracking-widest shrink-0">LIVE</span>}
      {!live && statusLabel && <span className={`text-[9px] font-bold tracking-widest shrink-0 ${statusClassName ?? 'text-zinc-500'}`}>{statusLabel}</span>}
    </button>
  )
}

// ── AddBtn ─────────────────────────────────────────────────────────

export function AddBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="mb-1 flex w-full items-center gap-1.5 rounded-xl border border-dashed border-white/10 px-3 py-2 text-[11px] text-zinc-500 transition-colors hover:border-cyan-500/35 hover:bg-cyan-500/8 hover:text-cyan-200">
      <span className="text-sm w-4 text-center shrink-0">+</span>
      <span>{label}</span>
    </button>
  )
}

// ── SectionLabel ───────────────────────────────────────────────────

export function SectionLabel({ children, hint: _hint, first = false }: { children: string; hint?: string; first?: boolean }) {
  return (
    <div className={first ? 'px-2.5 pt-3 mb-3' : 'mt-6 mb-3 px-2.5 pt-3 border-t border-white/8'}>
      <span className="inline-flex rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-[9px] font-semibold uppercase tracking-[0.28em] text-cyan-200">
        {children}
      </span>
    </div>
  )
}

// ── SidebarAppIcon ─────────────────────────────────────────────────

function SidebarAppIcon({ app }: { app: Application }) {
  return <IconGlyph icon={app.icon} label={app.label} size={14} />
}

// ── MediaSection ───────────────────────────────────────────────────

export function MediaSection({ title, items, selectedId, onSelect }: {
  title: string
  items: MediaRecord[]
  selectedId?: string | null
  onSelect: (asset: MediaRecord) => void
}) {
  if (items.length === 0) return null
  const kindIcon: Record<string, string> = { image: '🖼', video: '🎬', audio: '🎵' }
  return (
    <div className="mb-1">
      <div className="mt-4 mb-2 px-2.5 border-t border-white/8 pt-3">
        <span className="inline-flex rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-[9px] font-semibold uppercase tracking-[0.28em] text-cyan-200">
          {title}
        </span>
        <span className="ml-2 text-[9px] text-zinc-600">{items.length}</span>
      </div>
      {items.map((asset) => (
        <SidebarBtn
          key={asset.id}
          icon={kindIcon[asset.kind] ?? '📄'}
          label={asset.name}
          active={selectedId === asset.id}
          onClick={() => onSelect(asset)}
          statusLabel={asset.kind.toUpperCase()}
          statusClassName="text-zinc-600"
        />
      ))}
    </div>
  )
}

// ── CaptureSidebarRow ──────────────────────────────────────────────

function CaptureSidebarRow({
  source,
  expanded,
  onToggleExpand,
  onUpdate,
  onRemove,
}: {
  source: CaptureSource
  expanded: boolean
  onToggleExpand: () => void
  onUpdate: (updated: CaptureSource) => void
  onRemove: () => void
}) {
  const { active, error, warning, start, stop } = useScreenSharePublisher(source.id, source.audio)

  return (
    <div className="mb-1.5">
      {/* collapsed / header row */}
      <SidebarBtn
        icon="🖥️"
        label={source.name || 'Unnamed source'}
        active={expanded}
        statusLabel={active ? '● Live' : undefined}
        statusClassName="text-emerald-400"
        onClick={onToggleExpand}
      />

      {/* expanded inline config */}
      {expanded && (
        <div className="mx-1 mb-2 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2.5 space-y-2.5">
          {/* name */}
          <input
            type="text"
            value={source.name}
            onChange={(e) => onUpdate({ ...source, name: e.target.value })}
            placeholder="Source name…"
            className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[11px] text-zinc-200 placeholder-zinc-600 outline-none focus:border-cyan-500/50 focus:ring-0"
          />

          {/* toggles */}
          <div className="flex flex-col gap-1.5">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={source.audio}
                onChange={(e) => onUpdate({ ...source, audio: e.target.checked })}
                className="h-3.5 w-3.5 rounded border-zinc-600 bg-zinc-800 accent-cyan-400"
              />
              <span className="text-[11px] text-zinc-400">Capture audio</span>
            </label>
          </div>

          {/* start / stop */}
          <div className="flex items-center gap-2">
            {active ? (
              <button
                type="button"
                onClick={stop}
                className="rounded-lg border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[11px] text-zinc-300 transition-colors hover:border-white/20 hover:text-white"
              >
                ⏹ Stop
              </button>
            ) : (
              <button
                type="button"
                onClick={start}
                className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1 text-[11px] text-cyan-300 transition-colors hover:border-cyan-500/50 hover:bg-cyan-500/15 hover:text-cyan-200"
              >
                🖥️ Share
              </button>
            )}
            <button
              type="button"
              onClick={onRemove}
              disabled={active}
              className="ml-auto rounded-lg border border-white/8 px-2 py-1 text-[11px] text-zinc-600 transition-colors hover:border-red-500/30 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-40"
              title="Remove source"
            >
              🗑
            </button>
          </div>

          {/* error / warning */}
          {error && (
            <div className="rounded border border-red-500/40 bg-red-500/10 px-2.5 py-1.5 text-[10px] text-red-400">
              {error}
            </div>
          )}
          {!error && warning && (
            <div className="rounded border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-[10px] text-amber-400">
              {warning}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── CaptureSourcesSection ──────────────────────────────────────────

function CaptureSourcesSection() {
  const sources    = useAdminStore((s) => s.config.captureSources ?? [])
  const patchConfig = useAdminStore((s) => s.patchConfig)
  const saveConfig  = useAdminStore((s) => s.saveConfig)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const persist = useCallback(async (next: CaptureSource[]) => {
    patchConfig({ captureSources: next })
    try {
      await saveConfig({ captureSources: next })
    } catch {
      // store already patched; silently swallow — error visible in console
    }
  }, [patchConfig, saveConfig])

  const handleUpdate = (id: string, updated: CaptureSource) => {
    void persist(sources.map((s) => (s.id === id ? updated : s)))
  }

  const handleRemove = (id: string) => {
    if (expandedId === id) setExpandedId(null)
    void persist(sources.filter((s) => s.id !== id))
  }

  const handleAdd = () => {
    const next: CaptureSource = {
      id: crypto.randomUUID(),
      name: `Source ${sources.length + 1}`,
      audio: false,
      autoStart: true,
    }
    void persist([...sources, next])
    setExpandedId(next.id)
  }

  return (
    <>
      <SectionLabel first>Capture Sources</SectionLabel>

      {sources.length === 0 && (
        <div className="px-2.5 pb-1 text-[10px] italic text-zinc-600">
          No sources. Add one below.
        </div>
      )}

      {sources.map((source) => (
        <CaptureSidebarRow
          key={source.id}
          source={source}
          expanded={expandedId === source.id}
          onToggleExpand={() => setExpandedId((prev) => (prev === source.id ? null : source.id))}
          onUpdate={(updated) => handleUpdate(source.id, updated)}
          onRemove={() => handleRemove(source.id)}
        />
      ))}

      <AddBtn label="Add Source" onClick={handleAdd} />
    </>
  )
}

// ── helpers ────────────────────────────────────────────────────────

/** Returns true if the currently selected item "belongs" to the given section. */
function selectedBelongsToSection(selected: SelectedItem | null, section: string): boolean {
  if (!selected) return false
  if (section === 'scenes')  return selected.kind === 'scene'
  if (section === 'widgets') return selected.kind === 'app' || selected.kind === 'widget-create'
  if (section === 'layouts') return selected.kind === 'widget-layout'
  return false
}

// ── NavListBox ─────────────────────────────────────────────────────

export function NavListBox({ selected, onSelect, onActivate, activeSection = 'scenes' }: {
  selected: SelectedItem | null
  onSelect: (item: SelectedItem) => void
  onActivate: (item: SelectedItem) => void
  activeSection?: string
}) {
  const currentState   = useAdminStore((s) => s.currentState)
  const saveConfig     = useAdminStore((s) => s.saveConfig)
  const patchConfig    = useAdminStore((s) => s.patchConfig)
  const applications   = useAdminStore((s) => s.config.applications)
  const scenes         = useAdminStore((s) => s.config.scenes)
  const desktopConfig  = withDesktopConfigDefaults(useAdminStore((s) => s.config.desktopConfig))
  const openWidgetIds  = useAdminStore((s) => s.openWidgetIds)

  const systemWidgetApps = applications.filter((app) => getWidgetSource(app) === 'system')
  const userWidgetApps   = applications.filter((app) => getWidgetSource(app) === 'user')
  const persistedWidgetLayouts = useAdminStore((s) => s.config.widgetLayouts ?? [])
  const userWidgetLayouts      = persistedWidgetLayouts.filter((layout) => layout.source === 'user')

  const addNewLayout = async () => {
    if (applications.length === 0) return
    const nextLayout = createWidgetLayoutFromCurrentState(`Layout ${userWidgetLayouts.length + 1}`, applications, desktopConfig, [])
    const nextLayouts = [...persistedWidgetLayouts, nextLayout]
    patchConfig({ widgetLayouts: nextLayouts })
    onSelect({ kind: 'widget-layout', layoutId: nextLayout.id })
    try {
      await saveConfig({ widgetLayouts: nextLayouts })
    } catch {
      patchConfig({ widgetLayouts: persistedWidgetLayouts })
    }
  }

  const isActive = (item: SelectedItem) => selected ? itemKey(item) === itemKey(selected) : false

  // ── Auto-select first item when entering a list section ───────────
  useEffect(() => {
    if (selectedBelongsToSection(selected, activeSection)) return

    if (activeSection === 'scenes') {
      const first = Object.values(scenes)[0]
      if (first) onSelect({ kind: 'scene', sceneState: first.id })
    } else if (activeSection === 'widgets') {
      const allApps = [...systemWidgetApps, ...userWidgetApps]
      const first = allApps[0]
      if (first) onSelect({ kind: 'app', appId: first.id })
    } else if (activeSection === 'layouts') {
      const first = userWidgetLayouts[0]
      if (first) onSelect({ kind: 'widget-layout', layoutId: first.id })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSection])

  return (
    <div className="flex w-[240px] shrink-0 flex-col border-r border-[var(--color-border-default)] bg-[var(--color-bg-surface)]/60 px-3 py-4">
      <div className="flex-1 overflow-y-auto pb-2 pr-1">

        {activeSection === 'scenes' && <>
          <CaptureSourcesSection />
          <SectionLabel>Scenes</SectionLabel>
          {Object.values(scenes)
            .map((scene) => (
              <SidebarBtn key={scene.id} icon={scene.id === STATE.DESKTOP ? '🖥' : '🎬'} label={scene.label}
                live={currentState === scene.id}
                active={isActive({ kind: 'scene', sceneState: scene.id })}
                onClick={() => onSelect({ kind: 'scene', sceneState: scene.id })}
                onDoubleClick={() => onActivate({ kind: 'scene', sceneState: scene.id })} />
            ))}
          <AddBtn label="New Scene" onClick={() => {
            const sceneId = 'SCENE_' + Date.now()
            const newScene: Scene = {
              id: sceneId, label: 'New Scene', backgroundOpaque: false, windows: [],
            }
            const nextScenes = { ...scenes, [sceneId]: newScene }
            patchConfig({ scenes: nextScenes })
            onSelect({ kind: 'scene', sceneState: sceneId })
            void saveConfig({ scenes: nextScenes })
          }} />
        </>}

        {activeSection === 'widgets' && <>
          <SectionLabel first>Widgets</SectionLabel>
          {systemWidgetApps.map((app) => (
            <SidebarBtn key={app.id} icon={<SidebarAppIcon app={app} />} label={app.label}
              statusLabel={openWidgetIds.includes(app.id) ? 'OPEN' : 'CLOSED'}
              statusClassName={openWidgetIds.includes(app.id) ? 'text-cyan-300' : 'text-zinc-600'}
              active={isActive({ kind: 'app', appId: app.id })}
              onClick={() => onSelect({ kind: 'app', appId: app.id })}
              onDoubleClick={() => onActivate({ kind: 'app', appId: app.id })} />
          ))}
          <div className="px-2.5 pt-2 pb-1 text-[9px] font-bold uppercase tracking-wider text-zinc-700">User Widgets</div>
          {userWidgetApps.map((app) => (
            <SidebarBtn key={app.id} icon={<SidebarAppIcon app={app} />} label={app.label}
              statusLabel={openWidgetIds.includes(app.id) ? 'OPEN' : 'CLOSED'}
              statusClassName={openWidgetIds.includes(app.id) ? 'text-cyan-300' : 'text-zinc-600'}
              active={isActive({ kind: 'app', appId: app.id })}
              onClick={() => onSelect({ kind: 'app', appId: app.id })}
              onDoubleClick={() => onActivate({ kind: 'app', appId: app.id })} />
          ))}
          <AddBtn label="New Widget" onClick={() => onSelect({ kind: 'widget-create' })} />
        </>}

        {activeSection === 'layouts' && <>
          <SectionLabel first>Layouts</SectionLabel>
          {userWidgetLayouts.map((layout) => (
            <SidebarBtn key={layout.id} icon={layout.icon || '📐'} label={layout.label}
              active={isActive({ kind: 'widget-layout', layoutId: layout.id })}
              onClick={() => onSelect({ kind: 'widget-layout', layoutId: layout.id })}
              onDoubleClick={() => onActivate({ kind: 'widget-layout', layoutId: layout.id })} />
          ))}
          <AddBtn label="Add New Layout" onClick={() => { void addNewLayout() }} />
        </>}

      </div>
    </div>
  )
}
