import { useEffect, useRef, useCallback, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../utils/cn';
import { trapFocus } from '../../utils/accessibility';

/**
 * Modal organism component for the IEOM Admin Panel design system.
 *
 * Renders a dialog overlay via React portal with a semi-transparent backdrop,
 * scale-up entrance animation, focus trapping, Escape key dismissal, and
 * backdrop click-to-close behavior. Focus is returned to the trigger element
 * when the modal closes.
 *
 * @example
 * ```tsx
 * <Modal open={isOpen} onClose={() => setIsOpen(false)} title="Confirm Action">
 *   <p>Are you sure you want to proceed?</p>
 * </Modal>
 * ```
 */

export interface ModalProps {
  /** Whether the modal is currently visible */
  open: boolean;
  /** Callback invoked when the modal should close */
  onClose: () => void;
  /** Optional title rendered as an h2 in the header section */
  title?: string;
  /** Modal body content */
  children: ReactNode;
  /** Additional class names for the content panel */
  className?: string;
}

export function Modal({ open, onClose, title, children, className }: ModalProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<Element | null>(null);

  // Store the active element before the modal opens so we can restore focus on close
  useEffect(() => {
    if (open) {
      triggerRef.current = document.activeElement;
    } else if (triggerRef.current && triggerRef.current instanceof HTMLElement) {
      triggerRef.current.focus();
      triggerRef.current = null;
    }
  }, [open]);

  // Focus trap: trap focus within the modal content when open
  useEffect(() => {
    if (!open || !contentRef.current) return;

    // Move focus into the modal on open
    const focusTarget = contentRef.current;
    requestAnimationFrame(() => {
      focusTarget.focus();
    });

    const cleanup = trapFocus(focusTarget);
    return cleanup;
  }, [open]);

  // Escape key handler
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    },
    [onClose],
  );

  // Backdrop click handler
  const handleBackdropClick = useCallback(
    (event: React.MouseEvent) => {
      if (event.target === event.currentTarget) {
        onClose();
      }
    },
    [onClose],
  );

  if (!open) return null;

  const titleId = title ? 'modal-title' : undefined;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onKeyDown={handleKeyDown}
    >
      {/* Backdrop */}
      <div
        className={cn(
          'absolute inset-0 bg-[var(--color-bg-overlay)]',
          'animate-backdrop-enter',
        )}
        onClick={handleBackdropClick}
        aria-hidden="true"
      />

      {/* Content panel */}
      <div
        ref={contentRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          'relative z-10 w-full max-w-lg',
          'bg-[var(--color-bg-elevated)]',
          'rounded-xl shadow-xl',
          'p-6',
          'animate-modal-enter',
          'focus:outline-none',
          className,
        )}
      >
        {/* Header */}
        {title && (
          <div className="mb-4 flex items-center justify-between">
            <h2
              id={titleId}
              className="text-lg font-semibold text-[var(--color-text-primary)]"
            >
              {title}
            </h2>
            <CloseButton onClick={onClose} />
          </div>
        )}

        {/* Close button when no title */}
        {!title && (
          <div className="absolute right-4 top-4">
            <CloseButton onClick={onClose} />
          </div>
        )}

        {/* Body */}
        {children}
      </div>
    </div>,
    document.body,
  );
}

/** Close button with X icon rendered in the top-right corner. */
function CloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center justify-center',
        'h-8 w-8 rounded-[var(--radius-md)]',
        'text-[var(--color-text-muted)]',
        'hover:bg-[var(--color-bg-surface)] hover:text-[var(--color-text-primary)]',
        'transition-colors duration-[var(--duration-fast)] ease-[var(--ease-default)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-400)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-elevated)]',
      )}
      aria-label="Close modal"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    </button>
  );
}
