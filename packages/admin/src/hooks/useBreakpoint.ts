import { useState, useEffect } from 'react';

const DESKTOP_QUERY = '(min-width: 768px)';

/**
 * Reactively detects viewport breakpoint changes relative to the 768px threshold.
 *
 * Returns `{ isDesktop, isMobile }` where `isDesktop` is `true` when the viewport
 * width is >= 768px. Updates automatically when the viewport crosses the breakpoint.
 *
 * Handles SSR gracefully by defaulting to desktop (`isDesktop: true`) when
 * `window` is undefined.
 *
 * Consumed by the DashboardLayout to auto-collapse the sidebar when the viewport
 * becomes mobile (below 768px).
 *
 * @example
 * ```tsx
 * const { isDesktop, isMobile } = useBreakpoint();
 * if (isMobile) collapseSidebar();
 * ```
 */
export function useBreakpoint(): { isDesktop: boolean; isMobile: boolean } {
  const [isDesktop, setIsDesktop] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return window.matchMedia(DESKTOP_QUERY).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mql = window.matchMedia(DESKTOP_QUERY);

    const handler = (event: MediaQueryListEvent) => {
      setIsDesktop(event.matches);
    };

    // Sync state in case it changed between initial render and effect
    setIsDesktop(mql.matches);

    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  return { isDesktop, isMobile: !isDesktop };
}
