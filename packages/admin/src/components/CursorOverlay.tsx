import React, { useEffect, useRef, useState } from 'react';

export function CursorOverlay({ target, onClick }: { target: { x: number, y: number }, onClick?: () => void }) {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const cursorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Animate cursor to target
    const anim = setInterval(() => {
      setPos((prev) => ({
        x: prev.x + (target.x - prev.x) * 0.2,
        y: prev.y + (target.y - prev.y) * 0.2,
      }));
    }, 16);
    return () => clearInterval(anim);
  }, [target]);

  useEffect(() => {
    // Simulate click when close to target
    if (Math.abs(pos.x - target.x) < 5 && Math.abs(pos.y - target.y) < 5 && onClick) {
      onClick();
    }
  }, [pos, target, onClick]);

  return (
    <div
      ref={cursorRef}
      style={{
        position: 'fixed',
        left: pos.x,
        top: pos.y,
        width: 24,
        height: 24,
        pointerEvents: 'none',
        zIndex: 9999,
        transition: 'background 0.2s',
      }}
    >
      <svg width="24" height="24">
        <circle cx="12" cy="12" r="8" fill="rgba(0,0,0,0.7)" />
      </svg>
    </div>
  );
}
