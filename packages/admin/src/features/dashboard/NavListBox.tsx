import { useAdminStore } from '../../store/useAdminStore'
import { STATE, withDesktopConfigDefaults, getWidgetSource } from '@ieomlabs/shared'
import type { Application, Scene } from '@ieomlabs/shared'
import { socket } from '../../socket/client'
import { IconGlyph } from '../../shared/ui'
import { itemKey } from './types'
import type { SelectedItem } from './types'
import { createWidgetLayoutFromCurrentState } from './widgetHelpers'
import type { AssetRecord } from '../../shared/catalog'

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

// ── AssetSection ───────────────────────────────────────────────────

export function AssetSection({ title, items, selectedId, onSelect }: {
  title: string
  items: AssetRecord[]
  selectedId?: string | null
  onSelect: (asset: AssetRecord) => void
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

// ── NavListBox ─────────────────────────────────────────────────────

export function NavListBox({ selected, onSelect, onActivate, activeSection = 'scenes' }: {
  selected: SelectedItem | null
  onSelect: (item: SelectedItem) => void
  onActivate: (item: SelectedItem) => void
  activeSection?: string
}) {
  const currentState   = useAdminStore((s) => s.currentState)
  const saveConfig     = useAdminStore((s) => s.saveConfig)
  const applications   = useAdminStore((s) => s.config.applications)
  const scenes         = useAdminStore((s) => s.config.scenes)
  const desktopConfig  = withDesktopConfigDefaults(useAdminStore((s) => s.config.desktopConfig))
  const openWidgetIds  = useAdminStore((s) => s.openWidgetIds)

  const systemWidgetApps = applications.filter((app) => getWidgetSource(app) === 'system')
  const userWidgetApps   = applications.filter((app) => getWidgetSource(app) === 'user')
  const persistedWidgetLayouts = useAdminStore((s) => s.config.widgetLayouts ?? [])
  const systemWidgetLayouts    = persistedWidgetLayouts.filter((layout) => layout.source === 'system')
  const userWidgetLayouts      = persistedWidgetLayouts.filter((layout) => layout.source === 'user')
  const orderedWidgetLayouts   = [...systemWidgetLayouts, ...userWidgetLayouts]

  const captureCurrentLayout = async () => {
    if (applications.length === 0) return
    const nextUserLayoutNumber = userWidgetLayouts.length + 1
    const nextLayout = createWidgetLayoutFromCurrentState(`Layout ${nextUserLayoutNumber}`, applications, desktopConfig, openWidgetIds)
    await saveConfig({
      widgetLayouts: [...persistedWidgetLayouts, nextLayout],
    })
    onSelect({ kind: 'widget-layout', layoutId: nextLayout.id })
  }

  const isActive = (item: SelectedItem) => selected ? itemKey(item) === itemKey(selected) : false

  return (
    <div className="flex w-[240px] shrink-0 flex-col border-r border-[var(--color-border-default)] bg-[var(--color-bg-surface)]/60 px-3 py-4">
      <div className="flex-1 overflow-y-auto pb-2 pr-1">

        {activeSection === 'scenes' && <>
          <SectionLabel first>Runtimes</SectionLabel>
          <SidebarBtn icon="🌐" label="Lobby"
            live={currentState === STATE.LOBBY}
            active={isActive({ kind: 'env', envState: STATE.LOBBY })}
            onClick={() => onSelect({ kind: 'env', envState: STATE.LOBBY })}
            onDoubleClick={() => onActivate({ kind: 'env', envState: STATE.LOBBY })} />
          <SidebarBtn icon="🖥" label="Desktop"
            live={currentState === STATE.DESKTOP}
            active={isActive({ kind: 'env', envState: STATE.DESKTOP })}
            onClick={() => onSelect({ kind: 'env', envState: STATE.DESKTOP })}
            onDoubleClick={() => onActivate({ kind: 'env', envState: STATE.DESKTOP })} />

          <SectionLabel>Scenes</SectionLabel>
          {Object.values(scenes)
            .filter((s) => s.id !== STATE.LOBBY && s.id !== STATE.DESKTOP)
            .map((scene) => (
              <SidebarBtn key={scene.id} icon="🎬" label={scene.label}
                live={currentState === scene.id}
                active={isActive({ kind: 'scene', sceneState: scene.id })}
                onClick={() => onSelect({ kind: 'scene', sceneState: scene.id })}
                onDoubleClick={() => onActivate({ kind: 'scene', sceneState: scene.id })} />
            ))}
          <AddBtn label="New Scene" onClick={async () => {
            const sceneId = 'SCENE_' + Date.now()
            const newScene: Scene = {
              id: sceneId, label: 'New Scene', backgroundOpaque: false, sources: [],
            }
            await saveConfig({ scenes: { ...scenes, [sceneId]: newScene } })
            onSelect({ kind: 'scene', sceneState: sceneId })
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

          <SectionLabel>Widget Layouts</SectionLabel>
          {orderedWidgetLayouts.map((layout) => (
            <SidebarBtn key={layout.id} icon={layout.icon || '📐'} label={layout.label}
              active={isActive({ kind: 'widget-layout', layoutId: layout.id })}
              onClick={() => onSelect({ kind: 'widget-layout', layoutId: layout.id })}
              onDoubleClick={() => onActivate({ kind: 'widget-layout', layoutId: layout.id })} />
          ))}
          <AddBtn label="Capture Current Layout" onClick={() => { void captureCurrentLayout() }} />
        </>}


      </div>
    </div>
  )
}
