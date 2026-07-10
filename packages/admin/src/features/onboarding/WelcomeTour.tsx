import { useState, useCallback, useEffect } from 'react';
import { cn } from '../../utils/cn';
import { Button } from '../../components/atoms';

/**
 * WelcomeTour — Multi-step onboarding overlay for first-time admin users.
 *
 * Displays a 3-step guided tour highlighting the main UI areas:
 * Top Bar Navigation, Content Area, and Quick Actions.
 * Each step shows a tooltip card with title, description, step indicator,
 * and navigation buttons. A semi-transparent backdrop with a pulsing
 * spotlight outline draws attention to the described region.
 *
 * Uses CSS custom properties from the design token system and the
 * `animate-modal-enter` class for entrance animation.
 *
 * @example
 * ```tsx
 * <WelcomeTour open={showTour} onDismiss={() => setShowTour(false)} />
 * ```
 */

export interface WelcomeTourProps {
  /** Whether the tour overlay is visible */
  open: boolean;
  /** Callback fired when the user completes or dismisses the tour */
  onDismiss: () => void;
}

interface TourStep {
  title: string;
  description: string;
  target: string;
  position: 'right' | 'bottom' | 'left' | 'center';
}

const TOUR_STEPS: TourStep[] = [
  {
    title: 'Top Bar Navigation',
    description:
      'Browse all sections from the top bar — Dashboard, Scenes, Events, Ambiance, and Integrations.',
    target: '[data-tour="topbar"]',
    position: 'bottom',
  },
  {
    title: 'Content Area',
    description:
      'This is where your configurations and panels are displayed. Each section opens here.',
    target: '[data-tour="main-content"]',
    position: 'center',
  },
  {
    title: 'Quick Actions',
    description:
      'Common operations like switching scenes or toggling widgets are one click away.',
    target: '[data-tour="quick-actions"]',
    position: 'left',
  },
];

const TOTAL_STEPS = TOUR_STEPS.length;

/**
 * Positional styles for the tooltip card relative to the highlighted area.
 */
const positionClasses: Record<TourStep['position'], string> = {
  right: 'left-[260px] top-1/3',
  bottom: 'top-[64px] left-1/2 -translate-x-1/2',
  left: 'right-[80px] top-1/3',
  center: 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
};

/**
 * Arrow/indicator direction classes for the tooltip card.
 */
const arrowClasses: Record<TourStep['position'], string> = {
  right:
    'before:absolute before:left-[-6px] before:top-6 before:border-8 before:border-transparent before:border-r-[var(--color-bg-elevated)]',
  bottom:
    'before:absolute before:top-[-6px] before:left-1/2 before:-translate-x-1/2 before:border-8 before:border-transparent before:border-b-[var(--color-bg-elevated)]',
  left:
    'before:absolute before:right-[-6px] before:top-6 before:border-8 before:border-transparent before:border-l-[var(--color-bg-elevated)]',
  center: '',
};

export function WelcomeTour({ open, onDismiss }: WelcomeTourProps) {
  const [currentStep, setCurrentStep] = useState(0);

  const step = TOUR_STEPS[currentStep];
  const isFirst = currentStep === 0;
  const isLast = currentStep === TOTAL_STEPS - 1;

  const handleNext = useCallback(() => {
    if (isLast) {
      onDismiss();
    } else {
      setCurrentStep((s) => s + 1);
    }
  }, [isLast, onDismiss]);

  const handlePrevious = useCallback(() => {
    setCurrentStep((s) => Math.max(0, s - 1));
  }, []);

  if (!open) return null;

  return (
    <div
      className={cn(
        'fixed inset-0 z-[9999]',
        'animate-modal-enter',
      )}
      role="dialog"
      aria-modal="true"
      aria-label="Welcome Tour"
    >
      {/* Semi-transparent backdrop */}
      <div
        className="absolute inset-0 bg-[var(--color-bg-overlay)]"
        onClick={onDismiss}
        aria-hidden="true"
      />

      {/* Spotlight pulsing outline on the target area */}
      <SpotlightHighlight target={step.target} />

      {/* Tooltip card */}
      <div
        className={cn(
          'absolute z-10 w-[320px]',
          'rounded-[var(--radius-lg)] bg-[var(--color-bg-elevated)]',
          'border border-[var(--color-border-strong)]',
          'shadow-[var(--shadow-xl)] p-5',
          'flex flex-col gap-4',
          positionClasses[step.position],
          arrowClasses[step.position],
        )}
      >
        {/* Step indicator */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-[var(--color-text-muted)]">
            {currentStep + 1}/{TOTAL_STEPS}
          </span>
          <div className="flex gap-1">
            {TOUR_STEPS.map((_, i) => (
              <span
                key={i}
                className={cn(
                  'h-1.5 w-1.5 rounded-full transition-colors duration-[var(--duration-fast)]',
                  i === currentStep
                    ? 'bg-[var(--color-primary-400)]'
                    : 'bg-[var(--color-border-strong)]',
                )}
              />
            ))}
          </div>
        </div>

        {/* Title */}
        <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
          {step.title}
        </h2>

        {/* Description */}
        <p className="text-sm leading-relaxed text-[var(--color-text-secondary)]">
          {step.description}
        </p>

        {/* Navigation buttons */}
        <div className="flex items-center justify-between pt-1">
          {!isFirst ? (
            <Button variant="ghost" size="sm" onClick={handlePrevious}>
              Previous
            </Button>
          ) : (
            <span />
          )}

          {isLast ? (
            <Button variant="primary" size="sm" onClick={handleNext}>
              Get Started
            </Button>
          ) : (
            <Button variant="primary" size="sm" onClick={handleNext}>
              Next
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Renders a pulsing border outline around the tour target element
 * identified by a `data-tour` attribute selector.
 */
function SpotlightHighlight({ target }: { target: string }) {
  // The spotlight attempts to find the target element in the DOM
  // and renders a pulsing outline around it. If the element isn't found,
  // we skip the highlight gracefully.
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    const el = document.querySelector(target);
    if (el) {
      setRect(el.getBoundingClientRect());
    } else {
      setRect(null);
    }
  }, [target]);

  if (!rect) return null;

  return (
    <div
      className={cn(
        'absolute z-[1] pointer-events-none',
        'rounded-[var(--radius-lg)]',
        'border-2 border-[var(--color-primary-400)]',
        'shadow-[0_0_0_4px_rgba(34,211,238,0.15)]',
      )}
      style={{
        top: rect.top - 4,
        left: rect.left - 4,
        width: rect.width + 8,
        height: rect.height + 8,
        animation: 'pulse-ring 2s var(--ease-out) infinite',
      }}
      aria-hidden="true"
    />
  );
}
