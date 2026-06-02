import { Component, useState, type ReactNode } from 'react'
import { withDesktopConfigDefaults, isSystemWidget, STATE } from '@ieom/shared'
import { useAdminStore } from '../../store/useAdminStore'
import { socket } from '../../socket/client'
import {
  Btn, ConfigCard, ConfigNotice,
  FloatingWindowShell, FloatingWindowHeader,
  IconGlyph,
} from '../../shared/ui'
import { SettingsPage } from '../settings/SettingsPage'
import { ArchivePanel } from '../archive/ArchivePanel'
import { KeybindsPage } from '../keybinds/KeybindsPage'
import { AudioPanel } from '../audio/AudioPanel'
import { AmbiancePanel } from '../ambiance/AmbiancePanel'
import { OnlineRoomsPanel } from '../pov/OnlineRoomsPanel'
import { SchedulerPanel } from '../scheduler/SchedulerPanel'
import { SceneMachinePanel } from '../scene-machine/SceneMachinePanel'
import { ObsPanel } from '../obs/ObsPanel'
import { AssetLibraryPanel } from '../asset-library/AssetLibraryPanel'
import { FeatureGate } from '../../desktop/FeatureGate'
import type { SelectedItem } from './types'
import { AppForm } from './AppForm'
import { NewWidgetForm } from './NewWidgetForm'
import { WidgetLayoutPanel } from './WidgetLayoutPanel'
import { ScenePanel, LobbyThemeEditor, DesktopThemeEditor } from './EnvEditors'
import { SocketLogConsole } from './socketLog'
import { removeWidgetFromDesktopConfig } from './widgetHelpers'

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
  if (selected.kind === 'keybinds') return <KeybindsPage />
  if (selected.kind === 'archive')  return <ArchivePanel />
  if (selected.kind === 'settings') return <SettingsPanel />
  if (selected.kind === 'asset-library') return <AssetLibraryPanel />
  if (selected.kind === 'ambiance') return <AmbiancePanel />
  if (selected.kind === 'scheduler') return <SchedulerPanel />
  if (selected.kind === 'scene-machine') return <SceneMachinePanel />
  if (selected.kind === 'obs') return <ObsPanel />
  if (selected.kind === 'pov-online') return <FeatureGate feature="stream-rooms"><OnlineRoomsPanel /></FeatureGate>

  return null
}

// ── RightPane ──────────────────────────────────────────────────────

export function RightPane({ selected, onClose, onSelectItem }: {
  selected: SelectedItem | null
  onClose: () => void
  onSelectItem: (item: SelectedItem) => void
}) {
  const currentState  = useAdminStore((s) => s.currentState)
  const setLastError  = useAdminStore((s) => s.setLastError)
  const applications  = useAdminStore((s) => s.config.applications)
  const desktopConfig = withDesktopConfigDefaults(useAdminStore((s) => s.config.desktopConfig))

  const triggerScene = (state: string) => {
    setLastError(null)
    socket.emit('scene:change', state, (err: string | null) => { if (err) setLastError(err) })
  }

  if (!selected) {
    return (
      <div className="flex-1 min-w-0 overflow-y-auto border-l border-zinc-800 bg-zinc-950/95">
          <ConfigCard className="text-left">
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Quick Read</div>
            <div className="text-[10px] text-zinc-400 leading-relaxed">
              Scene = runtime state. Application = transition signal. Widget = open desktop thing. Decoration = render-only desktop thing.
            </div>
          </ConfigCard>
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
  else if (selected.kind === 'asset-library') { headerIcon = '🗂'; headerLabel = 'Asset Library'; headerMeta = 'Utility' }
  else if (selected.kind === 'ambiance')      { headerIcon = '🌌'; headerLabel = 'Ambiance';      headerMeta = 'Engine' }
  else if (selected.kind === 'scheduler')     { headerIcon = '⏱';  headerLabel = 'Scheduler';     headerMeta = 'Engine' }
  else if (selected.kind === 'scene-machine') { headerIcon = '🔄'; headerLabel = 'Scene Machine'; headerMeta = 'Engine' }
  else if (selected.kind === 'obs')           { headerIcon = '🎬'; headerLabel = 'OBS';           headerMeta = 'Engine' }
  else if (selected.kind === 'pov-online') { headerIcon = '🌐'; headerLabel = 'Online Rooms'; headerMeta = 'Browser POV' }

  return (
    <div className="flex flex-1 min-w-0 flex-col overflow-hidden border-l border-zinc-800 bg-zinc-950/95">
      <div className="flex shrink-0 items-center gap-2 border-b border-zinc-800/80 bg-zinc-950/70 px-3 py-2.5 backdrop-blur-sm">
        <span className="text-sm shrink-0">{headerIcon}</span>
        <span className="flex-1 min-w-0">
          <span className="block text-xs font-semibold text-zinc-200 truncate">{headerLabel}</span>
          {headerMeta && <span className="block text-[10px] text-zinc-500 truncate mt-0.5">{headerMeta}</span>}
        </span>
        {actionFn && (
          <Btn onClick={actionFn} variant={isLive ? 'active' : 'default'} className="px-2.5 py-1 text-xs">
            {actionLabel}
          </Btn>
        )}
        <button onClick={onClose}
          className="ml-0.5 rounded-md border border-zinc-800/80 bg-zinc-950/60 px-2 py-0.5 text-sm leading-none text-zinc-500 transition-colors hover:border-zinc-700/80 hover:text-zinc-100">
          ×
        </button>
      </div>
      <div className="flex-1 overflow-y-auto bg-zinc-950/55 p-3">
        <RightPaneErrorBoundary>
          <RightPaneContent selected={selected} onDeleted={onClose} onSelectItem={onSelectItem} />
        </RightPaneErrorBoundary>
      </div>
    </div>
  )
}

// ── SettingsModal ──────────────────────────────────────────────────

export type SettingsTab = 'general' | 'about'

function SettingsPanel() {
  const [tab, setTab] = useState<SettingsTab>('general')
  return (
    <div className="flex flex-1 min-h-0 flex-col p-4 space-y-3">
      <div className="flex gap-1.5 rounded-xl border border-zinc-800/80 bg-zinc-950/55 p-1.5">
        {(['general', 'about'] as const).map((id) => (
          <button key={id} type="button" onClick={() => setTab(id)}
            className={'flex-1 rounded-lg border px-3 py-1.5 text-xs font-medium capitalize transition-colors ' + (
              tab === id
                ? 'border-cyan-400/35 bg-cyan-500/14 text-cyan-100'
                : 'border-transparent text-zinc-500 hover:border-zinc-700/70 hover:bg-zinc-900/75 hover:text-zinc-200'
            )}>{id}</button>
        ))}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        {tab === 'about'    && <SettingsPage mode="about" />}
        {tab === 'general'  && <SettingsPage consolePanel={<SocketLogConsole variant="settings" />} />}
      </div>
    </div>
  )
}

export function SettingsModal({ tab, onTabChange, onClose }: {
  tab: SettingsTab
  onTabChange: (tab: SettingsTab) => void
  onClose: () => void
}) {
  return (
    <FloatingWindowShell frameClassName="h-[min(760px,calc(100vh-48px))]" layerClassName="z-[55]">
      <FloatingWindowHeader icon="⚙" title="Settings" onClose={onClose} />

      <div className="flex flex-1 min-h-0 flex-col p-4 space-y-3">
        <div className="flex gap-1.5 rounded-xl border border-zinc-800/80 bg-zinc-950/55 p-1.5">
          {([
            ['general', 'General'],
            ['about', 'About'],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => onTabChange(id)}
              className={'flex-1 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ' + (
                tab === id
                  ? 'border-cyan-400/35 bg-cyan-500/14 text-cyan-100'
                  : 'border-transparent text-zinc-500 hover:border-zinc-700/70 hover:bg-zinc-900/75 hover:text-zinc-200'
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          {tab === 'about'    && <SettingsPage mode="about" />}
          {tab === 'general'  && <SettingsPage consolePanel={<SocketLogConsole variant="settings" />} />}
        </div>
      </div>
    </FloatingWindowShell>
  )
}
