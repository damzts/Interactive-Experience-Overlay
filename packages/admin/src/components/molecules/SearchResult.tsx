import type { LucideIcon } from 'lucide-react';
import { cn } from '../../utils/cn';
import { Badge } from '../atoms/Badge';

/**
 * SearchResult molecule component for the IEOM Admin Panel design system.
 *
 * Renders a single search result row within the Command Palette. Displays
 * an optional icon, label text with highlighted matching characters, a
 * category badge, and an optional navigation path. Supports a selected
 * state for keyboard navigation highlighting.
 *
 * All colors reference CSS custom properties from the design token system.
 *
 * @example
 * ```tsx
 * <SearchResult
 *   label="Lobby Scene"
 *   category="scene"
 *   matchIndices={[0, 1, 2, 3]}
 *   selected={true}
 *   onClick={() => navigate('/scenes/lobby')}
 *   path="Scenes / Lobby"
 * />
 * ```
 */

export interface SearchResultProps {
  /** Display label for the search result */
  label: string;
  /** Category of the result, determines badge variant */
  category: 'scene' | 'widget' | 'setting' | 'action';
  /** Indices of characters in `label` that match the search query */
  matchIndices?: number[];
  /** Whether this result is currently selected via keyboard navigation */
  selected?: boolean;
  /** Click handler for selecting this result */
  onClick?: () => void;
  /** Optional Lucide icon to display before the label */
  icon?: LucideIcon;
  /** Optional breadcrumb-style path showing where this result lives */
  path?: string;
}

/** Maps each category to its corresponding Badge variant */
const categoryBadgeVariant: Record<SearchResultProps['category'], 'primary' | 'default' | 'success'> = {
  scene: 'primary',
  widget: 'default',
  setting: 'default',
  action: 'success',
};

/**
 * Renders label text with matched characters highlighted using the primary color.
 */
function HighlightedLabel({ label, matchIndices }: { label: string; matchIndices?: number[] }) {
  if (!matchIndices || matchIndices.length === 0) {
    return <span>{label}</span>;
  }

  const matchSet = new Set(matchIndices);

  return (
    <span>
      {label.split('').map((char, index) => {
        if (matchSet.has(index)) {
          return (
            <span
              key={index}
              className="text-[var(--color-primary-400)] font-semibold"
            >
              {char}
            </span>
          );
        }
        return <span key={index}>{char}</span>;
      })}
    </span>
  );
}

/**
 * SearchResult — a single row in the command palette search results list.
 */
export function SearchResult({
  label,
  category,
  matchIndices,
  selected = false,
  onClick,
  icon: Icon,
  path,
}: SearchResultProps) {
  return (
    <div
      role="option"
      aria-selected={selected}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      tabIndex={-1}
      className={cn(
        // Base styles
        'flex items-center gap-[var(--space-3)] px-[var(--space-3)] py-[var(--space-2)]',
        'rounded-[var(--radius-md)] cursor-pointer',
        'transition-colors duration-[var(--duration-fast)] ease-[var(--ease-default)]',
        // Default state
        'hover:bg-[var(--color-bg-elevated)]',
        // Selected state (keyboard navigation)
        selected && 'bg-[var(--color-bg-elevated)]',
      )}
    >
      {/* Icon */}
      {Icon && (
        <Icon
          size={16}
          className="shrink-0 text-[var(--color-text-muted)]"
          aria-hidden="true"
        />
      )}

      {/* Label + Path */}
      <div className="flex-1 min-w-0">
        <span className="text-[var(--text-sm)] text-[var(--color-text-primary)] truncate block">
          <HighlightedLabel label={label} matchIndices={matchIndices} />
        </span>
        {path && (
          <span className="text-[var(--text-xs)] text-[var(--color-text-muted)] truncate block">
            {path}
          </span>
        )}
      </div>

      {/* Category Badge */}
      <Badge
        variant={categoryBadgeVariant[category]}
        size="sm"
        className="shrink-0"
      >
        {category}
      </Badge>
    </div>
  );
}
