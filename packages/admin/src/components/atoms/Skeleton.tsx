import { cn } from '../../utils/cn';

/**
 * Skeleton atom component for the IEOM Admin Panel design system.
 *
 * Renders a placeholder loading indicator with a shimmer animation.
 * Used to represent content that is still loading, providing visual
 * feedback instead of blank areas.
 *
 * Three variant shapes are supported:
 * - `text`: Rounded rectangle at typical text line height (16px), full width
 * - `circle`: Equal width/height with fully rounded corners (avatars, icons)
 * - `rect`: Configurable rectangle for cards, images, or other block content
 *
 * The shimmer effect uses the `animate-skeleton-shimmer` class from
 * animations.css, which applies a gradient sweep from `--color-bg-surface`
 * to `--color-bg-elevated`.
 *
 * @example
 * ```tsx
 * <Skeleton variant="text" width="60%" />
 * <Skeleton variant="circle" width={40} height={40} />
 * <Skeleton variant="rect" width="100%" height={120} />
 * ```
 */

export interface SkeletonProps {
  /** Shape variant controlling border radius and default dimensions */
  variant: 'text' | 'circle' | 'rect';
  /** Width of the skeleton element (CSS value or number in px) */
  width?: string | number;
  /** Height of the skeleton element (CSS value or number in px) */
  height?: string | number;
  /** Additional CSS classes */
  className?: string;
  /** Accessible label describing the loading content */
  'aria-label'?: string;
}

const variantStyles: Record<SkeletonProps['variant'], string> = {
  text: 'rounded-md',
  circle: 'rounded-full',
  rect: 'rounded-md',
};

/**
 * Skeleton — a shimmer placeholder for loading content.
 */
export function Skeleton({
  variant,
  width,
  height,
  className,
  'aria-label': ariaLabel,
}: SkeletonProps) {
  const resolvedWidth =
    width !== undefined
      ? typeof width === 'number'
        ? `${width}px`
        : width
      : variant === 'text'
        ? '100%'
        : undefined;

  const resolvedHeight =
    height !== undefined
      ? typeof height === 'number'
        ? `${height}px`
        : height
      : variant === 'text'
        ? '16px'
        : variant === 'circle' && width !== undefined
          ? typeof width === 'number'
            ? `${width}px`
            : width
          : undefined;

  return (
    <div
      className={cn(
        'animate-skeleton-shimmer',
        variantStyles[variant],
        className,
      )}
      style={{
        width: resolvedWidth,
        height: resolvedHeight,
      }}
      role="status"
      aria-label={ariaLabel ?? 'Loading...'}
      aria-busy="true"
    />
  );
}
