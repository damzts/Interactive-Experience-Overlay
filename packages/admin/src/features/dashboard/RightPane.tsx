import { Component, type ReactNode } from 'react'
import { withDesktopConfigDefaults, isSystemWidget, STATE } from '@ieomlabs/shared'
import { useAdminStore } from '../../store/useAdminStore'
import { socket } from '../../socket/client'
import { LobbyRuntimePanel } from './LobbyRuntimePanel'
import { DesktopRuntimePanel } from './DesktopRuntimePanel'
import {
  Btn, ConfigCard, ConfigNotice,
  IconGlyph,
} from '../../shared/ui'
import { KeybindEditor } from '../keybinds/KeybindEditor'
import { AudioPanel } from '../audio/AudioPanel'
import { OnlineRoomsPanel } from '../pov/OnlineRoomsPanel'
import { SchedulerPanel } from '../scheduler/SchedulerPanel'
import { ObsPanel } from '../obs/ObsPanel'
import { KernelHealthPanel } from '../kernel/KernelHealthPanel'
import { AutomationPanel } from '../automation/AutomationPanel'
import { ShowsPanel } from '../shows/ShowsPanel'
import { TwitchPanel } from '../twitch/TwitchPanel'
import { PresetsPanel } from '../presets/PresetsPanel'
import { MediaLibraryPanel } from '../media-library/MediaLibraryPanel'
import { MediaLibraryProvider } from '../media-library/MediaLibraryContext'
import type { SelectedItem } from './types'
import { AppForm } from './AppForm'
import { NewWidgetForm } from './NewWidgetForm'
import { WidgetLayoutPanel } from './WidgetLayoutPanel'
import { ScenePanel } from './ScenePanel'
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

  if (selected.kind === 'env') {
    return selected.envState === STATE.LOBBY
      ? <LobbyRuntimePanel />
      : <DesktopRuntimePanel />
  }

  if (selected.kind === 'scene') {
    return <ScenePanel sceneId={selected.sceneState} onDeleted={onDeleted} />
  }

  if (selected.kind === 'app') {
    const app = applications.find((a) => a.id === selected.appId)
    if (!app) return <div className="text-zinc-600 text-xs italic p-4">App not found.</div>

    return (
      <AppForm app={app} onDelete={() => {
        if (isSystemWidget(app)) return
        saveConfig({ applications: applications.filter((a) => a.id !== selected.appId) })
        onDeleted()
      }} />
    )
  }

  if (selected.kind === 'widget-create') {
    return <NewWidgetForm onCreated={(appId) => onSelectItem({ kind: 'app', appId })} />
  }

  if (selected.kind === 'widget-layout') {
    return <WidgetLayoutPanel key={selected.layoutId} layoutId={selected.layoutId} onDeleted={onDeleted} />
  }

  if (selected.kind === 'audio')    return <AudioPanel />
  if (selected.kind === 'keybinds') return <KeybindEditor />
  if (selected.kind === 'settings') return <SettingsPanel />
  if (selected.kind === 'scheduler') return <SchedulerPanel />
if (selected.kind === 'obs') return <ObsPanel />
  if (selected.kind === 'kernel-health') return <KernelHealthPanel />
  if (selected.kind === 'automation') return <AutomationPanel />
  if (selected.kind === 'shows')  return <ShowsPanel />
  if (selected.kind === 'twitch') return <TwitchPanel />
  if (selected.kind === 'presets') return <PresetsPanel />
  if (selected.kind === 'pov-online') return <OnlineRoomsPanel />
  if (selected.kind === 'media-gallery')     return <MediaLibraryPanel tab="catalog" />
  if (selected.kind === 'media-effects')     return <MediaLibraryPanel tab="events" />
  if (selected.kind === 'media-renders')     return <MediaLibraryPanel tab="sources" />
  if (selected.kind === 'media-transitions') return <MediaLibraryPanel tab="transitions" />

  return null
}

// ── Media tabs (module-level — stable across renders) ──────────────

const MEDIA_TABS: Array<{ kind: SelectedItem['kind']; icon: string; label: string }> = [
  { kind: 'media-gallery',     icon: '🖼', label: 'Gallery' },
  { kind: 'media-effects',     icon: '⚡', label: 'Effects' },
  { kind: 'media-renders',     icon: '📺', label: 'Renders' },
  { kind: 'media-transitions', icon: '✨', label: 'Transitions' },
]

// ── SystemSidebar ──────────────────────────────────────────────────

const SYSTEM_ITEMS: Array<{ icon: string; label: string; kind: SelectedItem['kind'] }> = [
  { icon: '🌐', label: 'Online Rooms',       kind: 'pov-online' },
{ icon: '⏱', label: 'Scheduler',          kind: 'scheduler' },
  { icon: '🎬', label: 'OBS',               kind: 'obs' },
  { icon: '🔊', label: 'Audio Engine',       kind: 'audio' },
  { icon: '⌨', label: 'Input Engine',       kind: 'keybinds' },
  { icon: '⚙', label: 'Kernel Health',      kind: 'kernel-health' },
  { icon: '🤖', label: 'Automation',        kind: 'automation' },
  { icon: '🎭', label: 'Show Sequencer',    kind: 'shows' },
  { icon: '💬', label: 'Twitch Integration', kind: 'twitch' },
  { icon: '💾', label: 'Presets',            kind: 'presets' },
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
  const scenes        = useAdminStore((s) => s.config.scenes)
  const applications  = useAdminStore((s) => s.config.applications)
  const widgetLayouts = useAdminStore((s) => s.config.widgetLayouts ?? [])
  const openWidgetIds = useAdminStore((s) => s.openWidgetIds)
  const triggerScene  = (state: string) => {
    setLastError(null)
    socket.emit('scene:change', state, (err: string | null) => { if (err) setLastError(err) })
  }

  const showNavList = activeSection === 'scenes' || activeSection === 'widgets' || activeSection === 'layouts'

  // ── Header metadata (only used when selected is non-null) ──────────
  let headerIcon: React.ReactNode = ''
  let headerLabel = ''
  let headerMeta  = ''
  let actionLabel = ''
  let actionFn: (() => void) | null = null
  let isLive = false

  if (selected) {
    if (selected.kind === 'env') {
      headerIcon  = selected.envState === STATE.LOBBY ? '🖥' : '💾'
      headerLabel = selected.envState === STATE.LOBBY ? 'Lobby' : 'Desktop'
      headerMeta  = 'Scene'
      isLive      = currentState === selected.envState
      actionLabel = isLive ? '● Live' : '▶ Go Live'
      actionFn    = () => triggerScene(selected.envState)
    } else if (selected.kind === 'scene') {
      const app   = applications.find((a) => a.targetSceneId === selected.sceneState)
      const scene = scenes[selected.sceneState]
      headerIcon  = app ? <IconGlyph icon={app.icon} label={app.label} /> : '🎮'
      headerLabel = app?.label ?? scene?.label ?? selected.sceneState
      headerMeta  = 'Scene'
      isLive      = currentState === selected.sceneState
      actionLabel = isLive ? '● Live' : '▶ Go Live'
      actionFn    = () => triggerScene(selected.sceneState)
    } else if (selected.kind === 'app') {
      const app    = applications.find((a) => a.id === selected.appId)
      headerIcon   = app ? <IconGlyph icon={app.icon} label={app.label} /> : '🎮'
      headerLabel  = app?.label ?? 'Widget'
      headerMeta   = 'Widget'
      const isOpen = app ? openWidgetIds.includes(app.id) : false
      actionLabel  = isOpen ? '● Open' : '▶ Open'
      actionFn     = app ? () => socket.emit('widget:toggle', app.id) : null
    } else if (selected.kind === 'widget-create') {
      headerIcon = '+'; headerLabel = 'New Widget'; headerMeta = 'User Widget Creator'
    } else if (selected.kind === 'widget-layout') {
      const layout = widgetLayouts.find((entry) => entry.id === selected.layoutId)
      headerIcon  = layout?.icon ?? '📐'
      headerLabel = layout?.label ?? 'Widget Layout'
      headerMeta  = layout?.source === 'system' ? 'System Layout' : 'User Layout'
      actionLabel = '▶ Test'
      actionFn    = () => socket.emit('widget:layout:apply', selected.layoutId)
    } else if (selected.kind === 'lobby-theme')    { headerIcon = '🖥'; headerLabel = 'Lobby Theme';    headerMeta = 'Utility' }
    else if (selected.kind === 'desktop-theme')     { headerIcon = '🎨'; headerLabel = 'Desktop Theme';  headerMeta = 'Utility' }
    else if (selected.kind === 'audio')             { headerIcon = '🔊'; headerLabel = 'Audio Engine';   headerMeta = 'Engine' }
    else if (selected.kind === 'keybinds')          { headerIcon = '⌨';  headerLabel = 'Input Engine';   headerMeta = 'Engine' }
    else if (selected.kind === 'settings')          { headerIcon = '⚙';  headerLabel = 'Settings';       headerMeta = 'Utility' }
    else if (selected.kind === 'scheduler')         { headerIcon = '⏱';  headerLabel = 'Scheduler';      headerMeta = 'Engine' }
    else if (selected.kind === 'obs')               { headerIcon = '🎬'; headerLabel = 'OBS';            headerMeta = 'Engine' }
    else if (selected.kind === 'kernel-health')     { headerIcon = '⚙';  headerLabel = 'Kernel Health';  headerMeta = 'Engine' }
    else if (selected.kind === 'automation')        { headerIcon = '🤖'; headerLabel = 'Automation';     headerMeta = 'Engine' }
    else if (selected.kind === 'pov-online')        { headerIcon = '🌐'; headerLabel = 'Online Rooms';   headerMeta = 'Browser POV' }
    else if (selected.kind === 'shows')             { headerIcon = '🎭'; headerLabel = 'Show Sequencer'; headerMeta = 'Engine' }
    else if (selected.kind === 'twitch')            { headerIcon = '💬'; headerLabel = 'Twitch Integration'; headerMeta = 'Engine' }
    else if (selected.kind === 'presets')            { headerIcon = '💾'; headerLabel = 'Presets';           headerMeta = 'System' }
    else {
      const mediaTab = MEDIA_TABS.find((t) => t.kind === selected.kind)
      if (mediaTab) { headerIcon = mediaTab.icon; headerLabel = mediaTab.label; headerMeta = 'Media Library' }
    }
  }

  // ── Shared section sidebars ───────────────────────────────────────
  const systemSidebar = activeSection === 'system' ? (
    <div className="flex w-[200px] shrink-0 flex-col border-r border-[var(--color-border-default)] bg-[var(--color-bg-surface)]/60 px-3 py-4 overflow-y-auto">
      <SectionLabel first>Manager</SectionLabel>
      {SYSTEM_ITEMS.map(({ icon, label, kind }) => (
        <SidebarBtn key={kind} icon={icon} label={label}
          active={selected?.kind === kind}
          onClick={() => onSelectItem({ kind } as SelectedItem)} />
      ))}
    </div>
  ) : null

  // ── Single return — ONE MediaLibraryProvider survives all navigation ──
  return (
    <MediaLibraryProvider>
      <div className="flex flex-1 min-w-0 overflow-hidden bg-[var(--color-bg-base)]">
        {showNavList && onSelect && onActivate && (
          <NavListBox selected={selected} onSelect={onSelect} onActivate={onActivate} activeSection={activeSection} />
        )}
        {systemSidebar}

        {!selected ? (
          <div className="flex-1 min-w-0 overflow-y-auto">
            <ConfigCard className="text-left">
              <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Quick Read</div>
              <div className="text-[10px] text-zinc-400 leading-relaxed">
                Scene = compositor content. Widget = desktop window. Runtime = lifecycle manager (Lobby, Desktop).
              </div>
            </ConfigCard>
          </div>
        ) : (
          <div className="flex flex-1 min-w-0 flex-col overflow-hidden">
            {!MEDIA_TABS.some((t) => t.kind === selected.kind) && (
              <div className="flex shrink-0 items-center gap-3 border-b border-[var(--color-border-default)] bg-[var(--color-bg-surface)]/70 px-5 py-3 backdrop-blur-sm">
                <span className="text-sm shrink-0">{headerIcon}</span>
                <span className="flex-1 min-w-0">
                  <span className="block text-xs font-semibold text-[var(--color-text-primary)] truncate">{headerLabel}</span>
                  {headerMeta && <span className="block text-[10px] text-[var(--color-text-muted)] truncate mt-0.5">{headerMeta}</span>}
                </span>
                {selected.kind === 'widget-layout' && (() => {
                  const layout = widgetLayouts.find((l) => l.id === selected.layoutId)
                  return layout?.source !== 'system' ? (
                    <button
                      onClick={async () => {
                        await useAdminStore.getState().saveConfig({ widgetLayouts: widgetLayouts.filter((l) => l.id !== selected.layoutId) })
                        onClose()
                      }}
                      className="rounded-md border border-[var(--color-danger-400)]/30 bg-[var(--color-danger-500)]/10 px-2.5 py-1 text-xs text-[var(--color-danger-400)] transition-colors hover:border-[var(--color-danger-400)]/50 hover:text-[var(--color-danger-300)]">
                      Delete
                    </button>
                  ) : null
                })()}
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
            )}
            <div className="flex-1 overflow-y-auto p-5">
              <RightPaneErrorBoundary>
                <RightPaneContent selected={selected} onDeleted={onClose} onSelectItem={onSelectItem} />
              </RightPaneErrorBoundary>
            </div>
          </div>
        )}
      </div>
    </MediaLibraryProvider>
  )
}

