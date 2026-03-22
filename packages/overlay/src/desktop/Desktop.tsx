import { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import { socket } from '../socket/client'
import { DEFAULT_CONFIG, DEFAULT_SYSTEM_WIDGET_LAYOUT_IDS, STATE, getWidgetComponent, withDesktopConfigDefaults } from '@ieom/shared'
import type { Application, DesktopTheme, OverlayStyle, WidgetComponentType } from '@ieom/shared'
import { useAppStore } from '../store/useAppStore'
import { AppIcon } from './AppIcon'
import { Taskbar } from './Taskbar'
import { ScreenSaver } from './ScreenSaver'
import { MusicWidget } from './MusicWidget'
import { ArchiveWidget } from './ArchiveWidget'
import { ChatWidget } from './ChatWidget'
import { StickyNotesWidget } from './StickyNotesWidget'
import { GalleryWidget } from './GalleryWidget'
import { CameraWidget } from './CameraWidget'
import { SourceWidget } from './SourceWidget'
import { DesktopNotifications } from './DesktopNotifications'
import { DesktopWindow } from './DesktopWindow'
import { AppGlyph } from './AppGlyph'
import { patchApplicationConfig, patchDesktopConfig } from './configPersistence'
import { CursorOverlayProvider } from './CursorOverlay'
import { CursorSimExample } from './CursorSimExample'
import { buildOpenWidgetMenuTimeline, closeWidgetByWindowButton, focusWidgetFromTaskbar, focusWidgetWindow, interactWithWidgetByRecipe, runWidgetCursorSimulation } from './cursorSimUtils';
import { getWidgetSimulationRecipe, pickWidgetInteractionStep } from './widgetSimulationRegistry';
import React from 'react';

interface DesktopWidgetProps {
  appId?: string
  defaultCameraLabel?: string
  defaultMirror?: boolean
  onClose: () => void
  onMinimize?: () => void
  onFocus?: () => void
  windowState?: 'open' | 'closing'
  zIndex?: number
}

/** Maps widget app IDs to their component. Add new widgets here. */
const WIDGET_COMPONENTS: Partial<Record<WidgetComponentType, React.ComponentType<DesktopWidgetProps>>> = {
  music: MusicWidget,
  archive: ArchiveWidget,
  chat: ChatWidget,
  'sticky-notes': StickyNotesWidget,
  gallery: GalleryWidget,
  camera: CameraWidget,
  source: SourceWidget,
}

const MAX_SIM_OPEN_WIDGETS = 2
const OPEN_WHILE_ONE_OPEN_CHANCE = 0.35

function resolveWidgetComponent(app: Application) {
  const widgetComponent = getWidgetComponent(app)
  if (!widgetComponent || widgetComponent === 'generic') return null
  return WIDGET_COMPONENTS[widgetComponent] ?? null
}

const THEME_CLASSNAME: Record<DesktopTheme, string> = {
  win98: 'desktop--theme-win98',
  'frutiger aero': 'desktop--theme-frutiger-aero',
  'y2k candy': 'desktop--theme-y2k-candy',
  'midnight chrome': 'desktop--theme-midnight-chrome',
  'sunset boulevard': 'desktop--theme-sunset-boulevard',
  'coastal glass': 'desktop--theme-coastal-glass',
  'amber terminal': 'desktop--theme-amber-terminal',
  custom: 'desktop--theme-custom',
}

interface ContextMenu {
  x: number
  y: number
  type: 'desktop' | 'icon'
  app?: Application
}

interface DesktopProps {
  apps: Application[]
}

type IconSize = NonNullable<Application['iconSize']>

interface IconDragSession {
  appId: string
  iconSize: IconSize
  pointerStart: { x: number; y: number }
  pointerOffset: { x: number; y: number }
  currentPosition: { x: number; y: number }
  moved: boolean
}

function clampChannel(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)))
}

function adjustHexColor(input: string, delta: number) {
  const hex = input.replace('#', '')
  if (!/^[\da-fA-F]{6}$/.test(hex)) return input
  const r = clampChannel(parseInt(hex.slice(0, 2), 16) + delta)
  const g = clampChannel(parseInt(hex.slice(2, 4), 16) + delta)
  const b = clampChannel(parseInt(hex.slice(4, 6), 16) + delta)
  return `#${[r, g, b].map((value) => value.toString(16).padStart(2, '0')).join('')}`
}

function buildFontStack(fontFamily: string, fallback: string) {
  return `"${fontFamily.replace(/"/g, '\\"')}", ${fallback}`
}

function opaqueHexColor(input: string, fallback: string) {
  const value = input.trim()
  if (/^#[\da-fA-F]{3,4}$/.test(value)) {
    const expanded = value.slice(1).split('').map((char) => char + char).join('')
    return `#${expanded.slice(0, 6)}`
  }
  if (/^#[\da-fA-F]{6}([\da-fA-F]{2})?$/.test(value)) {
    return `#${value.slice(1, 7)}`
  }
  return fallback
}

const DEFAULT_DESKTOP_STYLE = DEFAULT_CONFIG.scenes[STATE.DESKTOP].style

function buildDesktopThemeVars(theme: DesktopTheme, accentColor: string, textColor: string, fontFamily: string): React.CSSProperties {
  const customAccent = accentColor.startsWith('#') ? accentColor : '#2f70c8'
  const customText = textColor || '#ffffff'
  const opaqueCustomText = opaqueHexColor(customText, '#ffffff')
  const hasAccentOverride = theme === 'custom' || (DEFAULT_DESKTOP_STYLE && customAccent.toLowerCase() !== DEFAULT_DESKTOP_STYLE.accentColor.toLowerCase())
  const hasTextOverride = theme === 'custom' || (DEFAULT_DESKTOP_STYLE && customText.toLowerCase() !== DEFAULT_DESKTOP_STYLE.textColor.toLowerCase())
  const hasFontOverride = fontFamily !== 'default' && (DEFAULT_DESKTOP_STYLE && fontFamily !== DEFAULT_DESKTOP_STYLE.fontFamily)

  const vars: Record<string, string> = {
    '--desktop-panel': '#c0c0c0',
    '--desktop-panel-light': '#ffffff',
    '--desktop-panel-dark': '#808080',
    '--desktop-panel-shadow': '#000000',
    '--desktop-title-start': '#000080',
    '--desktop-title-end': '#1084d0',
    '--desktop-title-text': '#ffffff',
    '--desktop-ui-font': 'MS Sans Serif, Arial, sans-serif',
    '--desktop-menu-hover': '#000080',
    '--desktop-menu-danger': '#800000',
    '--desktop-icon-label': '#ffffff',
    '--desktop-icon-shadow': '1px 1px 2px #000, -1px -1px 2px #000',
    '--desktop-tray-glow': 'rgba(0, 204, 0, 0.3)',
  }

  if (theme === 'y2k candy') {
    Object.assign(vars, {
      '--desktop-panel': '#ffe6fb',
      '--desktop-panel-light': '#ffffff',
      '--desktop-panel-dark': '#d76eb8',
      '--desktop-panel-shadow': '#772a72',
      '--desktop-title-start': '#ff7bc6',
      '--desktop-title-end': '#7bdcff',
      '--desktop-title-text': '#3d1140',
      '--desktop-ui-font': 'Trebuchet MS, Verdana, Arial, sans-serif',
      '--desktop-menu-hover': '#f05db3',
      '--desktop-menu-danger': '#bf4378',
      '--desktop-icon-shadow': '0 1px 2px rgba(65, 0, 70, 0.85)',
      '--desktop-tray-glow': 'rgba(255, 143, 216, 0.45)',
    })
  } else if (theme === 'frutiger aero') {
    Object.assign(vars, {
      '--desktop-panel': 'rgba(231, 247, 255, 0.92)',
      '--desktop-panel-light': '#ffffff',
      '--desktop-panel-dark': '#5b8fb8',
      '--desktop-panel-shadow': '#1f466f',
      '--desktop-title-start': '#2aa0e0',
      '--desktop-title-end': '#aef0ff',
      '--desktop-title-text': '#073c61',
      '--desktop-ui-font': 'Tahoma, Segoe UI, Arial, sans-serif',
      '--desktop-menu-hover': '#1187d8',
      '--desktop-menu-danger': '#d24d4d',
      '--desktop-icon-shadow': '0 2px 6px rgba(0, 0, 0, 0.8)',
      '--desktop-tray-glow': 'rgba(55, 226, 255, 0.5)',
    })
  } else if (theme === 'midnight chrome') {
    Object.assign(vars, {
      '--desktop-panel': '#d8e2ef',
      '--desktop-panel-light': '#ffffff',
      '--desktop-panel-dark': '#667382',
      '--desktop-panel-shadow': '#0c1117',
      '--desktop-title-start': '#22384f',
      '--desktop-title-end': '#9ab8d8',
      '--desktop-title-text': '#f6fbff',
      '--desktop-ui-font': 'Tahoma, Segoe UI, Arial, sans-serif',
      '--desktop-menu-hover': '#345c86',
      '--desktop-menu-danger': '#8c3849',
      '--desktop-icon-shadow': '0 2px 8px rgba(0, 0, 0, 0.9)',
      '--desktop-tray-glow': 'rgba(154, 184, 216, 0.4)',
    })
  } else if (theme === 'sunset boulevard') {
    Object.assign(vars, {
      '--desktop-panel': '#ffd8c8',
      '--desktop-panel-light': '#fff6f2',
      '--desktop-panel-dark': '#b96872',
      '--desktop-panel-shadow': '#4c1830',
      '--desktop-title-start': '#ff8b5f',
      '--desktop-title-end': '#ff5c8d',
      '--desktop-title-text': '#47101d',
      '--desktop-ui-font': 'Trebuchet MS, Verdana, Arial, sans-serif',
      '--desktop-menu-hover': '#d65475',
      '--desktop-menu-danger': '#8d2637',
      '--desktop-icon-shadow': '0 2px 6px rgba(48, 7, 18, 0.82)',
      '--desktop-tray-glow': 'rgba(255, 145, 109, 0.45)',
    })
  } else if (theme === 'coastal glass') {
    Object.assign(vars, {
      '--desktop-panel': 'rgba(229, 255, 252, 0.9)',
      '--desktop-panel-light': '#ffffff',
      '--desktop-panel-dark': '#65a1a6',
      '--desktop-panel-shadow': '#123f43',
      '--desktop-title-start': '#3ac6bf',
      '--desktop-title-end': '#b4fff8',
      '--desktop-title-text': '#0a4044',
      '--desktop-ui-font': 'Tahoma, Segoe UI, Arial, sans-serif',
      '--desktop-menu-hover': '#17989c',
      '--desktop-menu-danger': '#b44f4f',
      '--desktop-icon-shadow': '0 2px 6px rgba(0, 30, 32, 0.82)',
      '--desktop-tray-glow': 'rgba(148, 255, 244, 0.5)',
    })
  } else if (theme === 'amber terminal') {
    Object.assign(vars, {
      '--desktop-panel': '#d1a45b',
      '--desktop-panel-light': '#f6ddaf',
      '--desktop-panel-dark': '#74531f',
      '--desktop-panel-shadow': '#130d05',
      '--desktop-title-start': '#5b360d',
      '--desktop-title-end': '#be7c22',
      '--desktop-title-text': '#ffe0a0',
      '--desktop-ui-font': 'Lucida Console, Courier New, monospace',
      '--desktop-menu-hover': '#8e5d16',
      '--desktop-menu-danger': '#7a2d1d',
      '--desktop-icon-label': '#ffd77a',
      '--desktop-icon-shadow': '0 0 10px rgba(0, 0, 0, 0.9)',
      '--desktop-tray-glow': 'rgba(255, 186, 74, 0.45)',
    })
  } else if (theme === 'custom') {
    Object.assign(vars, {
      '--desktop-panel': adjustHexColor(customAccent, 110),
      '--desktop-panel-light': '#ffffff',
      '--desktop-panel-dark': adjustHexColor(customAccent, -35),
      '--desktop-panel-shadow': adjustHexColor(customAccent, -95),
      '--desktop-title-start': adjustHexColor(customAccent, -20),
      '--desktop-title-end': adjustHexColor(customAccent, 35),
      '--desktop-title-text': customText,
      '--desktop-ui-font': 'Segoe UI, Arial, sans-serif',
      '--desktop-menu-hover': adjustHexColor(customAccent, -25),
      '--desktop-menu-danger': '#9f2d41',
      '--desktop-icon-label': opaqueCustomText,
      '--desktop-tray-glow': `${customAccent}55`,
    })
  }

  if (theme !== 'custom' && hasAccentOverride) {
    vars['--desktop-title-end'] = customAccent
    vars['--desktop-menu-hover'] = customAccent
    vars['--desktop-tray-glow'] = `${customAccent}55`
  }

  if (theme !== 'custom' && hasTextOverride) {
    vars['--desktop-title-text'] = customText
    vars['--desktop-icon-label'] = opaqueCustomText
  }

  if (hasFontOverride) {
    vars['--desktop-ui-font'] = buildFontStack(fontFamily, vars['--desktop-ui-font'])
  }

  return vars as React.CSSProperties
}

// ── Icon grid layout ──────────────────────────────────────────
// Slot dimensions: icon area + padding + label + inter-icon gap
const ICON_SLOT_W: Record<IconSize, number> = { small: 68, normal: 84, large: 106 }
const ICON_RENDER_W: Record<IconSize, number> = { small: 60, normal: 76, large: 90 }
const ICON_RENDER_H: Record<IconSize, number> = { small: 74, normal: 86, large: 98 }
const ICON_SLOT_H  = 88
const DESKTOP_PAD  = 16
const TASKBAR_H    = 40
const CANVAS_H     = 1080
const DRAG_THRESHOLD_PX = 4

function resolveWidgetStackPreference(
  widgetId: string,
  runtimeZIndices: Record<string, number>,
  defaultZIndices: Record<string, number>,
) {
  const runtimeValue = runtimeZIndices[widgetId]
  if (Number.isFinite(runtimeValue)) return runtimeValue as number
  const defaultValue = defaultZIndices[widgetId]
  if (Number.isFinite(defaultValue)) return defaultValue as number
  return Number.MAX_SAFE_INTEGER
}

function sortWidgetIdsByStackPreference(
  widgetIds: string[],
  runtimeZIndices: Record<string, number>,
  defaultZIndices: Record<string, number>,
) {
  return [...widgetIds].sort((a, b) => (
    resolveWidgetStackPreference(a, runtimeZIndices, defaultZIndices)
    - resolveWidgetStackPreference(b, runtimeZIndices, defaultZIndices)
  ))
}

function orderVisibleWidgetIds(
  widgetIds: string[],
  runtimeZIndices: Record<string, number>,
  defaultZIndices: Record<string, number>,
) {
  if (widgetIds.some((id) => runtimeZIndices[id] !== undefined)) {
    return sortWidgetIdsByStackPreference(widgetIds, runtimeZIndices, defaultZIndices)
  }
  if (widgetIds.some((id) => defaultZIndices[id] !== undefined)) {
    return sortWidgetIdsByStackPreference(widgetIds, {}, defaultZIndices)
  }

  const nonCameraIds = widgetIds.filter((id) => !/^camera(?:[-:_].+)?$/.test(id))
  const cameraIds = widgetIds.filter((id) => /^camera(?:[-:_].+)?$/.test(id))
  return [...nonCameraIds, ...cameraIds]
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function resolveIconSize(app: Application, defaultIconSize: IconSize): IconSize {
  return app.iconSize ?? defaultIconSize
}

function clampIconPosition(
  position: { x: number; y: number },
  iconSize: IconSize,
  bounds: { width: number; height: number },
) {
  return {
    x: clamp(position.x, 0, Math.max(0, bounds.width - ICON_RENDER_W[iconSize] - DESKTOP_PAD)),
    y: clamp(position.y, 0, Math.max(0, bounds.height - TASKBAR_H - ICON_RENDER_H[iconSize] - DESKTOP_PAD)),
  }
}

/**
 * Assigns a top-to-bottom, left-to-right column grid position to each app
 * in the supplied list. Apps are slotted in order; the first column fills
 * from top to bottom before the next column begins (Win98 style).
 */
function computeGridPositions(
  apps: Application[],
  defaultIconSize: IconSize,
): Map<string, { x: number; y: number }> {
  const slotW     = ICON_SLOT_W[defaultIconSize] ?? ICON_SLOT_W.normal
  const availH    = CANVAS_H - TASKBAR_H - DESKTOP_PAD * 2
  const perColumn = Math.max(1, Math.floor(availH / ICON_SLOT_H))
  const result    = new Map<string, { x: number; y: number }>()

  apps.forEach((app, idx) => {
    const col = Math.floor(idx / perColumn)
    const row = idx % perColumn
    result.set(app.id, {
      x: DESKTOP_PAD + col * slotW,
      y: DESKTOP_PAD + row * ICON_SLOT_H,
    })
  })

  return result
}

/** Fallback draggable window for any widget ID not registered in WIDGET_COMPONENTS */
function GenericWidget({ app, onClose, onMinimize, onFocus, windowState = 'open', zIndex }: { app: Application } & DesktopWidgetProps) {
  return (
    <DesktopWindow
      id={app.id}
      title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><AppGlyph icon={app.icon} label={app.label} size={16} /> <span>{app.label}</span></span>}
      width={260}
      height={240}
      defaultPosition={{ x: 80, y: 120 }}
      zIndex={zIndex}
      state={windowState}
      onFocus={onFocus}
      onMinimize={onMinimize}
      onClose={onClose}
      bodyStyle={{ padding: '12px 16px', color: 'var(--desktop-title-start)', textAlign: 'center' }}
    >
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <AppGlyph icon={app.icon} label={app.label} size={28} />
        </div>
        <div style={{ marginTop: 6, fontWeight: 'bold' }}>{app.label}</div>
        <div style={{ marginTop: 4, fontSize: 10, color: '#666' }}>Widget — no component registered for id: {app.id}</div>
    </DesktopWindow>
  )
}

export function Desktop({ apps }: DesktopProps) {
  const [selectedId, setSelectedId]       = useState<string | null>(null)
  const [startMenuOpen, setStartMenuOpen] = useState(false)
  const [contextMenu, setContextMenu]     = useState<ContextMenu | null>(null)
  const [windowOrder, setWindowOrder]     = useState<string[]>([])
  const [dragPositions, setDragPositions] = useState<Record<string, { x: number; y: number }>>({})
  const [draggingId, setDraggingId]       = useState<string | null>(null)
  const [simulationLeaderId, setSimulationLeaderId] = useState<string | null>(null)

  const openWidgets = useAppStore((s) => s.openWidgets)
  const closingWidgets = useAppStore((s) => s.closingWidgets)
  const minimizedWidgets = useAppStore((s) => s.minimizedWidgets)
  const minimizeWidget = useAppStore((s) => s.minimizeWidget)
  const restoreWidget = useAppStore((s) => s.restoreWidget)
  const enqueueDesktopNotification = useAppStore((s) => s.enqueueDesktopNotification)
  const recycleBinFull = useAppStore((s) => s.recycleBinFull)
  const reactiveIconId = useAppStore((s) => s.reactiveIconId)

  const desktopRef = useRef<HTMLDivElement>(null)
  const iconDragRef = useRef<IconDragSession | null>(null)
  const suppressClickRef = useRef(false)
  const simLastActionAtByWidgetRef = useRef<Map<string, number>>(new Map())
  const simLastWidgetIdRef = useRef<string | null>(null)
  const simEmittingRef = useRef(false)
  const suppressZIndexPersistRef = useRef(false)
  const pendingDefaultSeedWidgetIdsRef = useRef<Set<string>>(new Set())
  const sourceCenterToggleRef = useRef<string>(DEFAULT_SYSTEM_WIDGET_LAYOUT_IDS.cameraSourceACenter)

  const config = useAppStore((s) => s.config)
  const desktopConfig = useMemo(() => withDesktopConfigDefaults(config.desktopConfig), [config.desktopConfig])
  const desktopConfigRef = useRef(desktopConfig)
  desktopConfigRef.current = desktopConfig
  const desktopScene = config.scenes[STATE.DESKTOP] as { style?: OverlayStyle } | undefined
  const supportedApps = useMemo(() => apps, [apps])

  // Ambiance widget simulation config
  const widgetSimConfig = config.desktopAmbiance?.widgetSimulation;
  const isSimulationLeader = simulationLeaderId !== null && simulationLeaderId === socket.id;
  const isEmbeddedPreview = useMemo(() => {
    if (typeof window === 'undefined') return false;
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  }, []);

  useEffect(() => {
    const onLeader = (payload: { socketId: string | null }) => {
      setSimulationLeaderId(payload.socketId)
    }

    const requestLeader = () => {
      socket.emit('ambiance:leader:request', (payload: { socketId: string | null }) => {
        setSimulationLeaderId(payload.socketId)
      })
    }

    socket.on('ambiance:leader', onLeader)
    socket.on('connect', requestLeader)
    if (socket.connected) requestLeader()
    return () => {
      socket.off('ambiance:leader', onLeader)
      socket.off('connect', requestLeader)
    }
  }, [])

  // Ambiance simulation interval
  useEffect(() => {
    const cursor = (window as any).__cursorOverlayController;
    if (isEmbeddedPreview) return;
    if (!isSimulationLeader) return;
    if (!widgetSimConfig || !widgetSimConfig.enabled) return;
    if (!cursor) return;
    cursor.setVisible(true);
    let stopped = false;
    let timer: any;
    const intervalMs = ((widgetSimConfig && widgetSimConfig.intervalSeconds) || 10) * 1000;
    const minActionGapMs = Math.max(1500, Math.round(intervalMs * 0.8));
    const maxOpenWidgets = Math.max(1, widgetSimConfig?.maxOpenWidgets ?? MAX_SIM_OPEN_WIDGETS);
    const openWhileOneOpenChance = Math.max(0, Math.min(1, widgetSimConfig?.openWhileOneOpenChance ?? OPEN_WHILE_ONE_OPEN_CHANCE));
    type SimulationAction = { kind: 'open' | 'close' | 'interact'; widgetId: string; app: Application };
    const actionQueue: SimulationAction[] = [];
    const queuedActionKeys = new Set<string>();
    const busyWidgetIds = new Set<string>();
    let processingQueue = false;
    const lastActionAtByWidget = simLastActionAtByWidgetRef.current;

    const actionKey = (action: SimulationAction) => action.widgetId;

    const enqueueAction = (action: SimulationAction) => {
      if (busyWidgetIds.has(action.widgetId)) return;
      const key = actionKey(action);
      if (queuedActionKeys.has(key)) return;
      queuedActionKeys.add(key);
      busyWidgetIds.add(action.widgetId);
      actionQueue.push(action);
    };

    async function processQueue() {
      if (processingQueue || stopped) return;
      processingQueue = true;
      try {
        while (!stopped && actionQueue.length > 0) {
          const action = actionQueue.shift();
          if (!action) continue;
          let executed = false;
          const openNow = useAppStore.getState().openWidgets;

          // Skip stale actions to avoid accidental toggle closes/opens.
          if (action.kind === 'open' && openNow.has(action.widgetId)) {
            queuedActionKeys.delete(actionKey(action));
            busyWidgetIds.delete(action.widgetId);
            continue;
          }
          if (action.kind === 'close' && !openNow.has(action.widgetId)) {
            queuedActionKeys.delete(actionKey(action));
            busyWidgetIds.delete(action.widgetId);
            continue;
          }
          if (action.kind === 'interact' && !openNow.has(action.widgetId)) {
            queuedActionKeys.delete(actionKey(action));
            busyWidgetIds.delete(action.widgetId);
            continue;
          }

          if (action.kind === 'close') {
            simEmittingRef.current = true;
            try {
              executed = await closeWidgetByWindowButton(cursor, action.widgetId, action.app.label);
            } finally {
              simEmittingRef.current = false;
            }
          } else if (action.kind === 'open') {
            const recipe = getWidgetSimulationRecipe(action.app);
            const menuPath = recipe.menuPath(action.app);
            const timeline = buildOpenWidgetMenuTimeline(action.app.label, menuPath);
            socket.emit('cursor:mirror:menu-timeline', timeline);
            simEmittingRef.current = true;
            try {
              executed = await runWidgetCursorSimulation(cursor, action.app.label, {
                menuPath,
                timingPlan: {
                  startMoveMs: timeline.startMoveMs,
                  startPostMs: timeline.startPostMs,
                  steps: timeline.steps,
                },
              });
            } finally {
              simEmittingRef.current = false;
            }
          } else {
            const recipe = getWidgetSimulationRecipe(action.app);
            const step = pickWidgetInteractionStep(recipe);
            if (!step) {
              queuedActionKeys.delete(actionKey(action));
              busyWidgetIds.delete(action.widgetId);
              continue;
            }
            // Focus visible window directly; restore from taskbar only if minimized.
            const focused = await focusWidgetWindow(cursor, action.widgetId, 520);
            if (!focused) {
              await focusWidgetFromTaskbar(cursor, action.app.label, 520);
            }
            executed = await interactWithWidgetByRecipe(cursor, action.widgetId, step.selectors, {
              moveMinMs: step.moveMinMs,
              moveMaxMs: step.moveMaxMs,
              postDelayMinMs: step.postDelayMinMs,
              postDelayMaxMs: step.postDelayMaxMs,
            });
          }

          if (executed) {
            lastActionAtByWidget.set(action.widgetId, Date.now());
          }

          queuedActionKeys.delete(actionKey(action));
          busyWidgetIds.delete(action.widgetId);

          const humanPauseMs = 220 + Math.floor(Math.random() * 460);
          await new Promise((resolve) => setTimeout(resolve, humanPauseMs));
        }
      } finally {
        processingQueue = false;
      }
    }

    async function tick() {
      if (stopped) return;
      // Keep simulation human-like: only one queued/executing action globally.
      if (processingQueue || actionQueue.length > 0) {
        timer = setTimeout(tick, intervalMs);
        return;
      }

      const behaviors = widgetSimConfig?.behaviors ?? {};
      const enabledEntries = Object.entries(behaviors).filter(([, behavior]) => behavior?.enabled) as Array<[string, { openChance?: number; closeChance?: number; interactChance?: number }]>;
      const openNow = useAppStore.getState().openWidgets;
      const openCount = openNow.size;
      const allowOpenActions = openCount < maxOpenWidgets;

      const closeCandidates: SimulationAction[] = [];
      const interactCandidates: SimulationAction[] = [];
      const openCandidates: SimulationAction[] = [];
      for (const [widgetId, behavior] of enabledEntries) {
        if (busyWidgetIds.has(widgetId)) continue;
        const app = supportedApps.find((candidate) => candidate.id === widgetId && candidate.appType === 'widget');
        if (!app) continue;
        const recipe = getWidgetSimulationRecipe(app);

        const lastActionAt = lastActionAtByWidget.get(widgetId) ?? 0;
        if (Date.now() - lastActionAt < minActionGapMs) continue;

        const isOpen = openNow.has(widgetId);
        if (isOpen) {
          if (Math.random() < (behavior.closeChance ?? 0)) {
            closeCandidates.push({ kind: 'close', widgetId, app });
          } else if (recipe.interactionPlan.length > 0 && Math.random() < (behavior.interactChance ?? recipe.interactionChance)) {
            interactCandidates.push({ kind: 'interact', widgetId, app });
          }
        } else if (allowOpenActions && Math.random() < (behavior.openChance ?? 1)) {
          openCandidates.push({ kind: 'open', widgetId, app });
        }
      }

      let candidates: SimulationAction[] = [];
      if (openCount === 0) {
        candidates = openCandidates;
      } else if (openCount >= maxOpenWidgets) {
        candidates = interactCandidates.length > 0 ? interactCandidates : closeCandidates;
      } else {
        const shouldOpenSecondWidget = openCandidates.length > 0 && Math.random() < openWhileOneOpenChance;
        if (shouldOpenSecondWidget) {
          candidates = openCandidates;
        } else {
          candidates = interactCandidates.length > 0
            ? interactCandidates
            : closeCandidates.length > 0
              ? closeCandidates
              : openCandidates;
        }
      }

      if (candidates.length > 0) {
        // Weighted random pick: prefer widgets that have been idle longer,
        // but avoid repeating the same widget too often to feel more human.
        const now = Date.now();
        const lastWidgetId = simLastWidgetIdRef.current;
        const weights = candidates.map((candidate) => {
          const age = now - (lastActionAtByWidget.get(candidate.widgetId) ?? 0);
          let weight = Math.max(0.1, age / Math.max(1, minActionGapMs));
          if (lastWidgetId && candidate.widgetId === lastWidgetId && candidates.some((c) => c.widgetId !== lastWidgetId)) {
            weight *= 0.2;
          }
          weight += Math.random() * 0.75;
          return weight;
        });

        const totalWeight = weights.reduce((sum, w) => sum + w, 0);
        let target = Math.random() * totalWeight;
        let picked = candidates[candidates.length - 1];
        for (let i = 0; i < candidates.length; i++) {
          target -= weights[i];
          if (target <= 0) {
            picked = candidates[i];
            break;
          }
        }

        enqueueAction(picked);
        simLastWidgetIdRef.current = picked.widgetId;
      }

      void processQueue();
      timer = setTimeout(tick, intervalMs);
    }
    timer = setTimeout(tick, intervalMs);
    return () => {
      stopped = true;
      clearTimeout(timer);
      simEmittingRef.current = false;
      cursor.setVisible(false);
    };
  }, [isEmbeddedPreview, isSimulationLeader, widgetSimConfig, supportedApps]);

  const themeStyle = useMemo(
    () => buildDesktopThemeVars(
      desktopConfig.theme,
      desktopScene?.style?.accentColor ?? config.overlayStyle.accentColor,
      desktopScene?.style?.textColor ?? config.overlayStyle.textColor,
      desktopScene?.style?.fontFamily ?? config.overlayStyle.fontFamily,
    ),
    [config.overlayStyle.accentColor, config.overlayStyle.fontFamily, config.overlayStyle.textColor, desktopConfig.theme, desktopScene?.style?.accentColor, desktopScene?.style?.fontFamily, desktopScene?.style?.textColor],
  )

  const desktopApps = useMemo(
    () => supportedApps.map((app) => {
      if (app.id !== 'recycle-bin') return app
      return {
        ...app,
        icon: recycleBinFull
          ? (app.recycleBinSettings?.fullIcon ?? app.icon)
          : (app.recycleBinSettings?.emptyIcon ?? app.icon),
      }
    }),
    [supportedApps, recycleBinFull],
  )

  const autoArrangeIcons = desktopConfig.autoArrangeIcons
  const defaultIconSize  = desktopConfig.defaultIconSize

  // Compute collision-free grid positions. In auto-arrange mode every icon
  // gets a grid slot. In manual mode only icons without a saved iconPosition
  // get a fallback slot so they don't pile on top of positioned siblings.
  const gridPositions = useMemo(() => {
    const toArrange = autoArrangeIcons
      ? desktopApps
      : desktopApps.filter((a) => !a.iconPosition)
    return computeGridPositions(toArrange, defaultIconSize)
  }, [desktopApps, autoArrangeIcons, defaultIconSize])

  const launchableApps = useMemo(
    () => desktopApps.filter((app) => app.appType !== 'decoration'),
    [desktopApps],
  )
  const widgetAppById = useMemo(
    () => new Map(apps.filter((app) => app.appType === 'widget').map((app) => [app.id, app])),
    [apps],
  )

  const visibleWidgets = useMemo(
    () => desktopApps.filter((app) => (
      app.appType === 'widget'
      && (openWidgets.has(app.id) || closingWidgets.has(app.id))
      && !minimizedWidgets.has(app.id)
    )),
    [closingWidgets, desktopApps, minimizedWidgets, openWidgets],
  )

  useEffect(() => {
    setWindowOrder((prev) => {
      const ids = visibleWidgets.map((widget) => widget.id)
      const next = prev.filter((id) => ids.includes(id))
      const newIds = ids.filter((id) => !next.includes(id))
      if (newIds.length === 0) return next.length === prev.length ? prev : next

      const defaultZIndices = desktopConfigRef.current.widgetDefaultZIndices ?? {}

      if (suppressZIndexPersistRef.current) {
        const runtimeZIndices = desktopConfigRef.current.widgetZIndices ?? {}
        return orderVisibleWidgetIds(ids, runtimeZIndices, defaultZIndices)
      }

      const persistedZIndices = desktopConfigRef.current.widgetZIndices ?? {}
      const runtimeZIndices = { ...persistedZIndices }
      newIds.forEach((id) => {
        pendingDefaultSeedWidgetIdsRef.current.add(id)
        delete runtimeZIndices[id]
      })

      const nextOrderedIds = orderVisibleWidgetIds(ids, runtimeZIndices, defaultZIndices)
      const nextOpenWidgetZIndices = Object.fromEntries(nextOrderedIds.map((id, idx) => [id, idx]))
      const nextPersistedZIndices = { ...persistedZIndices, ...nextOpenWidgetZIndices }

      patchDesktopConfig({ widgetZIndices: nextPersistedZIndices })
        .catch(() => {})
        .finally(() => {
          newIds.forEach((id) => pendingDefaultSeedWidgetIdsRef.current.delete(id))
        })

      return nextOrderedIds
    })
  }, [visibleWidgets])

  useEffect(() => {
    const runtimeZIndices = { ...(desktopConfig.widgetZIndices ?? {}) }
    pendingDefaultSeedWidgetIdsRef.current.forEach((id) => {
      delete runtimeZIndices[id]
    })
    const defaultZIndices = desktopConfig.widgetDefaultZIndices ?? {}
    const visibleIds = visibleWidgets.map((widget) => widget.id)
    if (!visibleIds.some((id) => runtimeZIndices[id] !== undefined)) return

    const sortedVisibleIds = orderVisibleWidgetIds(visibleIds, runtimeZIndices, defaultZIndices)
    setWindowOrder((prev) => {
      if (prev.length === sortedVisibleIds.length && prev.every((id, idx) => id === sortedVisibleIds[idx])) {
        return prev
      }
      return sortedVisibleIds
    })
  }, [desktopConfig.widgetDefaultZIndices, desktopConfig.widgetZIndices, visibleWidgets])

  const focusWidget = useCallback((widgetId: string) => {
    setWindowOrder((prev) => {
      const next = prev.filter((id) => id !== widgetId)
      next.push(widgetId)
      if (suppressZIndexPersistRef.current) {
        return next
      }
      // Persist updated z-order so it survives reconnects
      const currentZIndices = desktopConfigRef.current.widgetZIndices ?? {}
      const nextOpenWidgetZIndices = Object.fromEntries(next.map((id, idx) => [id, idx]))
      const zIndices = { ...currentZIndices, ...nextOpenWidgetZIndices }
      patchDesktopConfig({ widgetZIndices: zIndices }).catch(() => {})
      return next
    })
  }, [])

  const getWidgetZIndex = useCallback((widgetId: string) => {
    const idx = windowOrder.indexOf(widgetId)
    return 60 + (idx >= 0 ? idx : 0)
  }, [windowOrder])

  const ss = desktopConfig.screenSaver

  const clearDragOverride = useCallback((appId: string) => {
    setDragPositions((prev) => {
      if (!(appId in prev)) return prev
      const next = { ...prev }
      delete next[appId]
      return next
    })
  }, [])

  const consumeClickSuppression = useCallback(() => {
    const suppressed = suppressClickRef.current
    suppressClickRef.current = false
    return suppressed
  }, [])

  const resolveIconPosition = useCallback((app: Application) => {
    return dragPositions[app.id]
      ?? (autoArrangeIcons ? gridPositions.get(app.id) : (app.iconPosition ?? gridPositions.get(app.id)))
  }, [autoArrangeIcons, dragPositions, gridPositions])

  useEffect(() => {
    if (!autoArrangeIcons) return
    iconDragRef.current = null
    setDraggingId(null)
    setDragPositions({})
  }, [autoArrangeIcons])

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      const session = iconDragRef.current
      const desktopBounds = desktopRef.current?.getBoundingClientRect()
      if (!session || !desktopBounds || autoArrangeIcons) return

      const movedEnough = Math.hypot(
        event.clientX - session.pointerStart.x,
        event.clientY - session.pointerStart.y,
      ) >= DRAG_THRESHOLD_PX

      if (!session.moved && !movedEnough) return
      if (!session.moved) {
        session.moved = true
        setSelectedId(null)
        setDraggingId(session.appId)
      }

      const next = clampIconPosition(
        {
          x: event.clientX - desktopBounds.left - session.pointerOffset.x,
          y: event.clientY - desktopBounds.top - session.pointerOffset.y,
        },
        session.iconSize,
        { width: desktopBounds.width, height: desktopBounds.height },
      )

      session.currentPosition = next
      setDragPositions((prev) => {
        const current = prev[session.appId]
        if (current && current.x === next.x && current.y === next.y) return prev
        return { ...prev, [session.appId]: next }
      })
    }

    const handleMouseUp = () => {
      const session = iconDragRef.current
      if (!session) return

      iconDragRef.current = null
      setDraggingId(null)

      if (!session.moved) return

      suppressClickRef.current = true
      patchApplicationConfig(session.appId, { iconPosition: session.currentPosition })
        .then(() => clearDragOverride(session.appId))
        .catch(() => clearDragOverride(session.appId))
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [autoArrangeIcons, clearDragOverride])

  const handleLaunch = (app: Application) => {
    setSelectedId(null)
    setStartMenuOpen(false)

    if ((window as any).__cursorMirrorVisualOnly) {
      return
    }

    if (app.appType === 'widget') {
      if (simEmittingRef.current) socket.emit('widget:simulate', app.id)
      else socket.emit('widget:toggle', app.id)
      return
    }
    if (app.appType !== 'scene') return

    if (app.launchPipeline && app.launchPipeline.effects.length > 0) {
      socket.emit('overlay:trigger', {
        id: `launch-${app.id}`,
        effects: app.launchPipeline.effects,
      })
      setTimeout(() => {
        socket.emit('scene:change', app.targetSceneId as STATE)
      }, app.launchPipeline.delayMs)
    } else {
      socket.emit('scene:change', app.targetSceneId as STATE)
    }
  }

  const handleDesktopMouseDown = () => {
    setSelectedId(null)
    setStartMenuOpen(false)
    setContextMenu(null)
  }

  const handleDesktopContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    setStartMenuOpen(false)
    setContextMenu({ x: e.clientX, y: e.clientY, type: 'desktop' })
  }

  const handleIconMouseDown = useCallback((event: React.MouseEvent<HTMLDivElement>, app: Application) => {
    if (event.button !== 0 || autoArrangeIcons) return

    const desktopBounds = desktopRef.current?.getBoundingClientRect()
    const position = resolveIconPosition(app)
    if (!desktopBounds || !position) return

    setStartMenuOpen(false)
    setContextMenu(null)

    iconDragRef.current = {
      appId: app.id,
      iconSize: resolveIconSize(app, defaultIconSize),
      pointerStart: { x: event.clientX, y: event.clientY },
      pointerOffset: {
        x: event.clientX - desktopBounds.left - position.x,
        y: event.clientY - desktopBounds.top - position.y,
      },
      currentPosition: position,
      moved: false,
    }

    event.preventDefault()
    event.stopPropagation()
  }, [autoArrangeIcons, defaultIconSize, resolveIconPosition])

  const handleIconContextMenu = useCallback((e: React.MouseEvent, app: Application) => {
    e.preventDefault()
    e.stopPropagation()
    setStartMenuOpen(false)
    const rect = (desktopRef.current ?? document.body).getBoundingClientRect()
    setContextMenu({ x: e.clientX - rect.left, y: e.clientY - rect.top, type: 'icon', app })
  }, [])

  const closeMenus = useCallback(() => {
    setStartMenuOpen(false)
    setContextMenu(null)
  }, [])

  const applyWidgetLayoutById = useCallback((layoutId: string) => {
    socket.emit('widget:layout:apply', layoutId)
    closeMenus()
  }, [closeMenus])

  useEffect(() => {
    const handleSavedWidgetLayoutApply = (layoutId: string) => {
      const layout = (desktopConfigRef.current.widgetLayouts ?? []).find((entry) => entry.id === layoutId)
      if (!layout) return

      const defaultZIndices = desktopConfigRef.current.widgetDefaultZIndices ?? {}
      const nextOrder = [...layout.items]
        .filter((item) => item.enabled)
        .sort((a, b) => {
          if (a.focusPriority !== b.focusPriority) return a.focusPriority - b.focusPriority
          return (defaultZIndices[a.widgetId] ?? 0) - (defaultZIndices[b.widgetId] ?? 0)
        })
        .map((item) => item.widgetId)

      const store = useAppStore.getState()
      suppressZIndexPersistRef.current = true
      layout.items.forEach((item) => {
        if (item.enabled && store.minimizedWidgets.has(item.widgetId)) {
          store.restoreWidget(item.widgetId)
        }
      })
      setWindowOrder((prev) => {
        const openWidgetIds = useAppStore.getState().openWidgets
        const visibleOrder = nextOrder.filter((widgetId) => openWidgetIds.has(widgetId))
        const others = prev.filter((widgetId) => openWidgetIds.has(widgetId) && !visibleOrder.includes(widgetId))
        return [...others, ...visibleOrder]
      })
      if (layoutId === DEFAULT_SYSTEM_WIDGET_LAYOUT_IDS.cameraSourceACenter) {
        sourceCenterToggleRef.current = DEFAULT_SYSTEM_WIDGET_LAYOUT_IDS.cameraSourceBCenter
      } else if (layoutId === DEFAULT_SYSTEM_WIDGET_LAYOUT_IDS.cameraSourceBCenter) {
        sourceCenterToggleRef.current = DEFAULT_SYSTEM_WIDGET_LAYOUT_IDS.cameraSourceACenter
      }
      enqueueDesktopNotification({
        title: 'Widget Layouts',
        body: `Layout applied: ${layout.label}`,
        durationMs: 2200,
      })
      setTimeout(() => {
        suppressZIndexPersistRef.current = false
      }, 500)
      closeMenus()
    }

    socket.on('widget:layout:apply', handleSavedWidgetLayoutApply)
    return () => {
      socket.off('widget:layout:apply', handleSavedWidgetLayoutApply)
    }
  }, [closeMenus, enqueueDesktopNotification])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.altKey || !event.ctrlKey) return
      if (event.repeat) return
      if (isTypingTarget(event.target)) return

      const key = event.key
      if (key === '1') {
        event.preventDefault()
        applyWidgetLayoutById(DEFAULT_SYSTEM_WIDGET_LAYOUT_IDS.cameraSourceACenter)
        return
      }
      if (key === '2') {
        event.preventDefault()
        applyWidgetLayoutById(DEFAULT_SYSTEM_WIDGET_LAYOUT_IDS.cameraSourceBCenter)
        return
      }
      if (key === '3') {
        event.preventDefault()
        applyWidgetLayoutById(sourceCenterToggleRef.current)
        return
      }
      if (key === '0') {
        event.preventDefault()
        applyWidgetLayoutById(DEFAULT_SYSTEM_WIDGET_LAYOUT_IDS.cameraDirectTalk)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [applyWidgetLayoutById])

  const iconMenuLaunchable = contextMenu?.app?.appType === 'scene' || contextMenu?.app?.appType === 'widget'
  const widgetLayouts = desktopConfig.widgetLayouts ?? []
  const systemWidgetLayouts = widgetLayouts.filter((layout) => layout.source === 'system')
  const userWidgetLayouts = widgetLayouts.filter((layout) => layout.source === 'user')
  const orderedWidgetLayouts = [...systemWidgetLayouts, ...userWidgetLayouts]

  return (
    <CursorOverlayProvider>
      <CursorSimExample />
      <div
        ref={desktopRef}
        className={`desktop ${THEME_CLASSNAME[desktopConfig.theme]}`}
        style={themeStyle}
        onMouseDown={handleDesktopMouseDown}
        onContextMenu={handleDesktopContextMenu}
      >
        {/* Desktop icon canvas */}
        <div className="desktop-icons" onMouseDown={(e) => e.stopPropagation()}>
          {desktopApps.map((app, index) => {
            const resolvedPos = resolveIconPosition(app)
            const resolvedSize = resolveIconSize(app, defaultIconSize)
            return (
              <AppIcon
                key={app.id}
                app={app}
                position={resolvedPos}
                size={resolvedSize}
                selected={selectedId === app.id}
                animationMode={desktopConfig.iconAnimation}
                motionAmount={desktopConfig.iconMotion}
                animationSeed={index}
                reactive={desktopConfig.iconAnimation === 'reactive' && reactiveIconId === app.id}
                draggable={!autoArrangeIcons}
                dragging={draggingId === app.id}
                onSelect={() => { setSelectedId(app.id); closeMenus() }}
                onLaunch={() => handleLaunch(app)}
                onMouseDown={(event) => handleIconMouseDown(event, app)}
                consumeClickSuppression={consumeClickSuppression}
                onContextMenu={(e) => handleIconContextMenu(e, app)}
              />
            )
          })}
        </div>

        {/* Start Menu */}
        {startMenuOpen && (
          <div className="start-menu" onMouseDown={(e) => e.stopPropagation()}>
            <div className="start-menu-banner">
              <span className="start-menu-banner-text">IEOM</span>
            </div>
            <div className="start-menu-items">
              {/* Programs sub-list */}
              <div className="start-menu-item start-menu-item--has-sub">
                <span className="start-menu-item-icon">📂</span>
                <span className="start-menu-item-label">Programs</span>
                <span className="start-menu-item-arrow">▶</span>
                <div className="start-menu-sub">
                  {launchableApps.map((app) => (
                    <button
                      key={app.id}
                      className="start-menu-sub-item"
                      onClick={() => {
                        handleLaunch(app);
                      }}
                    >
                      <AppGlyph icon={app.icon} label={app.label} size={16} />
                      <span>{app.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="start-menu-item start-menu-item--has-sub">
                <span className="start-menu-item-icon">📐</span>
                <span className="start-menu-item-label">Widget Layouts</span>
                <span className="start-menu-item-arrow">▶</span>
                <div className="start-menu-sub">
                  {orderedWidgetLayouts.map((layout) => {
                    const enabledWidgets = layout.items
                      .filter((item) => item.enabled)
                      .map((item) => widgetAppById.get(item.widgetId))
                      .filter((app): app is Application => !!app)

                    return (
                    <button
                      key={layout.id}
                      className="start-menu-sub-item"
                      onClick={() => { applyWidgetLayoutById(layout.id) }}
                      title={enabledWidgets.length > 0
                        ? `${layout.label}: ${enabledWidgets.map((app) => app.label).join(', ')}`
                        : layout.label}
                    >
                      <span style={{ width: 18, textAlign: 'center' }}>{layout.icon || '📐'}</span>
                      <span className="start-menu-sub-item-content">
                        <span className="start-menu-sub-item-title">{layout.label}</span>
                        <span className="start-menu-sub-item-meta">
                          {enabledWidgets.length > 0 ? enabledWidgets.map((app) => (
                            <span key={`${layout.id}-${app.id}`} className="start-menu-sub-item-badge">
                              <span className="start-menu-sub-item-badge-icon">{typeof app.icon === 'string' ? app.icon : '■'}</span>
                              <span>{app.label}</span>
                            </span>
                          )) : (
                            <span className="start-menu-sub-item-badge start-menu-sub-item-badge--muted">No enabled widgets</span>
                          )}
                        </span>
                      </span>
                    </button>
                  )})}
                  {systemWidgetLayouts.length > 0 && orderedWidgetLayouts.length > 0 && <div className="start-menu-separator" />}
                  {systemWidgetLayouts.length > 0 && (
                    <button
                      className="start-menu-sub-item"
                      onClick={() => { applyWidgetLayoutById(sourceCenterToggleRef.current) }}
                    >
                      <span style={{ width: 18, textAlign: 'center' }}>⇄</span>
                      <span className="start-menu-sub-item-content">
                        <span className="start-menu-sub-item-title">Toggle Source A/B</span>
                        <span className="start-menu-sub-item-meta">
                          <span className="start-menu-sub-item-badge start-menu-sub-item-badge--muted">Switch between the two source-center system layouts</span>
                        </span>
                      </span>
                    </button>
                  )}
                </div>
              </div>

              <div className="start-menu-separator" />

              <button
                className="start-menu-item"
                onClick={() => { socket.emit('scene:change', STATE.LOBBY); closeMenus() }}
              >
                <span className="start-menu-item-icon">🖥</span>
                <span className="start-menu-item-label">LOBBY</span>
              </button>

              <div className="start-menu-separator" />

              <button
                className="start-menu-item start-menu-item--danger"
                onClick={() => { socket.emit('panic'); closeMenus() }}
              >
                <span className="start-menu-item-icon">🔴</span>
                <span className="start-menu-item-label">PANIC</span>
              </button>
            </div>
          </div>
        )}

        {/* Context Menu */}
        {contextMenu && (
          <div
            className="context-menu"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {contextMenu.type === 'desktop' ? (
              <>
                <button className="context-menu-item context-menu-item--disabled">Arrange Icons</button>
                <button className="context-menu-item" onClick={closeMenus}>Refresh</button>
                <div className="context-menu-separator" />
                <button className="context-menu-item context-menu-item--disabled">New Folder</button>
                <div className="context-menu-separator" />
                <button className="context-menu-item context-menu-item--disabled">Properties</button>
              </>
            ) : (
              <>
                <button
                  className={`context-menu-item context-menu-item--bold${iconMenuLaunchable ? '' : ' context-menu-item--disabled'}`}
                  onClick={() => { if (contextMenu.app && iconMenuLaunchable) handleLaunch(contextMenu.app) }}
                >
                  Open
                </button>
                <div className="context-menu-separator" />
                <button className="context-menu-item context-menu-item--disabled">Create Shortcut</button>
                <button className="context-menu-item context-menu-item--disabled">Delete</button>
                <button className="context-menu-item context-menu-item--disabled">Rename</button>
                <div className="context-menu-separator" />
                <button className="context-menu-item context-menu-item--disabled">Properties</button>
              </>
            )}
          </div>
        )}

        <DesktopNotifications />

        <Taskbar
          startMenuOpen={startMenuOpen}
          onStartClick={() => { setStartMenuOpen((o) => !o); setContextMenu(null) }}
        />

        {/* Screen saver — activates after idle timeout if enabled */}
        {ss && (
          <ScreenSaver
            enabled={ss.enabled}
            timeoutMinutes={ss.timeoutMinutes}
            preset={ss.preset}
          />
        )}

        {/* Widget windows — rendered above desktop content (z=50 within desktop stacking context) */}
        {visibleWidgets.map((a) => {
          const widgetComponent = getWidgetComponent(a)
          const WidgetComp = resolveWidgetComponent(a)
          const widgetProps: DesktopWidgetProps = {
            appId: a.id,
            defaultCameraLabel: widgetComponent === 'camera'
              ? (a.cameraSettings?.preferredDeviceLabel ?? '')
              : undefined,
            defaultMirror: widgetComponent === 'camera'
              ? (a.cameraSettings?.mirror ?? false)
              : undefined,
            onClose: () => {
              if ((window as any).__cursorMirrorVisualOnly) return
              if (simEmittingRef.current) socket.emit('widget:simulate', a.id)
              else socket.emit('widget:toggle', a.id)
            },
            onMinimize: () => minimizeWidget(a.id),
            onFocus: () => focusWidget(a.id),
            windowState: closingWidgets.has(a.id) ? 'closing' : 'open',
            zIndex: getWidgetZIndex(a.id),
          }
          if (WidgetComp) return <WidgetComp key={a.id} {...widgetProps} />
          return <GenericWidget key={a.id} app={a} {...widgetProps} />
        })}
      </div>
    </CursorOverlayProvider>
  )
}
