import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../utils/cn';
import { Button, Skeleton } from '../atoms';
import { Card } from '../molecules';

/**
 * ConfigPanel organism component for the IEOM Admin Panel design system.
 *
 * A structured configuration section with an improved header (title + optional
 * description), a collapsible body with smooth height animation, and a sticky
 * save bar that appears when unsaved changes are detected.
 *
 * Uses the Card molecule as its outer container (variant="default", padding="lg")
 * and manages collapse state internally via useState.
 *
 * @example
 * ```tsx
 * <ConfigPanel
 *   title="Audio Settings"
 *   description="Configure audio sources and volume levels."
 *   collapsible
 *   dirty={hasChanges}
 *   saving={isSaving}
 *   onSave={handleSave}
 * >
 *   <Field label="Master Volume">
 *     <Input type="number" value={volume} onChange={setVolume} />
 *   </Field>
 * </ConfigPanel>
 * ```
 */

export interface ConfigPanelProps {
  /** Panel heading text */
  title: string;
  /** Optional description displayed below the title */
  description?: string;
  /** Panel body content */
  children: ReactNode;
  /** Callback invoked when the save button is clicked */
  onSave?: () => void;
  /** Whether a save operation is in progress */
  saving?: boolean;
  /** Whether the panel has unsaved changes (shows the save bar) */
  dirty?: boolean;
  /** Whether the panel body can be collapsed */
  collapsible?: boolean;
  /** Initial collapsed state when collapsible is true */
  defaultCollapsed?: boolean;
  /** Whether the panel is loading async data (shows skeleton placeholders) */
  loading?: boolean;
  /** Additional CSS class names */
  className?: string;
}

export function ConfigPanel({
  title,
  description,
  children,
  onSave,
  saving = false,
  dirty = false,
  collapsible = false,
  defaultCollapsed = false,
  loading = false,
  className,
}: ConfigPanelProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  return (
    <Card variant="default" padding="lg" className={cn('relative', className)}>
      {/* Header */}
      <div className="flex items-start justify-between gap-[var(--space-4)]">
        <div className="flex-1 min-w-0">
          <h2 className="text-[var(--text-lg)] font-semibold text-[var(--color-text-primary)] leading-tight">
            {title}
          </h2>
          {description && (
            <p className="mt-[var(--space-1)] text-[var(--text-sm)] text-[var(--color-text-secondary)]">
              {description}
            </p>
          )}
        </div>

        {collapsible && (
          <button
            type="button"
            onClick={() => setCollapsed((prev) => !prev)}
            className={cn(
              'inline-flex items-center justify-center',
              'h-8 w-8 rounded-[var(--radius-md)]',
              'text-[var(--color-text-secondary)]',
              'hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-text-primary)]',
              'transition-all duration-[var(--duration-fast)] ease-[var(--ease-default)]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-400)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-base)]',
            )}
            aria-expanded={!collapsed}
            aria-label={collapsed ? `Expand ${title}` : `Collapse ${title}`}
          >
            <ChevronDown
              className={cn(
                'h-4 w-4 transition-transform duration-[var(--duration-normal)] ease-[var(--ease-out)]',
                collapsed && '-rotate-90',
              )}
            />
          </button>
        )}
      </div>

      {/* Collapsible body */}
      <div
        className={cn(
          'overflow-hidden transition-[grid-template-rows] duration-[var(--duration-normal)] ease-[var(--ease-out)]',
          'grid',
          collapsed ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]',
        )}
      >
        <div className="min-h-0">
          <div className="pt-[var(--space-4)]">
            {loading ? (
              <div className="flex flex-col gap-[var(--space-3)]">
                <Skeleton variant="text" width="100%" />
                <Skeleton variant="text" width="80%" />
                <Skeleton variant="text" width="60%" />
                <Skeleton variant="rect" width="100%" height={40} />
                <Skeleton variant="text" width="40%" />
              </div>
            ) : (
              children
            )}
          </div>
        </div>
      </div>

      {/* Save bar */}
      {dirty && !loading && (
        <div
          className={cn(
            'sticky bottom-0 -mx-[var(--space-6)] -mb-[var(--space-6)] mt-[var(--space-4)]',
            'px-[var(--space-6)] py-[var(--space-3)]',
            'bg-[var(--color-bg-elevated)] border-t border-[var(--color-border-default)]',
            'rounded-b-[var(--radius-lg)]',
            'flex items-center justify-end',
          )}
        >
          <Button
            variant="primary"
            size="md"
            loading={saving}
            onClick={onSave}
            disabled={saving}
          >
            Save
          </Button>
        </div>
      )}
    </Card>
  );
}
