import { cn } from '../../utils/cn';

/**
 * VuMeter molecule for the IEOM Admin Panel design system.
 *
 * A horizontal level bar (0-1) with a green→amber→red gradient fill, used
 * to give a live visual confirmation that audio is actually reaching an
 * analyser — e.g. the Audio panel's reactivity source, so an operator can
 * tell "is my screen-share widget's audio wired in?" without needing beat/
 * energy events to fire first.
 *
 * Purely a display primitive — level must be fed in (0-1, already smoothed/
 * decayed by the caller if desired).
 *
 * @example
 * ```tsx
 * <VuMeter level={level} label="Level" />
 * ```
 */

export interface VuMeterProps {
  /** Current level, 0-1. Values outside this range are clamped. */
  level: number;
  /** Optional label rendered to the left of the bar. */
  label?: string;
  /** Additional CSS class names. */
  className?: string;
}

export function VuMeter({ level, label, className }: VuMeterProps) {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(level) ? level : 0));
  const percent = Math.round(clamped * 100);

  return (
    <div className={cn('flex items-center gap-3', className)}>
      {label && (
        <span className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)] w-16 shrink-0">
          {label}
        </span>
      )}
      <div
        className="relative flex-1 h-3 rounded-full overflow-hidden bg-[var(--color-bg-base)] border border-[var(--color-border-default)]"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label={label ?? 'Audio level'}
      >
        <div
          className="absolute inset-y-0 left-0 transition-[width] duration-75 ease-out"
          style={{
            width: `${percent}%`,
            background: 'linear-gradient(90deg, var(--color-success-400) 0%, var(--color-success-400) 60%, var(--color-accent-400) 80%, var(--color-danger-400) 95%)',
          }}
        />
      </div>
      <span className="text-[10px] font-mono text-[var(--color-text-muted)] w-9 text-right shrink-0">
        {percent}%
      </span>
    </div>
  );
}
