import { useCallback } from 'react';
import { useAdminStore } from '../../store/useAdminStore';
import { DashboardOverview } from './DashboardOverview';

/**
 * DashboardContainer — Connects the DashboardOverview presentational component
 * to the Zustand admin store, providing real-time state from socket events and
 * polling as props.
 *
 * The admin store is already kept in sync via socket events handled in
 * `src/socket/useSocketEvents.ts` (overlay:owner, obs:status, state:change, etc.),
 * so this container simply selects the relevant slices and maps them to the
 * DashboardOverview prop interface.
 *
 * @example
 * ```tsx
 * import { DashboardContainer } from './DashboardContainer';
 * // Renders the dashboard wired to live store data
 * <DashboardContainer />
 * ```
 */
export function DashboardContainer() {
  // ─── Runtime state from socket events ───
  const overlayOwnerSocketId = useAdminStore((s) => s.overlayOwnerSocketId);
  const obsConnected = useAdminStore((s) => s.obsConnected);
  const currentState = useAdminStore((s) => s.currentState);
  const clientCount = useAdminStore((s) => s.clientCount);

  // ─── UI navigation actions ───
  const setActiveSection = useAdminStore((s) => s.setActiveSection);

  // Derive overlay connection status from whether an overlay client owns the socket
  const overlayStatus: 'connected' | 'disconnected' =
    overlayOwnerSocketId != null ? 'connected' : 'disconnected';

  // Map OBS boolean to the status string expected by DashboardOverview
  const obsStatus: 'connected' | 'disconnected' =
    obsConnected ? 'connected' : 'disconnected';

  // Map the STATE enum value to a human-readable scene name
  const activeScene = formatSceneName(currentState);

  // TODO: Replace clientCount with a dedicated online room count once the store
  // tracks individual room objects (e.g. from a periodic /api/online/rooms poll).
  // For now clientCount is the closest proxy available in the runtime slice.
  const onlineRoomCount = clientCount;

  // ─── Quick action callbacks ───
  const handleSwitchScene = useCallback(() => {
    // Navigate to the scenes section in the sidebar
    setActiveSection('scenes');
  }, [setActiveSection]);

  const handleToggleWidget = useCallback(() => {
    // Navigate to the widgets section in the sidebar
    setActiveSection('widgets');
  }, [setActiveSection]);

  const handleOpenOverlay = useCallback(() => {
    // TODO: Determine the correct overlay URL from config/environment
    window.open('/', '_blank');
  }, []);

  const handleOpenSettings = useCallback(() => {
    // Navigate to the system/settings section in the sidebar
    setActiveSection('system');
  }, []);

  const handleOpenBusTrace = useCallback(() => {
    window.open('/bus-trace.html', 'ieom-bus-trace', 'width=1000,height=640,menubar=no,toolbar=no,location=no');
  }, []);

  return (
    <DashboardOverview
      overlayStatus={overlayStatus}
      obsStatus={obsStatus}
      onlineRoomCount={onlineRoomCount}
      activeScene={activeScene}
      onSwitchScene={handleSwitchScene}
      onToggleWidget={handleToggleWidget}
      onOpenOverlay={handleOpenOverlay}
      onOpenSettings={handleOpenSettings}
      onOpenBusTrace={handleOpenBusTrace}
    />
  );
}

/**
 * Converts a STATE enum value (e.g. "LOBBY", "DESKTOP") into a
 * title-cased display name for the dashboard.
 */
function formatSceneName(state: string): string {
  if (!state) return 'None';
  // Title-case: "DESKTOP" → "Desktop", "LOBBY" → "Lobby"
  return state.charAt(0).toUpperCase() + state.slice(1).toLowerCase();
}
