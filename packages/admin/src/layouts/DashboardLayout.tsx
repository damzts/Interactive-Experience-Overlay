import type { ReactNode } from 'react';
import { cn } from '../utils/cn';
import { Sidebar, TopBar } from '../components/organisms';
import type { SidebarSection } from '../components/organisms';

/**
 * DashboardLayout — primary page-level layout shell for the IEOM Admin Panel.
 *
 * Composes the fixed Sidebar (left), fixed TopBar (top), and a scrollable
 * main content area. The content area's left margin adjusts smoothly when
 * the sidebar collapses (48px) or expands (240px), and its top margin
 * accounts for the TopBar height (56px / h-14).
 *
 * Breakpoint strategy:
 * - < 768px:    Mobile layout (bottom nav + full-width content)
 * - 768–1200px: Standard layout (sidebar 240px + content)
 * - > 1200px:   Extended layout (sidebar 240px + content + inspector 320px)
 *
 * @example
 * ```tsx
 * <DashboardLayout
 *   sidebarCollapsed={false}
 *   onSidebarToggle={() => toggleSidebar()}
 *   activeSection="dashboard"
 *   onNavigate={(id) => setSection(id)}
 *   sections={navSections}
 *   onSearchOpen={() => openCommandPalette()}
 *   overlayStatus="connected"
 *   obsStatus="disconnected"
 *   userName="Admin"
 * >
 *   <DashboardOverview />
 * </DashboardLayout>
 * ```
 */

export interface DashboardLayoutProps {
  /** Main content rendered in the scrollable area */
  children: ReactNode;
  /** Whether the sidebar is in collapsed (icon-only) mode */
  sidebarCollapsed: boolean;
  /** Callback to toggle sidebar collapsed state */
  onSidebarToggle: () => void;
  /** ID of the currently active navigation section */
  activeSection: string;
  /** Callback when a navigation section or item is selected */
  onNavigate: (section: string) => void;
  /** Navigation sections to render in the sidebar */
  sections: SidebarSection[];
  /** Callback fired when the search trigger is clicked */
  onSearchOpen?: () => void;
  /** Overlay WebSocket connection status */
  overlayStatus?: 'connected' | 'disconnected';
  /** OBS Studio connection status */
  obsStatus?: 'connected' | 'disconnected';
  /** Display name for the user avatar badge */
  userName?: string;
}

/**
 * Renders the full dashboard shell: fixed sidebar, fixed top bar,
 * and a scrollable padded content area with smooth margin transitions.
 */
export function DashboardLayout({
  children,
  sidebarCollapsed,
  onSidebarToggle,
  activeSection,
  onNavigate,
  sections,
  onSearchOpen,
  overlayStatus,
  obsStatus,
  userName,
}: DashboardLayoutProps) {
  const sidebarWidth = sidebarCollapsed ? 48 : 240;

  return (
    <div className={cn('flex h-screen overflow-hidden', 'bg-[var(--color-bg-base)]')}>
      {/* Fixed sidebar — left edge */}
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={onSidebarToggle}
        activeSection={activeSection}
        onNavigate={onNavigate}
        sections={sections}
      />

      {/* Fixed top bar — full width, layered above content */}
      <TopBar
        onSearchOpen={onSearchOpen}
        overlayStatus={overlayStatus}
        obsStatus={obsStatus}
        userName={userName}
      />

      {/* Main content area */}
      <main
        className={cn(
          'flex-1 flex flex-col min-w-0 overflow-hidden',
          'transition-[margin-left] duration-[var(--duration-normal)] ease-[var(--ease-out)]',
        )}
        style={{ marginLeft: sidebarWidth, marginTop: 56 }}
      >
        <div className="flex-1 overflow-y-auto p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
