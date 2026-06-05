import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../utils/cn';

/**
 * Card molecule component for the IEOM Admin Panel design system.
 *
 * A versatile container with four visual variants (default, elevated,
 * interactive, status), optional colored glow effects, and configurable
 * padding sizes. When an `onClick` handler is provided the card renders
 * with button-like affordances (cursor-pointer, focus ring).
 *
 * All colors and spacing reference CSS custom properties from the design
 * token system for consistent theming.
 *
 * @example
 * ```tsx
 * <Card variant="elevated" padding="md" glow="primary">
 *   <h3>Scene Status</h3>
 *   <p>Currently live</p>
 * </Card>
 *
 * <Card variant="interactive" padding="md" onClick={() => navigate('/scenes')}>
 *   Click to open scenes
 * </Card>
 * ```
 */

export interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onClick'> {
  /** Visual style variant */
  variant: 'default' | 'elevated' | 'interactive' | 'status';
  /** Internal padding size */
  padding: 'sm' | 'md' | 'lg';
  /** Colored glow effect applied as a box-shadow */
  glow?: 'primary' | 'success' | 'accent' | 'none';
  /** Card content */
  children: ReactNode;
  /** Click handler; when provided, adds button-like affordances */
  onClick?: () => void;
  /** Additional CSS class names */
  className?: string;
}

const variantStyles: Record<CardProps['variant'], string> = {
  default: [
    'bg-[var(--color-bg-surface)]',
    'border-[var(--color-border-default)]',
    'shadow-[var(--shadow-sm)]',
  ].join(' '),
  elevated: [
    'bg-[var(--color-bg-surface)]',
    'border-[var(--color-border-strong)]',
    'shadow-[var(--shadow-md)]',
  ].join(' '),
  interactive: [
    'bg-[var(--color-bg-surface)]',
    'border-[var(--color-border-default)]',
    'shadow-[var(--shadow-md)]',
    'hover:shadow-[var(--shadow-lg)]',
    'hover:border-[var(--color-primary-400)]/30',
    'cursor-pointer',
  ].join(' '),
  status: [
    'bg-[var(--color-bg-surface)]',
    'border-[var(--color-border-default)]',
    'border-l-2',
    'border-l-[var(--color-primary-400)]',
    'shadow-[var(--shadow-sm)]',
  ].join(' '),
};

const paddingStyles: Record<CardProps['padding'], string> = {
  sm: 'p-[var(--space-3)]',
  md: 'p-[var(--space-4)]',
  lg: 'p-[var(--space-6)]',
};

const glowStyles: Record<NonNullable<CardProps['glow']>, string> = {
  primary: 'shadow-[0_0_20px_rgba(6,182,212,0.15)]',
  success: 'shadow-[0_0_20px_rgba(16,185,129,0.15)]',
  accent: 'shadow-[0_0_20px_rgba(245,158,11,0.15)]',
  none: '',
};

export const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    {
      variant,
      padding,
      glow = 'none',
      children,
      onClick,
      className,
      ...rest
    },
    ref,
  ) => {
    return (
      <div
        ref={ref}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
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
        className={cn(
          // Base styles
          'border rounded-[var(--radius-lg)]',
          'transition-all duration-[var(--duration-fast)] ease-[var(--ease-default)]',
          // Variant
          variantStyles[variant],
          // Padding
          paddingStyles[padding],
          // Glow
          glowStyles[glow],
          // Clickable affordances
          onClick && 'cursor-pointer',
          onClick &&
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-400)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-base)]',
          className,
        )}
        {...rest}
      >
        {children}
      </div>
    );
  },
);

Card.displayName = 'Card';
