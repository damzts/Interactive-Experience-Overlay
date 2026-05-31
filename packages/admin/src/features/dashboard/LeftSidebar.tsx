import { useAdminStore } from '../../store/useAdminStore'
import { STATE, withDesktopConfigDefaults, getWidgetSource } from '@ieom/shared'
import type { Application, Scene } from '@ieom/shared'
import { socket } from '../../socket/client'
import { IconGlyph } from '../../shared/ui'
import { itemKey } from './types'
import type { SelectedItem } from './types'
import { createWidgetLayoutFromCurrentState } from './widgetHelpers'

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
      className={'mb-0.5 flex w-full items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left text-xs transition-colors ' +
        (active
          ? 'border-cyan-400/30 bg-cyan-500/12 text-zinc-100'
          : 'border-zinc-900/60 bg-transparent text-zinc-500 hover:border-zinc-800/80 hover:bg-zinc-900/60 hover:text-zinc-100')}>
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
      className="mb-0.5 flex w-full items-center gap-1.5 rounded-lg border border-dashed border-zinc-800/80 px-2.5 py-1.5 text-[11px] text-zinc-500 transition-colors hover:border-cyan-500/35 hover:bg-cyan-500/8 hover:text-cyan-200">
      <span className="text-sm w-4 text-center shrink-0">+</span>
      <span>{label}</span>
    </button>
  )
}

// ── SectionLabel ───────────────────────────────────────────────────

export function SectionLabel({ children, hint: _hint, first = false }: { children: string; hint?: string; first?: boolean }) {
  return (
    <div className={first ? 'px-2.5 pt-2 mb-3' : 'mt-7 mb-3 px-2.5 pt-3 border-t-2 border-cyan-500/25'}>
      <span className="inline-flex rounded-full border border-cyan-500/40 bg-cyan-500/10 px-3 py-1 text-[9px] font-semibold uppercase tracking-[0.28em] text-cyan-200">
        {children}
      </span>
    </div>
  )
}

// ── SidebarAppIcon ─────────────────────────────────────────────────

function SidebarAppIcon({ app }: { app: Application }) {
  return <IconGlyph icon={app.icon} label={app.label} size={14} />
}

// ── LeftSidebar ────────────────────────────────────────────────────

export function LeftSidebar({ selected, onSelect, onActivate, libraryOpen, onLibrary, settingsOpen, onSettings }: {
  selected: SelectedItem | null
  onSelect: (item: SelectedItem) => void
  onActivate: (item: SelectedItem) => void
  libraryOpen: boolean
  onLibrary: () => void
  settingsOpen: boolean
  onSettings: () => void
}) {
  const currentState   = useAdminStore((s) => s.currentState)
  const saveConfig     = useAdminStore((s) => s.saveConfig)
  const applications   = useAdminStore((s) => s.config.applications)
  const scenes         = useAdminStore((s) => s.config.scenes)
  const overlayStyle   = useAdminStore((s) => s.config.overlayStyle)
  const desktopConfig  = withDesktopConfigDefaults(useAdminStore((s) => s.config.desktopConfig))
  const openWidgetIds  = useAdminStore((s) => s.openWidgetIds)

  const sceneApps        = applications.filter((a) => (a.appType ?? 'scene') === 'scene')
  const widgetApps       = applications.filter((a) => a.appType === 'widget')
  const systemWidgetApps = widgetApps.filter((app) => getWidgetSource(app) === 'system')
  const userWidgetApps   = widgetApps.filter((app) => getWidgetSource(app) === 'user')
  const decorationApps   = applications.filter((a) => a.appType === 'decoration')
  const persistedWidgetLayouts = desktopConfig.widgetLayouts ?? []
  const systemWidgetLayouts    = persistedWidgetLayouts.filter((layout) => layout.source === 'system')
  const userWidgetLayouts      = persistedWidgetLayouts.filter((layout) => layout.source === 'user')
  const orderedWidgetLayouts   = [...systemWidgetLayouts, ...userWidgetLayouts]

  const userSceneEntries: Array<{ app: Application; scene: Scene }> = []
  const seenSceneIds = new Set<string>()
  sceneApps.forEach((app) => {
    const scene = scenes[app.targetSceneId]
    if (!scene || scene.id === STATE.LOBBY || scene.id === STATE.DESKTOP || seenSceneIds.has(scene.id)) return
    seenSceneIds.add(scene.id)
    userSceneEntries.push({ app, scene })
  })

  const captureCurrentLayout = async () => {
    if (widgetApps.length === 0) return
    const nextUserLayoutNumber = userWidgetLayouts.length + 1
    const nextLayout = createWidgetLayoutFromCurrentState(`Layout ${nextUserLayoutNumber}`, widgetApps, desktopConfig, openWidgetIds)
    await saveConfig({
      desktopConfig: {
        ...desktopConfig,
        widgetLayouts: [...persistedWidgetLayouts, nextLayout],
      },
    })
    onSelect({ kind: 'widget-layout', layoutId: nextLayout.id })
  }

  const isActive = (item: SelectedItem) => selected ? itemKey(item) === itemKey(selected) : false

  return (
    <div className="flex w-52 shrink-0 flex-col border-r border-zinc-800/80 bg-zinc-950/95">
      <div className="flex-1 overflow-y-auto pb-1">

        <SectionLabel hint="Lobby, Desktop, and application-backed runtime scenes." first>Scenes</SectionLabel>
        <SidebarBtn icon="🖥" label="Lobby"
          live={currentState === STATE.LOBBY}
          active={isActive({ kind: 'env', envState: STATE.LOBBY })}
          onClick={() => onSelect({ kind: 'env', envState: STATE.LOBBY })}
          onDoubleClick={() => onActivate({ kind: 'env', envState: STATE.LOBBY })} />
        <SidebarBtn icon="💾" label="Desktop"
          live={currentState === STATE.DESKTOP}
          active={isActive({ kind: 'env', envState: STATE.DESKTOP })}
          onClick={() => onSelect({ kind: 'env', envState: STATE.DESKTOP })}
          onDoubleClick={() => onActivate({ kind: 'env', envState: STATE.DESKTOP })} />
        {userSceneEntries.length > 0 && (
          <div className="px-2.5 pt-2 pb-1 text-[9px] font-bold uppercase tracking-wider text-zinc-700">
            User Scenes
          </div>
        )}
        {userSceneEntries.map(({ app, scene }) => (
          <SidebarBtn key={scene.id} icon={<SidebarAppIcon app={app} />} label={scene.label}
            live={currentState === scene.id}
            active={isActive({ kind: 'scene', sceneState: scene.id })}
            onClick={() => onSelect({ kind: 'scene', sceneState: scene.id })}
            onDoubleClick={() => onActivate({ kind: 'scene', sceneState: scene.id })} />
        ))}
        <AddBtn label="New Scene" onClick={() => {
          const sceneId = 'SCENE_' + Date.now()
          const a: Application = {
            id: 'app-' + Date.now(),
            label: 'New App',
            icon: '🎮',
            appType: 'scene',
            targetSceneId: sceneId,
            transitionType: 'desktop-to-gameplay',
            introTransition: 'desktop-to-gameplay',
            exitTransition: 'gameplay-to-desktop',
          }
          const newScene: Scene = {
            id: sceneId,
            label: 'New App',
            backgroundOpaque: false,
            sources: [],
            style: {
              ...overlayStyle,
              background: {
                ...overlayStyle.background,
                type: 'none',
                opacity: 0,
              },
            },
          }
          saveConfig({ applications: [...applications, a], scenes: { ...scenes, [sceneId]: newScene } })
          onSelect({ kind: 'app', appId: a.id })
        }} />

        <SectionLabel hint="Desktop windows. Widgets do not change machine state.">Widgets</SectionLabel>
        {systemWidgetApps.map((app) => (
          <SidebarBtn key={app.id} icon={<SidebarAppIcon app={app} />} label={app.label}
            statusLabel={openWidgetIds.includes(app.id) ? 'OPEN' : 'CLOSED'}
            statusClassName={openWidgetIds.includes(app.id) ? 'text-cyan-300' : 'text-zinc-600'}
            active={isActive({ kind: 'app', appId: app.id })}
            onClick={() => onSelect({ kind: 'app', appId: app.id })}
            onDoubleClick={() => onActivate({ kind: 'app', appId: app.id })} />
        ))}
        <div className="px-2.5 pt-2 pb-1 text-[9px] font-bold uppercase tracking-wider text-zinc-700">
          User Widgets
        </div>
        {userWidgetApps.map((app) => (
          <SidebarBtn key={app.id} icon={<SidebarAppIcon app={app} />} label={app.label}
            statusLabel={openWidgetIds.includes(app.id) ? 'OPEN' : 'CLOSED'}
            statusClassName={openWidgetIds.includes(app.id) ? 'text-cyan-300' : 'text-zinc-600'}
            active={isActive({ kind: 'app', appId: app.id })}
            onClick={() => onSelect({ kind: 'app', appId: app.id })}
            onDoubleClick={() => onActivate({ kind: 'app', appId: app.id })} />
        ))}
        <AddBtn label="New Widget" onClick={() => onSelect({ kind: 'widget-create' })} />

        <SectionLabel hint="Desktop-only icons for environmental dressing.">Decorations</SectionLabel>
        {decorationApps.map((app) => (
          <SidebarBtn key={app.id} icon={<SidebarAppIcon app={app} />} label={app.label}
            live={false}
            active={isActive({ kind: 'app', appId: app.id })}
            onClick={() => onSelect({ kind: 'app', appId: app.id })}
            onDoubleClick={() => onActivate({ kind: 'app', appId: app.id })} />
        ))}
        <AddBtn label="New Decoration" onClick={() => {
          const a: Application = {
            id: 'decor-' + Date.now(),
            label: 'New Decoration',
            icon: '🖼',
            appType: 'decoration',
            targetSceneId: STATE.DESKTOP,
            transitionType: 'instant',
          }
          saveConfig({ applications: [...applications, a] })
          onSelect({ kind: 'app', appId: a.id })
        }} />

        <SectionLabel hint="Saved desktop window presets and focus ordering.">Widget Layouts</SectionLabel>
        {orderedWidgetLayouts.map((layout) => (
          <SidebarBtn
            key={layout.id}
            icon={layout.icon || '📐'}
            label={layout.label}
            active={isActive({ kind: 'widget-layout', layoutId: layout.id })}
            onClick={() => onSelect({ kind: 'widget-layout', layoutId: layout.id })}
            onDoubleClick={() => onActivate({ kind: 'widget-layout', layoutId: layout.id })}
          />
        ))}
        <AddBtn label="Capture Current Layout" onClick={() => { void captureCurrentLayout() }} />

        <div className="flex-1" />

        <SectionLabel hint="Auxiliary panels that are not runtime applications.">Utilities</SectionLabel>
        <SidebarBtn icon="🖥" label="Global Lobby Theme"   active={isActive({ kind: 'lobby-theme' })}   onClick={() => onSelect({ kind: 'lobby-theme' })} />
        <SidebarBtn icon="🎨" label="Global Desktop Theme" active={isActive({ kind: 'desktop-theme' })} onClick={() => onSelect({ kind: 'desktop-theme' })} />
        <SidebarBtn icon="📁" label="Archive" active={isActive({ kind: 'archive' })} onClick={() => onSelect({ kind: 'archive' })} />
        <SidebarBtn icon="🌌" label="Ambiance" active={isActive({ kind: 'ambiance' })} onClick={() => onSelect({ kind: 'ambiance' })} />
        <SidebarBtn icon="🌐" label="Online Rooms" active={isActive({ kind: 'pov-online' })} onClick={() => onSelect({ kind: 'pov-online' })} />
        <SidebarBtn icon="🗂" label="Asset Library" active={libraryOpen} onClick={onLibrary} />
        <SidebarBtn icon="⚙" label="Settings" active={settingsOpen} onClick={onSettings} />

      </div>
    </div>
  )
}
