
import React, { useContext } from 'react';
import { CursorOverlayContext } from './CursorOverlay';
import { runWidgetCursorSimulation } from './cursorSimUtils';

// Example: Open start menu, then open a widget by label
export function CursorSimExample() {
  const cursor = useContext(CursorOverlayContext);

  const runDemo = async () => {
    if (!cursor) return;
    await runWidgetCursorSimulation(cursor, 'Browser', { hideAfterMs: 800 });
  };

  return (
    <button style={{ position: 'absolute', top: 10, right: 10, zIndex: 100000 }} onClick={runDemo}>
      Run Cursor Simulation (Menu + Widget)
    </button>
  );
}
