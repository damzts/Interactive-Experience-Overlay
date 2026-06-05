import { useEffect, useState, useCallback } from 'react'
import { LayoutDashboard, Monitor, Layers, Image, Settings } from 'lucide-react'
import { withDesktopConfigDefaults } from '@ieom/shared'
import { socket } from '../../socket/client'
import { useAdminStore } from '../../store/useAdminStore'
import { useAuth } from '../../auth/AuthContext'
import { Sidebar as LeftSidebar, TopBar as NewTopBar } from '../../components/organisms'
import type { SidebarSection } from '../../components/organisms'
import { DashboardContainer } from './DashboardContainer'
import { useSidebarPersistence } from '../../hooks/useSidebarPersistence'
import { useBreakpoint } from '../../hooks/useBreakpoint'
import { RightPane } from './RightPane'
import type { SelectedItem } from './types'
import { itemKey } from './types'

// ── Navigation sections for the new Sidebar ────────────────────────────────

const NAV_SECTIONS: SidebarSection[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'scenes', label: 'Scenes', icon: Monitor },
  { id: 'widgets', label: 'Widgets', icon: Layers },
  { id: 'media', label: 'Media', icon: Image },
  { id: 'system', label: 'System', icon: Settings },
]

// ── Dashboard ──────────────────────────────────────────────────────────────

export function Dashboard() {
  // ─── Existing state (preserved) ───
  const [selected, setSelected] = useState<SelectedItem | null>(null)
  const applications = useAdminStore((s) => s.config.applications)
  const desktopConfig = withDesktopConfigDefaults(useAdminStore((s) => s.config.desktopConfig))

  // ─── New layout state ───
  const [sidebarCollapsed, setSidebarCollapsed] = useSidebarPersistence()
  const { isMobile } = useBreakpoint()
  const [activeSection, setActiveSection] = useState('dashboard')

  // ─── Runtime state for TopBar status indicators ───
  const overlayOwnerSocketId = useAdminStore((s) => s.overlayOwnerSocketId)
  const obsConnected = useAdminStore((s) => s.obsConnected)
  const { user } = useAuth()

  const overlayStatus: 'connected' | 'disconnected' =
    overlayOwnerSocketId != null ? 'connected' : 'disconnected'
  const obsStatus: 'connected' | 'disconnected' =
    obsConnected ? 'connected' : 'disconnected'

  // ─── Auto-collapse sidebar on mobile ───
  useEffect(() => {
    if (isMobile && !sidebarCollapsed) {
      setSidebarCollapsed(true)
    }
  }, [isMobile]) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Sidebar width for layout ───
  const sidebarWidth = sidebarCollapsed ? 48 : 240

  // ─── Existing handlers (preserved) ───

  // Clear selection when selected app is removed
  useEffect(() => {
    if (selected?.kind === 'app' && !applications.find((a) => a.id === selected.appId)) {
      setSelected(null)
    }
  }, [applications, selected])

  useEffect(() => {
    if (selected?.kind === 'widget-layout' && !(desktopConfig.widgetLayouts ?? []).some((layout) => layout.id === selected.layoutId)) {
      setSelected(null)
    }
  }, [desktopConfig.widgetLayouts, selected])

  const handleSelect = (item: SelectedItem) => {
    if (selected && itemKey(item) === itemKey(selected)) {
      setSelected(null)
    } else {
      setSelected(item)
    }
  }

  const handleActivate = (item: SelectedItem) => {
    setSelected(item)
    if (item.kind === 'env') {
      socket.emit('scene:change', item.envState)
    } else if (item.kind === 'scene') {
      socket.emit('scene:change', item.sceneState)
    } else if (item.kind === 'app') {
      const app = applications.find((a) => a.id === item.appId)
      if (!app) return
      if (app.appType === 'widget') socket.emit('widget:toggle', app.id)
      else if (app.appType === 'scene') socket.emit('scene:change', app.targetSceneId)
    } else if (item.kind === 'widget-layout') {
      socket.emit('widget:layout:apply', item.layoutId)
    }
  }

  // ─── New sidebar navigation handler ───

  const handleNavigate = useCallback((section: string) => {
    setActiveSection(section)
    setSelected(null)
  }, [])

  const handleSidebarToggle = useCallback(() => {
    setSidebarCollapsed(!sidebarCollapsed)
  }, [sidebarCollapsed, setSidebarCollapsed])

  // ─── Command palette integration ───
  const setCommandPaletteOpen = useAdminStore((s) => s.setCommandPaletteOpen)
  const handleSearchOpen = useCallback(() => {
    setCommandPaletteOpen(true)
  }, [setCommandPaletteOpen])

  // ─── Determine whether to show the dashboard overview or the existing content ───
  const showDashboard = activeSection === 'dashboard'

  return (
    <div
      className="h-screen overflow-hidden bg-[var(--color-bg-base)] text-[var(--color-text-primary)]"
      data-tour="dashboard-root"
    >
      {/* ─── New Design System Sidebar (fixed left) ─── */}
      <LeftSidebar
        collapsed={sidebarCollapsed}
        onToggle={handleSidebarToggle}
        activeSection={activeSection}
        onNavigate={handleNavigate}
        sections={NAV_SECTIONS}
      />

      {/* ─── New Design System TopBar (fixed top, offset by sidebar) ─── */}
      <NewTopBar
        onSearchOpen={handleSearchOpen}
        overlayStatus={overlayStatus}
        obsStatus={obsStatus}
        userName={user?.name ?? 'Admin'}
        style={{ left: `${sidebarWidth}px`, transition: 'left 250ms cubic-bezier(0, 0, 0.2, 1)' }}
      />

      {/* ─── Main content area (offset by sidebar + topbar) ─── */}
      <div
        className="absolute top-14 bottom-0 right-0 overflow-hidden"
        style={{ left: `${sidebarWidth}px`, transition: 'left 250ms cubic-bezier(0, 0, 0.2, 1)' }}
        data-tour="main-content"
      >
        {showDashboard ? (
          <div className="h-full overflow-y-auto px-6 py-5" data-tour="quick-actions">
            <DashboardContainer />
          </div>
        ) : (
          <div className="flex h-full overflow-hidden" data-tour="navigator-content">
            <RightPane selected={selected} onClose={() => setSelected(null)} onSelectItem={setSelected} activeSection={activeSection} onSelect={handleSelect} onActivate={handleActivate} />
          </div>
        )}
      </div>

    </div>
  )
}
