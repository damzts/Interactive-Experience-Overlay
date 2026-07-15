import { useEffect, useState, useCallback, useMemo } from 'react'
import { LayoutDashboard, Monitor, Layers, LayoutGrid, Image, Settings, Film, Sparkles, Plug } from 'lucide-react'
import { withDesktopConfigDefaults, getWidgetSource } from '@ieomlabs/shared'
import { socket } from '../../socket/client'
import { useAdminStore } from '../../store/useAdminStore'
import { useAuth } from '../../auth/AuthContext'
import { provideAuthToken } from '../../api/roomApi'
import { LoginModal } from '../../auth/LoginModal'
import { TopBar as NewTopBar } from '../../components/organisms'
import type { TopBarNavSection, TopBarSubItem } from '../../components/organisms'
import { useNavMemory } from '../../hooks/useNavMemory'
import { DashboardContainer } from './DashboardContainer'
import { RightPane } from './RightPane'
import type { SelectedItem } from './types'
import { itemKey } from './types'
import type { SchedulerTab } from '../scheduler/SchedulerHost'
import { SCHEDULER_TABS } from '../scheduler/SchedulerHost'

// ── Static sub-item lists ─────────────────────────────────────────────────

const INTEGRATION_SUB_ITEMS: TopBarSubItem[] = [
  { id: 'obs',        label: 'OBS',          icon: '🎬' },
  { id: 'twitch',     label: 'Twitch',        icon: '💬' },
  { id: 'pov-online', label: 'Online Rooms',  icon: '🌐' },
  { id: 'ai',         label: 'AI',            icon: '🧠' },
  { id: 'tts',        label: 'TTS',           icon: '🔊' },
  { id: 'audio',      label: 'Audio',         icon: '🎵' },
  { id: 'keybinds',   label: 'Input Engine',  icon: '⌨' },
]

const SETTINGS_SUB_ITEMS: TopBarSubItem[] = [
  { id: 'settings',   label: 'Settings',      icon: '⚙' },
  { id: 'developer',  label: 'Developer',     icon: '🛠' },
]

const GRAPHICS_SUB_ITEMS: TopBarSubItem[] = [
  { id: 'sources',  label: 'Sources',   icon: '🖼' },
  { id: 'events',   label: 'Events',    icon: '⚡' },
  { id: 'catalog',  label: 'Catalog',   icon: '📚' },
  { id: 'avatar',   label: 'Avatar',    icon: '🎭' },
]

const AMBIANCE_SUB_ITEMS: TopBarSubItem[] = SCHEDULER_TABS.map((t) => ({
  id: t.tab,
  label: t.label,
  icon: t.icon,
}))

const SEQUENCES_SUB_ITEMS: TopBarSubItem[] = [
  { id: 'sequences',  label: 'Sequences',  icon: '🎞' },
  { id: 'automation', label: 'Automation', icon: '🤖' },
]

// ── Section sets ──────────────────────────────────────────────────────────

/** Sections that always keep something selected (no empty-right-panel).
 *  Sequences is now a self-contained panel (like graphics) — not a list section. */
const LIST_SECTIONS = new Set(['scenes', 'widgets', 'layouts'])

// ── isStillValid ──────────────────────────────────────────────────────────

function isStillValid(
  item: SelectedItem,
  store: { scenes: Record<string, unknown>; applications: Array<{ id: string }>; widgetLayouts: Array<{ id: string }> },
): boolean {
  if (item.kind === 'scene')         return item.sceneState in store.scenes
  if (item.kind === 'app')           return store.applications.some((a) => a.id === item.appId)
  if (item.kind === 'widget-layout') return store.widgetLayouts.some((l) => l.id === item.layoutId)
  if (item.kind === 'sequence')      return item.sequenceId.length > 0
  return true // singletons (obs, twitch, settings, sequences-panel, etc.) are always valid
}

// ── defaultSelectedForSection ─────────────────────────────────────────────

/** The default SelectedItem when entering a section with no memory. */
function defaultSelectedForSection(section: string): SelectedItem | null {
  if (section === 'graphics')        return { kind: 'graphics' }
  if (section === 'ambiance')        return { kind: 'scheduler', tab: 'events' }
  if (section === 'sequences')       return { kind: 'sequences-panel' }
  if (section === 'integrations')    return { kind: 'obs' }
  if (section === 'settings-tab')    return { kind: 'settings' }
  // list sections: return null — NavListBox auto-select effect handles first item
  return null
}

// ── resolveSubItem ────────────────────────────────────────────────────────

/** Maps a (sectionId, subItemId) pair to the corresponding SelectedItem. */
function resolveSubItem(sectionId: string, subItemId: string): SelectedItem | null {
  switch (sectionId) {
    case 'scenes':
      return { kind: 'scene', sceneState: subItemId }
    case 'widgets':
      if (subItemId === '__new') return { kind: 'widget-create' }
      return { kind: 'app', appId: subItemId }
    case 'layouts':
      if (subItemId === '__new') return null // handled separately via addNewLayout
      return { kind: 'widget-layout', layoutId: subItemId }
    case 'graphics':
      return { kind: 'graphics', tab: subItemId as 'sources' | 'events' | 'catalog' | 'avatar' }
    case 'ambiance':
      return { kind: 'scheduler', tab: subItemId as SchedulerTab }
    case 'sequences':
      return { kind: 'sequences-panel', tab: subItemId as 'sequences' | 'automation' }
    case 'integrations':
    case 'settings-tab':
      return { kind: subItemId } as SelectedItem
    default:
      return null
  }
}

// ── Dashboard ──────────────────────────────────────────────────────────────

export function Dashboard() {
  // ─── State ───
  const [selected, setSelected] = useState<SelectedItem | null>(null)
  const [activeSection, setActiveSection] = useState('dashboard')

  // ─── Store ───
  const applications   = useAdminStore((s) => s.config.applications)
  const scenes         = useAdminStore((s) => s.config.scenes)
  const desktopConfig  = withDesktopConfigDefaults(useAdminStore((s) => s.config.desktopConfig))
  const widgetLayouts  = useAdminStore((s) => s.config.widgetLayouts ?? [])
  const patchConfig    = useAdminStore((s) => s.patchConfig)
  const saveConfig     = useAdminStore((s) => s.saveConfig)

  const systemWidgetApps = applications.filter((app) => getWidgetSource(app) === 'system')
  const userWidgetApps   = applications.filter((app) => getWidgetSource(app) === 'user')
  const userWidgetLayouts = widgetLayouts.filter((l) => l.source === 'user')

  // ─── Session memory ───
  const navMemory = useNavMemory()

  const { user, isLoginModalOpen, closeLoginModal } = useAuth()

  // ─── Auth token ───
  useEffect(() => {
    provideAuthToken().catch(() => {})
  }, [])

  // ─── Stale selection guards ───
  useEffect(() => {
    if (selected?.kind === 'app' && !applications.find((a) => a.id === selected.appId)) {
      setSelected(null)
    }
  }, [applications, selected])

  useEffect(() => {
    if (selected?.kind === 'widget-layout' && !widgetLayouts.some((l) => l.id === selected.layoutId)) {
      setSelected(null)
    }
  }, [widgetLayouts, selected])

  // ─── Build dynamic subItems ───────────────────────────────────────
  const scenesSubItems = useMemo<TopBarSubItem[]>(() => [
    ...Object.values(scenes).slice(0, 7).map((s) => ({ id: s.id, label: s.label, icon: '🎬' })),
    { id: '__new', label: 'New Scene', icon: '＋' },
  ], [scenes])

  const widgetsSubItems = useMemo<TopBarSubItem[]>(() => [
    ...[...systemWidgetApps, ...userWidgetApps].slice(0, 7).map((a) => ({ id: a.id, label: a.label, icon: '🧩' })),
    { id: '__new', label: 'New Widget', icon: '＋' },
  ], [systemWidgetApps, userWidgetApps])

  const layoutsSubItems = useMemo<TopBarSubItem[]>(() => [
    ...userWidgetLayouts.slice(0, 7).map((l) => ({ id: l.id, label: l.label, icon: l.icon || '📐' })),
    { id: '__new', label: 'New Layout', icon: '＋' },
  ], [userWidgetLayouts])

  // ─── Assemble NAV_SECTIONS with subItems ─────────────────────────
  const navSections = useMemo<TopBarNavSection[]>(() => [
    { id: 'dashboard',    label: 'Dashboard',    icon: LayoutDashboard },
    { id: 'scenes',       label: 'Scenes',       icon: Monitor,      subItems: scenesSubItems },
    { id: 'widgets',      label: 'Widgets',      icon: Layers,       subItems: widgetsSubItems },
    { id: 'layouts',      label: 'Layouts',      icon: LayoutGrid,   subItems: layoutsSubItems },
    { id: 'sequences',       label: 'Sequences',       icon: Film,         subItems: SEQUENCES_SUB_ITEMS },
    { id: 'graphics',        label: 'Graphics',        icon: Image,        subItems: GRAPHICS_SUB_ITEMS },
    { id: 'ambiance',        label: 'Ambiance',        icon: Sparkles,     subItems: AMBIANCE_SUB_ITEMS },
    { id: 'integrations',    label: 'Integrations',    icon: Plug,         subItems: INTEGRATION_SUB_ITEMS },
  ], [scenesSubItems, widgetsSubItems, layoutsSubItems])

  const endSections = useMemo<TopBarNavSection[]>(() => [
    { id: 'settings-tab', label: 'Settings', icon: Settings, subItems: SETTINGS_SUB_ITEMS },
  ], [])

  // ─── Select handler (prevents deselection in list sections) ──────
  const handleSelect = useCallback((item: SelectedItem) => {
    if (LIST_SECTIONS.has(activeSection) && selected && itemKey(item) === itemKey(selected)) {
      return // no-op — list sections always keep a selection
    }
    if (selected && itemKey(item) === itemKey(selected)) {
      setSelected(null)
    } else {
      setSelected(item)
    }
  }, [activeSection, selected])

  // ─── Activate handler ────────────────────────────────────────────
  const handleActivate = useCallback((item: SelectedItem) => {
    setSelected(item)
    if (item.kind === 'scene') {
      socket.emit('scene:change', item.sceneState)
    } else if (item.kind === 'app') {
      const app = applications.find((a) => a.id === item.appId)
      if (!app) return
      socket.emit('widget:toggle', app.id)
    } else if (item.kind === 'widget-layout') {
      socket.emit('widget:layout:apply', item.layoutId)
    }
  }, [applications])

  // ─── Top bar section navigation (with session memory recall) ─────
  const handleNavigate = useCallback((section: string) => {
    setActiveSection(section)
    const recalled = navMemory.recall(section)
    if (recalled && isStillValid(recalled, { scenes, applications, widgetLayouts })) {
      setSelected(recalled)
    } else {
      setSelected(defaultSelectedForSection(section))
    }
  }, [navMemory, scenes, applications, widgetLayouts])

  // ─── Sub-item navigation (hover menu — visual deferred to Task 1) ─
  const handleSubNavigate = useCallback((sectionId: string, subItemId: string) => {
    setActiveSection(sectionId)

    // Special cases for "New …" items
    if (subItemId === '__new') {
      if (sectionId === 'scenes') {
        const sceneId = 'SCENE_' + Date.now()
        const newScene = { id: sceneId, label: 'New Scene', backgroundOpaque: false, windows: [] }
        const nextScenes = { ...scenes, [sceneId]: newScene }
        patchConfig({ scenes: nextScenes })
        const item: SelectedItem = { kind: 'scene', sceneState: sceneId }
        setSelected(item)
        navMemory.remember(sectionId, item)
        void saveConfig({ scenes: nextScenes })
        return
      }
      if (sectionId === 'widgets') {
        const item: SelectedItem = { kind: 'widget-create' }
        setSelected(item)
        navMemory.remember(sectionId, item)
        return
      }
      if (sectionId === 'layouts') {
        // addNewLayout logic is in NavListBox — navigate there and let it handle creation
        setSelected(null)
        return
      }
    }

    const item = resolveSubItem(sectionId, subItemId)
    if (item) {
      setSelected(item)
      navMemory.remember(sectionId, item)
    }
  }, [navMemory, scenes, patchConfig, saveConfig])

  // ─── Remember selection in session memory whenever it changes ────
  // Only for sections where the user explicitly chose something.
  useEffect(() => {
    if (selected && activeSection && activeSection !== 'dashboard') {
      navMemory.remember(activeSection, selected)
    }
  }, [selected, activeSection, navMemory])

  const showDashboard = activeSection === 'dashboard'

  return (
    <div
      className="h-screen overflow-hidden bg-[var(--color-bg-base)] text-[var(--color-text-primary)]"
      data-tour="dashboard-root"
    >
      <LoginModal open={isLoginModalOpen} onClose={closeLoginModal} />

      <NewTopBar
        userName={user?.name ?? 'Admin'}
        sections={navSections}
        endSections={endSections}
        activeSection={activeSection}
        onNavigate={handleNavigate}
        onSubNavigate={handleSubNavigate}
      />

      <div
        className="absolute top-14 bottom-0 left-0 right-0 overflow-hidden"
        data-tour="main-content"
      >
        {showDashboard ? (
          <div className="h-full overflow-hidden px-4 py-3" data-tour="quick-actions">
            <DashboardContainer />
          </div>
        ) : (
          <div className="flex h-full overflow-hidden" data-tour="navigator-content">
            <RightPane
              selected={selected}
              onClose={() => setSelected(null)}
              onSelectItem={setSelected}
              activeSection={activeSection}
              onSelect={handleSelect}
              onActivate={handleActivate}
            />
          </div>
        )}
      </div>
    </div>
  )
}
