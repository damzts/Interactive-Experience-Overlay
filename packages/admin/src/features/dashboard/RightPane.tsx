import { Component, type ReactNode } from 'react'
import { withDesktopConfigDefaults, isSystemWidget, STATE } from '@ieom/shared'
import { useAdminStore } from '../../store/useAdminStore'
import { socket } from '../../socket/client'
import {
  Btn, ConfigCard, ConfigNotice,
  IconGlyph,
} from '../../shared/ui'
import { ArchivePanel } from '../archive/ArchivePanel'
import { KeybindEditor } from '../keybinds/KeybindEditor'
import { AudioPanel } from '../audio/AudioPanel'
import { AmbiancePanel } from '../ambiance/AmbiancePanel'
import { OnlineRoomsPanel } from '../pov/OnlineRoomsPanel'
import { SchedulerPanel } from '../scheduler/SchedulerPanel'
import { SceneMachinePanel } from '../scene-machine/SceneMachinePanel'
import { ObsPanel } from '../obs/ObsPanel'
import { KernelHealthPanel } from '../kernel/KernelHealthPanel'
import { AssetLibraryPanel } from '../asset-library/AssetLibraryPanel'
import { FeatureGate } from '../../desktop/FeatureGate'
import type { SelectedItem } from './types'
import { AppForm } from './AppForm'
import { NewWidgetForm } from './NewWidgetForm'
import { WidgetLayoutPanel } from './WidgetLayoutPanel'
import { ScenePanel, LobbyThemeEditor, DesktopThemeEditor } from './EnvEditors'
import { removeWidgetFromDesktopConfig } from './widgetHelpers'
import { SettingsPanel } from './SettingsPanel'
import { SidebarBtn, SectionLabel, NavListBox } from './NavListBox'

// ── RightPaneErrorBoundary ─────────────────────────────────────────

export class RightPaneErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; message: string | null }
> {
  state = { hasError: false, message: null }

  static getDerivedStateFromError(error: unknown) {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : 'Unknown dashboard error',
    }
  }

  componentDidCatch(error: unknown) {
    console.error('[admin] right pane render failed', error)
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <ConfigNotice tone="warning" className="space-y-2 px-3 py-3">
        <div className="text-[11px] font-semibold text-amber-200">This item could not be rendered safely.</div>
        {this.state.message && (
          <div className="font-mono text-[10px] text-amber-100/80">{this.state.message}</div>
        )}
        <Btn
          type="button"
          variant="warning"
          onClick={() => this.setState({ hasError: false, message: null })}
          className="px-3 py-1.5 text-[10px]"
        >
          Retry
        </Btn>
      </ConfigNotice>
    )
  }
}

// ── RightPaneContent ───────────────────────────────────────────────

function RightPaneContent({ selected, onDeleted, onSelectItem }: {
  selected: SelectedItem
  onDeleted: () => void
  onSelectItem: (item: SelectedItem) => void
}) {
  const saveConfig    = useAdminStore((s) => s.saveConfig)
  const applications  = useAdminStore((s) => s.config.applications)
  const desktopConfig = withDesktopConfigDefaults(useAdminStore((s) => s.config.desktopConfig))

  if (selected.kind === 'env') {
    const isLobby = selected.envState === STATE.LOBBY
    return (
        <ScenePanel sceneId={selected.envState} />
    )
  }

  if (selected.kind === 'scene') {
    const app = applications.find((a) => a.targetSceneId === selected.sceneState)
    return (
      <div className="space-y-5">
        <ScenePanel sceneId={selected.sceneState} />
        {app && (
          <AppForm app={app} onDelete={() => {
            saveConfig({ applications: applications.filter((a) => a.id !== app.id) })
            onDeleted()
          }} />
        )}
      </div>
    )
  }

  if (selected.kind === 'app') {
    const app = applications.find((a) => a.id === selected.appId)
    if (!app) return <div className="text-zinc-600 text-xs italic p-4">App not found.</div>

    if (app.appType === 'widget') {
      return (
        <AppForm app={app} onDelete={() => {
          if (isSystemWidget(app)) return
          saveConfig({
            applications: applications.filter((a) => a.id !== selected.appId),
            desktopConfig: removeWidgetFromDesktopConfig(desktopConfig, app.id),
          })
          onDeleted()
        }} />
      )
    }

    if (app.appType === 'decoration') {
      return (
        <AppForm app={app} onDelete={() => {
          saveConfig({ applications: applications.filter((a) => a.id !== selected.appId) })
          onDeleted()
        }} />
      )
    }

    return null
  }

  if (selected.kind === 'widget-create') {
    return <NewWidgetForm onCreated={(appId) => onSelectItem({ kind: 'app', appId })} />
  }

  if (selected.kind === 'widget-layout') {
    return <WidgetLayoutPanel layoutId={selected.layoutId} onDeleted={onDeleted} />
  }

  if (selected.kind === 'lobby-theme')   return <LobbyThemeEditor />
  if (selected.kind === 'desktop-theme') return <DesktopThemeEditor />
  if (selected.kind === 'audio')    return <AudioPanel />
  if (selected.kind === 'keybinds') return <KeybindEditor />
  if (selected.kind === 'archive')  return <ArchivePanel />
  if (selected.kind === 'settings') return <SettingsPanel />
  if (selected.kind === 'ambiance') return <AmbiancePanel />
  if (selected.kind === 'scheduler') return <SchedulerPanel />
  if (selected.kind === 'scene-machine') return <SceneMachinePanel />
  if (selected.kind === 'obs') return <ObsPanel />
  if (selected.kind === 'kernel-health') return <KernelHealthPanel />
  if (selected.kind === 'pov-online') return <FeatureGate feature="stream-rooms"><OnlineRoomsPanel /></FeatureGate>
  if (selected.kind === 'asset-catalog')     return <AssetLibraryPanel tab="catalog" />
  if (selected.kind === 'asset-events')      return <AssetLibraryPanel tab="events" />
  if (selected.kind === 'asset-sources')     return <AssetLibraryPanel tab="sources" />
  if (selected.kind === 'asset-transitions') return <AssetLibraryPanel tab="transitions" />
  if (selected.kind === 'asset-library')     return <AssetLibraryPanel tab="catalog" />

  return null
}

// ── SystemSidebar ──────────────────────────────────────────────────

const SYSTEM_ITEMS: Array<{ icon: string; label: string; kind: SelectedItem['kind'] }> = [
  { icon: '🌐', label: 'Online Rooms',       kind: 'pov-online' },
  { icon: '🖥', label: 'Global Lobby Theme', kind: 'lobby-theme' },
  { icon: '🎨', label: 'Global Desktop Theme', kind: 'desktop-theme' },
  { icon: '🔄', label: 'Scene Machine',      kind: 'scene-machine' },
  { icon: '⏱', label: 'Scheduler',          kind: 'scheduler' },
  { icon: '🎬', label: 'OBS',               kind: 'obs' },
  { icon: '🌌', label: 'Ambiance',           kind: 'ambiance' },
  { icon: '📁', label: 'Archive',            kind: 'archive' },
  { icon: '🔊', label: 'Audio Engine',       kind: 'audio' },
  { icon: '⌨', label: 'Input Engine',       kind: 'keybinds' },
  { icon: '⚙', label: 'Kernel Health',      kind: 'kernel-health' },
  { icon: '⚙', label: 'Settings',           kind: 'settings' },
]

// ── RightPane ──────────────────────────────────────────────────────

export function RightPane({ selected, onClose, onSelectItem, onSelect, onActivate, activeSection }: {
  selected: SelectedItem | null
  onClose: () => void
  onSelectItem: (item: SelectedItem) => void
  onSelect?: (item: SelectedItem) => void
  onActivate?: (item: SelectedItem) => void
  activeSection?: string
}) {
  const currentState  = useAdminStore((s) => s.currentState)
  const setLastError  = useAdminStore((s) => s.setLastError)
  const applications  = useAdminStore((s) => s.config.applications)
  const desktopConfig = withDesktopConfigDefaults(useAdminStore((s) => s.config.desktopConfig))

  const triggerScene = (state: string) => {
    setLastError(null)
    socket.emit('scene:change', state, (err: string | null) => { if (err) setLastError(err) })
  }

  const showNavList = activeSection === 'scenes' || activeSection === 'widgets'

  const ASSET_TABS: Array<{ kind: SelectedItem['kind']; icon: string; label: string }> = [
    { kind: 'asset-catalog',     icon: '🗂', label: 'Catalog' },
    { kind: 'asset-events',      icon: '⚡', label: 'Events' },
    { kind: 'asset-sources',     icon: '📺', label: 'Sources' },
    { kind: 'asset-transitions', icon: '✨', label: 'Transitions' },
  ]

  if (!selected) {
    return (
      <div className="flex flex-1 min-w-0 overflow-hidden bg-[var(--color-bg-base)]">
        {showNavList && onSelect && onActivate && (
          <NavListBox selected={selected} onSelect={onSelect} onActivate={onActivate} activeSection={activeSection} />
        )}
        {activeSection === 'media' && (
          <div className="flex w-[200px] shrink-0 flex-col border-r border-[var(--color-border-default)] bg-[var(--color-bg-surface)]/60 px-3 py-4 overflow-y-auto">
            <SectionLabel first>Media</SectionLabel>
            {ASSET_TABS.map(({ kind, icon, label }) => (
              <SidebarBtn key={kind} icon={icon} label={label} active={selected?.kind === kind} onClick={() => onSelectItem({ kind } as SelectedItem)} />
            ))}
          </div>
        )}
        {activeSection === 'system' && (
          <div className="flex w-[200px] shrink-0 flex-col border-r border-[var(--color-border-default)] bg-[var(--color-bg-surface)]/60 px-3 py-4 overflow-y-auto">
            <SectionLabel first>System</SectionLabel>
            {SYSTEM_ITEMS.map(({ icon, label, kind }) => (
              <SidebarBtn key={kind} icon={icon} label={label}
                active={false}
                onClick={() => onSelectItem({ kind } as SelectedItem)} />
            ))}
          </div>
        )}
        <div className="flex-1 min-w-0 overflow-y-auto">
          <ConfigCard className="text-left">
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Quick Read</div>
            <div className="text-[10px] text-zinc-400 leading-relaxed">
              Scene = runtime state. Application = transition signal. Widget = open desktop thing. Decoration = render-only desktop thing.
            </div>
          </ConfigCard>
        </div>
      </div>
    )
  }

  // Build header info
  let headerIcon: React.ReactNode = ''
  let headerLabel = ''
  let headerMeta = ''
  let actionLabel = ''
  let actionFn: (() => void) | null = null
  let isLive = false

  if (selected.kind === 'env') {
    headerIcon  = selected.envState === STATE.LOBBY ? '🖥' : '💾'
    headerLabel = selected.envState === STATE.LOBBY ? 'Lobby' : 'Desktop'
    headerMeta  = 'Scene'
    isLive      = currentState === selected.envState
    actionLabel = isLive ? '● Live' : '▶ Go Live'
    actionFn    = () => triggerScene(selected.envState)
  } else if (selected.kind === 'scene') {
    const app   = applications.find((a) => a.targetSceneId === selected.sceneState)
    headerIcon  = app ? <IconGlyph icon={app.icon} label={app.label} /> : '🎮'
    headerLabel = app?.label ?? selected.sceneState
    headerMeta  = 'Scene'
    isLive      = currentState === selected.sceneState
    actionLabel = isLive ? '● Live' : '▶ Go Live'
    actionFn    = () => triggerScene(selected.sceneState)
  } else if (selected.kind === 'app') {
    const app   = applications.find((a) => a.id === selected.appId)
    headerIcon  = app ? <IconGlyph icon={app.icon} label={app.label} /> : '🎮'
    headerLabel = app?.label ?? 'Application'
    headerMeta  = app?.appType === 'widget' ? 'Widget' : 'Decoration'
    actionLabel = app?.appType === 'widget' ? '▶ Open' : ''
  } else if (selected.kind === 'widget-create') {
    headerIcon  = '+'
    headerLabel = 'New Widget'
    headerMeta  = 'User Widget Creator'
  } else if (selected.kind === 'widget-layout') {
    const layout = (desktopConfig.widgetLayouts ?? []).find((entry) => entry.id === selected.layoutId)
    headerIcon  = layout?.icon ?? '📐'
    headerLabel = layout?.label ?? 'Widget Layout'
    headerMeta  = layout?.source === 'system' ? 'System Layout' : 'User Layout'
  } else if (selected.kind === 'lobby-theme') {
    headerIcon  = '🖥'
    headerLabel = 'Lobby Theme'
    headerMeta  = 'Utility'
  } else if (selected.kind === 'desktop-theme') {
    headerIcon  = '🎨'
    headerLabel = 'Desktop Theme'
    headerMeta  = 'Utility'
  } else if (selected.kind === 'audio')    { headerIcon = '🔊'; headerLabel = 'Audio Engine'; headerMeta = 'Engine' }
  else if (selected.kind === 'keybinds')   { headerIcon = '⌨';  headerLabel = 'Input Engine'; headerMeta = 'Engine' }
  else if (selected.kind === 'archive')    { headerIcon = '📁'; headerLabel = 'Archive';       headerMeta = 'Utility' }
  else if (selected.kind === 'settings')   { headerIcon = '⚙';  headerLabel = 'Settings';      headerMeta = 'Utility' }
  else if (selected.kind === 'asset-library' || selected.kind === 'asset-catalog') { headerIcon = '🗂'; headerLabel = 'Catalog';     headerMeta = 'Asset Library' }
  else if (selected.kind === 'asset-events')      { headerIcon = '⚡'; headerLabel = 'Events';      headerMeta = 'Asset Library' }
  else if (selected.kind === 'asset-sources')     { headerIcon = '📺'; headerLabel = 'Sources';     headerMeta = 'Asset Library' }
  else if (selected.kind === 'asset-transitions') { headerIcon = '✨'; headerLabel = 'Transitions'; headerMeta = 'Asset Library' }
  else if (selected.kind === 'ambiance')      { headerIcon = '🌌'; headerLabel = 'Ambiance';      headerMeta = 'Engine' }
  else if (selected.kind === 'scheduler')     { headerIcon = '⏱';  headerLabel = 'Scheduler';     headerMeta = 'Engine' }
  else if (selected.kind === 'scene-machine') { headerIcon = '🔄'; headerLabel = 'Scene Machine'; headerMeta = 'Engine' }
  else if (selected.kind === 'obs')           { headerIcon = '🎬'; headerLabel = 'OBS';           headerMeta = 'Engine' }
  else if (selected.kind === 'kernel-health') { headerIcon = '⚙';  headerLabel = 'Kernel Health'; headerMeta = 'Engine' }
  else if (selected.kind === 'pov-online') { headerIcon = '🌐'; headerLabel = 'Online Rooms'; headerMeta = 'Browser POV' }

  return (
    <div className="flex flex-1 min-w-0 overflow-hidden bg-[var(--color-bg-base)]">
      {showNavList && onSelect && onActivate && (
        <NavListBox selected={selected} onSelect={onSelect} onActivate={onActivate} activeSection={activeSection} />
      )}
      {activeSection === 'media' && (
        <div className="flex w-[200px] shrink-0 flex-col border-r border-[var(--color-border-default)] bg-[var(--color-bg-surface)]/60 px-3 py-4 overflow-y-auto">
          <SectionLabel first>Media</SectionLabel>
          {ASSET_TABS.map(({ kind, icon, label }) => (
            <SidebarBtn key={kind} icon={icon} label={label} active={selected?.kind === kind} onClick={() => onSelectItem({ kind } as SelectedItem)} />
          ))}
        </div>
      )}
      {activeSection === 'system' && (
        <div className="flex w-[200px] shrink-0 flex-col border-r border-[var(--color-border-default)] bg-[var(--color-bg-surface)]/60 px-3 py-4 overflow-y-auto">
          <SectionLabel first>System</SectionLabel>
          {SYSTEM_ITEMS.map(({ icon, label, kind }) => (
            <SidebarBtn key={kind} icon={icon} label={label}
              active={selected?.kind === kind}
              onClick={() => onSelectItem({ kind } as SelectedItem)} />
          ))}
        </div>
      )}
      <div className="flex flex-1 min-w-0 flex-col overflow-hidden">
        <div className="flex shrink-0 items-center gap-3 border-b border-[var(--color-border-default)] bg-[var(--color-bg-surface)]/70 px-5 py-3 backdrop-blur-sm">
          <span className="text-sm shrink-0">{headerIcon}</span>
          <span className="flex-1 min-w-0">
            <span className="block text-xs font-semibold text-[var(--color-text-primary)] truncate">{headerLabel}</span>
            {headerMeta && <span className="block text-[10px] text-[var(--color-text-muted)] truncate mt-0.5">{headerMeta}</span>}
          </span>
          {actionFn && (
            <Btn onClick={actionFn} variant={isLive ? 'active' : 'default'} className="px-3 py-1.5 text-xs">
              {actionLabel}
            </Btn>
          )}
          <button onClick={onClose}
            className="ml-1 rounded-md border border-[var(--color-danger-400)]/30 bg-[var(--color-danger-500)]/10 px-2.5 py-1 text-sm leading-none text-[var(--color-danger-400)] transition-colors hover:border-[var(--color-danger-400)]/50 hover:text-[var(--color-danger-300)]">
            ×
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          <RightPaneErrorBoundary>
            <RightPaneContent selected={selected} onDeleted={onClose} onSelectItem={onSelectItem} />
          </RightPaneErrorBoundary>
        </div>
      </div>
    </div>
  )
}

