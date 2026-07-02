/**
 * PRESENTATION LAYER — Desktop OS
 * packages/overlay/src/desktop/
 *
 * Everything in this directory is specific to the Desktop OS presentation.
 * The engine (server + shared) is presentation-agnostic. This directory
 * interprets engine primitives (widget toggles, scene states, ambiance actions)
 * through the Desktop OS metaphor: draggable windows, taskbar, icons, screen saver.
 *
 * A different overlay client would replace this directory entirely while
 * consuming the same engine via the Socket.IO + config API contract.
 */
import { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import { socket } from '../socket/client'
import { STATE, getWidgetComponent, withDesktopConfigDefaults } from '@ieomlabs/shared'
import type { AmbianceSimulationPayload, AppConfig, Application, DesktopIconDragPayload, DesktopRuntimeStatePayload, DesktopStartMenuRoot, DesktopStartMenuSimulationPhasePayload, DesktopStartMenuStatePayload, DesktopTheme, OverlayRuntimeStatusPayload } from '@ieomlabs/shared'
import { useAppStore } from '../store/useAppStore'
import { Taskbar } from './Taskbar'
import { ScreenSaver } from './ScreenSaver'
import { DesktopNotifications } from './DesktopNotifications'
import { IconGrid } from './IconGrid'
import { StartMenu } from './StartMenu'
import { ContextMenuSystem, type ContextMenu } from './ContextMenuSystem'
import { WindowManager } from './WindowManager'
import { buildDesktopThemeVars } from './ThemeEngine'
import { patchApplicationConfig, replaceConfig } from './configPersistence'
import { CursorOverlayProvider } from './CursorOverlay'
import { buildWidgetThemeScopeClassNames, buildWidgetThemeVars } from './widgetTheme'
import { buildOpenWidgetMenuTimeline, closeWidgetByWindowButton, interactWithWidgetByRecipe, runWidgetCursorSimulation, simulateWidgetWindowDrag, simulateWidgetWindowResize } from './cursorSimUtils';
import { getWidgetInteractionStepForIntent, getWidgetSimulationRecipe, pickWidgetInteractionStep } from './widgetSimulationRegistry';
import { warnMissingDesktopWidgetRegistration, loadDesktopWidget, preloadWidgets, getDesktopWidgetRenderer, isWidgetRegistered } from './widgetRegistry'
import React from 'react';
import { resolveSceneStyle } from '../services/SceneResolver.js'

function resolveWidgetComponent(app: Application) {
  return getDesktopWidgetRenderer(getWidgetComponent(app))
}

const THEME_CLASSNAME: Record<DesktopTheme, string> = {
  win98: 'desktop--theme-win98',
  'frutiger aero': 'desktop--theme-frutiger-aero',
  'y2k candy': 'desktop--theme-y2k-candy',
  'midnight chrome': 'desktop--theme-midnight-chrome',
  'sunset boulevard': 'desktop--theme-sunset-boulevard',
  'coastal glass': 'desktop--theme-coastal-glass',
  'amber terminal': 'desktop--theme-amber-terminal',
  diablo: 'desktop--theme-diablo',
  matrix: 'desktop--theme-matrix',
  cyberpunk: 'desktop--theme-cyberpunk',
  runescape: 'desktop--theme-runescape',
  custom: 'desktop--theme-custom',
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

interface IconDragBroadcastState {
  lastSentAt: number
  rafId: number | null
  pending: DesktopIconDragPayload | null
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

function computeArrangementPositions(
  apps: Application[],
  arrangement: string,
  t: number,
  bounds: { width: number; height: number },
  motionAmount: number,
): Map<string, { x: number; y: number }> {
  const result = new Map<string, { x: number; y: number }>()
  const count = apps.length
  if (count === 0) return result

  const W = bounds.width
  const H = bounds.height - TASKBAR_H
  const strength = Math.max(0, Math.min(3, motionAmount))
  const cx = W / 2
  const cy = H / 2

  apps.forEach((app, i) => {
    const frac = count > 1 ? i / (count - 1) : 0.5
    let x = 0
    let y = 0

    if (arrangement === 'wave') {
      // Icons travel horizontally across the screen with a sine wave in Y
      const col = (frac + t * 0.04) % 1
      x = col * (W - 80)
      y = cy + Math.sin((frac * Math.PI * 4) + t * 1.2) * (H * 0.34 * strength)
    } else if (arrangement === 'ripple') {
      // Icons expand/contract in concentric rings from the center
      const angle = (i / count) * Math.PI * 2
      const ringRadius = (0.28 + Math.sin(t * 0.8 + i * 0.4) * 0.18) * Math.min(W, H) * 0.44 * strength
      x = cx + Math.cos(angle) * ringRadius - 32
      y = cy + Math.sin(angle) * ringRadius - 32
    } else if (arrangement === 'spiral') {
      // Icons orbit in an Archimedean spiral that slowly rotates
      const angle = frac * Math.PI * 6 + t * 0.5
      const radius = (0.12 + frac * 0.38) * Math.min(W, H) * 0.72 * strength
      x = cx + Math.cos(angle) * radius - 32
      y = cy + Math.sin(angle) * radius - 32
    } else if (arrangement === 'scatter') {
      // Each icon traces an independent Lissajous figure
      const seed = i * 2.399
      x = cx + Math.cos(seed + t * (0.4 + (i % 5) * 0.07)) * (W * 0.38 * strength) - 32
      y = cy + Math.sin(seed * 1.3 + t * (0.3 + (i % 7) * 0.06)) * (H * 0.34 * strength) - 32
    } else if (arrangement === 'orbit') {
      // Icons orbit in concentric rings at different speeds
      const ring = Math.floor(i / 6)
      const slot = i % 6
      const ringRadius = (0.18 + ring * 0.15) * Math.min(W, H) * 0.55 * strength
      const angle = (slot / 6) * Math.PI * 2 + t * (0.4 - ring * 0.08)
      x = cx + Math.cos(angle) * ringRadius - 32
      y = cy + Math.sin(angle) * ringRadius - 32
    }

    result.set(app.id, {
      x: clamp(x, 0, Math.max(0, W - 80)),
      y: clamp(y, 0, Math.max(0, H - 80)),
    })
  })

  return result
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

/** Fallback draggable window for any widget without a registered runtime component. */
export function Desktop({ apps }: DesktopProps) {
  const [selectedId, setSelectedId]       = useState<string | null>(null)
  const [startMenuOpen, setStartMenuOpen] = useState(false)
  const [startMenuActiveRoot, setStartMenuActiveRoot] = useState<DesktopStartMenuRoot>(null)
  const [startMenuSimulationPhase, setStartMenuSimulationPhase] = useState<DesktopStartMenuSimulationPhasePayload | null>(null)
  const [contextMenu, setContextMenu]     = useState<ContextMenu | null>(null)
  const [windowOrder, setWindowOrder]     = useState<string[]>([])
  const [dragPositions, setDragPositions] = useState<Record<string, { x: number; y: number }>>({})
  const [draggingId, setDraggingId]       = useState<string | null>(null)
  const [overlayRuntimeStatus, setOverlayRuntimeStatus] = useState<OverlayRuntimeStatusPayload>({
    mounted: false,
    cursorReady: false,
    widgetRegistryReady: false,
    ready: false,
    cameraPermission: 'unknown',
  })

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
  const simEmittingRef = useRef(false)
  const ambianceQueueRef = useRef<AmbianceSimulationPayload[]>([])
  const ambianceRunningRef = useRef(false)
  const suppressZIndexPersistRef = useRef(false)
  const pendingDefaultSeedWidgetIdsRef = useRef<Set<string>>(new Set())
  const iconDragBroadcastRef = useRef<IconDragBroadcastState>({
    lastSentAt: 0,
    rafId: null,
    pending: null,
  })
  const overlayRuntimeStatusSignatureRef = useRef('')

  const config = useAppStore((s) => s.config)
  const desktopConfig = useMemo(() => withDesktopConfigDefaults(config.desktopConfig), [config.desktopConfig])
  const desktopConfigRef = useRef(desktopConfig)
  desktopConfigRef.current = desktopConfig
  const applicationsRef = useRef(config.applications)
  applicationsRef.current = config.applications
  const desktopStyle = resolveSceneStyle(config, STATE.DESKTOP)
  const supportedApps = useMemo(() => apps, [apps])
  const cameraPermissionState = useAppStore((s) => s.cameraPermissionState)
  const setCameraPermissionState = useAppStore((s) => s.setCameraPermissionState)

  const overlayRuntimeReady = overlayRuntimeStatus.ready

  useEffect(() => {
    if (typeof navigator === 'undefined') return
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraPermissionState('unsupported')
      return
    }
    if (!navigator.permissions?.query) {
      return
    }

    let cancelled = false
    let permissionStatus: PermissionStatus | null = null

    const syncPermission = () => {
      if (cancelled || !permissionStatus) return
      const state = permissionStatus.state
      if (state === 'granted' || state === 'prompt' || state === 'denied') {
        setCameraPermissionState(state)
      }
    }

    void navigator.permissions.query({ name: 'camera' as PermissionName })
      .then((status) => {
        if (cancelled) return
        permissionStatus = status
        syncPermission()
        permissionStatus.addEventListener?.('change', syncPermission)
      })
      .catch(() => {
        if (!cancelled) setCameraPermissionState('unknown')
      })

    return () => {
      cancelled = true
      permissionStatus?.removeEventListener?.('change', syncPermission)
    }
  }, [setCameraPermissionState])

  useEffect(() => {
    const emitRuntimeStatus = (force = false) => {
      const nextStatus: OverlayRuntimeStatusPayload = {
        mounted: true,
        cursorReady: !!(window as any).__cursorOverlayController,
        widgetRegistryReady: supportedApps.length > 0,
        ready: !!(window as any).__cursorOverlayController && supportedApps.length > 0,
        cameraPermission: cameraPermissionState,
      }
      const signature = JSON.stringify(nextStatus)
      if (force || overlayRuntimeStatusSignatureRef.current !== signature) {
        overlayRuntimeStatusSignatureRef.current = signature
        setOverlayRuntimeStatus(nextStatus)
        socket.emit('overlay:runtime:status', nextStatus)
      }
    }

    const onConnect = () => emitRuntimeStatus(true)

    socket.on('connect', onConnect)
    emitRuntimeStatus(true)

    if (overlayRuntimeReady) {
      return () => {
        socket.off('connect', onConnect)
      }
    }

    const timer = window.setInterval(emitRuntimeStatus, 1000)

    return () => {
      window.clearInterval(timer)
      socket.off('connect', onConnect)
    }
  }, [cameraPermissionState, overlayRuntimeReady, supportedApps])

  useEffect(() => {
    const applyStartMenuState = (payload: DesktopStartMenuStatePayload) => {
      setStartMenuOpen(payload.open)
      setStartMenuActiveRoot(payload.open ? payload.activeRoot : null)
      if (!payload.open) {
        setStartMenuSimulationPhase(null)
        setContextMenu(null)
      }
    }

    const applyStartMenuSimulationPhase = (payload: DesktopStartMenuSimulationPhasePayload) => {
      if (payload.phase === 'clear') {
        setStartMenuSimulationPhase(null)
        return
      }
      setStartMenuSimulationPhase(payload)
    }

    socket.on('desktop:start-menu:state', applyStartMenuState)
    socket.on('desktop:start-menu:phase', applyStartMenuSimulationPhase)
    return () => {
      socket.off('desktop:start-menu:state', applyStartMenuState)
      socket.off('desktop:start-menu:phase', applyStartMenuSimulationPhase)
    }
  }, [])

  const emitStartMenuState = useCallback((payload: DesktopStartMenuStatePayload) => {
    setStartMenuOpen(payload.open)
    setStartMenuActiveRoot(payload.open ? payload.activeRoot : null)
    socket.emit('desktop:start-menu:state', payload)
  }, [])

  useEffect(() => {
    const requestDesktopRuntimeState = () => {
      socket.emit('desktop:state:request', (payload: DesktopRuntimeStatePayload) => {
        const nextState = payload.startMenuState ?? { open: false, activeRoot: null }
        setStartMenuOpen(nextState.open)
        setStartMenuActiveRoot(nextState.open ? nextState.activeRoot : null)
      })
    }

    socket.on('connect', requestDesktopRuntimeState)
    if (socket.connected) {
      requestDesktopRuntimeState()
    }

    return () => {
      socket.off('connect', requestDesktopRuntimeState)
    }
  }, [])

  useEffect(() => {
    if (!overlayRuntimeReady) return;

    const runAmbianceSimulation = async (payload: AmbianceSimulationPayload) => {
      const startedAt = Date.now();
      let ok = false;

      const rawSimCfg = useAppStore.getState().config?.desktopAmbiance?.widgetSimulation
      const speedMultiplier = Math.max(0.1, rawSimCfg?.cursorSpeedMultiplier ?? 1.0)
      const moveJitter = Math.max(0, Math.min(1, rawSimCfg?.moveJitter ?? 0.3))
      const pauseAfterActionMs = Math.max(0, rawSimCfg?.pauseAfterActionMs ?? 0)
      const timelineOpts = { speedMultiplier, moveJitter }

      try {
        const cursor = (window as any).__cursorOverlayController;
        if (!cursor) return;

        socket.emit('ambiance:simulate:started', {
          actionId: payload.actionId,
          widgetId: payload.widgetId,
          action: payload.action,
          startedAt,
        })

        // ── Layout / Scene nav select ────────────────────────────────
        if (payload.action === 'select' && payload.targetKind && payload.menuPath?.length) {
          const menuPath = payload.menuPath;
          const timeline = buildOpenWidgetMenuTimeline(menuPath[1] ?? '', menuPath, payload.widgetId, timelineOpts);
          simEmittingRef.current = true;
          try {
            await runWidgetCursorSimulation(cursor, menuPath[1] ?? '', {
              startMenu: false,
              menuPath,
              visualOnly: true,
              driveCursorVisualOnly: true,
              allowDomActionsInVisualOnly: false,
              targetAppId: payload.widgetId,
              activateLeafClick: false,
              openFirstLevelOnHover: true,
              onPhase: (phasePayload) => {
                if (phasePayload.phase === 'open') {
                  emitStartMenuState({ open: true, activeRoot: null })
                }
              },
              debugTag: `ambiance:${payload.targetKind}:${payload.actionId}:${payload.widgetId}`,
              closeStartMenuAfterPath: false,
              timingPlan: { startMoveMs: timeline.startMoveMs, startPostMs: timeline.startPostMs, steps: timeline.steps },
            });
            if (payload.targetKind === 'layout') {
              socket.emit('widget:layout:apply', payload.widgetId);
            } else if (payload.targetKind === 'scene') {
              socket.emit('scene:change', payload.widgetId as unknown as STATE);
            }
            ok = true;
          } finally {
            emitStartMenuState({ open: false, activeRoot: null });
            simEmittingRef.current = false;
          }
          return;
        }

        const app = supportedApps.find((candidate) => candidate.id === payload.widgetId);
        if (!app) return;

        if (payload.action === 'close') {
          simEmittingRef.current = true;
          try {
            await closeWidgetByWindowButton(cursor, app.id, app.label);
            await new Promise((resolve) => setTimeout(resolve, 140));
            if (useAppStore.getState().openWidgets.has(app.id)) {
              socket.emit('widget:simulate:action', { widgetId: app.id, action: 'close' });
            }
            ok = true;
          } finally {
            simEmittingRef.current = false;
          }
          return;
        }

        if (payload.action === 'open') {
          const recipe = getWidgetSimulationRecipe(app);
          const menuPath = recipe.menuPath(app);
          const timeline = buildOpenWidgetMenuTimeline(app.label, menuPath, app.id, timelineOpts);
          simEmittingRef.current = true;
          try {
            const wasOpen = useAppStore.getState().openWidgets.has(app.id);
            await runWidgetCursorSimulation(cursor, app.label, {
              startMenu: false,
              menuPath,
              visualOnly: true,
              driveCursorVisualOnly: true,
              allowDomActionsInVisualOnly: false,
              targetAppId: app.id,
              activateLeafClick: false,
              openFirstLevelOnHover: true,
              onPhase: (phasePayload) => {
                if (phasePayload.phase === 'open') {
                  emitStartMenuState({ open: true, activeRoot: null })
                }
              },
              debugTag: `leader:${payload.actionId}:${app.id}`,
              closeStartMenuAfterPath: false,
              timingPlan: {
                startMoveMs: timeline.startMoveMs,
                startPostMs: timeline.startPostMs,
                steps: timeline.steps,
              },
            });
            if (!wasOpen) {
              socket.emit('widget:simulate:action', { widgetId: app.id, action: 'open' });
            }
            ok = true;
          } finally {
            emitStartMenuState({ open: false, activeRoot: null });
            simEmittingRef.current = false;
          }
          return;
        }

        const recipe = getWidgetSimulationRecipe(app);

        if (payload.sharedIntent && payload.mirrorPolicy === 'shared-safe') {
          const sharedStep = getWidgetInteractionStepForIntent(app, payload.sharedIntent)
          if (!sharedStep) {
            return
          }

          await interactWithWidgetByRecipe(cursor, app.id, sharedStep.selectors, {
            moveMinMs: sharedStep.moveMinMs,
            moveMaxMs: sharedStep.moveMaxMs,
            postDelayMinMs: sharedStep.postDelayMinMs,
            postDelayMaxMs: sharedStep.postDelayMaxMs,
            performNativeClick: false,
          })
          socket.emit('widget:simulate:intent', payload.sharedIntent)
          ok = true
          return
        }

        const step = pickWidgetInteractionStep(recipe);
        if (!step) {
          ok = true;
          return;
        }

        // Interact mode can also animate organic window movement and resize,
        // which then fan out through desktop:widget:drag/resize live events.
        const windowMotionRoll = Math.random();
        if (windowMotionRoll < 0.2) {
          await simulateWidgetWindowDrag(cursor, app.id);
          ok = true;
          return;
        }
        if (windowMotionRoll < 0.32) {
          await simulateWidgetWindowResize(cursor, app.id);
          ok = true;
          return;
        }

        await interactWithWidgetByRecipe(cursor, app.id, step.selectors, {
          moveMinMs: step.moveMinMs,
          moveMaxMs: step.moveMaxMs,
          postDelayMinMs: step.postDelayMinMs,
          postDelayMaxMs: step.postDelayMaxMs,
        });
        ok = true;
      } catch {
        ok = false;
      } finally {
        if (pauseAfterActionMs > 0) {
          await new Promise<void>((r) => setTimeout(r, pauseAfterActionMs))
        }
        socket.emit('ambiance:simulate:done', {
          actionId: payload.actionId,
          widgetId: payload.widgetId,
          action: payload.action,
          ok,
          durationMs: Date.now() - startedAt,
        });
      }
    }

    const drainAmbianceQueue = () => {
      if (ambianceRunningRef.current) return
      const next = ambianceQueueRef.current.shift()
      if (!next) return
      ambianceRunningRef.current = true
      void runAmbianceSimulation(next).finally(() => {
        ambianceRunningRef.current = false
        drainAmbianceQueue()
      })
    }

    const onAmbianceSimulate = (payload: AmbianceSimulationPayload) => {
      socket.emit('ambiance:simulate:accepted', {
        actionId: payload.actionId,
        widgetId: payload.widgetId,
        action: payload.action,
      })
      ambianceQueueRef.current.push(payload)
      drainAmbianceQueue()
    }

    socket.on('ambiance:simulate', onAmbianceSimulate);
    return () => {
      socket.off('ambiance:simulate', onAmbianceSimulate);
      ambianceQueueRef.current = []
      ambianceRunningRef.current = false
      simEmittingRef.current = false;
      emitStartMenuState({ open: false, activeRoot: null });
      const cursor = (window as any).__cursorOverlayController;
      if (cursor) {
        cursor.setVisible(false);
      }
    };
  }, [emitStartMenuState, overlayRuntimeReady, supportedApps]);

  const themeStyle = useMemo(
    () => ({
      ...buildDesktopThemeVars(
        desktopConfig.globalThemeDefault.theme,
        desktopStyle.accentColor,
        desktopStyle.textColor,
        desktopStyle.fontFamily,
      ),
      ...buildWidgetThemeVars(desktopConfig.globalThemeDefault.widgetTheme),
    }),
    [
      desktopStyle.accentColor,
      desktopStyle.fontFamily,
      desktopStyle.textColor,
      desktopConfig.globalThemeDefault.theme,
      desktopConfig.globalThemeDefault.widgetTheme,
    ],
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
  const arrangedGridPositions = useMemo(
    () => computeGridPositions(desktopApps, defaultIconSize),
    [defaultIconSize, desktopApps],
  )

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
    () => desktopApps,
    [desktopApps],
  )

  const visibleWidgets = useMemo(
    () => desktopApps.filter((app) => (
      (openWidgets.has(app.id) || closingWidgets.has(app.id))
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

      const defaultZIndices = Object.fromEntries(
        applicationsRef.current.map((a) => [a.id, a.zIndexDefault ?? 0])
      )

      if (suppressZIndexPersistRef.current) {
        const runtimeZIndices = Object.fromEntries(
          applicationsRef.current.map((a) => [a.id, a.zIndexCurrent ?? a.zIndexDefault ?? 0])
        )
        return orderVisibleWidgetIds(ids, runtimeZIndices, defaultZIndices)
      }

      const persistedZIndices = Object.fromEntries(
        applicationsRef.current.map((a) => [a.id, a.zIndexCurrent ?? 0])
      )

      newIds.forEach((id) => {
        pendingDefaultSeedWidgetIdsRef.current.add(id)
      })

      // Preserve the current window order for existing widgets and insert new widgets
      // at positions matching their focusPriority (widgetDefaultZIndices). This ensures
      // that opening a widget from the left panel respects the same z-index ordering as
      // a widget layout apply rather than re-sorting all windows from stale persisted values.
      const sortedNewIds = [...newIds].sort((a, b) =>
        resolveWidgetStackPreference(a, {}, defaultZIndices)
        - resolveWidgetStackPreference(b, {}, defaultZIndices)
      )
      const nextOrderedIds = [...next]
      for (const newId of sortedNewIds) {
        const newPref = resolveWidgetStackPreference(newId, {}, defaultZIndices)
        let insertAt = nextOrderedIds.length
        for (let i = 0; i < nextOrderedIds.length; i++) {
          if (resolveWidgetStackPreference(nextOrderedIds[i], {}, defaultZIndices) > newPref) {
            insertAt = i
            break
          }
        }
        nextOrderedIds.splice(insertAt, 0, newId)
      }

      const nextOpenWidgetZIndices = Object.fromEntries(nextOrderedIds.map((id, idx) => [id, idx]))
      const nextPersistedZIndices = { ...persistedZIndices, ...nextOpenWidgetZIndices }

      // Persist zIndexCurrent on each application (geometry lives on applications table, not desktopConfig)
      const updatedApps = applicationsRef.current.map((a) =>
        nextPersistedZIndices[a.id] !== undefined ? { ...a, zIndexCurrent: nextPersistedZIndices[a.id] } : a
      )
      fetch('/api/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applications: updatedApps }),
      })
        .catch(() => {})
        .finally(() => {
          newIds.forEach((id) => pendingDefaultSeedWidgetIdsRef.current.delete(id))
        })

      return nextOrderedIds
    })
  }, [visibleWidgets])

  useEffect(() => {
    const runtimeZIndices = Object.fromEntries(
      config.applications.map((a) => [a.id, a.zIndexCurrent ?? 0])
    )
    pendingDefaultSeedWidgetIdsRef.current.forEach((id) => {
      delete runtimeZIndices[id]
    })
    const defaultZIndices = Object.fromEntries(
      config.applications.map((a) => [a.id, a.zIndexDefault ?? 0])
    )
    const visibleIds = visibleWidgets.map((widget) => widget.id)
    if (!visibleIds.some((id) => runtimeZIndices[id] !== undefined)) return

    const sortedVisibleIds = orderVisibleWidgetIds(visibleIds, runtimeZIndices, defaultZIndices)
    setWindowOrder((prev) => {
      if (prev.length === sortedVisibleIds.length && prev.every((id, idx) => id === sortedVisibleIds[idx])) {
        return prev
      }
      return sortedVisibleIds
    })
  }, [config.applications, visibleWidgets])

  const focusWidget = useCallback((widgetId: string) => {
    setWindowOrder((prev) => {
      const next = prev.filter((id) => id !== widgetId)
      next.push(widgetId)
      if (suppressZIndexPersistRef.current) {
        return next
      }
      // Persist updated z-order so it survives reconnects
      const currentZIndices = Object.fromEntries(applicationsRef.current.map((a) => [a.id, a.zIndexCurrent ?? 0]))
      const nextOpenWidgetZIndices = Object.fromEntries(next.map((id, idx) => [id, idx]))
      const zIndices = { ...currentZIndices, ...nextOpenWidgetZIndices }
      const updatedApps = applicationsRef.current.map((a) =>
        zIndices[a.id] !== undefined ? { ...a, zIndexCurrent: zIndices[a.id] } : a
      )
      fetch('/api/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applications: updatedApps }),
      }).catch(() => {})
      return next
    })
  }, [])

  const getWidgetZIndex = useCallback((widgetId: string) => {
    const idx = windowOrder.indexOf(widgetId)
    return 60 + (idx >= 0 ? idx : 0)
  }, [windowOrder])

  const handleTaskbarWidgetClick = useCallback((widgetId: string) => {
    if (!openWidgets.has(widgetId)) return

    if (minimizedWidgets.has(widgetId)) {
      restoreWidget(widgetId)
      focusWidget(widgetId)
      return
    }

    const visibleOrder = windowOrder.filter((id) => (
      openWidgets.has(id)
      && !minimizedWidgets.has(id)
      && !closingWidgets.has(id)
    ))
    const topVisibleId = visibleOrder.length > 0 ? visibleOrder[visibleOrder.length - 1] : null

    if (topVisibleId === widgetId) {
      minimizeWidget(widgetId)
      return
    }

    focusWidget(widgetId)
  }, [closingWidgets, focusWidget, minimizeWidget, minimizedWidgets, openWidgets, restoreWidget, windowOrder])

  const ss = desktopConfig.screenSaver

  const clearDragOverride = useCallback((appId: string) => {
    setDragPositions((prev) => {
      if (!(appId in prev)) return prev
      const next = { ...prev }
      delete next[appId]
      return next
    })
  }, [])

  const emitIconDrag = useCallback((payload: DesktopIconDragPayload, immediate = false) => {
    if (!socket.connected) return

    const broadcastState = iconDragBroadcastRef.current
    const flush = (next: DesktopIconDragPayload) => {
      socket.emit('desktop:icon:drag', next)
      broadcastState.lastSentAt = Date.now()
    }

    if (immediate || payload.phase !== 'move') {
      if (broadcastState.rafId !== null) {
        window.cancelAnimationFrame(broadcastState.rafId)
        broadcastState.rafId = null
        broadcastState.pending = null
      }
      flush(payload)
      return
    }

    const now = Date.now()
    if (now - broadcastState.lastSentAt >= 33) {
      flush(payload)
      return
    }

    broadcastState.pending = payload
    if (broadcastState.rafId !== null) return

    broadcastState.rafId = window.requestAnimationFrame(() => {
      broadcastState.rafId = null
      const pending = broadcastState.pending
      broadcastState.pending = null
      if (!pending) return
      flush(pending)
    })
  }, [])

  const consumeClickSuppression = useCallback(() => {
    const suppressed = suppressClickRef.current
    suppressClickRef.current = false
    return suppressed
  }, [])

  const iconArrangement = desktopConfig.iconArrangement ?? 'grid'
  const [arrangementPositions, setArrangementPositions] = useState<Map<string, { x: number; y: number }>>(new Map)

  useEffect(() => {
    if (iconArrangement === 'grid') {
      setArrangementPositions(new Map())
      return
    }
    let rafId: number
    const tick = () => {
      const bounds = desktopRef.current?.getBoundingClientRect()
      if (bounds) {
        const t = performance.now() / 1000
        setArrangementPositions(computeArrangementPositions(desktopApps, iconArrangement, t, { width: bounds.width, height: bounds.height }, desktopConfig.iconArrangementMotion ?? 1))
      }
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [iconArrangement, desktopApps, desktopConfig.iconArrangementMotion])

  const resolveIconPosition = useCallback((app: Application) => {
    if (iconArrangement !== 'grid') return arrangementPositions.get(app.id)
    return dragPositions[app.id]
      ?? (autoArrangeIcons ? arrangedGridPositions.get(app.id) : (app.iconPosition ?? gridPositions.get(app.id)))
  }, [arrangementPositions, arrangedGridPositions, autoArrangeIcons, dragPositions, gridPositions, iconArrangement])

  useEffect(() => {
    return () => {
      const broadcastState = iconDragBroadcastRef.current
      if (broadcastState.rafId !== null) {
        window.cancelAnimationFrame(broadcastState.rafId)
      }
    }
  }, [])

  useEffect(() => {
    setDragPositions((prev) => {
      let changed = false
      const next = { ...prev }

      for (const [appId, pos] of Object.entries(prev)) {
        const app = desktopApps.find((entry) => entry.id === appId)
        if (!app?.iconPosition) continue
        const isLocallyDragging = iconDragRef.current?.appId === appId
        const isVisuallyDragging = draggingId === appId
        if (isLocallyDragging || isVisuallyDragging) continue
        if (app.iconPosition.x !== pos.x || app.iconPosition.y !== pos.y) continue
        delete next[appId]
        changed = true
      }

      return changed ? next : prev
    })
  }, [desktopApps, draggingId])

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
      emitIconDrag({ appId: session.appId, x: next.x, y: next.y, phase: 'move' })
    }

    const handleMouseUp = () => {
      const session = iconDragRef.current
      if (!session) return

      iconDragRef.current = null
      setDraggingId(null)

      if (!session.moved) return

      suppressClickRef.current = true
      emitIconDrag({ appId: session.appId, x: session.currentPosition.x, y: session.currentPosition.y, phase: 'end' }, true)
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
  }, [autoArrangeIcons, clearDragOverride, emitIconDrag])

  const handleLaunch = (app: Application) => {
    setSelectedId(null)
    emitStartMenuState({ open: false, activeRoot: null })

    if ((window as any).__cursorMirrorVisualOnly) {
      return
    }

    if (app.widgetComponent !== undefined || app.widgetSource !== undefined) {
      if (simEmittingRef.current) socket.emit('widget:simulate:action', { widgetId: app.id, action: 'toggle' })
      else socket.emit('widget:toggle', app.id)
      return
    }
  }

  const handleDesktopMouseDown = () => {
    if ((window as any).__simulatingCursorClick) return
    if ((window as any).__simulatingWidgetFocus) return
    setSelectedId(null)
    emitStartMenuState({ open: false, activeRoot: null })
    setContextMenu(null)
  }

  const handleDesktopContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    emitStartMenuState({ open: false, activeRoot: null })
    const rect = (desktopRef.current ?? document.body).getBoundingClientRect()
    setContextMenu({ x: e.clientX - rect.left, y: e.clientY - rect.top, type: 'desktop' })
  }

  const handleIconMouseDown = useCallback((event: React.MouseEvent<HTMLDivElement>, app: Application) => {
    if (event.button !== 0 || autoArrangeIcons) return

    const desktopBounds = desktopRef.current?.getBoundingClientRect()
    const position = resolveIconPosition(app)
    if (!desktopBounds || !position) return

    emitStartMenuState({ open: false, activeRoot: null })
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

    emitIconDrag({ appId: app.id, x: position.x, y: position.y, phase: 'start' }, true)

    event.preventDefault()
    event.stopPropagation()
  }, [autoArrangeIcons, defaultIconSize, emitIconDrag, emitStartMenuState, resolveIconPosition])

  const handleIconContextMenu = useCallback((e: React.MouseEvent, app: Application) => {
    e.preventDefault()
    e.stopPropagation()
    emitStartMenuState({ open: false, activeRoot: null })
    const rect = (desktopRef.current ?? document.body).getBoundingClientRect()
    setContextMenu({ x: e.clientX - rect.left, y: e.clientY - rect.top, type: 'icon', app })
  }, [emitStartMenuState])

  const closeMenus = useCallback(() => {
    emitStartMenuState({ open: false, activeRoot: null })
    setContextMenu(null)
  }, [emitStartMenuState])

  const persistDesktopLayoutRecovery = useCallback(async ({
    nextApplications = config.applications,
    nextDesktopConfig = config.desktopConfig,
    notificationBody,
  }: {
    nextApplications?: Application[]
    nextDesktopConfig?: AppConfig['desktopConfig']
    notificationBody: string
  }) => {
    const nextConfig: AppConfig = {
      ...config,
      applications: nextApplications,
      desktopConfig: nextDesktopConfig,
    }

    try {
      await replaceConfig(nextConfig)
      enqueueDesktopNotification({
        title: 'Desktop',
        body: notificationBody,
        durationMs: 2200,
      })
      closeMenus()
    } catch {
      enqueueDesktopNotification({
        title: 'Desktop',
        body: 'Unable to save the desktop layout change.',
        icon: '⚠️',
        durationMs: 2800,
      })
    }
  }, [closeMenus, config, enqueueDesktopNotification])

  const handleArrangeIcons = useCallback(() => {
    const nextApplications = config.applications.map((app) => {
      const nextPosition = arrangedGridPositions.get(app.id)
      if (!nextPosition) return app
      return {
        ...app,
        iconPosition: { ...nextPosition },
      }
    })

    return persistDesktopLayoutRecovery({
      nextApplications,
      notificationBody: 'Icons snapped into a clean grid.',
    })
  }, [arrangedGridPositions, config.applications, persistDesktopLayoutRecovery])

  const handleToggleAutoArrange = useCallback(() => {
    return persistDesktopLayoutRecovery({
      nextDesktopConfig: {
        ...desktopConfig,
        autoArrangeIcons: !autoArrangeIcons,
      },
      notificationBody: autoArrangeIcons
        ? 'Free icon placement restored.'
        : 'Auto-arrange enabled for desktop icons.',
    })
  }, [autoArrangeIcons, config.desktopConfig, persistDesktopLayoutRecovery])

  const handleResetIconLayout = useCallback(() => {
    const nextApplications = config.applications.map((app) => {
      if (!desktopApps.some((desktopApp) => desktopApp.id === app.id)) return app
      const { iconPosition: _iconPosition, ...rest } = app
      return rest
    })

    return persistDesktopLayoutRecovery({
      nextApplications,
      nextDesktopConfig: {
        ...desktopConfig,
        autoArrangeIcons: true,
      },
      notificationBody: 'Icon layout reset to the automatic desktop grid.',
    })
  }, [config.applications, config.desktopConfig, desktopApps, persistDesktopLayoutRecovery])

  const handleResetWidgetWindows = useCallback(() => {
    const nextApplications = config.applications.map((app) => ({
      ...app,
      windowPosition: undefined,
      windowSize: undefined,
      zIndexCurrent: undefined,
    }))
    return persistDesktopLayoutRecovery({
      nextApplications,
      notificationBody: 'Widget windows restored to their saved defaults.',
    })
  }, [config.applications, persistDesktopLayoutRecovery])

  useEffect(() => {
    const handleSavedWidgetLayoutApply = (layoutId: string) => {
      const layout = (config.widgetLayouts ?? []).find((entry) => entry.id === layoutId)
      if (!layout) return

      const defaultZIndices = Object.fromEntries(applicationsRef.current.map((a) => [a.id, a.zIndexDefault ?? 0]))
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
    visibleWidgets.forEach((app) => {
      const widgetComponent = getWidgetComponent(app)
      const WidgetComp = resolveWidgetComponent(app)
      // Suppress the notification for registered widgets — they're lazy-loading and will resolve shortly.
      if (WidgetComp || isWidgetRegistered(widgetComponent) || !warnMissingDesktopWidgetRegistration(app, widgetComponent)) return

      enqueueDesktopNotification({
        title: 'Missing widget UI',
        body: `${app.label} is using the generic fallback because ${widgetComponent ?? app.id} is not registered.`,
        icon: '⚠️',
        durationMs: 4200,
      })
    })
  }, [enqueueDesktopNotification, visibleWidgets])

  // Lazy-load widget components as they become visible.
  // Forces a re-render once each component resolves so the real component replaces GenericWidget.
  const [, forceUpdate] = React.useReducer((n: number) => n + 1, 0)
  useEffect(() => {
    let cancelled = false
    const types = visibleWidgets.map((a) => getWidgetComponent(a)).filter(Boolean)
    Promise.all(types.map((t) => loadDesktopWidget(t!))).then(() => {
      if (!cancelled) forceUpdate()
    })
    return () => { cancelled = true }
  }, [visibleWidgets])

  const widgetThemeClassNames = buildWidgetThemeScopeClassNames(desktopConfig.globalThemeDefault.widgetTheme)

  return (
    <CursorOverlayProvider>
      <div
        ref={desktopRef}
        className={`desktop ${THEME_CLASSNAME[desktopConfig.globalThemeDefault.theme]} ${widgetThemeClassNames}`}
        style={themeStyle}
        onMouseDown={handleDesktopMouseDown}
        onContextMenu={handleDesktopContextMenu}
      >
        {/* Desktop icon canvas */}
        <IconGrid
          apps={desktopApps}
          selectedId={selectedId}
          draggingId={draggingId}
          autoArrangeIcons={autoArrangeIcons}
          defaultIconSize={defaultIconSize}
          iconAnimation={desktopConfig.iconAnimation}
          iconMotion={desktopConfig.iconMotion ?? 1}
          reactiveIconId={reactiveIconId}
          resolveIconPosition={resolveIconPosition}
          resolveIconSize={(app) => resolveIconSize(app, defaultIconSize)}
          onSelect={setSelectedId}
          onLaunch={handleLaunch}
          onMouseDown={handleIconMouseDown}
          onContextMenu={handleIconContextMenu}
          consumeClickSuppression={consumeClickSuppression}
          closeMenus={closeMenus}
        />

        {/* Start Menu */}
        <StartMenu
          open={startMenuOpen}
          activeRoot={startMenuActiveRoot}
          simulationPhase={startMenuSimulationPhase}
          launchableApps={launchableApps}
          onEmitState={(open, root) => emitStartMenuState({ open, activeRoot: root })}
          onLaunch={handleLaunch}
          onClose={closeMenus}
        />

        {/* Context Menu */}
        <ContextMenuSystem
          contextMenu={contextMenu}
          autoArrangeIcons={autoArrangeIcons}
          onArrangeIcons={handleArrangeIcons}
          onToggleAutoArrange={handleToggleAutoArrange}
          onResetIconLayout={handleResetIconLayout}
          onResetWidgetWindows={handleResetWidgetWindows}
          onLaunch={handleLaunch}
          onClose={closeMenus}
        />

        <DesktopNotifications />

        <Taskbar
          startMenuOpen={startMenuOpen}
          onStartClick={() => {
            const nextOpen = !startMenuOpen
            emitStartMenuState({ open: nextOpen, activeRoot: null })
            setContextMenu(null)
          }}
          onWidgetTaskbarClick={handleTaskbarWidgetClick}
        />

        {/* Screen saver — activates after idle timeout if enabled */}
        {ss && (
          <ScreenSaver
            enabled={ss.enabled}
            timeoutMinutes={ss.timeoutMinutes}
            preset={ss.preset}
          />
        )}

        {/* Widget windows */}
        <WindowManager
          visibleWidgets={visibleWidgets}
          closingWidgets={closingWidgets}
          simEmittingRef={simEmittingRef}
          minimizeWidget={minimizeWidget}
          focusWidget={focusWidget}
          getWidgetZIndex={getWidgetZIndex}
          onWidgetClose={(widgetId) => {
            if ((window as any).__cursorMirrorVisualOnly) return
            if (simEmittingRef.current) socket.emit('widget:simulate:action', { widgetId, action: 'toggle' })
            else socket.emit('widget:toggle', widgetId)
          }}
          onWarnMissing={(app) => {
            const widgetComponent = getWidgetComponent(app)
            if (!warnMissingDesktopWidgetRegistration(app, widgetComponent)) return
            enqueueDesktopNotification({
              title: 'Missing widget UI',
              body: `${app.label} is using the generic fallback because ${widgetComponent ?? app.id} is not registered.`,
              icon: '⚠️',
              durationMs: 4200,
            })
          }}
        />
      </div>
    </CursorOverlayProvider>
  )
}
