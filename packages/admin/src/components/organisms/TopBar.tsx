import type { LucideIcon } from 'lucide-react';
import { cn } from '../../utils/cn';

export interface TopBarNavSection {
  id: string;
  label: string;
  icon: LucideIcon;
}

export interface TopBarProps {
  /** Display name for the user avatar badge */
  userName?: string;
  /** Opens the global search palette */
  onSearchOpen?: () => void;
  /** Overlay connection indicator */
  overlayStatus?: 'connected' | 'disconnected';
  /** OBS connection indicator */
  obsStatus?: 'connected' | 'disconnected';
  /** Additional CSS class names */
  className?: string;
  /** Inline styles */
  style?: React.CSSProperties;
  /** Horizontal navigation sections (replaces the old left sidebar) */
  sections?: TopBarNavSection[];
  /** ID of the currently active navigation section */
  activeSection?: string;
  /** Callback when a navigation section is selected */
  onNavigate?: (section: string) => void;
}

function StatusDot({ label, status }: { label: string; status: 'connected' | 'disconnected' }) {
  return (
    <span
      className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]"
      title={`${label}: ${status}`}
    >
      <span
        className={cn(
          'inline-block h-2 w-2 rounded-full',
          status === 'connected' ? 'bg-emerald-400' : 'bg-zinc-600',
        )}
      />
      {label}
    </span>
  );
}

function NavItem({ section, active, onClick }: { section: TopBarNavSection; active: boolean; onClick: () => void }) {
  const Icon = section.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3',
        'text-[var(--text-sm)] font-medium transition-colors duration-[var(--duration-fast)] ease-[var(--ease-default)]',
        active
          ? 'bg-[var(--color-primary-500)]/15 text-[var(--color-primary-400)]'
          : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-text-primary)]',
      )}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{section.label}</span>
    </button>
  );
}

export function TopBar({
  userName = 'User',
  onSearchOpen,
  overlayStatus,
  obsStatus,
  className,
  style,
  sections,
  activeSection,
  onNavigate,
}: TopBarProps) {
  const userInitial = userName.charAt(0).toUpperCase();

  return (
    <header
      data-tour="topbar"
      className={cn(
        'fixed top-0 left-0 right-0 z-40',
        'flex h-14 items-center justify-between gap-4',
        'bg-[var(--color-bg-surface)]/80 backdrop-blur-md',
        'border-b border-[var(--color-border-default)]',
        'px-[var(--space-6)]',
        className,
      )}
      style={style}
    >
      <div className="flex min-w-0 flex-1 items-center gap-[var(--space-5)]">
        <span
          className={cn(
            'shrink-0 text-[var(--text-lg)] font-bold tracking-wider',
            'bg-gradient-to-r from-[var(--color-primary-400)] to-[var(--color-primary-600)]',
            'bg-clip-text text-transparent',
            'select-none',
          )}
        >
          IEOM
        </span>

        {sections && sections.length > 0 && (
          <nav
            role="navigation"
            aria-label="Main navigation"
            className="flex min-w-0 items-center gap-1 overflow-x-auto"
          >
            {sections.map((section) => (
              <NavItem
                key={section.id}
                section={section}
                active={activeSection === section.id}
                onClick={() => onNavigate?.(section.id)}
              />
            ))}
          </nav>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-[var(--space-3)]">
        {overlayStatus && <StatusDot label="Overlay" status={overlayStatus} />}
        {obsStatus && <StatusDot label="OBS" status={obsStatus} />}
        {onSearchOpen && (
          <button
            type="button"
            onClick={onSearchOpen}
            className={cn(
              'flex h-8 items-center gap-2 rounded-full px-3',
              'border border-[var(--color-border-default)] text-[var(--color-text-secondary)]',
              'text-[var(--text-sm)]',
              'transition-colors duration-[var(--duration-fast)] ease-[var(--ease-default)]',
              'hover:text-[var(--color-text-primary)]',
            )}
            aria-label="Open search"
          >
            🔍
          </button>
        )}
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
