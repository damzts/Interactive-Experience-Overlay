import { useState, useEffect, useId, type ReactNode } from 'react';
import { cn } from '../../utils/cn';

/**
 * Tooltip atom component for the IEOM Admin Panel design system.
 *
 * Displays a contextual text label on hover or focus of the trigger element.
 * Supports four positioning options (top, bottom, left, right) and a
 * configurable show delay (default 200ms) to prevent accidental triggers.
 *
 * Uses `role="tooltip"` and `aria-describedby` for screen reader accessibility.
 * Styled with an elevated dark background, light text, and a fade-in animation
 * using the design token system's CSS custom properties.
 *
 * @example
 * ```tsx
 * <Tooltip content="Save changes" position="top">
 *   <Button variant="primary" size="sm" icon={<Save />}>Save</Button>
 * </Tooltip>
 * ```
 */

export interface TooltipProps {
  /** Text content displayed inside the tooltip */
  content: string;
  /** Position of the tooltip relative to the trigger element */
  position: 'top' | 'bottom' | 'left' | 'right';
  /** Delay in milliseconds before the tooltip appears (default: 200ms) */
  delay?: number;
  /** Trigger element that the tooltip is attached to */
  children: ReactNode;
}

/** Positioning styles for each tooltip placement */
const positionStyles: Record<TooltipProps['position'], string> = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
  left: 'right-full top-1/2 -translate-y-1/2 mr-2',
  right: 'left-full top-1/2 -translate-y-1/2 ml-2',
};

export function Tooltip({
  content,
  position,
  delay = 200,
  children,
}: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);
  const tooltipId = useId();

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    if (visible) {
      timer = setTimeout(() => {
        setShouldRender(true);
      }, delay);
    } else {
      setShouldRender(false);
    }

    return () => {
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [visible, delay]);

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      <div aria-describedby={shouldRender ? tooltipId : undefined}>
        {children}
      </div>

      {shouldRender && (
        <div
          id={tooltipId}
          role="tooltip"
          className={cn(
            'absolute z-50 pointer-events-none',
            'px-2 py-1 text-xs font-medium whitespace-nowrap',
            'bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)]',
            'rounded-[var(--radius-sm)]',
            'shadow-[var(--shadow-md)]',
            'animate-[fadeIn_var(--duration-fast)_var(--ease-default)]',
            positionStyles[position],
          )}
        >
          {content}
        </div>
      )}
    </div>
  );
}
