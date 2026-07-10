import { useEffect, useState, useCallback } from 'react'
import { LayoutDashboard, Monitor, Layers, LayoutGrid, Image, Settings, Film, Sparkles, Plug } from 'lucide-react'
import { withDesktopConfigDefaults } from '@ieomlabs/shared'
import { socket } from '../../socket/client'
import { useAdminStore } from '../../store/useAdminStore'
import { useAuth } from '../../auth/AuthContext'
import { provideAuthToken } from '../../api/roomApi'
import { LoginModal } from '../../auth/LoginModal'
import { TopBar as NewTopBar } from '../../components/organisms'
import type { TopBarNavSection } from '../../components/organisms'
import { DashboardContainer } from './DashboardContainer'
import { RightPane } from './RightPane'
import type { SelectedItem } from './types'
import { itemKey } from './types'

// ── Navigation sections for the TopBar ──────────────────────────────────────

const NAV_SECTIONS: TopBarNavSection[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'scenes', label: 'Scenes', icon: Monitor },
  { id: 'widgets', label: 'Widgets', icon: Layers },
  { id: 'layouts', label: 'Layouts', icon: LayoutGrid },
  { id: 'graphics', label: 'Graphics', icon: Image },
  { id: 'ambiance', label: 'Ambiance', icon: Sparkles },
  { id: 'sequences', label: 'Sequences', icon: Film },
  { id: 'integrations', label: 'Integrations', icon: Plug },
]

const END_SECTIONS: TopBarNavSection[] = [
  { id: 'settings-tab', label: 'Settings', icon: Settings },
]

// ── Dashboard ──────────────────────────────────────────────────────────────

export function Dashboard() {
  // ─── Existing state (preserved) ───
  const [selected, setSelected] = useState<SelectedItem | null>(null)
  const applications  = useAdminStore((s) => s.config.applications)
  const desktopConfig = withDesktopConfigDefaults(useAdminStore((s) => s.config.desktopConfig))
  const widgetLayouts = useAdminStore((s) => s.config.widgetLayouts ?? [])

  // ─── New layout state ───
  const [activeSection, setActiveSection] = useState('dashboard')

  const { user, isLoginModalOpen, closeLoginModal } = useAuth()

  // ─── Provide auth token to server on app load ───
  // Sends the stored user JWT to POST /api/online/auth so the server can
  // reconnect to cloud rooms as hub without waiting for RoomsPanel to open.
  useEffect(() => {
    provideAuthToken().catch(() => {})
  }, [])

  // ─── Existing handlers (preserved) ───

  // Clear selection when selected app is removed
  useEffect(() => {
    if (selected?.kind === 'app' && !applications.find((a) => a.id === selected.appId)) {
      setSelected(null)
    }
  }, [applications, selected])

  useEffect(() => {
    if (selected?.kind === 'widget-layout' && !(widgetLayouts).some((layout) => layout.id === selected.layoutId)) {
      setSelected(null)
    }
  }, [widgetLayouts, selected])

  const handleSelect = (item: SelectedItem) => {
    if (selected && itemKey(item) === itemKey(selected)) {
      setSelected(null)
    } else {
      setSelected(item)
    }
  }

  const handleActivate = (item: SelectedItem) => {
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
  }

  // ─── Top bar navigation handler ───

  const handleNavigate = useCallback((section: string) => {
    setActiveSection(section)
    setSelected(
      section === 'graphics' ? { kind: 'graphics' }
      : section === 'ambiance' ? { kind: 'scheduler', tab: 'events' }
      : section === 'integrations' ? { kind: 'obs' }
      : section === 'settings-tab' ? { kind: 'keybinds' }
      : null
    )
  }, [])

  // ─── Determine whether to show the dashboard overview or the existing content ───
  const showDashboard = activeSection === 'dashboard'

  return (
    <div
      className="h-screen overflow-hidden bg-[var(--color-bg-base)] text-[var(--color-text-primary)]"
      data-tour="dashboard-root"
    >
      {/* ─── Login modal overlay (not a navigation) ─── */}
      <LoginModal open={isLoginModalOpen} onClose={closeLoginModal} />

      {/* ─── TopBar: logo + horizontal nav + status/search/avatar ─── */}
      <NewTopBar
        userName={user?.name ?? 'Admin'}
        sections={NAV_SECTIONS}
        endSections={END_SECTIONS}
        activeSection={activeSection}
        onNavigate={handleNavigate}
      />

      {/* ─── Main content area (offset by topbar only) ─── */}
      <div
        className="absolute top-14 bottom-0 left-0 right-0 overflow-hidden"
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
