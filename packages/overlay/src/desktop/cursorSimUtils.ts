import { CursorOverlayController } from './CursorOverlay';

function randomRange(min: number, max: number) {
  return min + Math.random() * (max - min);
}

// Generalized: Simulate cursor following a menu path (e.g., ['Programs', 'Browser'])
export async function openMenuPath(cursor: CursorOverlayController, path: string[], options: { startMenu?: boolean, delay?: number } = {}): Promise<boolean> {
  const { startMenu = true, delay = 500 } = options;
  let success = true;
  const simOpenedMenus: HTMLElement[] = [];
  const simHighlightedItems: HTMLElement[] = [];
  (window as any).__simulatingCursorClick = true;
  try {
    if (startMenu) {
      // Open Start menu first
      const startBtn = document.querySelector('.taskbar-start-btn');
      if (startBtn instanceof HTMLElement) {
        await moveCursorAndClick(cursor, startBtn, randomRange(560, 860));
        startBtn.click();
      }
      await new Promise((r) => setTimeout(r, delay + randomRange(40, 180)));
    }
    for (let i = 0; i < path.length; ++i) {
      const label = path[i];
      let el: HTMLElement | null = null;
      if (i === 0) {
        // First level: .start-menu-item-label (e.g., 'Programs')
        const items = Array.from(document.querySelectorAll('.start-menu-item-label'));
        el = items.find((item) => item.textContent?.trim() === label)?.parentElement as HTMLElement | null;
      } else if (i === 1) {
        // Second level: .start-menu-sub-item (e.g., 'Browser')
        const items = Array.from(document.querySelectorAll('.start-menu-sub-item')) as HTMLElement[];
        el = items.find((item) => item.offsetParent !== null && item.textContent?.trim() === label) ?? null;
        if (!el) {
          el = items.find((item) => item.offsetParent !== null && item.textContent?.trim().includes(label)) ?? null;
        }
      }
      if (!el) {
        // Try fallback: search any button with matching text
        const btns = Array.from(document.querySelectorAll('button'));
        el = btns.find((btn) => btn.textContent?.trim() === label) as HTMLElement | null;
      }
      if (el) {
        if (i === 0) {
          el.classList.add('start-menu-item--sim-open', 'start-menu-item--sim-hover');
          simOpenedMenus.push(el);
          simHighlightedItems.push(el);
        }
        if (i > 0) {
          el.classList.add('start-menu-sub-item--sim-hover');
          simHighlightedItems.push(el);
        }
        await moveCursorAndClick(cursor, el, randomRange(520, 920));
        el.click();
        await new Promise((r) => setTimeout(r, delay + randomRange(30, 160)));
      } else {
        // Not found, abort
        success = false;
        break;
      }
    }
  } finally {
    for (const item of simHighlightedItems) {
      item.classList.remove('start-menu-item--sim-hover', 'start-menu-sub-item--sim-hover');
    }
    for (const menu of simOpenedMenus) {
      menu.classList.remove('start-menu-item--sim-open');
    }
    (window as any).__simulatingCursorClick = false;
  }
  return success;
}

// Reusable cursor simulation entrypoint for widget opening.
export async function runWidgetCursorSimulation(
  cursor: CursorOverlayController,
  widgetLabel: string,
  options: { hideAfterMs?: number; menuPath?: string[] } = {},
) {
  const { hideAfterMs, menuPath } = options;
  cursor.setVisible(true);
  const opened = await openMenuPath(cursor, menuPath ?? ['Programs', widgetLabel]);
  if (typeof hideAfterMs === 'number') {
    setTimeout(() => cursor.setVisible(false), hideAfterMs);
  }
  return opened;
}

// Bring a widget window to front by clicking its taskbar button label.
export async function focusWidgetFromTaskbar(cursor: CursorOverlayController, widgetLabel: string, duration = 600) {
  const btns = Array.from(document.querySelectorAll('.taskbar-window-btn')) as HTMLElement[];
  const btn = btns.find((item) => {
    const label = item.querySelector('.taskbar-window-label')?.textContent?.trim();
    return label === widgetLabel;
  });
  if (!btn) return false;
  await moveCursorAndClick(cursor, btn, duration);
  btn.click();
  return true;
}

// Close a widget by clicking its window Close control.
export async function closeWidgetByWindowButton(cursor: CursorOverlayController, widgetId: string, widgetLabel?: string) {
  let closeBtn = document.querySelector(`[data-widget-id="${widgetId}"] button[aria-label="Close"]`) as HTMLElement | null;

  // If minimized/hidden, try restoring from taskbar and re-query.
  if (!closeBtn && widgetLabel) {
    await focusWidgetFromTaskbar(cursor, widgetLabel, 650);
    await new Promise((r) => setTimeout(r, 250));
    closeBtn = document.querySelector(`[data-widget-id="${widgetId}"] button[aria-label="Close"]`) as HTMLElement | null;
  }

  if (!closeBtn) return false;
  await moveCursorAndClick(cursor, closeBtn, 650);
  closeBtn.click();
  return true;
}

// Move cursor to a DOM element's center and click
export async function moveCursorAndClick(cursor: CursorOverlayController, el: HTMLElement, duration = 600) {
  const rect = el.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  await cursor.moveTo(x, y, { duration });
  await cursor.click();
}

// Find the start menu button (Taskbar) and open it
export async function openStartMenu(cursor: CursorOverlayController) {
  const btn = document.querySelector('.taskbar .taskbar-start');
  if (btn instanceof HTMLElement) {
    await moveCursorAndClick(cursor, btn);
  }
}

// Find a widget icon by label and open it
export async function openWidgetByLabel(cursor: CursorOverlayController, label: string) {
  const icons = Array.from(document.querySelectorAll('.app-icon'));
  for (const icon of icons) {
    const span = icon.querySelector('.app-icon-label');
    if (span && span.textContent?.trim() === label) {
      await moveCursorAndClick(cursor, icon as HTMLElement);
      return true;
    }
  }
  return false;
}

// Find the taskbar widget button by label and click it
export async function openWidgetFromTaskbar(cursor: CursorOverlayController, label: string) {
  const btns = Array.from(document.querySelectorAll('.taskbar-window-btn'));
  for (const btn of btns) {
    const span = btn.querySelector('.taskbar-window-label');
    if (span && span.textContent?.trim() === label) {
      await moveCursorAndClick(cursor, btn as HTMLElement);
      return true;
    }
  }
  return false;
}
