import { CursorOverlayController } from './CursorOverlay';
import type { MenuPathTimingStep, OpenWidgetMenuTimelinePayload } from '@ieom/shared';

function randomRange(min: number, max: number) {
  return min + Math.random() * (max - min);
}

export function buildOpenWidgetMenuTimeline(widgetLabel: string, menuPath: string[]): OpenWidgetMenuTimelinePayload {
  const steps: MenuPathTimingStep[] = menuPath.map(() => ({
    moveMs: Math.round(randomRange(650, 1050)),
    hoverMs: Math.round(randomRange(180, 320)),
    postMs: Math.round(500 + randomRange(30, 160)),
  }));
  return {
    widgetLabel,
    menuPath,
    startMoveMs: Math.round(randomRange(700, 1100)),
    startPostMs: Math.round(500 + randomRange(40, 180)),
    steps,
  };
}

// Generalized: Simulate cursor following a menu path (e.g., ['Programs', 'Browser'])
export async function openMenuPath(
  cursor: CursorOverlayController,
  path: string[],
  options: {
    startMenu?: boolean,
    delay?: number,
    visualOnly?: boolean,
    driveCursorVisualOnly?: boolean,
    timingPlan?: Pick<OpenWidgetMenuTimelinePayload, 'startMoveMs' | 'startPostMs' | 'steps'>,
  } = {},
): Promise<boolean> {
  const { startMenu = true, delay = 500, visualOnly = false, driveCursorVisualOnly = false, timingPlan } = options;
  let success = true;
  const simOpenedMenus: HTMLElement[] = [];
  const simHighlightedItems: HTMLElement[] = [];
  (window as any).__simulatingCursorClick = true;
  if (visualOnly) {
    (window as any).__cursorMirrorVisualOnly = true;
  }
  try {
    if (startMenu) {
      // Open Start menu first
      const startBtn = document.querySelector('.taskbar-start-btn');
      if (startBtn instanceof HTMLElement) {
        const startDelay = timingPlan?.startMoveMs ?? randomRange(700, 1100);
        if (visualOnly) {
          if (driveCursorVisualOnly) {
            const rect = startBtn.getBoundingClientRect();
            await cursor.moveTo(rect.left + rect.width / 2, rect.top + rect.height / 2, { duration: startDelay });
          } else {
            await new Promise((r) => setTimeout(r, startDelay));
          }
          const startHoverDelay = timingPlan?.steps?.[0]?.hoverMs ?? randomRange(140, 240);
          await new Promise((r) => setTimeout(r, startHoverDelay));
          if (driveCursorVisualOnly) {
            await cursor.click();
          }
          // Keep the menu visibly open in mirrored clients without re-triggering widget actions.
          startBtn.click();
        } else {
          await moveCursorAndClick(cursor, startBtn, startDelay);
          const startHoverDelay = timingPlan?.steps?.[0]?.hoverMs ?? randomRange(140, 240);
          await new Promise((r) => setTimeout(r, startHoverDelay));
          startBtn.click();
        }
      }
      const startPostDelay = timingPlan?.startPostMs ?? (delay + randomRange(40, 180));
      await new Promise((r) => setTimeout(r, startPostDelay));
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
          el.classList.add('start-menu-item--sim-open');
          simOpenedMenus.push(el);
        }
        const stepPlan = timingPlan?.steps?.[i];
        const moveDelay = stepPlan?.moveMs ?? randomRange(650, 1050);
        const hoverDelay = stepPlan?.hoverMs ?? randomRange(180, 320);
        if (visualOnly) {
          if (driveCursorVisualOnly) {
            const rect = el.getBoundingClientRect();
            await cursor.moveTo(rect.left + rect.width / 2, rect.top + rect.height / 2, { duration: moveDelay });
          } else {
            await new Promise((r) => setTimeout(r, moveDelay));
          }
          if (i === 0) {
            el.classList.add('start-menu-item--sim-hover');
            simHighlightedItems.push(el);
          } else {
            el.classList.add('start-menu-sub-item--sim-hover');
            simHighlightedItems.push(el);
          }
          // Show hover state briefly so mirrored previews can see the menu navigation.
          await new Promise((r) => setTimeout(r, hoverDelay));
          if (driveCursorVisualOnly) {
            await cursor.click();
          }
          el.click();
        } else {
          await moveCursorAndClick(cursor, el, moveDelay);
          if (i === 0) {
            el.classList.add('start-menu-item--sim-hover');
            simHighlightedItems.push(el);
          } else {
            el.classList.add('start-menu-sub-item--sim-hover');
            simHighlightedItems.push(el);
          }
          await new Promise((r) => setTimeout(r, hoverDelay));
          el.click();
        }
        const postDelay = timingPlan?.steps?.[i]?.postMs ?? (delay + randomRange(30, 160));
        await new Promise((r) => setTimeout(r, postDelay));
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
    if (visualOnly) {
      (window as any).__cursorMirrorVisualOnly = false;
    }
    (window as any).__simulatingCursorClick = false;
  }
  return success;
}

// Reusable cursor simulation entrypoint for widget opening.
export async function runWidgetCursorSimulation(
  cursor: CursorOverlayController,
  widgetLabel: string,
  options: {
    hideAfterMs?: number;
    menuPath?: string[];
    visualOnly?: boolean;
    driveCursorVisualOnly?: boolean;
    timingPlan?: Pick<OpenWidgetMenuTimelinePayload, 'startMoveMs' | 'startPostMs' | 'steps'>;
  } = {},
) {
  const { hideAfterMs, menuPath, visualOnly = false, driveCursorVisualOnly = false, timingPlan } = options;
  if (!visualOnly || driveCursorVisualOnly) {
    cursor.setVisible(true);
  }
  const opened = await openMenuPath(cursor, menuPath ?? ['Programs', widgetLabel], { visualOnly, driveCursorVisualOnly, timingPlan });
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
  const title = btn.getAttribute('title')?.toLowerCase() ?? '';
  const minimized = title.includes('restore');
  if (!minimized) return false;
  await moveCursorAndClick(cursor, btn, duration);
  btn.click();
  return true;
}

// Focus widget by clicking inside its window (does not toggle minimize state).
export async function focusWidgetWindow(cursor: CursorOverlayController, widgetId: string, duration = 520) {
  const root = document.querySelector(`[data-widget-id="${widgetId}"]`) as HTMLElement | null;
  if (!root) return false;
  const target = (root.querySelector('.window-body') as HTMLElement | null) ?? root;
  await moveCursorAndClick(cursor, target, duration);
  target.click();
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

// Interact with one control inside a widget window using recipe selectors.
export async function interactWithWidgetByRecipe(
  cursor: CursorOverlayController,
  widgetId: string,
  selectors: string[],
  options: {
    moveMinMs?: number
    moveMaxMs?: number
    postDelayMinMs?: number
    postDelayMaxMs?: number
  } = {},
) {
  if (!selectors.length) return false;
  const {
    moveMinMs = 480,
    moveMaxMs = 860,
    postDelayMinMs = 140,
    postDelayMaxMs = 420,
  } = options;
  const root = document.querySelector(`[data-widget-id="${widgetId}"]`) as HTMLElement | null;
  if (!root) return false;
  const body = root.querySelector('.window-body') as HTMLElement | null;
  if (!body) return false;

  const candidates: HTMLElement[] = [];
  for (const selector of selectors) {
    const elements = Array.from(body.querySelectorAll(selector)) as HTMLElement[];
    for (const element of elements) {
      if (element.offsetParent === null) continue;
      if (element.hasAttribute('disabled')) continue;
      candidates.push(element);
    }
  }

  if (!candidates.length) return false;
  const target = candidates[Math.floor(Math.random() * candidates.length)];
  await moveCursorAndClick(cursor, target, randomRange(moveMinMs, moveMaxMs));
  target.click();
  await new Promise((resolve) => setTimeout(resolve, randomRange(postDelayMinMs, postDelayMaxMs)));
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
