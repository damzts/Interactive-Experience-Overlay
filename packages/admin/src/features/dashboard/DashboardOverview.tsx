import { useEffect, useRef, useState } from 'react';
import {
  Monitor,
  Wifi,
  Globe,
  Layers,
  Settings,
  Play,
  Activity,
  Radio,
} from 'lucide-react';
import { cn } from '../../utils/cn';
import { Card } from '../../components/molecules/Card';
import { StatusIndicator } from '../../components/molecules/StatusIndicator';
import { Button } from '../../components/atoms/Button';

/**
 * Hook that detects when a value changes and returns a transient
 * "just changed" flag that auto-resets after a short duration.
 * Used to trigger a one-shot pulse animation on state transitions.
 */
function useStateChangeFlash(value: string, durationMs = 600): boolean {
  const prevRef = useRef(value);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (prevRef.current !== value) {
      prevRef.current = value;
      setFlash(true);
      const timer = setTimeout(() => setFlash(false), durationMs);
      return () => clearTimeout(timer);
    }
  }, [value, durationMs]);

  return flash;
}

/**
 * DashboardOverview — Default landing view for the IEOM Admin Panel.
 *
 * Displays system health at a glance including connection status cards
 * for Overlay, OBS, and Online Rooms, the current active scene,
 * quick-action buttons for common operations, and a recent activity feed.
 *
 * Uses staggered card entrance animations (`animate-card-entrance`) and
 * CSS custom properties from the design token system for all styling.
 *
 * @example
 * ```tsx
 * <DashboardOverview
 *   overlayStatus="connected"
 *   obsStatus="disconnected"
 *   onlineRoomCount={3}
 *   activeScene="Lobby"
 *   onSwitchScene={() => navigate('/scenes')}
 *   onToggleWidget={() => navigate('/widgets')}
 *   onOpenOverlay={() => window.open('/overlay')}
 *   onOpenSettings={() => navigate('/settings')}
 * />
 * ```
 */

export interface DashboardOverviewProps {
  /** Overlay WebSocket connection status */
  overlayStatus?: 'connected' | 'disconnected';
  /** OBS Studio connection status */
  obsStatus?: 'connected' | 'disconnected';
  /** Number of currently active online rooms */
  onlineRoomCount?: number;
  /** Name of the currently active scene */
  activeScene?: string;
  /** Callback to trigger scene switching */
  onSwitchScene?: () => void;
  /** Callback to toggle a widget */
  onToggleWidget?: () => void;
  /** Callback to open the overlay preview */
  onOpenOverlay?: () => void;
  /** Callback to open settings */
  onOpenSettings?: () => void;
  /** Callback to open the bus trace popup */
  onOpenBusTrace?: () => void;
}

export function DashboardOverview({
  overlayStatus = 'disconnected',
  obsStatus = 'disconnected',
  onlineRoomCount = 0,
  activeScene = 'None',
  onSwitchScene,
  onToggleWidget,
  onOpenOverlay,
  onOpenSettings,
  onOpenBusTrace,
}: DashboardOverviewProps) {
  const overlayFlash = useStateChangeFlash(overlayStatus);
  const obsFlash = useStateChangeFlash(obsStatus);
  const prevRoomCount = useRef(onlineRoomCount);
  const [roomFlash, setRoomFlash] = useState(false);

  useEffect(() => {
    if (prevRoomCount.current !== onlineRoomCount) {
      prevRoomCount.current = onlineRoomCount;
      setRoomFlash(true);
      const timer = setTimeout(() => setRoomFlash(false), 600);
      return () => clearTimeout(timer);
    }
  }, [onlineRoomCount]);

  return (
    <div className="flex flex-col gap-[var(--space-6)]">
      {/* ─── Status Cards ─── */}
      <section aria-label="Connection status">
        <h2 className="text-[var(--text-sm)] font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-[var(--space-3)]">
          System Status
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-[var(--space-4)]">
          {/* Overlay Status */}
          <Card
            variant="status"
            padding="md"
            className={cn(
              'animate-card-entrance transition-shadow duration-[var(--duration-normal)]',
              overlayFlash && 'animate-highlight-flash',
            )}
          >
            <div className="flex items-center gap-[var(--space-3)]">
              <div
                className={cn(
                  'flex items-center justify-center h-10 w-10 rounded-[var(--radius-md)]',
                  overlayStatus === 'connected'
                    ? 'bg-[var(--color-success-400)]/10'
                    : 'bg-[var(--color-danger-400)]/10',
                )}
              >
                <Monitor
                  className={cn(
                    'h-5 w-5',
                    overlayStatus === 'connected'
                      ? 'text-[var(--color-success-400)]'
                      : 'text-[var(--color-danger-400)]',
                  )}
                />
              </div>
              <div className="flex flex-col gap-[var(--space-1)]">
                <span className="text-[var(--text-sm)] font-medium text-[var(--color-text-primary)]">
                  Overlay
                </span>
                <StatusIndicator
                  status={overlayStatus}
                  label={overlayStatus === 'connected' ? 'Connected' : 'Disconnected'}
                />
              </div>
            </div>
          </Card>

          {/* OBS Status */}
          <Card
            variant="status"
            padding="md"
            className={cn(
              'animate-card-entrance transition-shadow duration-[var(--duration-normal)]',
              obsFlash && 'animate-highlight-flash',
            )}
          >
            <div className="flex items-center gap-[var(--space-3)]">
              <div
                className={cn(
                  'flex items-center justify-center h-10 w-10 rounded-[var(--radius-md)]',
                  obsStatus === 'connected'
                    ? 'bg-[var(--color-success-400)]/10'
                    : 'bg-[var(--color-danger-400)]/10',
                )}
              >
                <Wifi
                  className={cn(
                    'h-5 w-5',
                    obsStatus === 'connected'
                      ? 'text-[var(--color-success-400)]'
                      : 'text-[var(--color-danger-400)]',
                  )}
                />
              </div>
              <div className="flex flex-col gap-[var(--space-1)]">
                <span className="text-[var(--text-sm)] font-medium text-[var(--color-text-primary)]">
                  OBS Studio
                </span>
                <StatusIndicator
                  status={obsStatus}
                  label={obsStatus === 'connected' ? 'Connected' : 'Disconnected'}
                />
              </div>
            </div>
          </Card>

          {/* Online Rooms */}
          <Card
            variant="status"
            padding="md"
            className={cn(
              'animate-card-entrance transition-shadow duration-[var(--duration-normal)]',
              roomFlash && 'animate-highlight-flash',
            )}
          >
            <div className="flex items-center gap-[var(--space-3)]">
              <div className="flex items-center justify-center h-10 w-10 rounded-[var(--radius-md)] bg-[var(--color-primary-400)]/10">
                <Globe className="h-5 w-5 text-[var(--color-primary-400)]" />
              </div>
              <div className="flex flex-col gap-[var(--space-1)]">
                <span className="text-[var(--text-sm)] font-medium text-[var(--color-text-primary)]">
                  Online Rooms
                </span>
                <span className="text-[var(--text-xs)] text-[var(--color-text-secondary)]">
                  {onlineRoomCount} {onlineRoomCount === 1 ? 'room' : 'rooms'} active
                </span>
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* ─── Active Scene Card ─── */}
      <section aria-label="Active scene">
        <Card
          variant="elevated"
          padding="md"
          glow="primary"
          className="animate-card-entrance"
        >
          <div className="flex items-center gap-[var(--space-3)]">
            <div className="flex items-center justify-center h-10 w-10 rounded-[var(--radius-md)] bg-[var(--color-primary-400)]/10">
              <Play className="h-5 w-5 text-[var(--color-primary-400)]" />
            </div>
            <div className="flex flex-col gap-[var(--space-1)]">
              <span className="text-[var(--text-xs)] font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
                Active Scene
              </span>
              <span className="text-[var(--text-lg)] font-semibold text-[var(--color-text-primary)]">
                {activeScene}
              </span>
            </div>
          </div>
        </Card>
      </section>

      {/* ─── Quick Actions ─── */}
      <section aria-label="Quick actions">
        <h2 className="text-[var(--text-sm)] font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-[var(--space-3)]">
          Quick Actions
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-[var(--space-3)]">
          <Button
            variant="secondary"
            size="md"
            icon={<Layers />}
            onClick={onSwitchScene}
            className="animate-card-entrance flex-col h-auto py-[var(--space-4)]"
          >
            Switch Scene
          </Button>
          <Button
            variant="secondary"
            size="md"
            icon={<Monitor />}
            onClick={onToggleWidget}
            className="animate-card-entrance flex-col h-auto py-[var(--space-4)]"
          >
            Toggle Widget
          </Button>
          <Button
            variant="secondary"
            size="md"
            icon={<Globe />}
            onClick={onOpenOverlay}
            className="animate-card-entrance flex-col h-auto py-[var(--space-4)]"
          >
            Open Overlay
          </Button>
          <Button
            variant="secondary"
            size="md"
            icon={<Settings />}
            onClick={onOpenSettings}
            className="animate-card-entrance flex-col h-auto py-[var(--space-4)]"
          >
            Settings
          </Button>
          <Button
            variant="secondary"
            size="md"
            icon={<Radio />}
            onClick={onOpenBusTrace}
            className="animate-card-entrance flex-col h-auto py-[var(--space-4)]"
          >
            Bus Trace
          </Button>
        </div>
      </section>

      {/* ─── Recent Activity Feed ─── */}
      <section aria-label="Recent activity">
        <h2 className="text-[var(--text-sm)] font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-[var(--space-3)]">
          Recent Activity
        </h2>
        <Card
          variant="default"
          padding="md"
          className="animate-card-entrance"
        >
          <div className="flex items-center gap-[var(--space-3)] text-[var(--color-text-muted)]">
            <Activity className="h-4 w-4" />
            <span className="text-[var(--text-sm)]">No recent activity</span>
          </div>
        </Card>
      </section>
    </div>
  );
}
