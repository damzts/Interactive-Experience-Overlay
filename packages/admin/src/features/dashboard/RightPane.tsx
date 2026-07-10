import { Component, type ReactNode } from 'react'
import { withDesktopConfigDefaults, isSystemWidget } from '@ieomlabs/shared'
import { useAdminStore } from '../../store/useAdminStore'
import { socket } from '../../socket/client'
import {
  Btn, ConfigCard, ConfigNotice,
  IconGlyph,
} from '../../shared/ui'
import { KeybindEditor } from '../keybinds/KeybindEditor'
import { RoomsPanel } from '../pov/RoomsPanel'
import { SchedulerHost } from '../scheduler/SchedulerHost'
import { ObsPanel } from '../obs/ObsPanel'
import { AiPanel } from '../integrations/AiPanel'
import { TtsPanel } from '../integrations/TtsPanel'
import { ShowsPanel } from '../shows/ShowsPanel'
import { TwitchPanel } from '../twitch/TwitchPanel'
import { DeveloperPanel } from '../developer/DeveloperPanel'
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
import { SequencesHost } from '../sequences/SequencesHost'

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

  if (selected.kind === 'keybinds') return <KeybindEditor />
  if (selected.kind === 'settings') return <SettingsPanel />
  if (selected.kind === 'scheduler') {
    return (
      <SchedulerHost
        tab={selected.tab}
        onTabChange={(tab) => onSelectItem({ kind: 'scheduler', tab })}
        onOpenAvatar={() => onSelectItem({ kind: 'graphics', tab: 'avatar' })}
      />
    )
  }
  if (selected.kind === 'obs') return <ObsPanel />
  if (selected.kind === 'ai') return <AiPanel />
  if (selected.kind === 'tts') return <TtsPanel />
  if (selected.kind === 'shows')  return <ShowsPanel />
  if (selected.kind === 'twitch') return <TwitchPanel />
  if (selected.kind === 'developer') return <DeveloperPanel />
  if (selected.kind === 'pov-online') return <RoomsPanel />
  if (selected.kind === 'graphics') return <MediaLibraryPanel tab={selected.tab ?? 'sources'} />
  if (selected.kind === 'sequence') return <SequencesHost key={selected.sequenceId} sequenceId={selected.sequenceId} onDeleted={onDeleted} />

  return null
}

// ── Section sidebars (module-level — stable across renders) ────────

const INTEGRATION_ITEMS: Array<{ icon: string; label: string; kind: SelectedItem['kind'] }> = [
  { icon: '🎬', label: 'OBS',          kind: 'obs' },
  { icon: '💬', label: 'Twitch',       kind: 'twitch' },
  { icon: '🌐', label: 'Online Rooms', kind: 'pov-online' },
  { icon: '🧠', label: 'AI',           kind: 'ai' },
  { icon: '🔊', label: 'TTS',          kind: 'tts' },
  { icon: '⌨', label: 'Input Engine',  kind: 'keybinds' },
]

const SETTINGS_ITEMS: Array<{ icon: string; label: string; kind: SelectedItem['kind'] }> = [
  { icon: '⚙', label: 'Settings',      kind: 'settings' },
  { icon: '🛠', label: 'Developer',     kind: 'developer' },
]

// ── Sequences sub-tabs ─────────────────────────────────────────────

const SEQUENCES_TABS = [
  { id: 'sequences', icon: '🎞', label: 'Sequences' },
  { id: 'shows',     icon: '🎭', label: 'Shows' },
] as const

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
    || (activeSection === 'sequences' && selected?.kind !== 'shows')

  // ── Header metadata (only used when selected is non-null) ──────────
  let headerIcon: React.ReactNode = ''
  let headerLabel = ''
  let headerMeta  = ''
  let actionLabel = ''
  let actionFn: (() => void) | null = null
  let isLive = false

  if (selected) {
    if (selected.kind === 'scene') {
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
    } else if (selected.kind === 'keybinds')          { headerIcon = '⌨';  headerLabel = 'Input Engine';   headerMeta = 'Integration' }
    else if (selected.kind === 'settings')          { headerIcon = '⚙';  headerLabel = 'Settings';       headerMeta = 'Utility' }
    else if (selected.kind === 'obs')               { headerIcon = '🎬'; headerLabel = 'OBS';            headerMeta = 'Integration' }
    else if (selected.kind === 'pov-online')        { headerIcon = '🌐'; headerLabel = 'Online Rooms';   headerMeta = 'Browser POV' }
    else if (selected.kind === 'ai')                { headerIcon = '🧠'; headerLabel = 'AI';             headerMeta = 'Integration' }
    else if (selected.kind === 'tts')               { headerIcon = '🔊'; headerLabel = 'TTS';            headerMeta = 'Integration' }
    else if (selected.kind === 'twitch')            { headerIcon = '💬'; headerLabel = 'Twitch';         headerMeta = 'Integration' }
    else if (selected.kind === 'developer')         { headerIcon = '🛠'; headerLabel = 'Developer';      headerMeta = 'Engine' }
    else if (selected.kind === 'sequence')          { headerIcon = '🎞'; headerLabel = 'Sequence';         headerMeta = 'Effect Pipeline' }
  }

  // ── Shared section sidebars ───────────────────────────────────────
  const sidebarSection = activeSection === 'integrations'
    ? { label: 'Integrations', items: INTEGRATION_ITEMS }
    : activeSection === 'settings-tab'
      ? { label: 'Settings', items: SETTINGS_ITEMS }
      : null
  const sectionSidebar = sidebarSection ? (
    <div className="flex w-[200px] shrink-0 flex-col border-r border-[var(--color-border-default)] bg-[var(--color-bg-surface)]/60 px-3 py-4 overflow-y-auto">
      <SectionLabel first>{sidebarSection.label}</SectionLabel>
      {sidebarSection.items.map(({ icon, label, kind }) => (
        <SidebarBtn key={kind} icon={icon} label={label}
          active={selected?.kind === kind}
          onClick={() => onSelectItem({ kind } as SelectedItem)} />
      ))}
    </div>
  ) : null

  // ── Sequences sub-tabs: "Sequences" is the NavListBox flow, "Shows" swaps
  // in the ShowsPanel full-width. Derived from `selected` — no extra state.
  const sequencesTab = selected?.kind === 'shows' ? 'shows' : 'sequences'
  const sequencesTabStrip = activeSection === 'sequences' ? (
    <div className="flex shrink-0 items-center border-b border-[var(--color-border-default)] px-5">
      {SEQUENCES_TABS.map(({ id, icon, label }) => (
        <button
          key={id}
          type="button"
          onClick={() => { if (id === 'shows') onSelectItem({ kind: 'shows' }); else onClose() }}
          className={
            '-mb-px flex items-center gap-1.5 border-b-2 px-3 pb-2.5 pt-2 text-xs font-medium transition-colors ' +
            (sequencesTab === id
              ? 'border-cyan-400 text-zinc-50'
              : 'border-transparent text-zinc-500 hover:text-zinc-200')
          }
        >
          <span className="text-sm leading-none">{icon}</span>
          <span>{label}</span>
        </button>
      ))}
    </div>
  ) : null

  // ── Single return — ONE MediaLibraryProvider survives all navigation ──
  return (
    <MediaLibraryProvider>
      <div className="flex flex-1 min-w-0 flex-col overflow-hidden bg-[var(--color-bg-base)]">
        {sequencesTabStrip}
        <div className="flex flex-1 min-h-0 min-w-0 overflow-hidden">
        {showNavList && onSelect && onActivate && (
          <NavListBox selected={selected} onSelect={onSelect} onActivate={onActivate} activeSection={activeSection} />
        )}
        {sectionSidebar}

        {!selected ? (
          <div className="flex-1 min-w-0 overflow-y-auto">
            <ConfigCard className="text-left">
              {sidebarSection ? (
                <>
                  <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">{sidebarSection.label}</div>
                  <div className="text-[10px] text-zinc-400 leading-relaxed">
                    Pick an item from the left to view or configure it.
                  </div>
                </>
              ) : (
                <>
                  <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Quick Read</div>
                  <div className="text-[10px] text-zinc-400 leading-relaxed">
                    Scene = compositor content. Widget = desktop window. Desktop is the built-in boot scene.
                  </div>
                </>
              )}
            </ConfigCard>
          </div>
        ) : (
          <div className="flex flex-1 min-w-0 flex-col overflow-hidden">
            {selected.kind !== 'graphics' && selected.kind !== 'scheduler' && selected.kind !== 'shows' && (
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
                {/* No × close in Integrations/Settings — the persistent
                    sidebar (sectionSidebar) is the nav; there is nothing
                    useful to "close" back to, and doing so used to strand
                    the panel on the Events-flavored Quick Read copy. */}
                {!sidebarSection && (
                  <button onClick={onClose}
                    className="ml-1 rounded-md border border-[var(--color-danger-400)]/30 bg-[var(--color-danger-500)]/10 px-2.5 py-1 text-sm leading-none text-[var(--color-danger-400)] transition-colors hover:border-[var(--color-danger-400)]/50 hover:text-[var(--color-danger-300)]">
                    ×
                  </button>
                )}
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
      </div>
    </MediaLibraryProvider>
  )
}

