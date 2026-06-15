/// <reference types="vite/client" />
import { CursorOverlayController } from './CursorOverlay';
import type { DesktopStartMenuSimulationPhasePayload, MenuPathTimingStep, OpenWidgetMenuTimelinePayload } from '@ieomlabs/shared';

function randomRange(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function debugMenuSim(debugTag: string | undefined, message: string, details?: unknown) {
  if (!import.meta.env.DEV) return;
  if (!debugTag) return;
  if (details === undefined) {
    console.debug(`[menu-sim:${debugTag}] ${message}`);
    return;
  }
  console.debug(`[menu-sim:${debugTag}] ${message}`, details);
}

function isStartMenuOpen() {
  const menu = document.querySelector('.start-menu');
  return menu instanceof HTMLElement && menu.offsetParent !== null;
}

async function waitForStartMenuOpen(timeoutMs: number) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (isStartMenuOpen()) return true;
    await new Promise((resolve) => setTimeout(resolve, 16));
  }
  return isStartMenuOpen();
}

async function ensureStartMenuOpen(
  cursor: CursorOverlayController,
  options: {
    visualOnly: boolean,
    driveCursorVisualOnly: boolean,
    allowDomActionsInVisualOnly: boolean,
    debugTag?: string,
    delay: number,
    timingPlan?: Pick<OpenWidgetMenuTimelinePayload, 'startMoveMs' | 'startPostMs' | 'steps'>,
  },
) {
  const { visualOnly, driveCursorVisualOnly, allowDomActionsInVisualOnly, debugTag, delay, timingPlan } = options;
  if (isStartMenuOpen()) return true;

  const startBtn = document.querySelector('.taskbar-start-btn');
  if (!(startBtn instanceof HTMLElement)) {
    debugMenuSim(debugTag, 'start button not found');
    return false;
  }

  debugMenuSim(debugTag, 'opening Start menu', {
    visualOnly,
    driveCursorVisualOnly,
    allowDomActionsInVisualOnly,
  });

  const startDelay = timingPlan?.startMoveMs ?? randomRange(700, 1100);
  if (visualOnly) {
    if (driveCursorVisualOnly) {
      const rect = startBtn.getBoundingClientRect();
      await cursor.moveTo(rect.left + rect.width / 2, rect.top + rect.height / 2, { duration: startDelay });
    } else {
      await new Promise((resolve) => setTimeout(resolve, startDelay));
    }
    const startHoverDelay = timingPlan?.steps?.[0]?.hoverMs ?? randomRange(140, 240);
    await new Promise((resolve) => setTimeout(resolve, startHoverDelay));
    if (driveCursorVisualOnly) {
      await cursor.click();
    }
    if (allowDomActionsInVisualOnly) {
      startBtn.click();
    }
  } else {
    await moveCursorAndClick(cursor, startBtn, startDelay);
    const startHoverDelay = timingPlan?.steps?.[0]?.hoverMs ?? randomRange(140, 240);
    await new Promise((resolve) => setTimeout(resolve, startHoverDelay));
    startBtn.click();
  }

  const opened = await waitForStartMenuOpen(700);
  if (!opened) {
    debugMenuSim(debugTag, 'failed to open Start menu within timeout');
    return false;
  }

  debugMenuSim(debugTag, 'Start menu opened');

  const startPostDelay = timingPlan?.startPostMs ?? (delay + randomRange(40, 180));
  await new Promise((resolve) => setTimeout(resolve, startPostDelay));
  return true;
}

export function buildOpenWidgetMenuTimeline(
  widgetLabel: string,
  menuPath: string[],
  targetAppId?: string,
  opts?: { speedMultiplier?: number; moveJitter?: number },
): OpenWidgetMenuTimelinePayload {
  const speed = Math.max(0.1, opts?.speedMultiplier ?? 1.0)
  const jitter = Math.max(0, Math.min(1, opts?.moveJitter ?? 0.3))

  const steps: MenuPathTimingStep[] = menuPath.map(() => {
    const stepJitter = 1 + (Math.random() * 2 - 1) * jitter
    return {
      moveMs: Math.round(randomRange(650, 1050) * stepJitter / speed),
      hoverMs: Math.round(randomRange(180, 320) / speed),
      postMs: Math.round((500 + randomRange(30, 160)) / speed),
    }
  })

  return {
    widgetLabel,
    menuPath,
    targetAppId,
    startMoveMs: Math.round(randomRange(700, 1100) / speed),
    startPostMs: Math.round((500 + randomRange(40, 180)) / speed),
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
    targetAppId?: string,
    activateLeafClick?: boolean,
    openFirstLevelOnHover?: boolean,
    allowDomActionsInVisualOnly?: boolean,
    onPhase?: (payload: DesktopStartMenuSimulationPhasePayload) => void,
    debugTag?: string,
    closeStartMenuAfterPath?: boolean,
    timingPlan?: Pick<OpenWidgetMenuTimelinePayload, 'startMoveMs' | 'startPostMs' | 'steps'>,
  } = {},
): Promise<boolean> {
  const {
    startMenu = true,
    delay = 500,
    visualOnly = false,
    driveCursorVisualOnly = false,
    targetAppId,
    activateLeafClick = true,
    openFirstLevelOnHover = false,
    allowDomActionsInVisualOnly = true,
    onPhase,
    debugTag,
    closeStartMenuAfterPath = false,
    timingPlan,
  } = options;
  debugMenuSim(debugTag, 'menu path begin', {
    path,
    startMenu,
    visualOnly,
    driveCursorVisualOnly,
    targetAppId,
    activateLeafClick,
    openFirstLevelOnHover,
    allowDomActionsInVisualOnly,
  });
  let success = true;
  const simOpenedMenus: HTMLElement[] = [];
  const simHighlightedItems: HTMLElement[] = [];
  (window as any).__simulatingCursorClick = true;
  if (visualOnly) {
    (window as any).__cursorMirrorVisualOnly = true;
  }
  try {
    if (startMenu) {
      const opened = await ensureStartMenuOpen(cursor, {
        visualOnly,
        driveCursorVisualOnly,
        allowDomActionsInVisualOnly,
        debugTag,
        delay,
        timingPlan,
      });
      if (!opened) {
        debugMenuSim(debugTag, 'aborting: Start menu could not open');
        success = false;
      }
    } else {
        if (visualOnly && driveCursorVisualOnly && timingPlan) {
          const startBtn = document.querySelector('.taskbar-start-btn');
          if (startBtn instanceof HTMLElement) {
            const rect = startBtn.getBoundingClientRect();
            await cursor.moveTo(rect.left + rect.width / 2, rect.top + rect.height / 2, { duration: timingPlan.startMoveMs });
            await cursor.click();
            onPhase?.({ phase: 'open' });
            await new Promise((resolve) => setTimeout(resolve, timingPlan.startPostMs));
          }
        }

      // In synced/mirrored flows the menu may not have rendered yet.
      // Ensure it is actually present before traversing the path.
        const visualReadyTimeout = (timingPlan?.startMoveMs ?? 900) + (timingPlan?.startPostMs ?? 500) + 900;
        const ready = await waitForStartMenuOpen(allowDomActionsInVisualOnly ? 180 : visualReadyTimeout);
      if (!ready) {
        if (allowDomActionsInVisualOnly) {
          const opened = await ensureStartMenuOpen(cursor, {
            visualOnly,
            driveCursorVisualOnly,
            allowDomActionsInVisualOnly,
            debugTag,
            delay,
            timingPlan,
          });
          if (!opened) {
            debugMenuSim(debugTag, 'aborting: Start menu not ready after fallback open');
            success = false;
          }
        } else {
          debugMenuSim(debugTag, 'aborting: Start menu not ready and DOM actions disabled in visual-only mode');
          success = false;
        }
      }
    }
    for (let i = 0; success && i < path.length; ++i) {
      const label = path[i];
      let el: HTMLElement | null = null;
      if (i === 0) {
        // First level: .start-menu-item-label (e.g., 'Programs')
        const items = Array.from(document.querySelectorAll('.start-menu-item-label'));
        el = items.find((item) => item.textContent?.trim() === label)?.parentElement as HTMLElement | null;
      } else if (i === 1) {
        if (targetAppId) {
          const byId = document.querySelector(`.start-menu-sub-item[data-start-app-id="${targetAppId}"]`);
          if (byId instanceof HTMLElement && byId.offsetParent !== null) {
            el = byId;
          }
        }
        // Second level: .start-menu-sub-item (e.g., 'Browser')
        if (!el) {
          const items = Array.from(document.querySelectorAll('.start-menu-sub-item')) as HTMLElement[];
          el = items.find((item) => item.offsetParent !== null && item.textContent?.trim() === label) ?? null;
          if (!el) {
            el = items.find((item) => item.offsetParent !== null && item.textContent?.trim().includes(label)) ?? null;
          }
        }
      }
      if (!el) {
        // Try fallback: search any button with matching text
        const btns = Array.from(document.querySelectorAll('button'));
        el = btns.find((btn) => btn.textContent?.trim() === label) as HTMLElement | null;
      }
      if (el) {
        const isLeafStep = i === path.length - 1;
        const hoverOpenIntermediate = openFirstLevelOnHover && i === 0 && !isLeafStep;
        const shouldActivate = hoverOpenIntermediate ? false : (!isLeafStep || activateLeafClick);
        debugMenuSim(debugTag, 'step target resolved', {
          stepIndex: i,
          label,
          isLeafStep,
          hoverOpenIntermediate,
          shouldActivate,
          tag: el.className,
        });
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
            onPhase?.({ phase: 'programs-hover' });
          } else {
            el.classList.add('start-menu-sub-item--sim-hover');
            simHighlightedItems.push(el);
            onPhase?.({ phase: 'target-hover', targetAppId });
          }
          // Show hover state briefly so mirrored previews can see the menu navigation.
          await new Promise((r) => setTimeout(r, hoverDelay));
          if (driveCursorVisualOnly && !hoverOpenIntermediate) {
            await cursor.click();
            if (i === 1) {
              onPhase?.({ phase: 'target-select', targetAppId });
            }
          }
          if (shouldActivate && allowDomActionsInVisualOnly) {
            el.click();
            if (i === 0) {
              el.classList.add('start-menu-item--sim-open');
              simOpenedMenus.push(el);
              onPhase?.({ phase: 'programs-open' });
            }
          } else if (hoverOpenIntermediate) {
            el.classList.add('start-menu-item--sim-open');
            simOpenedMenus.push(el);
            onPhase?.({ phase: 'programs-open' });
          }
        } else {
          if (hoverOpenIntermediate) {
            const rect = el.getBoundingClientRect();
            await cursor.moveTo(rect.left + rect.width / 2, rect.top + rect.height / 2, { duration: moveDelay });
          } else {
            await moveCursorAndClick(cursor, el, moveDelay);
          }
          if (i === 0) {
            el.classList.add('start-menu-item--sim-hover');
            simHighlightedItems.push(el);
            onPhase?.({ phase: 'programs-hover' });
          } else {
            el.classList.add('start-menu-sub-item--sim-hover');
            simHighlightedItems.push(el);
            onPhase?.({ phase: 'target-hover', targetAppId });
          }
          await new Promise((r) => setTimeout(r, hoverDelay));
          // moveCursorAndClick animates the simulated cursor; this executes the real UI action.
          if (shouldActivate) {
            el.click();
            if (i === 1) {
              onPhase?.({ phase: 'target-select', targetAppId });
            }
            if (i === 0) {
              el.classList.add('start-menu-item--sim-open');
              simOpenedMenus.push(el);
              onPhase?.({ phase: 'programs-open' });
            }
          } else if (hoverOpenIntermediate) {
            el.classList.add('start-menu-item--sim-open');
            simOpenedMenus.push(el);
            onPhase?.({ phase: 'programs-open' });
          }
        }
        const postDelay = timingPlan?.steps?.[i]?.postMs ?? (delay + randomRange(30, 160));
        await new Promise((r) => setTimeout(r, postDelay));
      } else {
        // Not found, abort
        debugMenuSim(debugTag, 'step target not found', { stepIndex: i, label, targetAppId });
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
    if (closeStartMenuAfterPath && (!visualOnly || allowDomActionsInVisualOnly) && isStartMenuOpen()) {
      const startBtn = document.querySelector('.taskbar-start-btn');
      if (startBtn instanceof HTMLElement) {
        debugMenuSim(debugTag, 'closing Start menu after path');
        startBtn.click();
      }
    }
    if (visualOnly) {
      (window as any).__cursorMirrorVisualOnly = false;
    }
    (window as any).__simulatingCursorClick = false;
  }
  debugMenuSim(debugTag, 'menu path finished', { success });
  return success;
}

// Reusable cursor simulation entrypoint for widget opening.
export async function runWidgetCursorSimulation(
  cursor: CursorOverlayController,
  widgetLabel: string,
  options: {
    hideAfterMs?: number;
    startMenu?: boolean;
    menuPath?: string[];
    visualOnly?: boolean;
    driveCursorVisualOnly?: boolean;
    targetAppId?: string;
    activateLeafClick?: boolean;
    openFirstLevelOnHover?: boolean;
    allowDomActionsInVisualOnly?: boolean;
    onPhase?: (payload: DesktopStartMenuSimulationPhasePayload) => void;
    debugTag?: string;
    closeStartMenuAfterPath?: boolean;
    timingPlan?: Pick<OpenWidgetMenuTimelinePayload, 'startMoveMs' | 'startPostMs' | 'steps'>;
  } = {},
) {
  const {
    hideAfterMs,
    startMenu = true,
    menuPath,
    visualOnly = false,
    driveCursorVisualOnly = false,
    targetAppId,
    activateLeafClick = true,
    openFirstLevelOnHover = false,
    allowDomActionsInVisualOnly = true,
    onPhase,
    debugTag,
    closeStartMenuAfterPath = false,
    timingPlan,
  } = options;
  if (!visualOnly || driveCursorVisualOnly) {
    cursor.setVisible(true);
  }
  const opened = await openMenuPath(cursor, menuPath ?? ['Programs', widgetLabel], {
    startMenu,
    visualOnly,
    driveCursorVisualOnly,
    targetAppId,
    activateLeafClick,
    openFirstLevelOnHover,
    allowDomActionsInVisualOnly,
    onPhase,
    debugTag,
    closeStartMenuAfterPath,
    timingPlan,
  });
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
  const target = (root.querySelector('.desktop-window-title') as HTMLElement | null)
    ?? (root.querySelector('.window-body') as HTMLElement | null)
    ?? root;
  await moveCursorAndClick(cursor, target, duration);

  // A direct .click() does not trigger onMouseDown, while z-index focus uses onMouseDown.
  const rect = target.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  (window as any).__simulatingWidgetFocus = true;
  try {
    dispatchMouse(root, 'mousedown', x, y, 1);
    dispatchMouse(window, 'mouseup', x, y, 0);
  } finally {
    (window as any).__simulatingWidgetFocus = false;
  }
  target.click();

  // Let focus/z-index state settle before subsequent interactions.
  await new Promise((resolve) => setTimeout(resolve, 90));
  return true;
}

// Close a widget by clicking its window Close control.
export async function closeWidgetByWindowButton(cursor: CursorOverlayController, widgetId: string, widgetLabel?: string) {
  // Bring target window to the foreground before attempting to close it.
  const focused = await focusWidgetWindow(cursor, widgetId, 420);
  if (!focused && widgetLabel) {
    await focusWidgetFromTaskbar(cursor, widgetLabel, 650);
    await new Promise((resolve) => setTimeout(resolve, 220));
  }

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
    performNativeClick?: boolean
  } = {},
) {
  if (!selectors.length) return false;
  const {
    moveMinMs = 480,
    moveMaxMs = 860,
    postDelayMinMs = 140,
    postDelayMaxMs = 420,
    performNativeClick = true,
  } = options;
  const root = document.querySelector(`[data-widget-id="${widgetId}"]`) as HTMLElement | null;
  if (!root) return false;

  // Always bring the widget to front before selecting an interaction target.
  await focusWidgetWindow(cursor, widgetId, randomRange(280, 460));

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

  const centerPointIsVisible = (el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const top = document.elementFromPoint(x, y) as HTMLElement | null;
    if (!top) return false;
    return top === el || el.contains(top) || top.contains(el);
  };

  const visibleCandidates = candidates.filter(centerPointIsVisible);
  const pool = visibleCandidates.length > 0 ? visibleCandidates : candidates;
  const target = pool[Math.floor(Math.random() * pool.length)];
  await moveCursorAndClick(cursor, target, randomRange(moveMinMs, moveMaxMs));
  if (performNativeClick) {
    target.click();
  }
  await new Promise((resolve) => setTimeout(resolve, randomRange(postDelayMinMs, postDelayMaxMs)));
  return true;
}

function dispatchMouse(target: EventTarget, type: 'mousedown' | 'mousemove' | 'mouseup', x: number, y: number, buttons = 1) {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: x,
    clientY: y,
    button: 0,
    buttons,
    view: window,
  });
  ;(target as HTMLElement | Window).dispatchEvent(event);
}

export async function simulateWidgetWindowDrag(
  cursor: CursorOverlayController,
  widgetId: string,
  options: {
    distanceMin?: number;
    distanceMax?: number;
    steps?: number;
  } = {},
) {
  const root = document.querySelector(`[data-widget-id="${widgetId}"]`) as HTMLElement | null;
  if (!root) return false;
  const titleBar = root.querySelector('.desktop-window-title') as HTMLElement | null;
  if (!titleBar) return false;

  const { distanceMin = 72, distanceMax = 180, steps = 6 } = options;
  const startRect = titleBar.getBoundingClientRect();
  const startX = startRect.left + Math.min(startRect.width - 24, Math.max(24, startRect.width * 0.65));
  const startY = startRect.top + startRect.height / 2;

  const angle = randomRange(0, Math.PI * 2);
  const distance = randomRange(distanceMin, distanceMax);
  const rawTargetX = startX + Math.cos(angle) * distance;
  const rawTargetY = startY + Math.sin(angle) * distance;
  const targetX = Math.min(window.innerWidth - 60, Math.max(60, rawTargetX));
  const targetY = Math.min(window.innerHeight - 120, Math.max(40, rawTargetY));

  await cursor.moveTo(startX, startY, { duration: randomRange(520, 840) });
  dispatchMouse(titleBar, 'mousedown', startX, startY, 1);

  for (let index = 1; index <= steps; index += 1) {
    const t = index / steps;
    const x = startX + (targetX - startX) * t;
    const y = startY + (targetY - startY) * t;
    await cursor.moveTo(x, y, { duration: randomRange(120, 220) });
    dispatchMouse(window, 'mousemove', x, y, 1);
  }

  dispatchMouse(window, 'mouseup', targetX, targetY, 0);
  await new Promise((resolve) => setTimeout(resolve, randomRange(140, 320)));
  return true;
}

export async function simulateWidgetWindowResize(
  cursor: CursorOverlayController,
  widgetId: string,
  options: {
    deltaMin?: number;
    deltaMax?: number;
    steps?: number;
  } = {},
) {
  const root = document.querySelector(`[data-widget-id="${widgetId}"]`) as HTMLElement | null;
  if (!root) return false;
  const handle = root.querySelector('[data-widget-resize-handle="true"]') as HTMLElement | null;
  if (!handle) return false;

  const { deltaMin = -80, deltaMax = 140, steps = 6 } = options;
  const rect = handle.getBoundingClientRect();
  const startX = rect.left + rect.width / 2;
  const startY = rect.top + rect.height / 2;
  const deltaX = randomRange(deltaMin, deltaMax);
  const deltaY = randomRange(deltaMin, deltaMax);
  const targetX = Math.min(window.innerWidth - 24, Math.max(24, startX + deltaX));
  const targetY = Math.min(window.innerHeight - 64, Math.max(24, startY + deltaY));

  await cursor.moveTo(startX, startY, { duration: randomRange(520, 840) });
  dispatchMouse(handle, 'mousedown', startX, startY, 1);

  for (let index = 1; index <= steps; index += 1) {
    const t = index / steps;
    const x = startX + (targetX - startX) * t;
    const y = startY + (targetY - startY) * t;
    await cursor.moveTo(x, y, { duration: randomRange(120, 220) });
    dispatchMouse(window, 'mousemove', x, y, 1);
  }

  dispatchMouse(window, 'mouseup', targetX, targetY, 0);
  await new Promise((resolve) => setTimeout(resolve, randomRange(160, 320)));
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
