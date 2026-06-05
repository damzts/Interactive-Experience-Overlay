import { useState, useCallback, useEffect, useRef } from 'react';

export interface UseSidebarResizeOptions {
  /** Minimum allowed sidebar width in pixels. @default 200 */
  minWidth?: number;
  /** Maximum allowed sidebar width in pixels. @default 320 */
  maxWidth?: number;
  /** Initial sidebar width in pixels. @default 240 */
  initialWidth?: number;
}

export interface UseSidebarResizeReturn {
  /** Current sidebar width in pixels, clamped between min and max. */
  width: number;
  /** Whether the user is currently dragging the resize handle. */
  isDragging: boolean;
  /** Props to spread onto the resize handle element. */
  handleProps: {
    onMouseDown: (e: React.MouseEvent) => void;
  };
}

/**
 * Manages drag-to-resize logic for the admin sidebar.
 *
 * Tracks mouse movement while the resize handle is held, clamping the
 * resulting width between `minWidth` and `maxWidth`. Sets `cursor: col-resize`
 * on the document body during drag for consistent visual feedback regardless
 * of pointer position.
 *
 * @param options - Configuration for min/max/initial width values.
 * @returns The current width, dragging state, and props for the handle element.
 *
 * @example
 * ```tsx
 * const { width, isDragging, handleProps } = useSidebarResize({ initialWidth: 240 });
 *
 * return (
 *   <aside style={{ width }}>
 *     {/* sidebar content *\/}
 *     <div className="resize-handle" {...handleProps} />
 *   </aside>
 * );
 * ```
 */
export function useSidebarResize(
  options: UseSidebarResizeOptions = {},
): UseSidebarResizeReturn {
  const { minWidth = 200, maxWidth = 320, initialWidth = 240 } = options;

  const [width, setWidth] = useState<number>(() =>
    Math.min(Math.max(initialWidth, minWidth), maxWidth),
  );
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // Use a ref to track the starting X position and width at drag start
  const dragState = useRef<{ startX: number; startWidth: number } | null>(null);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragState.current = { startX: e.clientX, startWidth: width };
      setIsDragging(true);
    },
    [width],
  );

  useEffect(() => {
    if (!isDragging) return;

    // Set col-resize cursor on body for consistent feedback during drag
    const prevCursor = document.body.style.cursor;
    document.body.style.cursor = 'col-resize';

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragState.current) return;

      const delta = e.clientX - dragState.current.startX;
      const newWidth = dragState.current.startWidth + delta;
      setWidth(Math.min(Math.max(newWidth, minWidth), maxWidth));
    };

    const handleMouseUp = () => {
      dragState.current = null;
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.body.style.cursor = prevCursor;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, minWidth, maxWidth]);

  return {
    width,
    isDragging,
    handleProps: {
      onMouseDown: handleMouseDown,
    },
  };
}
