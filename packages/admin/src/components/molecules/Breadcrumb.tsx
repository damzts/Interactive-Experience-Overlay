import { type HTMLAttributes } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '../../utils/cn';

/**
 * Breadcrumb molecule component for the IEOM Admin Panel design system.
 *
 * Renders a navigational breadcrumb trail with clickable path segments
 * and a non-clickable current page indicator. Uses a chevron separator
 * between segments and proper ARIA semantics for accessibility.
 *
 * All segments except the last are rendered as ghost-style buttons with
 * hover underline. The last segment represents the current page and is
 * styled with primary text color and medium font weight.
 *
 * @example
 * ```tsx
 * <Breadcrumb
 *   segments={[
 *     { label: 'Dashboard', onClick: () => navigate('/') },
 *     { label: 'Scenes', onClick: () => navigate('/scenes') },
 *     { label: 'Lobby' },
 *   ]}
 * />
 * ```
 */

export interface BreadcrumbSegment {
  /** Display text for the segment */
  label: string;
  /** Click handler; omit for the current (last) segment */
  onClick?: () => void;
}

export interface BreadcrumbProps extends Omit<HTMLAttributes<HTMLElement>, 'children'> {
  /** Ordered array of breadcrumb path segments */
  segments: BreadcrumbSegment[];
  /** Additional CSS class names */
  className?: string;
}

export function Breadcrumb({ segments, className, ...rest }: BreadcrumbProps) {
  if (segments.length === 0) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      className={cn('flex items-center gap-[var(--space-1)]', className)}
      {...rest}
    >
      <ol className="flex items-center gap-[var(--space-1)] list-none m-0 p-0">
        {segments.map((segment, index) => {
          const isLast = index === segments.length - 1;

          return (
            <li key={index} className="flex items-center gap-[var(--space-1)]">
              {index > 0 && (
                <ChevronRight
                  className="w-[var(--text-sm)] h-[var(--text-sm)] text-[var(--color-text-muted)] shrink-0"
                  aria-hidden="true"
                />
              )}

              {isLast ? (
                <span
                  aria-current="page"
                  className="text-[var(--text-sm)] font-medium text-[var(--color-text-primary)]"
                >
                  {segment.label}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={segment.onClick}
                  className={cn(
                    'text-[var(--text-sm)] text-[var(--color-text-secondary)]',
                    'bg-transparent border-none cursor-pointer p-0',
                    'transition-colors duration-[var(--duration-fast)] ease-[var(--ease-default)]',
                    'hover:text-[var(--color-text-primary)] hover:underline',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-400)] focus-visible:rounded-[var(--radius-sm)]',
                  )}
                >
                  {segment.label}
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
