import { type LucideIcon } from 'lucide-react';
import { cn } from '../../utils/cn';

/**
 * Icon atom component for the IEOM Admin Panel design system.
 *
 * A thin wrapper around Lucide React icons that standardizes sizing
 * and color token integration across the application. Uses a fixed
 * size scale (sm, md, lg, xl) to ensure visual consistency.
 *
 * Default color is `currentColor`, allowing the icon to inherit
 * the text color of its parent element.
 *
 * @example
 * ```tsx
 * import { Settings } from 'lucide-react';
 *
 * <Icon icon={Settings} size="md" />
 * <Icon icon={Settings} size="lg" color="var(--color-primary-400)" />
 * ```
 */

export interface IconProps {
  /** The Lucide icon component to render */
  icon: LucideIcon;
  /** Size preset controlling the icon dimensions */
  size: 'sm' | 'md' | 'lg' | 'xl';
  /** Color value (CSS color string or design token variable). Defaults to currentColor */
  color?: string;
  /** Additional CSS classes to apply to the icon */
  className?: string;
}

const sizeMap: Record<IconProps['size'], number> = {
  sm: 14,
  md: 18,
  lg: 22,
  xl: 28,
};

export function Icon({ icon: LucideIconComponent, size, color = 'currentColor', className }: IconProps) {
  const pixelSize = sizeMap[size];

  return (
    <LucideIconComponent
      size={pixelSize}
      color={color}
      className={cn('shrink-0', className)}
      aria-hidden="true"
    />
  );
}
