import { Search } from 'lucide-react';
import { cn } from '../../utils/cn';
import { StatusIndicator } from '../molecules';
import { Button } from '../atoms';

/**
 * TopBar organism for the IEOM Admin Panel design system.
 *
 * Fixed horizontal bar at the top of the viewport containing the brand mark,
 * a center breadcrumb slot, and a right section with connection status
 * indicators, a search trigger (Ctrl+K), and a user avatar badge.
 *
 * Uses CSS custom properties from the design token system for all styling.
 * Includes backdrop-blur for a frosted-glass effect over scrolling content.
 *
 * @example
 * ```tsx
 * <TopBar
 *   onSearchOpen={() => setCommandPaletteOpen(true)}
 *   overlayStatus="connected"
 *   obsStatus="disconnected"
 *   userName="Admin"
 * />
 * ```
 */

export interface TopBarProps {
  /** Callback fired when the search trigger button is clicked */
  onSearchOpen?: () => void;
  /** Overlay WebSocket connection status */
  overlayStatus?: 'connected' | 'disconnected';
  /** OBS Studio connection status */
  obsStatus?: 'connected' | 'disconnected';
  /** Display name for the user avatar badge */
  userName?: string;
  /** Additional CSS class names */
  className?: string;
  /** Inline styles (for dynamic left offset) */
  style?: React.CSSProperties;
}

/**
 * Renders the top navigation bar with brand, status indicators, search, and user badge.
 */
export function TopBar({
  onSearchOpen,
  overlayStatus = 'disconnected',
  obsStatus = 'disconnected',
  userName = 'User',
  className,
  style,
}: TopBarProps) {
  const userInitial = userName.charAt(0).toUpperCase();

  return (
    <header
      data-tour="topbar"
      className={cn(
        'fixed top-0 right-0 z-40',
        'flex h-14 items-center justify-between',
        'bg-[var(--color-bg-surface)]/80 backdrop-blur-md',
        'border-b border-[var(--color-border-default)]',
        'px-[var(--space-6)]',
        className,
      )}
      style={style}
    >
      {/* Left section — Brand mark */}
      <div className="flex items-center gap-[var(--space-3)]">
        <span
          className={cn(
            'text-[var(--text-lg)] font-bold tracking-wider',
            'bg-gradient-to-r from-[var(--color-primary-400)] to-[var(--color-primary-600)]',
            'bg-clip-text text-transparent',
            'select-none',
          )}
        >
          IEOM
        </span>
      </div>

      {/* Center section — Breadcrumb slot (rendered by parent layout) */}
      <div className="flex-1" />

      {/* Right section — Status, Search, User */}
      <div className="flex items-center gap-[var(--space-3)]">
        {/* Connection status indicators */}
        <StatusIndicator status={overlayStatus} label="Overlay" />
        <StatusIndicator status={obsStatus} label="OBS" />

        {/* Search trigger button */}
        <Button
          variant="ghost"
          size="sm"
          icon={<Search />}
          onClick={onSearchOpen}
          aria-label="Open search (Ctrl+K)"
        >
          <span className="hidden sm:inline">Search</span>
          <kbd
            className={cn(
              'ml-1 hidden sm:inline-flex items-center',
              'rounded-[var(--radius-sm)] border border-[var(--color-border-default)]',
              'px-1.5 py-0.5 text-[10px] font-mono',
              'text-[var(--color-text-muted)]',
            )}
          >
            Ctrl+K
          </kbd>
        </Button>

        {/* User avatar badge */}
        <button
          type="button"
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-full',
            'bg-[var(--color-primary-500)]/20 text-[var(--color-primary-400)]',
            'text-[var(--text-sm)] font-semibold',
            'transition-colors duration-[var(--duration-fast)] ease-[var(--ease-default)]',
            'hover:bg-[var(--color-primary-500)]/30',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-400)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-base)]',
          )}
          aria-label={`User: ${userName}`}
          title={userName}
        >
          {userInitial}
        </button>
      </div>
    </header>
  );
}
