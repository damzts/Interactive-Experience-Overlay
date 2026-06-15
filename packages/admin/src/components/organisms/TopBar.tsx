import { cn } from '../../utils/cn';

export interface TopBarProps {
  /** Display name for the user avatar badge */
  userName?: string;
  /** Additional CSS class names */
  className?: string;
  /** Inline styles (for dynamic left offset) */
  style?: React.CSSProperties;
}

export function TopBar({
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

      <div className="flex-1" />

      <div className="flex items-center gap-[var(--space-3)]">
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
