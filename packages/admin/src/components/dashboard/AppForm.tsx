import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  DEFAULT_DESKTOP_NOTIFICATION_DURATION_MS,
  DEFAULT_RECYCLE_BIN_SETTINGS,
  DEFAULT_STICKY_NOTES_SETTINGS,
  DEFAULT_SYSTEM_WIDGET_LAYOUTS,
  DEFAULT_WIDGET_THEME_PRESETS,
  getWidgetSource,
  isSystemWidget,
  resolveSourceInstance,
  STATE,
  withDesktopConfigDefaults,
} from '@ieom/shared'
import type {
  Application,
  AppConfig,
  DesktopConfig,
  DesktopNotificationEffectConfig,
  EffectType,
  EventAction,
  WidgetLayoutDefinition,
  WidgetLayoutSnapshot,
  WidgetThemeConfig,
} from '@ieom/shared'
import { socket } from '../../socket/client'
import { useAdminStore } from '../../store/useAdminStore'
import { AssetSelectionInput } from '../AssetLibrary'
import {
  DESKTOP_THEMES,
  GOOGLE_FONTS,
  ICON_ANIMATIONS,
  SCREENSAVER_PRESETS,
  WIDGET_SKINS,
  WIDGET_THEME_ANIMATIONS,
  WIDGET_THEME_ATMOSPHERES,
} from '../adminDesktopOptions'
import {
  LAUNCH_PIPELINE_EFFECT_TYPES,
  createEffectDraft,
  createEventActionDraft,
  describeEventSetup,
  EVENT_EFFECT_TYPES,
  COMMON_EVENT_ACTION_KINDS,
  COMMON_EVENT_EFFECT_TYPES,
  getEventActionLabel,
  normalizeDesktopNotificationEffectConfig,
  type EventDef,
} from '../asset-library/eventPresets'
import { getSafeSceneSources } from '../sourceCatalog'
import {
  Btn,
  ConfigApplyBar,
  ConfigCard,
  ConfigChoiceButton,
  ConfigNotice,
  ConfigSectionPanel,
  HexColorInput,
  IconGlyph,
  isSameDraft,
  Slider,
  Toggle,
} from '../ui'
import { DASHBOARD_SAVE_BUTTON_CLASS, WIDGET_HEIGHT_MAX, WIDGET_HEIGHT_MIN, WIDGET_WIDTH_MAX, WIDGET_WIDTH_MIN, WIDGET_Z_INDEX_MAX, WIDGET_Z_INDEX_MIN } from './constants'
import { ThemeAppearanceFields } from './formAtoms'
import { postPreviewConfigPatch } from './previewUtils'
import { RecycleBinConfigSection, StickyNotesConfigSection } from './DefaultStylingEditor'
import { TransitionList } from './TransitionPicker'
import type { UserWidgetBaseComponent } from './widgetHelpers'
import {
  applyWidgetDefaultSnapshotToDesktopConfig,
  buildUserWidgetId,
  buildWidgetLayoutFallbackPosition,
  buildWidgetLayoutItem,
  clampWidgetDimension,
  clone,
  createApplicationSnapshot,
  createWidgetLayoutFromCurrentState,
  createWidgetLayoutSnapshot,
  findFirstSceneSource,
  getDefaultWidgetSize,
  normalizeWidgetLayoutsForEditor,
  resolveApplicationDefaultSnapshot,
  resolveAppWidgetComponent,
  resolveWidgetDefaultZIndexFromConfig,
  resolveWidgetPositionFromConfig,
  resolveWidgetRuntimeZIndex,
  resolveWidgetSizeFromConfig,
  resolveWidgetThemeOverrideFromConfig,
} from './widgetHelpers'

// ── Shared utility for model display ─────────────────────────────────

function summarizeTransitionModel(steps?: any[]) {
  if (!steps?.length) return 'none'
  const ids = steps.map((step: any) => step.id).join(' -> ')
  return `${steps.length} step${steps.length === 1 ? '' : 's'}: ${ids}`
}

function formatIconPositionModel(position?: { x: number; y: number }) {
  if (!position) return 'unset'
  return `x: ${Math.round(position.x)}, y: ${Math.round(position.y)}`
}

function ModelField({ field, value, mono = false }: { field: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="rounded border border-zinc-800 bg-zinc-900/40 px-3 py-2">
      <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">{field}</div>
      <div className={`text-[11px] text-zinc-100 break-all ${mono ? 'font-mono' : ''}`}>{value}</div>
    </div>
  )
}

// ── USER_WIDGET_COMPONENT_OPTIONS ─────────────────────────────────────

const USER_WIDGET_COMPONENT_OPTIONS: Array<{
  id: UserWidgetBaseComponent
  label: string
  icon: string
  description: string
}> = [
  { id: 'camera', label: 'Camera', icon: '📷', description: 'Opens a desktop camera window with per-widget camera defaults.' },
  { id: 'source', label: 'Source', icon: '🧩', description: 'Opens a desktop window bound to an existing scene source renderer.' },
]

// ── AppForm ───────────────────────────────────────────────────────────

export function AppForm({ app, onDelete }: { app: Application; onDelete: () => void }) {
  const config               = useAdminStore((s) => s.config)
  const persistedConfig      = useAdminStore((s) => s.persistedConfig)
  const runtimeConfigOverride = useAdminStore((s) => s.runtimeConfigOverride)
  const saveConfig           = useAdminStore((s) => s.saveConfig)
  const desktopConfig        = useMemo(() => withDesktopConfigDefaults(config.desktopConfig), [config.desktopConfig])
  const persistedDesktopConfig = useMemo(() => withDesktopConfigDefaults(persistedConfig.desktopConfig), [persistedConfig.desktopConfig])
  const persistedApp = useMemo(
    () => persistedConfig.applications.find((entry) => entry.id === app.id) ?? app,
    [app, persistedConfig.applications],
  )
  const runtimeWidgetThemeOverride  = runtimeConfigOverride.desktopConfig?.widgetThemeOverrides?.[app.id]
  const sourceWidgetThemeOverride   = resolveWidgetThemeOverrideFromConfig(persistedApp, persistedDesktopConfig)
  const effectiveWidgetThemeOverride = runtimeWidgetThemeOverride ?? sourceWidgetThemeOverride

  const [form,                      setForm]                      = useState<Application>(app)
  const [widgetSize,                setWidgetSize]                = useState(() => resolveWidgetSizeFromConfig(persistedApp, persistedDesktopConfig))
  const [widgetPosition,            setWidgetPosition]            = useState(() => resolveWidgetPositionFromConfig(persistedApp, persistedDesktopConfig))
  const [widgetDefaultZIndex,       setWidgetDefaultZIndex]       = useState<number>(() => resolveWidgetDefaultZIndexFromConfig(persistedApp, persistedDesktopConfig))
  const [widgetThemeOverrideEnabled, setWidgetThemeOverrideEnabled] = useState(() => !!effectiveWidgetThemeOverride)
  const [widgetThemeOverride,       setWidgetThemeOverride]       = useState<WidgetThemeConfig>(() => structuredClone(effectiveWidgetThemeOverride ?? persistedDesktopConfig.widgetTheme))
  const [recycleBinFullOnStart,     setRecycleBinFullOnStart]     = useState(() => persistedDesktopConfig.recycleBin.fullOnStart)
  const [saving,          setSaving]          = useState(false)
  const [saved,           setSaved]           = useState(false)
  const [clearingOverride, setClearingOverride] = useState(false)
  const [clearOverrideError, setClearOverrideError] = useState<string | null>(null)
  const [saveDefaultArmed, setSaveDefaultArmed] = useState(false)
  const [detectedCameras, setDetectedCameras] = useState<{ deviceId: string; label: string }[]>([])
  const [detectingCameras, setDetectingCameras] = useState(false)
  const [cameraLabelsGranted, setCameraLabelsGranted] = useState(false)
  const savedTimer       = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveDefaultTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const defaultSnapshot  = useMemo(() => resolveApplicationDefaultSnapshot(app), [app])

  const enumerateCameras = useCallback(async (requestPermission = false) => {
    setDetectingCameras(true)
    let probe: MediaStream | null = null
    try {
      if (requestPermission) probe = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      const all = await navigator.mediaDevices.enumerateDevices()
      const videoInputs = all.filter((d) => d.kind === 'videoinput')
      const labelsAvailable = videoInputs.some((d) => d.label.trim().length > 0)
      setDetectedCameras(videoInputs.map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Camera ${i + 1}` })))
      setCameraLabelsGranted(requestPermission || labelsAvailable)
    } catch { /* permission denied */ } finally {
      probe?.getTracks().forEach((t) => t.stop())
      setDetectingCameras(false)
    }
  }, [])

  const widgetComponent = form.appType === 'widget' ? resolveAppWidgetComponent(form) : undefined
  const widgetSource    = form.appType === 'widget' ? getWidgetSource(form) : undefined
  const isProtectedSystemWidget = form.appType === 'widget' && isSystemWidget(form)
  const isStickyNotesWidget    = form.appType === 'widget' && form.id === 'sticky-notes'
  const isRecycleBinDecoration = form.appType === 'decoration' && form.id === 'recycle-bin'
  const stickyNotesConfig = form.stickyNotesSettings ?? DEFAULT_STICKY_NOTES_SETTINGS
  const recycleBinConfig  = form.recycleBinSettings  ?? DEFAULT_RECYCLE_BIN_SETTINGS
  const sourcePresets     = config.sourcePresets ?? []
  const selectedSourceSceneId = form.sourceWidgetSettings?.sceneId ?? ''
  const selectedSourceScene   = selectedSourceSceneId ? config.scenes[selectedSourceSceneId] : undefined
  const selectedSourceSceneSources = getSafeSceneSources(selectedSourceScene)
  const availableSourceScenes = useMemo(
    () => Object.values(config.scenes).filter((scene) => {
      const sources = getSafeSceneSources(scene)
      return sources.length > 0 || scene.id === selectedSourceSceneId
    }),
    [config.scenes, selectedSourceSceneId],
  )
  const availableSources = selectedSourceSceneSources
  const selectedSource   = availableSources.find((source) => source.id === form.sourceWidgetSettings?.sourceId)
  const selectedSourceResolved = selectedSource ? resolveSourceInstance(selectedSource, sourcePresets) : null

  useEffect(() => {
    if (widgetComponent !== 'camera') return
    void enumerateCameras(false)
  }, [widgetComponent, enumerateCameras])

  const sourceWidgetPosition    = resolveWidgetPositionFromConfig(persistedApp, persistedDesktopConfig)
  const sourceWidgetSize        = resolveWidgetSizeFromConfig(persistedApp, persistedDesktopConfig)
  const sourceWidgetDefaultZIndex = resolveWidgetDefaultZIndexFromConfig(persistedApp, persistedDesktopConfig)
  const liveWidgetPosition      = resolveWidgetPositionFromConfig(app, desktopConfig)
  const liveWidgetSize          = resolveWidgetSizeFromConfig(app, desktopConfig)
  const liveWidgetRuntimeZIndex = resolveWidgetRuntimeZIndex(app, desktopConfig)
  const runtimeWidgetOverride       = runtimeConfigOverride.desktopConfig
  const runtimeWidgetPositionOverride = runtimeWidgetOverride?.widgetPositions?.[app.id]
  const runtimeWidgetSizeOverride     = runtimeWidgetOverride?.widgetSizes?.[app.id]
  const runtimeWidgetZIndexOverride   = runtimeWidgetOverride?.widgetZIndices?.[app.id]
  const hasRuntimeWidgetThemeOverride = form.appType === 'widget' && !!runtimeWidgetThemeOverride

  const runtimeOverrideEntries = form.appType === 'widget' ? [
    {
      key: 'Window Position',
      value: runtimeWidgetPositionOverride ? `${liveWidgetPosition.x}, ${liveWidgetPosition.y}` : `${sourceWidgetPosition.x}, ${sourceWidgetPosition.y}`,
      active: !!runtimeWidgetPositionOverride,
    },
    {
      key: 'Window Size',
      value: runtimeWidgetSizeOverride ? `${liveWidgetSize.width}x${liveWidgetSize.height}px` : `${sourceWidgetSize.width}x${sourceWidgetSize.height}px`,
      active: !!runtimeWidgetSizeOverride,
    },
    {
      key: 'Stack Order',
      value: runtimeWidgetZIndexOverride !== undefined ? String(liveWidgetRuntimeZIndex) : String(sourceWidgetDefaultZIndex),
      active: runtimeWidgetZIndexOverride !== undefined,
    },
    {
      key: 'Theme Override',
      value: runtimeWidgetThemeOverride
        ? [runtimeWidgetThemeOverride.skin, runtimeWidgetThemeOverride.animation, runtimeWidgetThemeOverride.atmosphere].filter(Boolean).join(' / ')
        : (sourceWidgetThemeOverride
            ? [sourceWidgetThemeOverride.skin, sourceWidgetThemeOverride.animation, sourceWidgetThemeOverride.atmosphere].filter(Boolean).join(' / ')
            : 'Inherited'),
      active: !!runtimeWidgetThemeOverride,
    },
  ] : []

  const hasRuntimeOverride = runtimeOverrideEntries.some((entry) => entry.active)
  const appDirty = !isSameDraft(form, persistedApp)
  const widgetPositionDirty     = form.appType === 'widget' && (widgetPosition.x !== sourceWidgetPosition.x || widgetPosition.y !== sourceWidgetPosition.y)
  const widgetSizeDirty         = form.appType === 'widget' && (widgetSize.width !== sourceWidgetSize.width || widgetSize.height !== sourceWidgetSize.height)
  const widgetDefaultZIndexDirty = form.appType === 'widget' && widgetDefaultZIndex !== sourceWidgetDefaultZIndex
  const widgetThemeOverrideDirty = form.appType === 'widget' && (
    widgetThemeOverrideEnabled !== !!effectiveWidgetThemeOverride
    || (widgetThemeOverrideEnabled && !isSameDraft(widgetThemeOverride, effectiveWidgetThemeOverride ?? persistedDesktopConfig.widgetTheme))
  )
  const recycleBinFullOnStartDirty = isRecycleBinDecoration && recycleBinFullOnStart !== persistedDesktopConfig.recycleBin.fullOnStart
  const dirty = appDirty || widgetPositionDirty || widgetSizeDirty || widgetDefaultZIndexDirty || widgetThemeOverrideDirty || recycleBinFullOnStartDirty
  const themeOnlyDirty = form.appType === 'widget' && widgetThemeOverrideDirty && !appDirty && !widgetPositionDirty && !widgetSizeDirty && !widgetDefaultZIndexDirty && !recycleBinFullOnStartDirty

  const widgetThemePreviewPatch = useMemo(() => {
    if (form.appType !== 'widget') return null
    const nextOverrides = { ...(persistedDesktopConfig.widgetThemeOverrides ?? {}) }
    if (widgetThemeOverrideEnabled) {
      nextOverrides[form.id] = structuredClone(widgetThemeOverride)
    } else {
      delete nextOverrides[form.id]
    }
    return {
      desktopConfig: { widgetThemeOverrides: Object.keys(nextOverrides).length ? nextOverrides : undefined },
    } as Partial<AppConfig>
  }, [form, persistedDesktopConfig.widgetThemeOverrides, widgetThemeOverride, widgetThemeOverrideEnabled])

  useEffect(() => {
    setForm(persistedApp)
    setWidgetPosition(resolveWidgetPositionFromConfig(persistedApp, persistedDesktopConfig))
    setWidgetSize(resolveWidgetSizeFromConfig(persistedApp, persistedDesktopConfig))
    setWidgetDefaultZIndex(resolveWidgetDefaultZIndexFromConfig(persistedApp, persistedDesktopConfig))
    setRecycleBinFullOnStart(persistedDesktopConfig.recycleBin.fullOnStart)
    setSaveDefaultArmed(false)
    setSaved(false)
  }, [persistedApp, persistedDesktopConfig])

  useEffect(() => {
    if (persistedApp.appType !== 'widget') return
    const resolved = effectiveWidgetThemeOverride
    setWidgetThemeOverrideEnabled(!!resolved)
    setWidgetThemeOverride(structuredClone(resolved ?? persistedDesktopConfig.widgetTheme))
  }, [effectiveWidgetThemeOverride, persistedApp.appType, persistedDesktopConfig.widgetTheme])

  useEffect(() => () => {
    if (savedTimer.current) clearTimeout(savedTimer.current)
    if (saveDefaultTimer.current) clearTimeout(saveDefaultTimer.current)
    postPreviewConfigPatch(null)
  }, [])

  useEffect(() => {
    postPreviewConfigPatch(widgetThemeOverrideDirty ? widgetThemePreviewPatch : null)
  }, [widgetThemeOverrideDirty, widgetThemePreviewPatch])

  const update = (updater: (d: Application) => void) => {
    const next = { ...form }; updater(next); setForm(next); setSaved(false)
  }

  const updateStickyNotesConfig = (updater: (draft: typeof DEFAULT_STICKY_NOTES_SETTINGS) => void) => {
    update((draft) => {
      const next = structuredClone(draft.stickyNotesSettings ?? DEFAULT_STICKY_NOTES_SETTINGS)
      updater(next)
      draft.stickyNotesSettings = next
    })
  }

  const updateRecycleBinConfig = (updater: (draft: typeof DEFAULT_RECYCLE_BIN_SETTINGS) => void) => {
    update((draft) => {
      const next = structuredClone(draft.recycleBinSettings ?? DEFAULT_RECYCLE_BIN_SETTINGS)
      updater(next)
      draft.recycleBinSettings = next
    })
  }

  const buildDraftPersistence = useCallback((includeDefaultSnapshot: boolean) => {
    const draftApp: Application = clone(form)
    const scene = persistedConfig.scenes[draftApp.targetSceneId]
    const updates: Partial<typeof config> = { applications: [] }
    let nextDesktopConfig: DesktopConfig | null = null
    const ensureNextDesktopConfig = () => {
      if (!nextDesktopConfig) nextDesktopConfig = structuredClone(persistedDesktopConfig)
      return nextDesktopConfig
    }

    if (draftApp.appType === 'widget') {
      const nextDesktop = ensureNextDesktopConfig()
      const normalizedWidth  = clampWidgetDimension(widgetSize.width,  WIDGET_WIDTH_MIN,  WIDGET_WIDTH_MAX,  sourceWidgetSize.width)
      const normalizedHeight = clampWidgetDimension(widgetSize.height, WIDGET_HEIGHT_MIN, WIDGET_HEIGHT_MAX, sourceWidgetSize.height)
      const defaults = getDefaultWidgetSize(draftApp)
      const nextWidgetPositions       = { ...(nextDesktop.widgetPositions ?? {}) }
      const nextWidgetSizes           = { ...(nextDesktop.widgetSizes ?? {}) }
      const nextWidgetDefaultZIndices = { ...(nextDesktop.widgetDefaultZIndices ?? {}) }
      const nextWidgetThemeOverrides  = { ...(nextDesktop.widgetThemeOverrides ?? {}) }

      nextWidgetPositions[draftApp.id] = { x: Math.max(0, Math.round(widgetPosition.x)), y: Math.max(0, Math.round(widgetPosition.y)) }

      if (normalizedWidth === defaults.width && normalizedHeight === defaults.height) {
        delete nextWidgetSizes[draftApp.id]
      } else {
        nextWidgetSizes[draftApp.id] = { width: normalizedWidth, height: normalizedHeight }
      }

      nextWidgetDefaultZIndices[draftApp.id] = Math.max(0, Math.round(widgetDefaultZIndex))

      if (widgetThemeOverrideEnabled) {
        nextWidgetThemeOverrides[draftApp.id] = structuredClone(widgetThemeOverride)
      } else {
        delete nextWidgetThemeOverrides[draftApp.id]
      }

      nextDesktop.widgetPositions       = Object.keys(nextWidgetPositions).length       ? nextWidgetPositions       : undefined
      nextDesktop.widgetSizes           = Object.keys(nextWidgetSizes).length           ? nextWidgetSizes           : undefined
      nextDesktop.widgetDefaultZIndices = Object.keys(nextWidgetDefaultZIndices).length ? nextWidgetDefaultZIndices : undefined
      nextDesktop.widgetThemeOverrides  = Object.keys(nextWidgetThemeOverrides).length  ? nextWidgetThemeOverrides  : undefined
    }

    if (isRecycleBinDecoration && recycleBinFullOnStart !== persistedDesktopConfig.recycleBin.fullOnStart) {
      const nextDesktop = ensureNextDesktopConfig()
      nextDesktop.recycleBin = { ...nextDesktop.recycleBin, fullOnStart: recycleBinFullOnStart }
    }

    if (includeDefaultSnapshot) {
      draftApp.defaultConfig = createApplicationSnapshot(draftApp, nextDesktopConfig ?? persistedDesktopConfig)
    }

    const apps = [...persistedConfig.applications]
    const idx = apps.findIndex((entry) => entry.id === draftApp.id)
    if (idx !== -1) apps[idx] = draftApp
    else apps.push(draftApp)
    updates.applications = apps

    if (scene) {
      updates.scenes = { [draftApp.targetSceneId]: { ...scene, label: draftApp.label } }
    }

    if (nextDesktopConfig) updates.desktopConfig = nextDesktopConfig
    return updates
  }, [config, form, isRecycleBinDecoration, persistedConfig.applications, persistedConfig.scenes, persistedDesktopConfig, recycleBinFullOnStart, sourceWidgetSize, widgetDefaultZIndex, widgetPosition, widgetSize, widgetThemeOverride, widgetThemeOverrideEnabled])

  const apply = async () => {
    setSaving(true)
    const updates = buildDraftPersistence(false)
    if (themeOnlyDirty && updates.desktopConfig) {
      updates.applications = undefined
      updates.scenes = undefined
      updates.desktopConfig = { widgetThemeOverrides: updates.desktopConfig.widgetThemeOverrides } as DesktopConfig
    }
    await saveConfig(updates)
    setSaving(false)
    if (savedTimer.current) clearTimeout(savedTimer.current)
    setSaved(true)
    savedTimer.current = setTimeout(() => setSaved(false), 1500)
  }

  const reset = () => {
    setForm(persistedApp)
    setWidgetPosition(resolveWidgetPositionFromConfig(persistedApp, persistedDesktopConfig))
    setWidgetSize(resolveWidgetSizeFromConfig(persistedApp, persistedDesktopConfig))
    setWidgetDefaultZIndex(resolveWidgetDefaultZIndexFromConfig(persistedApp, persistedDesktopConfig))
    setWidgetThemeOverrideEnabled(!!effectiveWidgetThemeOverride)
    setWidgetThemeOverride(structuredClone(effectiveWidgetThemeOverride ?? persistedDesktopConfig.widgetTheme))
    setRecycleBinFullOnStart(persistedDesktopConfig.recycleBin.fullOnStart)
    setSaveDefaultArmed(false)
    setSaved(false)
  }

  const restoreDefaults = async () => {
    const snapshot = clone(defaultSnapshot)
    const { widgetDefaults: _widgetDefaults, ...appDefaults } = snapshot
    const restoredApp: Application = { ...app, ...appDefaults, defaultConfig: app.defaultConfig ?? snapshot }
    const apps = config.applications.map((entry) => (entry.id === app.id ? restoredApp : entry))
    const updates: Partial<typeof config> = { applications: apps }
    if (restoredApp.appType === 'widget') {
      updates.desktopConfig = applyWidgetDefaultSnapshotToDesktopConfig(persistedDesktopConfig, restoredApp, snapshot)
    }
    setSaving(true)
    await saveConfig(updates)
    setSaving(false)
    setSaveDefaultArmed(false)
    setSaved(true)
    if (savedTimer.current) clearTimeout(savedTimer.current)
    savedTimer.current = setTimeout(() => setSaved(false), 1500)
  }

  const saveCurrentAsDefault = useCallback(async () => {
    if (!saveDefaultArmed) {
      setSaveDefaultArmed(true)
      if (saveDefaultTimer.current) clearTimeout(saveDefaultTimer.current)
      saveDefaultTimer.current = setTimeout(() => setSaveDefaultArmed(false), 3500)
      return
    }
    setSaving(true)
    if (saveDefaultTimer.current) clearTimeout(saveDefaultTimer.current)
    await saveConfig(buildDraftPersistence(true))
    setSaveDefaultArmed(false)
    setSaving(false)
    if (savedTimer.current) clearTimeout(savedTimer.current)
    setSaved(true)
    savedTimer.current = setTimeout(() => setSaved(false), 1500)
  }, [buildDraftPersistence, saveConfig, saveDefaultArmed])

  const useCurrentWidgetValues = () => {
    if (form.appType !== 'widget') return
    setWidgetPosition(liveWidgetPosition)
    setWidgetSize(liveWidgetSize)
    setSaved(false)
  }

  const clearWidgetRuntimeOverride = () => {
    if (form.appType !== 'widget' || !hasRuntimeOverride || clearingOverride) return
    setClearingOverride(true)
    setClearOverrideError(null)
    socket.emit('runtime:config:override:widget:clear', form.id, (err: string | null) => {
      setClearingOverride(false)
      if (err) { setClearOverrideError(err); return }
      setClearOverrideError(null)
    })
  }

  const supportsSceneTransitions = form.appType === 'scene'

  return (
    <div className="space-y-3">
      <ConfigApplyBar label="Application Configuration" dirty={dirty} saving={saving} saved={saved} onApply={apply} onReset={reset} alwaysShow />
      <div className="space-y-0 pt-3">

        {form.appType === 'widget' && (
          <ConfigSectionPanel label="Runtime Override" first>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className={hasRuntimeOverride ? 'text-[11px] font-medium text-red-100' : 'text-[11px] font-medium text-zinc-400'}>
                  {hasRuntimeOverride ? 'Runtime override active' : 'No runtime override active'}
                </div>
                <span className="flex-1" />
                <span className={['inline-block h-2.5 w-2.5 rounded-full transition-all', hasRuntimeOverride
                  ? 'bg-red-400 shadow-[0_0_10px_rgba(248,113,113,0.95),0_0_20px_rgba(239,68,68,0.55)]'
                  : 'bg-zinc-700 shadow-[0_0_0_rgba(0,0,0,0)]'].join(' ')} />
              </div>
              <div className="space-y-1.5 rounded border border-zinc-800/80 bg-zinc-950/40 px-3 py-2">
                {runtimeOverrideEntries.map((entry) => (
                  <div key={entry.key} className="flex items-start justify-between gap-3 text-[10px]">
                    <div className="uppercase tracking-[0.14em] text-zinc-500">{entry.key}</div>
                    <div className={entry.active ? 'text-right font-mono text-zinc-200' : 'text-right font-mono text-zinc-500'}>{entry.value}</div>
                  </div>
                ))}
              </div>
              {clearOverrideError && <ConfigNotice tone="danger">{clearOverrideError}</ConfigNotice>}
              <div className="flex justify-end">
                <Btn type="button" onClick={clearWidgetRuntimeOverride} disabled={!hasRuntimeOverride || clearingOverride} className="px-2.5 py-1 text-[10px]">
                  {clearingOverride ? 'Clearing Override...' : 'Clear Override'}
                </Btn>
              </div>
            </div>
          </ConfigSectionPanel>
        )}

        <ConfigSectionPanel label="Identity" first={form.appType !== 'widget'}>
          <div className="space-y-3">
            <div>
              <div className="text-[10px] text-zinc-500 mb-1">Label</div>
              <input type="text" value={form.label} onChange={(e) => update((d) => { d.label = e.target.value })} className="w-full text-xs" />
            </div>
            <div>
              <div className="text-[10px] text-zinc-500 mb-1">Icon</div>
              <div className="flex gap-2 items-center">
                <div className="w-11 h-11 flex items-center justify-center bg-zinc-800 rounded border border-zinc-700 overflow-hidden shrink-0">
                  <IconGlyph icon={form.icon} label={form.label} size={32} />
                </div>
                <div className="flex-1 min-w-0">
                  <AssetSelectionInput value={form.icon} onChange={(v) => update((d) => { d.icon = v })}
                    kinds={['image']} modalTitle="Application Icon" placeholder="Emoji or /assets/icons/custom.png"
                    buttonLabel="Choose Image" hint="Leave an emoji in the field, or use the asset library to assign a custom image icon."
                    inputClassName="font-mono" previewKind="image" showPreview={false} />
                </div>
              </div>
            </div>
            <div>
              <div className="text-[10px] text-zinc-500 mb-1">Size</div>
              <div className="flex gap-1">
                {(['small', 'normal', 'large'] as const).map((s) => (
                  <ConfigChoiceButton key={s} type="button" selected={(form.iconSize ?? 'normal') === s}
                    onClick={() => update((d) => { d.iconSize = s })} className="flex-1 text-[11px]">
                    {s}
                  </ConfigChoiceButton>
                ))}
              </div>
            </div>
          </div>
        </ConfigSectionPanel>

        {supportsSceneTransitions && (
          <ConfigSectionPanel label="Transitions">
            <div className="space-y-3">
              <div>
                <div className="text-[10px] text-zinc-500 mb-1">Intro</div>
                <TransitionList value={form.introTransitions ?? []} onChange={(steps) => update((d) => { d.introTransitions = steps.length ? steps : undefined })} />
              </div>
              <div>
                <div className="text-[10px] text-zinc-500 mb-1">Exit</div>
                <TransitionList value={form.exitTransitions ?? []} onChange={(steps) => update((d) => { d.exitTransitions = steps.length ? steps : undefined })} />
              </div>
            </div>
          </ConfigSectionPanel>
        )}

        {form.appType !== 'widget' && (
          <ConfigSectionPanel label="Position">
            <div className="text-[10px] text-zinc-600 mb-2">1920×1080 canvas, pixels from top-left.</div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-[10px] text-zinc-500 mb-1">X</div>
                <input type="number" min={0} max={1850} value={form.iconPosition?.x ?? 16}
                  onChange={(e) => update((d) => { d.iconPosition = { x: Number(e.target.value), y: d.iconPosition?.y ?? 16 } })}
                  className="w-full font-mono text-xs" />
              </div>
              <div>
                <div className="text-[10px] text-zinc-500 mb-1">Y</div>
                <input type="number" min={0} max={990} value={form.iconPosition?.y ?? 16}
                  onChange={(e) => update((d) => { d.iconPosition = { x: d.iconPosition?.x ?? 16, y: Number(e.target.value) } })}
                  className="w-full font-mono text-xs" />
              </div>
            </div>
            <div className="text-[10px] text-zinc-600 mt-1.5">Tip: X=16, Y increments of 94</div>
            <div className="text-[10px] text-zinc-600 mt-1">Desktop icons can also be dragged live when auto-arrange is off.</div>
          </ConfigSectionPanel>
        )}

        {form.appType === 'widget' && (
          <ConfigSectionPanel label="Widget Window Defaults">
            <div className="flex justify-end mb-3">
              <Btn type="button" onClick={useCurrentWidgetValues} className="px-2.5 py-1 text-[10px]">Use Current</Btn>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-[10px] text-zinc-500 mb-1">Width</div>
                <input type="number" min={WIDGET_WIDTH_MIN} max={WIDGET_WIDTH_MAX} value={widgetSize.width}
                  onChange={(e) => setWidgetSize((prev) => ({ ...prev, width: Number(e.target.value) }))}
                  className="w-full font-mono text-xs" />
              </div>
              <div>
                <div className="text-[10px] text-zinc-500 mb-1">Height</div>
                <input type="number" min={WIDGET_HEIGHT_MIN} max={WIDGET_HEIGHT_MAX} value={widgetSize.height}
                  onChange={(e) => setWidgetSize((prev) => ({ ...prev, height: Number(e.target.value) }))}
                  className="w-full font-mono text-xs" />
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-zinc-700/50">
              <div className="text-[10px] text-zinc-500 mb-2">Position</div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="text-[10px] text-zinc-500 mb-1">X</div>
                  <input type="number" min={0} max={1850} value={widgetPosition.x}
                    onChange={(e) => setWidgetPosition((prev) => ({ ...prev, x: Number(e.target.value) }))}
                    className="w-full font-mono text-xs" />
                </div>
                <div>
                  <div className="text-[10px] text-zinc-500 mb-1">Y</div>
                  <input type="number" min={0} max={990} value={widgetPosition.y}
                    onChange={(e) => setWidgetPosition((prev) => ({ ...prev, y: Number(e.target.value) }))}
                    className="w-full font-mono text-xs" />
                </div>
              </div>
              <div className="mt-2 text-[10px] text-zinc-600">Saved desktop position for this widget window.</div>
            </div>
            <div className="mt-3 pt-3 border-t border-zinc-700/50">
              <div className="text-[10px] text-zinc-500 mb-1">
                Default Z-Index
                <span className="text-zinc-600 ml-1">(base order — higher starts nearer the front before manual focus changes)</span>
              </div>
              <div className="flex gap-2 items-center">
                <input type="number" min={WIDGET_Z_INDEX_MIN} max={WIDGET_Z_INDEX_MAX} value={widgetDefaultZIndex}
                  onChange={(e) => { setWidgetDefaultZIndex(Math.max(WIDGET_Z_INDEX_MIN, Math.min(WIDGET_Z_INDEX_MAX, Math.round(Number(e.target.value) || 0)))) }}
                  className="w-24 font-mono text-xs" />
              </div>
              <div className="text-[10px] text-zinc-600 mt-1">
                This is the widget's baseline stack order. Saved layouts can temporarily bias focus priority on top of this, and manual clicking or taskbar focus can still move a window to the front at runtime.
              </div>
            </div>
          </ConfigSectionPanel>
        )}

        {form.appType === 'widget' && (
          <ConfigSectionPanel label="Widget Theme Override">
            <div className="space-y-4">
              <div className="text-[10px] text-zinc-500 leading-relaxed">
                Keep widgets self-sufficient by giving each one its own skin, theming, motion, and atmosphere profile. Leave this off to inherit the shared desktop widget theme.
              </div>
              {hasRuntimeWidgetThemeOverride && (
                <ConfigNotice className="px-3 py-2 text-[10px]" tone="info">
                  Runtime override active. The values below reflect the live override currently applied to this widget.
                </ConfigNotice>
              )}
              <Toggle checked={widgetThemeOverrideEnabled}
                onChange={(value) => {
                  setWidgetThemeOverrideEnabled(value)
                  if (value && !sourceWidgetThemeOverride) setWidgetThemeOverride(structuredClone(desktopConfig.widgetTheme))
                  setSaved(false)
                }}
                label="Use widget-specific appearance" />
              {widgetThemeOverrideEnabled ? (
                <>
                  <div className="grid grid-cols-2 gap-1.5 border-t border-zinc-800 pt-3">
                    {WIDGET_SKINS.map((skin) => (
                      <ConfigChoiceButton key={skin.id} type="button" selected={widgetThemeOverride.skin === skin.id}
                        onClick={() => { setWidgetThemeOverride(structuredClone(DEFAULT_WIDGET_THEME_PRESETS[skin.id])); setSaved(false) }}
                        className="min-h-0 flex-col items-start gap-1 px-3 py-2 text-left normal-case" title={skin.description}>
                        <span className="text-[11px] font-semibold leading-none">{skin.label}</span>
                        <span className="text-[10px] leading-relaxed text-zinc-500">{skin.description}</span>
                      </ConfigChoiceButton>
                    ))}
                  </div>
                  <div className="border-t border-zinc-800 pt-3">
                    <ThemeAppearanceFields appearance={widgetThemeOverride as any}
                      onChange={(updater) => { setWidgetThemeOverride((prev) => { const next = structuredClone(prev); updater(next as any); return next }); setSaved(false) }}
                      helperText="Use a different font, accent, and text color when this widget should feel like its own application instead of just another window using the global chrome." />
                  </div>
                  <div className="border-t border-zinc-800 pt-3 space-y-3">
                    <div>
                      <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Motion</div>
                      <div className="grid grid-cols-2 gap-1.5">
                        {WIDGET_THEME_ANIMATIONS.map((animation) => (
                          <ConfigChoiceButton key={animation.id} type="button" selected={widgetThemeOverride.animation === animation.id}
                            onClick={() => { setWidgetThemeOverride((prev) => ({ ...prev, animation: animation.id })); setSaved(false) }}
                            className="min-h-0 flex-col items-start gap-1 px-3 py-2 text-left normal-case" title={animation.description}>
                            <span className="text-[11px] font-semibold leading-none">{animation.label}</span>
                            <span className="text-[10px] leading-relaxed text-zinc-500">{animation.description}</span>
                          </ConfigChoiceButton>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Atmosphere</div>
                      <div className="grid grid-cols-3 gap-1.5">
                        {WIDGET_THEME_ATMOSPHERES.map((atmosphere) => (
                          <ConfigChoiceButton key={atmosphere.id} type="button" selected={widgetThemeOverride.atmosphere === atmosphere.id}
                            onClick={() => { setWidgetThemeOverride((prev) => ({ ...prev, atmosphere: atmosphere.id })); setSaved(false) }}
                            className="py-2 text-[11px]">
                            {atmosphere.label}
                          </ConfigChoiceButton>
                        ))}
                      </div>
                    </div>
                    <Slider label="Motion" value={Math.round(widgetThemeOverride.motionIntensity * 100)} min={0} max={300} step={5} unit="%"
                      onChange={(value) => { setWidgetThemeOverride((prev) => ({ ...prev, motionIntensity: value / 100 })); setSaved(false) }} />
                    <Slider label="Glow" value={Math.round(widgetThemeOverride.glowIntensity * 100)} min={0} max={300} step={5} unit="%"
                      onChange={(value) => { setWidgetThemeOverride((prev) => ({ ...prev, glowIntensity: value / 100 })); setSaved(false) }} />
                    <div className="flex justify-end">
                      <Btn type="button" onClick={() => { setWidgetThemeOverride(structuredClone(desktopConfig.widgetTheme)); setSaved(false) }} className="px-2 py-1 text-[10px]">
                        Copy Desktop Theme
                      </Btn>
                    </div>
                  </div>
                </>
              ) : (
                <div className="rounded border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-[10px] leading-relaxed text-zinc-500">
                  This widget currently inherits the shared desktop widget theme from the Desktop environment editor.
                </div>
              )}
            </div>
          </ConfigSectionPanel>
        )}

        {isStickyNotesWidget && (
          <StickyNotesConfigSection value={stickyNotesConfig} onChange={updateStickyNotesConfig} />
        )}

        {isRecycleBinDecoration && (
          <RecycleBinConfigSection settings={recycleBinConfig} fullOnStart={recycleBinFullOnStart}
            onSettingsChange={updateRecycleBinConfig}
            onFullOnStartChange={(v) => { setRecycleBinFullOnStart(v); setSaved(false) }} />
        )}

        {form.appType === 'widget' && widgetComponent === 'camera' && (
          <ConfigSectionPanel label="Camera Defaults">
            <div className="space-y-3">
              <div className="text-[10px] text-zinc-400">
                Configure the camera for this widget. The widget displays video only — no controls. Open OBS with <span className="font-mono text-zinc-300">?obs=1</span> in the browser source URL.
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <div className="text-[10px] text-zinc-500">Camera device</div>
                  {!cameraLabelsGranted && (
                    <Btn type="button" disabled={detectingCameras} onClick={() => void enumerateCameras(true)} className="px-2 py-0.5 text-[10px]">
                      {detectingCameras ? 'Detecting...' : '🔓 Get real names'}
                    </Btn>
                  )}
                </div>
                {detectingCameras && detectedCameras.length === 0 ? (
                  <div className="text-[10px] text-zinc-500 italic">Detecting devices...</div>
                ) : (
                  <select value={form.cameraSettings?.preferredDeviceLabel ?? ''}
                    onChange={(e) => update((d) => { d.cameraSettings = { ...(d.cameraSettings ?? {}), preferredDeviceLabel: e.target.value } })}
                    className="w-full text-xs">
                    <option value="">— No preference (first device) —</option>
                    {detectedCameras.map((cam) => <option key={cam.deviceId} value={cam.label}>{cam.label}</option>)}
                    {form.cameraSettings?.preferredDeviceLabel && !detectedCameras.some((c) => c.label === form.cameraSettings?.preferredDeviceLabel) && (
                      <option value={form.cameraSettings.preferredDeviceLabel}>{form.cameraSettings.preferredDeviceLabel} (saved)</option>
                    )}
                  </select>
                )}
                <div className="text-[10px] text-zinc-600 mt-1">
                  {!cameraLabelsGranted && detectedCameras.length > 0
                    ? 'Generic names — click "Get real names" to see actual system labels.'
                    : 'The label is saved on the server. OBS uses it to find the same camera automatically.'}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input id={`cam-mirror-${form.id}`} type="checkbox" checked={form.cameraSettings?.mirror ?? false}
                  onChange={(e) => update((d) => { d.cameraSettings = { ...(d.cameraSettings ?? {}), mirror: e.target.checked } })} />
                <label htmlFor={`cam-mirror-${form.id}`} className="text-[11px] text-zinc-300 cursor-pointer">Mirror (flip horizontally)</label>
              </div>
            </div>
          </ConfigSectionPanel>
        )}

        {form.appType === 'widget' && widgetComponent === 'source' && (
          <ConfigSectionPanel label="Source Binding">
            <div className="space-y-3">
              <div className="text-[10px] text-zinc-400">
                Source widgets render one scene source inside a desktop window. Bind this widget to any configured source and change it later without recreating the widget.
              </div>
              <div>
                <div className="text-[10px] text-zinc-500 mb-1">Scene</div>
                <select value={selectedSourceSceneId}
                  onChange={(e) => update((d) => {
                    const nextSceneId = e.target.value
                    const nextScene = config.scenes[nextSceneId]
                    const nextSceneSources = getSafeSceneSources(nextScene)
                    const currentSourceId = d.sourceWidgetSettings?.sourceId
                    const nextSourceId = nextSceneSources.some((source) => source.id === currentSourceId) ? currentSourceId : (nextSceneSources[0]?.id ?? '')
                    d.sourceWidgetSettings = nextSceneId ? { sceneId: nextSceneId, sourceId: nextSourceId } : undefined
                  })}
                  className="w-full text-xs">
                  <option value="">— Select scene —</option>
                  {availableSourceScenes.map((scene) => <option key={scene.id} value={scene.id}>{scene.label}</option>)}
                </select>
              </div>
              <div>
                <div className="text-[10px] text-zinc-500 mb-1">Source</div>
                <select value={form.sourceWidgetSettings?.sourceId ?? ''}
                  onChange={(e) => update((d) => { d.sourceWidgetSettings = { sceneId: d.sourceWidgetSettings?.sceneId ?? '', sourceId: e.target.value } })}
                  disabled={!selectedSourceSceneId || availableSources.length === 0}
                  className="w-full text-xs">
                  <option value="">{selectedSourceSceneId ? '— Select source —' : '— Choose a scene first —'}</option>
                  {availableSources.map((source) => (
                    <option key={source.id} value={source.id}>{source.id} · {resolveSourceInstance(source, sourcePresets)?.pluginType ?? 'unbound'}</option>
                  ))}
                </select>
              </div>
              {availableSourceScenes.length === 0 && (
                <div className="text-[10px] text-amber-300 leading-relaxed">No scene sources are configured yet. Add a source to any scene, then bind this widget to it.</div>
              )}
              {selectedSourceSceneId && availableSources.length === 0 && (
                <div className="text-[10px] text-zinc-600">This scene currently has no sources to bind.</div>
              )}
              {selectedSource && selectedSourceScene && (
                <div className="rounded border border-zinc-800 bg-zinc-900/40 px-3 py-2 space-y-1">
                  <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Current Binding</div>
                  <div className="text-[11px] text-zinc-200">{selectedSourceScene.label}</div>
                  <div className="text-[10px] text-zinc-400 font-mono">{selectedSource.id} · {selectedSourceResolved?.pluginType ?? 'unbound'}</div>
                </div>
              )}
            </div>
          </ConfigSectionPanel>
        )}

        {supportsSceneTransitions && (
          <ConfigSectionPanel label="Launch Pipeline">
            <div className="text-[10px] text-zinc-500 mb-2">Effects fired before the scene change. Fires in order, each with its own delay.</div>
            <Toggle checked={!!form.launchPipeline} label="Enable"
              onChange={(v) => update((d) => { d.launchPipeline = v ? { effects: [], delayMs: 0 } : undefined })} />
            {form.launchPipeline && (
              <div className="mt-3 space-y-3">
                <Slider label="Scene change delay (ms)" value={form.launchPipeline.delayMs} min={0} max={5000} step={100}
                  onChange={(v) => update((d) => { if (d.launchPipeline) d.launchPipeline.delayMs = v })} />
                <div>
                  <div className="text-[10px] text-zinc-500 mb-1">Effects</div>
                  {form.launchPipeline.effects.length === 0 && <div className="text-[10px] text-zinc-600 italic">No effects added.</div>}
                  {form.launchPipeline.effects.map((eff, i) => (
                    <div key={i} className="flex items-center gap-2 py-1 border-b border-zinc-700/40">
                      <span className="flex-1 text-[11px] font-mono text-zinc-300">{eff.type}</span>
                      <input type="number" min={0} max={10} step={0.1} value={eff.delay ?? 0}
                        onChange={(e) => update((d) => { if (!d.launchPipeline) return; d.launchPipeline.effects[i] = { ...d.launchPipeline.effects[i], delay: Number(e.target.value) } })}
                        className="w-16 font-mono text-xs" title="Delay (s)" />
                      <span className="text-[9px] text-zinc-600">s</span>
                      <button onClick={() => update((d) => { if (!d.launchPipeline) return; d.launchPipeline.effects.splice(i, 1) })}
                        className="text-[10px] text-red-500 hover:text-red-300 px-1">✕</button>
                    </div>
                  ))}
                  <select defaultValue="" onChange={(e) => {
                    const type = e.target.value as EffectType
                    if (!type) return
                    e.target.value = ''
                    update((d) => { if (!d.launchPipeline) return; d.launchPipeline.effects.push(createEffectDraft(type)) })
                  }} className="w-full text-xs mt-2">
                    <option value="">+ Add effect…</option>
                    {LAUNCH_PIPELINE_EFFECT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
            )}
          </ConfigSectionPanel>
        )}

        {form.appType === 'widget' && form.id === 'gallery' && (
          <ConfigSectionPanel label="Gallery Settings">
            <div className="space-y-3">
              <Toggle checked={form.gallerySettings?.randomOrder ?? true} label="Random order"
                onChange={(v) => update((d) => { d.gallerySettings = { randomOrder: v, autoPlay: d.gallerySettings?.autoPlay ?? false, intervalSec: d.gallerySettings?.intervalSec ?? 8 } })} />
              <Toggle checked={form.gallerySettings?.autoPlay ?? false} label="Auto play"
                onChange={(v) => update((d) => { d.gallerySettings = { randomOrder: d.gallerySettings?.randomOrder ?? true, autoPlay: v, intervalSec: d.gallerySettings?.intervalSec ?? 8 } })} />
              <div>
                <div className="text-[10px] text-zinc-500 mb-1">Auto interval (seconds)</div>
                <input type="number" min={2} max={120} value={form.gallerySettings?.intervalSec ?? 8}
                  onChange={(e) => update((d) => { d.gallerySettings = { randomOrder: d.gallerySettings?.randomOrder ?? true, autoPlay: d.gallerySettings?.autoPlay ?? false, intervalSec: Math.max(2, Math.min(120, Number(e.target.value) || 8)) } })}
                  className="w-24 font-mono text-xs" />
                <div className="text-[10px] text-zinc-600 mt-1">Playback controls in overlay use Previous / Play / Next.</div>
              </div>
            </div>
          </ConfigSectionPanel>
        )}

        <ConfigSectionPanel label="Application Model">
          <div className="space-y-3">
            <div className="grid gap-2 md:grid-cols-2">
              <ModelField field="id" value={form.id} mono />
              <ModelField field="appType" value={form.appType} mono />
              <ModelField field="label" value={form.label || 'untitled'} />
              <ModelField field="icon" value={form.icon || 'unset'} mono />
              <ModelField field="iconSize" value={form.iconSize ?? 'normal'} mono />
              {form.appType === 'scene' && <ModelField field="targetSceneId" value={form.targetSceneId || 'none'} mono />}
              {form.appType === 'widget' && widgetSource && <ModelField field="widgetSource" value={widgetSource} mono />}
              {form.appType === 'widget' && widgetComponent && <ModelField field="widgetComponent" value={widgetComponent} mono />}
              <ModelField field="iconPosition" value={formatIconPositionModel(form.iconPosition)} mono />
              {supportsSceneTransitions && (
                <>
                  <ModelField field="introTransitions" value={summarizeTransitionModel(form.introTransitions)} />
                  <ModelField field="exitTransitions"  value={summarizeTransitionModel(form.exitTransitions)} />
                </>
              )}
            </div>
            {isProtectedSystemWidget && (
              <div className="rounded border border-amber-500/20 bg-amber-500/8 px-3 py-2 text-[10px] text-amber-100/90 leading-relaxed">
                System widgets are part of the persisted baseline model. They remain present in config and cannot be removed from the dashboard.
              </div>
            )}
          </div>
        </ConfigSectionPanel>
      </div>

      <button onClick={onDelete} disabled={isProtectedSystemWidget}
        className={'text-xs px-2 py-1 rounded border transition-colors ' + (
          isProtectedSystemWidget
            ? 'border-zinc-800 text-zinc-600 cursor-not-allowed'
            : 'text-red-400 hover:text-red-300 border-red-900/50 hover:border-red-700'
        )}>
        {isProtectedSystemWidget ? 'Protected' : 'Remove'}
      </button>
    </div>
  )
}

// ── NewWidgetForm ─────────────────────────────────────────────────────

export function NewWidgetForm({ onCreated }: { onCreated: (appId: string) => void }) {
  const config     = useAdminStore((s) => s.config)
  const saveConfig = useAdminStore((s) => s.saveConfig)
  const applications = config.applications

  const [widgetComponent, setWidgetComponent] = useState<UserWidgetBaseComponent>('camera')
  const [label,    setLabel]    = useState('')
  const [icon,     setIcon]     = useState(USER_WIDGET_COMPONENT_OPTIONS[0].icon)
  const [creating, setCreating] = useState(false)
  const [error,    setError]    = useState('')

  const componentMeta = USER_WIDGET_COMPONENT_OPTIONS.find((option) => option.id === widgetComponent) ?? USER_WIDGET_COMPONENT_OPTIONS[0]
  const existingIds = useMemo(() => new Set(applications.map((app) => app.id)), [applications])
  const defaultLabel = widgetComponent === 'camera' ? 'Camera Widget' : 'Source Widget'
  const nextLabel = label.trim() || defaultLabel
  const previewId = buildUserWidgetId(widgetComponent, nextLabel, existingIds)
  const firstSourceReference = useMemo(() => findFirstSceneSource(config.scenes), [config.scenes])

  const handleCreate = async () => {
    setCreating(true)
    setError('')
    try {
      const nextDesktop = withDesktopConfigDefaults(config.desktopConfig)
      const nextDefaultZIndex = Math.max(-1, ...Object.values(nextDesktop.widgetDefaultZIndices ?? {})) + 1
      const nextWidget: Application = {
        id: previewId,
        label: nextLabel,
        icon: icon.trim() || componentMeta.icon,
        appType: 'widget',
        targetSceneId: STATE.DESKTOP,
        widgetSource: 'user',
        widgetComponent,
        transitionType: 'instant',
        iconSize: 'normal',
        ...(widgetComponent === 'camera' ? { cameraSettings: { mirror: false } } : {}),
        ...(widgetComponent === 'source' && firstSourceReference ? { sourceWidgetSettings: firstSourceReference } : {}),
      }
      await saveConfig({
        applications: [...applications, nextWidget],
        desktopConfig: { ...nextDesktop, widgetDefaultZIndices: { ...(nextDesktop.widgetDefaultZIndices ?? {}), [previewId]: nextDefaultZIndex } },
      })
      onCreated(previewId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create widget.')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="space-y-0 pt-1">
      <ConfigSectionPanel label="Create Widget" first>
        <div className="space-y-3">
          <div className="text-[10px] text-zinc-400 leading-relaxed">
            New widgets are stored as user widget records. Choose the base component first, then create the widget and continue configuring it from the standard widget editor.
          </div>
          <div>
            <div className="text-[10px] text-zinc-500 mb-1.5">Base Component</div>
            <div className="grid grid-cols-2 gap-2">
              {USER_WIDGET_COMPONENT_OPTIONS.map((option) => {
                const active = option.id === widgetComponent
                return (
                  <button key={option.id} type="button"
                    onClick={() => {
                      const currentMeta = USER_WIDGET_COMPONENT_OPTIONS.find((entry) => entry.id === widgetComponent)
                      setWidgetComponent(option.id)
                      if (!icon.trim() || icon === currentMeta?.icon) setIcon(option.icon)
                    }}
                    className={'rounded border px-3 py-3 text-left transition-colors ' + (
                      active ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-200' : 'border-zinc-800 bg-zinc-900/40 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-900/60'
                    )}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-base">{option.icon}</span>
                      <span className="text-[11px] font-semibold uppercase tracking-[0.18em]">{option.label}</span>
                    </div>
                    <div className="text-[10px] leading-relaxed text-zinc-500">{option.description}</div>
                  </button>
                )
              })}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-zinc-500 mb-1">Label</div>
            <input type="text" value={label} onChange={(e) => setLabel(e.target.value)} placeholder={defaultLabel} className="w-full text-xs" />
          </div>
          <div>
            <div className="text-[10px] text-zinc-500 mb-1">Generated ID</div>
            <input type="text" value={previewId} readOnly className="w-full text-xs font-mono text-zinc-500 cursor-default select-all" />
          </div>
          <div>
            <div className="text-[10px] text-zinc-500 mb-1">Icon</div>
            <div className="flex gap-2 items-center">
              <div className="w-11 h-11 flex items-center justify-center bg-zinc-800 rounded border border-zinc-700 overflow-hidden shrink-0">
                <IconGlyph icon={icon || componentMeta.icon} label={nextLabel} size={32} />
              </div>
              <div className="flex-1 min-w-0">
                <AssetSelectionInput value={icon} onChange={setIcon} kinds={['image']} modalTitle="Widget Icon"
                  placeholder="Emoji or /assets/icons/custom.png" buttonLabel="Choose Image"
                  hint="Leave an emoji in the field, or use the asset library to assign a custom image icon."
                  inputClassName="font-mono" previewKind="image" showPreview={false} />
              </div>
            </div>
          </div>
          {widgetComponent === 'source' && (
            <div className="rounded border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-[10px] leading-relaxed text-zinc-400">
              {firstSourceReference
                ? `Initial binding will use ${firstSourceReference.sceneId} / ${firstSourceReference.sourceId}. You can change this immediately after creation.`
                : 'No scene sources are available yet. The widget will still be created, but you will need to bind it to a source from the widget editor later.'}
            </div>
          )}
          {error && <div className="rounded border border-red-900/60 bg-red-950/30 px-3 py-2 text-[10px] text-red-300">{error}</div>}
          <div className="flex justify-end">
            <Btn variant="primary" onClick={() => { void handleCreate() }} disabled={creating}>
              {creating ? 'Creating...' : 'Create Widget'}
            </Btn>
          </div>
        </div>
      </ConfigSectionPanel>
    </div>
  )
}

// ── WidgetLayoutPanel ─────────────────────────────────────────────────

export function WidgetLayoutPanel({ layoutId, onDeleted }: { layoutId: string; onDeleted: () => void }) {
  const config               = useAdminStore((s) => s.config)
  const runtimeConfigOverride = useAdminStore((s) => s.runtimeConfigOverride)
  const saveConfig           = useAdminStore((s) => s.saveConfig)
  const openWidgetIds        = useAdminStore((s) => s.openWidgetIds)
  const desktopConfig = useMemo(() => withDesktopConfigDefaults(config.desktopConfig), [config.desktopConfig])
  const widgetApps    = useMemo(() => config.applications.filter((app) => app.appType === 'widget'), [config.applications])
  const sourceLayouts = useMemo(() => normalizeWidgetLayoutsForEditor(desktopConfig.widgetLayouts, widgetApps, desktopConfig), [desktopConfig, widgetApps])
  const sourceLayout  = useMemo(() => sourceLayouts.find((layout) => layout.id === layoutId) ?? null, [layoutId, sourceLayouts])

  const [layout,            setLayout]            = useState<WidgetLayoutDefinition | null>(sourceLayout)
  const [saving,            setSaving]            = useState(false)
  const [saved,             setSaved]             = useState(false)
  const [saveDefaultArmed,  setSaveDefaultArmed]  = useState(false)
  const [factoryResetArmed, setFactoryResetArmed] = useState(false)
  const [clearingOverride,  setClearingOverride]  = useState(false)
  const [clearOverrideError, setClearOverrideError] = useState<string | null>(null)
  const savedTimer       = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveDefaultTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const factoryResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setLayout(sourceLayout ? structuredClone(sourceLayout) : null)
    setClearingOverride(false); setClearOverrideError(null); setFactoryResetArmed(false); setSaved(false)
  }, [sourceLayout])

  useEffect(() => () => {
    if (savedTimer.current) clearTimeout(savedTimer.current)
    if (saveDefaultTimer.current) clearTimeout(saveDefaultTimer.current)
    if (factoryResetTimer.current) clearTimeout(factoryResetTimer.current)
  }, [])

  if (!sourceLayout || !layout) return <div className="text-zinc-600 text-xs italic p-4">Layout not found.</div>

  const dirty = !isSameDraft(layout, sourceLayout)
  const layoutWidgetIds = layout.items.map((item) => item.widgetId)
  const runtimeWidgetPositions = runtimeConfigOverride.desktopConfig?.widgetPositions ?? {}
  const runtimeWidgetSizes     = runtimeConfigOverride.desktopConfig?.widgetSizes ?? {}
  const runtimeWidgetZIndices  = runtimeConfigOverride.desktopConfig?.widgetZIndices ?? {}
  const hasRuntimeOverride = layoutWidgetIds.some((id) => id in runtimeWidgetPositions || id in runtimeWidgetSizes || id in runtimeWidgetZIndices)
  const activeRuntimeOverrideCount = layoutWidgetIds.filter((id) => id in runtimeWidgetPositions || id in runtimeWidgetSizes || id in runtimeWidgetZIndices).length
  const defaultSnapshot = sourceLayout.defaultConfig ? structuredClone(sourceLayout.defaultConfig) : createWidgetLayoutSnapshot(sourceLayout)
  const factorySystemLayout = sourceLayout.source === 'system'
    ? DEFAULT_SYSTEM_WIDGET_LAYOUTS.find((entry) => entry.id === sourceLayout.id)
    : undefined

  const applySnapshotToLayout = (target: WidgetLayoutDefinition, snapshot: WidgetLayoutSnapshot): WidgetLayoutDefinition => ({
    ...target, label: snapshot.label, icon: snapshot.icon, description: snapshot.description, items: structuredClone(snapshot.items),
  })

  const persistLayout = async (nextLayout: WidgetLayoutDefinition) => {
    setSaving(true)
    await saveConfig({ desktopConfig: { ...desktopConfig, widgetLayouts: sourceLayouts.map((entry) => entry.id === layoutId ? nextLayout : entry) } })
    setSaving(false)
    if (savedTimer.current) clearTimeout(savedTimer.current)
    setSaved(true)
    savedTimer.current = setTimeout(() => setSaved(false), 1500)
  }

  const reset = () => { setLayout(structuredClone(sourceLayout)); setSaveDefaultArmed(false); setSaved(false) }

  const updateLayout = (updater: (draft: WidgetLayoutDefinition) => void) => {
    setLayout((prev) => { if (!prev) return prev; const next = structuredClone(prev); updater(next); return next })
    setSaved(false)
  }

  const restoreDefaults = async () => {
    await persistLayout({ ...applySnapshotToLayout(layout, defaultSnapshot), defaultConfig: structuredClone(sourceLayout.defaultConfig ?? defaultSnapshot) })
    setSaveDefaultArmed(false)
  }

  const buildFactoryResetLayout = (): WidgetLayoutDefinition => {
    if (factorySystemLayout) {
      const [normalizedFactoryLayout] = normalizeWidgetLayoutsForEditor([factorySystemLayout], widgetApps, desktopConfig)
      if (normalizedFactoryLayout) {
        return { ...normalizedFactoryLayout, defaultConfig: structuredClone(sourceLayout.defaultConfig ?? normalizedFactoryLayout.defaultConfig) }
      }
    }
    return { ...layout, items: widgetApps.map((app, index) => buildWidgetLayoutItem(app, index, desktopConfig, false)), defaultConfig: structuredClone(sourceLayout.defaultConfig ?? defaultSnapshot) }
  }

  const performFactoryReset = async () => {
    if (!factoryResetArmed) {
      setFactoryResetArmed(true)
      if (factoryResetTimer.current) clearTimeout(factoryResetTimer.current)
      factoryResetTimer.current = setTimeout(() => setFactoryResetArmed(false), 3500)
      return
    }
    if (factoryResetTimer.current) clearTimeout(factoryResetTimer.current)
    await persistLayout(buildFactoryResetLayout())
    setFactoryResetArmed(false)
  }

  const saveCurrentAsDefault = async () => {
    if (!saveDefaultArmed) {
      setSaveDefaultArmed(true)
      if (saveDefaultTimer.current) clearTimeout(saveDefaultTimer.current)
      saveDefaultTimer.current = setTimeout(() => setSaveDefaultArmed(false), 3500)
      return
    }
    if (saveDefaultTimer.current) clearTimeout(saveDefaultTimer.current)
    await persistLayout({ ...layout, defaultConfig: createWidgetLayoutSnapshot(layout) })
    setSaveDefaultArmed(false)
  }

  const captureCurrentIntoLayout = () => {
    const nextLayout = createWidgetLayoutFromCurrentState('current', widgetApps, desktopConfig, openWidgetIds)
    updateLayout((draft) => { draft.items = nextLayout.items.map((item) => ({ ...item })) })
  }

  const deleteLayout = async () => {
    if (layout.source === 'system') return
    setSaving(true)
    await saveConfig({ desktopConfig: { ...desktopConfig, widgetLayouts: sourceLayouts.filter((entry) => entry.id !== layoutId) } })
    setSaving(false)
    onDeleted()
  }

  const applyLayout = async () => { await persistLayout(layout); socket.emit('widget:layout:apply', layoutId) }

  const clearLayoutOverride = () => {
    if (!hasRuntimeOverride || clearingOverride) return
    setClearingOverride(true)
    setClearOverrideError(null)
    socket.emit('runtime:config:override:widget-layout:clear', layoutWidgetIds, (err: string | null) => {
      setClearingOverride(false)
      if (err) { setClearOverrideError(err); return }
      setClearOverrideError(null)
    })
  }

  return (
    <div className="space-y-3">
      <ConfigApplyBar label={layout.label} dirty={dirty} saving={saving} saved={saved}
        onApply={() => { void persistLayout(layout) }} onReset={() => { void restoreDefaults() }} alwaysShow />
      <div className="space-y-0 pt-3">
        <ConfigSectionPanel label="Runtime Override" first>
          <div className="space-y-2.5">
            <div className="flex gap-2 items-start">
              <input type="text" value={layout.icon}
                onChange={(e) => updateLayout((draft) => { draft.icon = e.target.value || '📐' })}
                className="w-10 text-center font-mono text-xs" />
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-center gap-2">
                  <input type="text" value={layout.label}
                    onChange={(e) => updateLayout((draft) => { draft.label = e.target.value })}
                    className="flex-1 text-xs" placeholder="Layout label" />
                  <span className={'text-[9px] font-bold uppercase tracking-[0.16em] px-2 py-0.5 rounded-full border shrink-0 ' + (
                    layout.source === 'system' ? 'border-amber-500/30 bg-amber-500/10 text-amber-200' : 'border-cyan-500/30 bg-cyan-500/10 text-cyan-200'
                  )}>{layout.source}</span>
                </div>
                <input type="text" value={layout.description ?? ''}
                  onChange={(e) => updateLayout((draft) => { draft.description = e.target.value })}
                  className="w-full text-[11px]" placeholder="Optional description" />
              </div>
            </div>
            <ConfigCard className="space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="mt-1 text-[11px] text-zinc-200">
                    {hasRuntimeOverride ? `Active for ${activeRuntimeOverrideCount} ${activeRuntimeOverrideCount === 1 ? 'widget' : 'widgets'}` : 'No active override'}
                  </div>
                </div>
              </div>
              <div className="text-[10px] leading-relaxed text-zinc-500">
                Removes live runtime position, size, and stack-order overrides for every widget included in this layout without changing the saved layout definition.
              </div>
            </ConfigCard>
            {clearOverrideError && <ConfigNotice tone="danger">{clearOverrideError}</ConfigNotice>}
            <div className="flex gap-2">
              <Btn type="button" variant="primary" onClick={() => { void applyLayout() }} className="flex-1 px-2.5 py-1 text-[10px]">Apply</Btn>
              <Btn type="button" onClick={clearLayoutOverride} disabled={!hasRuntimeOverride || clearingOverride} className="px-2.5 py-1 text-[10px]">
                {clearingOverride ? 'Clearing Override...' : 'Clear Override'}
              </Btn>
              <Btn type="button" variant={layout.source === 'system' ? 'ghost' : 'danger'}
                onClick={() => { void deleteLayout() }} disabled={layout.source === 'system'} className="px-2.5 py-1 text-[10px]">
                {layout.source === 'system' ? 'Protected' : 'Delete'}
              </Btn>
            </div>
          </div>
        </ConfigSectionPanel>

        <ConfigSectionPanel label="Layout Configuration">
          <div className="space-y-2.5">
            {layout.source === 'system' && <div className="text-[10px] text-zinc-500">Built-in taskbar layout. Persistent, not removable.</div>}
            <div className="flex justify-end">
              <div className="flex flex-wrap justify-end gap-2">
                <Btn type="button" variant={factoryResetArmed ? 'danger' : 'ghost'} onClick={() => { void performFactoryReset() }} className="px-2.5 py-1 text-[10px]">
                  {factoryResetArmed ? 'Confirm Factory Reset' : 'Perform Factory Reset'}
                </Btn>
                <Btn type="button" onClick={() => captureCurrentIntoLayout()} className="px-2.5 py-1 text-[10px]">Use Current</Btn>
              </div>
            </div>
            <div className="space-y-1.5">
              {layout.items.map((item) => {
                const app = widgetApps.find((entry) => entry.id === item.widgetId)
                if (!app) return null
                return (
                  <div key={item.widgetId} className="rounded border border-zinc-800/80 bg-zinc-950/40 px-2 py-1.5 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <input type="checkbox" checked={item.enabled}
                        onChange={(e) => updateLayout((draft) => { const row = draft.items.find((entry) => entry.widgetId === item.widgetId); if (row) row.enabled = e.target.checked })} />
                      <div className="w-5 h-5 rounded border border-zinc-700 bg-zinc-900 flex items-center justify-center shrink-0">
                        <IconGlyph icon={app.icon} label={app.label} size={14} />
                      </div>
                      <div className="flex-1 min-w-0 text-[11px] text-zinc-200 truncate">{app.label}</div>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-[9px] uppercase tracking-wider text-zinc-500">Focus</span>
                        <input type="number" min={-999} max={999} value={item.focusPriority}
                          onChange={(e) => updateLayout((draft) => { const row = draft.items.find((entry) => entry.widgetId === item.widgetId); if (row) row.focusPriority = Math.max(-999, Math.min(999, Math.round(Number(e.target.value) || 0))) })}
                          className="w-14 font-mono text-[11px]" />
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-1.5">
                      {(['x', 'y', 'width', 'height'] as const).map((field) => (
                        <div key={field}>
                          <div className="text-[9px] text-zinc-500 mb-0.5 uppercase tracking-wider">{field === 'width' ? 'W' : field === 'height' ? 'H' : field.toUpperCase()}</div>
                          <input type="number"
                            min={field === 'width' ? WIDGET_WIDTH_MIN : field === 'height' ? WIDGET_HEIGHT_MIN : 0}
                            max={field === 'width' ? WIDGET_WIDTH_MAX : field === 'height' ? WIDGET_HEIGHT_MAX : undefined}
                            value={item[field]}
                            onChange={(e) => updateLayout((draft) => {
                              const row = draft.items.find((entry) => entry.widgetId === item.widgetId)
                              if (!row) return
                              const v = Number(e.target.value) || 0
                              if (field === 'width')  row.width  = clampWidgetDimension(v, WIDGET_WIDTH_MIN,  WIDGET_WIDTH_MAX,  row.width)
                              else if (field === 'height') row.height = clampWidgetDimension(v, WIDGET_HEIGHT_MIN, WIDGET_HEIGHT_MAX, row.height)
                              else row[field] = Math.max(0, Math.round(v))
                            })}
                            className="w-full font-mono text-[11px]" />
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </ConfigSectionPanel>
      </div>
    </div>
  )
}

// ── EventForm ─────────────────────────────────────────────────────────

export function EventForm({
  def,
  onUpdate,
  onDelete,
  showOverview = true,
  showDeleteButton = true,
}: {
  def: EventDef
  onUpdate: (d: EventDef) => void
  onDelete?: () => void
  showOverview?: boolean
  showDeleteButton?: boolean
}) {
  const config       = useAdminStore((s) => s.config)
  const desktopConfig = withDesktopConfigDefaults(config.desktopConfig)
  const widgetApps   = useMemo(() => config.applications.filter((app) => app.appType === 'widget'), [config.applications])
  const widgetLayouts = desktopConfig.widgetLayouts ?? []

  const update = (fn: (d: EventDef) => void) => {
    const next: EventDef = {
      ...def,
      auto: { ...def.auto },
      effects: def.effects.map((effect) => structuredClone(effect)),
      actions: structuredClone(def.actions ?? []),
    }
    fn(next)
    onUpdate(next)
  }

  const updateDesktopNotificationEffect = (index: number, updater: (cfg: DesktopNotificationEffectConfig) => void) => {
    update((d) => {
      const effect = d.effects[index]
      if (!effect || effect.type !== 'desktop-notification') return
      const nextCfg = normalizeDesktopNotificationEffectConfig(effect.cfg)
      updater(nextCfg)
      d.effects[index] = { ...effect, cfg: nextCfg }
    })
  }

  const updateAction = (index: number, updater: (action: EventAction) => void) => {
    update((d) => { const action = d.actions?.[index]; if (!action) return; updater(action) })
  }

  const addAction = (kind: EventAction['kind']) => {
    update((d) => { d.actions = [...(d.actions ?? []), createEventActionDraft(kind)] })
  }

  const addEffect = (type: EffectType) => {
    update((d) => { d.effects.push(createEffectDraft(type)) })
  }

  const renderThemeFields = (theme: WidgetThemeConfig, onChange: (updater: (draft: WidgetThemeConfig) => void) => void) => (
    <div className="grid grid-cols-2 gap-2 pl-1">
      <div>
        <div className="text-[10px] text-zinc-500 mb-1">Skin</div>
        <select value={theme.skin} onChange={(e) => onChange((draft) => Object.assign(draft, structuredClone(DEFAULT_WIDGET_THEME_PRESETS[e.target.value as keyof typeof DEFAULT_WIDGET_THEME_PRESETS])))} className="w-full text-xs">
          {WIDGET_SKINS.map((skin) => <option key={skin.id} value={skin.id}>{skin.label}</option>)}
        </select>
      </div>
      <div>
        <div className="text-[10px] text-zinc-500 mb-1">Font</div>
        <select value={theme.fontFamily} onChange={(e) => onChange((draft) => { draft.fontFamily = e.target.value })} className="w-full text-xs">
          {GOOGLE_FONTS.map((font) => <option key={font.css} value={font.css}>{font.name}</option>)}
        </select>
      </div>
      <div>
        <div className="text-[10px] text-zinc-500 mb-1">Accent</div>
        <HexColorInput value={theme.accentColor} onChange={(value) => onChange((draft) => { draft.accentColor = value })} />
      </div>
      <div>
        <div className="text-[10px] text-zinc-500 mb-1">Text</div>
        <HexColorInput value={theme.textColor} onChange={(value) => onChange((draft) => { draft.textColor = value })} />
      </div>
      <div>
        <div className="text-[10px] text-zinc-500 mb-1">Animation</div>
        <select value={theme.animation} onChange={(e) => onChange((draft) => { draft.animation = e.target.value as WidgetThemeConfig['animation'] })} className="w-full text-xs">
          {WIDGET_THEME_ANIMATIONS.map((animation) => <option key={animation.id} value={animation.id}>{animation.label}</option>)}
        </select>
      </div>
      <div>
        <div className="text-[10px] text-zinc-500 mb-1">Atmosphere</div>
        <select value={theme.atmosphere} onChange={(e) => onChange((draft) => { draft.atmosphere = e.target.value as WidgetThemeConfig['atmosphere'] })} className="w-full text-xs">
          {WIDGET_THEME_ATMOSPHERES.map((atmosphere) => <option key={atmosphere.id} value={atmosphere.id}>{atmosphere.label}</option>)}
        </select>
      </div>
      <div>
        <div className="text-[10px] text-zinc-500 mb-1">Motion</div>
        <input type="number" min={0} max={3} step={0.05} value={theme.motionIntensity}
          onChange={(e) => onChange((draft) => { draft.motionIntensity = Number(e.target.value) })}
          className="w-full font-mono text-xs" />
      </div>
      <div>
        <div className="text-[10px] text-zinc-500 mb-1">Glow</div>
        <input type="number" min={0} max={3} step={0.05} value={theme.glowIntensity}
          onChange={(e) => onChange((draft) => { draft.glowIntensity = Number(e.target.value) })}
          className="w-full font-mono text-xs" />
      </div>
    </div>
  )

  return (
    <div className="space-y-4">
      {showOverview && (
        <>
          <div className="flex items-center gap-4 rounded-xl border border-zinc-700/60 bg-zinc-800/50 px-4 py-4">
            <span className="text-3xl">{def.icon}</span>
            <div className="min-w-0">
              <div className="text-base font-bold text-zinc-100">{def.label}</div>
              <div className="text-xs text-zinc-500 font-mono">{def.id}</div>
              <div className="mt-1 text-xs text-zinc-400">{def.desc}</div>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <ConfigCard className="text-left">
              <div className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">Setup</div>
              <div className="mt-1 text-sm font-semibold text-zinc-100">{describeEventSetup(def)}</div>
            </ConfigCard>
            <ConfigCard className="text-left">
              <div className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">Runtime Actions</div>
              <div className="mt-1 text-sm font-semibold text-zinc-100">{def.actions?.length ?? 0}</div>
            </ConfigCard>
            <ConfigCard className="text-left">
              <div className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">Overlay Effects</div>
              <div className="mt-1 text-sm font-semibold text-zinc-100">{def.effects.length}</div>
            </ConfigCard>
          </div>
        </>
      )}

      <div className="grid gap-4 grid-cols-[280px_minmax(0,1fr)] items-start">
        <div className="space-y-0 sticky top-0">
          {!def.builtIn && (
            <ConfigSectionPanel label="Identity" first>
              <div className="space-y-3">
                <div>
                  <div className="text-[10px] text-zinc-400 mb-1">Label</div>
                  <input type="text" value={def.label} onChange={(e) => update((d) => { d.label = e.target.value })} className="w-full" />
                </div>
                <div>
                  <div className="text-[10px] text-zinc-400 mb-1">Icon</div>
                  <input type="text" value={def.icon} onChange={(e) => update((d) => { d.icon = e.target.value })} className="w-full" placeholder="⚡" />
                </div>
                <div>
                  <div className="text-[10px] text-zinc-400 mb-1">Description</div>
                  <textarea value={def.desc} onChange={(e) => update((d) => { d.desc = e.target.value })} className="min-h-[88px] w-full text-sm" />
                </div>
              </div>
            </ConfigSectionPanel>
          )}
          <ConfigSectionPanel label="Trigger" first={def.builtIn}>
            <Toggle checked={def.auto.enabled} onChange={(v) => update((d) => { d.auto.enabled = v })} label="Enable auto-trigger" />
            {def.auto.enabled && (
              <div className="mt-3 space-y-3">
                <div>
                  <div className="text-[10px] text-zinc-400 mb-1">Mode</div>
                  <div className="flex gap-2">
                    {(['interval', 'idle'] as const).map((m) => (
                      <ConfigChoiceButton key={m} type="button" selected={def.auto.mode === m} onClick={() => update((d) => { d.auto.mode = m })} className="flex-1 py-2 text-sm">{m}</ConfigChoiceButton>
                    ))}
                  </div>
                </div>
                {def.auto.mode === 'interval' && <Slider label="Avg every" value={def.auto.intervalMin} min={1} max={60} step={1} unit="min" onChange={(v) => update((d) => { d.auto.intervalMin = v })} />}
                {def.auto.mode === 'idle'     && <Slider label="After idle" value={def.auto.idleMin}     min={1} max={30} step={1} unit="min" onChange={(v) => update((d) => { d.auto.idleMin     = v })} />}
                <Slider label="Chance"   value={Math.round(def.auto.chance * 100)}  min={0} max={100} step={5}   unit="%" onChange={(v) => update((d) => { d.auto.chance       = v / 100 })} />
                <Slider label="Cooldown" value={def.auto.cooldownMin}               min={0} max={120} step={1}   unit="min" onChange={(v) => update((d) => { d.auto.cooldownMin = v })} />
                <div>
                  <div className="text-[10px] text-zinc-400 mb-1">Allowed states</div>
                  <div className="flex gap-2">
                    {[STATE.DESKTOP, STATE.LOBBY].map((stateId) => {
                      const selected = (def.auto.allowedStates ?? []).includes(stateId)
                      return (
                        <ConfigChoiceButton key={stateId} type="button" selected={selected}
                          onClick={() => update((d) => {
                            const next = new Set(d.auto.allowedStates ?? [])
                            if (next.has(stateId)) next.delete(stateId); else next.add(stateId)
                            d.auto.allowedStates = next.size ? [...next] : undefined
                          })}
                          className="flex-1 py-2 text-sm">{stateId}</ConfigChoiceButton>
                      )
                    })}
                  </div>
                  <div className="mt-1 text-[10px] text-zinc-500">Leave both off to allow any runtime state.</div>
                </div>
              </div>
            )}
          </ConfigSectionPanel>
          {!def.builtIn && showDeleteButton && onDelete && (
            <div className="pt-3">
              <Btn variant="danger" onClick={onDelete} className="w-full py-2.5 text-sm">Delete Event</Btn>
            </div>
          )}
        </div>

        <div className="space-y-0">
          <ConfigSectionPanel label="Runtime Actions" first>
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {COMMON_EVENT_ACTION_KINDS.map((kind) => (
                  <button key={kind} type="button" onClick={() => addAction(kind)}
                    className="rounded-full border border-zinc-700/70 bg-zinc-950/60 px-3 py-1.5 text-[11px] font-semibold text-zinc-300 transition hover:border-cyan-400/35 hover:text-cyan-200">
                    + {getEventActionLabel(kind)}
                  </button>
                ))}
              </div>
              {(def.actions ?? []).length === 0 && <div className="text-[10px] text-zinc-600 italic">No runtime actions configured.</div>}
              {(def.actions ?? []).map((action, index) => (
                <div key={`${def.id}-action-${index}`} className="space-y-3 rounded-xl border border-zinc-800/70 bg-zinc-950/45 px-4 py-4">
                  <div className="flex items-center gap-3">
                    <span className="flex-1 text-xs font-mono text-zinc-300">{action.kind}</span>
                    <button type="button" onClick={() => update((d) => { d.actions?.splice(index, 1) })}
                      className="rounded-md px-2 py-1 text-[11px] text-red-400 transition hover:bg-red-500/10 hover:text-red-200">Remove</button>
                  </div>
                  {action.kind === 'desktop-config' && (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2 pl-1">
                        <div>
                          <div className="text-[10px] text-zinc-500 mb-1">Desktop theme</div>
                          <select value={action.patch.theme ?? 'win98'} onChange={(e) => updateAction(index, (draft) => { if (draft.kind !== 'desktop-config') return; draft.patch.theme = e.target.value as DesktopConfig['theme'] })} className="w-full text-xs">
                            {DESKTOP_THEMES.map((theme) => <option key={theme.id} value={theme.id}>{theme.label}</option>)}
                          </select>
                        </div>
                        <div>
                          <div className="text-[10px] text-zinc-500 mb-1">Icon motion</div>
                          <select value={action.patch.iconAnimation ?? 'none'} onChange={(e) => updateAction(index, (draft) => { if (draft.kind !== 'desktop-config') return; draft.patch.iconAnimation = e.target.value as DesktopConfig['iconAnimation'] })} className="w-full text-xs">
                            {ICON_ANIMATIONS.map((mode) => <option key={mode.id} value={mode.id}>{mode.label}</option>)}
                          </select>
                        </div>
                        <div>
                          <div className="text-[10px] text-zinc-500 mb-1">Icon intensity</div>
                          <input type="number" min={0} max={3} step={0.05} value={action.patch.iconMotion ?? 1}
                            onChange={(e) => updateAction(index, (draft) => { if (draft.kind !== 'desktop-config') return; draft.patch.iconMotion = Number(e.target.value) })}
                            className="w-full font-mono text-xs" />
                        </div>
                        <div>
                          <div className="text-[10px] text-zinc-500 mb-1">Screen saver</div>
                          <select value={action.patch.screenSaver?.preset ?? desktopConfig.screenSaver.preset}
                            onChange={(e) => updateAction(index, (draft) => {
                              if (draft.kind !== 'desktop-config') return
                              draft.patch.screenSaver = { enabled: draft.patch.screenSaver?.enabled ?? desktopConfig.screenSaver.enabled, timeoutMinutes: draft.patch.screenSaver?.timeoutMinutes ?? desktopConfig.screenSaver.timeoutMinutes, preset: e.target.value as DesktopConfig['screenSaver']['preset'] }
                            })} className="w-full text-xs">
                            {SCREENSAVER_PRESETS.map((preset) => <option key={preset.id} value={preset.id}>{preset.label}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="rounded border border-zinc-800/70 bg-zinc-900/45 py-2">
                        <div className="px-3 pb-2 text-[10px] uppercase tracking-wider text-zinc-500">Global Widget Theme</div>
                        {renderThemeFields({ ...DEFAULT_WIDGET_THEME_PRESETS.metalheart, ...(action.patch.widgetTheme ?? {}) }, (updater) => updateAction(index, (draft) => {
                          if (draft.kind !== 'desktop-config') return
                          const nextTheme: WidgetThemeConfig = { ...DEFAULT_WIDGET_THEME_PRESETS.metalheart, ...(draft.patch.widgetTheme ?? {}) }
                          updater(nextTheme)
                          draft.patch.widgetTheme = nextTheme
                        }))}
                      </div>
                    </div>
                  )}
                  {action.kind === 'widget-theme-overrides' && (
                    <div className="space-y-2">
                      <div>
                        <div className="text-[10px] text-zinc-500 mb-1">Target widgets</div>
                        <div className="flex flex-wrap gap-1">
                          {widgetApps.map((app) => {
                            const selected = action.widgetIds.includes(app.id)
                            return (
                              <ConfigChoiceButton key={app.id} type="button" selected={selected}
                                onClick={() => updateAction(index, (draft) => {
                                  if (draft.kind !== 'widget-theme-overrides') return
                                  const next = new Set(draft.widgetIds)
                                  if (next.has(app.id)) next.delete(app.id); else next.add(app.id)
                                  draft.widgetIds = [...next]
                                })} className="text-[10px]">{app.label}</ConfigChoiceButton>
                            )
                          })}
                        </div>
                      </div>
                      <Toggle checked={action.clearExisting ?? false} onChange={(value) => updateAction(index, (draft) => { if (draft.kind !== 'widget-theme-overrides') return; draft.clearExisting = value })} label="Reset existing overrides first" />
                      <div className="rounded border border-zinc-800/70 bg-zinc-900/45 py-2">
                        <div className="px-3 pb-2 text-[10px] uppercase tracking-wider text-zinc-500">Override Theme</div>
                        {renderThemeFields(action.theme as WidgetThemeConfig, (updater) => updateAction(index, (draft) => {
                          if (draft.kind !== 'widget-theme-overrides') return
                          const nextTheme = structuredClone(draft.theme as WidgetThemeConfig)
                          updater(nextTheme)
                          draft.theme = nextTheme
                        }))}
                      </div>
                    </div>
                  )}
                  {action.kind === 'widget-layout' && (
                    <div className="space-y-2">
                      <div className="rounded border border-zinc-800/70 bg-zinc-900/45 px-3 py-2">
                        <Slider label="Revert after" value={action.timeoutSeconds ?? 30} min={5} max={600} step={5} unit="s"
                          onChange={(value) => updateAction(index, (draft) => { if (draft.kind !== 'widget-layout') return; draft.timeoutSeconds = value })} />
                      </div>
                      <div>
                        <div className="text-[10px] text-zinc-500 mb-1">Layout</div>
                        <select value={action.layoutId} onChange={(e) => updateAction(index, (draft) => { if (draft.kind !== 'widget-layout') return; draft.layoutId = e.target.value })} className="w-full text-xs">
                          <option value="">Select a layout</option>
                          {widgetLayouts.map((layout) => <option key={layout.id} value={layout.id}>{layout.label}</option>)}
                        </select>
                      </div>
                    </div>
                  )}
                  {action.kind === 'widget-command' && (
                    <div className="grid grid-cols-2 gap-2 pl-1">
                      <div>
                        <div className="text-[10px] text-zinc-500 mb-1">Widget</div>
                        <select value={action.widgetId} onChange={(e) => updateAction(index, (draft) => { if (draft.kind !== 'widget-command') return; draft.widgetId = e.target.value })} className="w-full text-xs">
                          {widgetApps.map((app) => <option key={app.id} value={app.id}>{app.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <div className="text-[10px] text-zinc-500 mb-1">Action</div>
                        <select value={action.action} onChange={(e) => updateAction(index, (draft) => { if (draft.kind !== 'widget-command') return; draft.action = e.target.value as 'open' | 'close' | 'toggle' })} className="w-full text-xs">
                          <option value="toggle">Toggle</option>
                          <option value="open">Open</option>
                          <option value="close">Close</option>
                        </select>
                      </div>
                    </div>
                  )}
                  {action.kind === 'ambiance-patch' && (
                    <div className="grid grid-cols-2 gap-2 pl-1">
                      <div className="col-span-2">
                        <Toggle checked={action.patch.enabled ?? false} onChange={(value) => updateAction(index, (draft) => { if (draft.kind !== 'ambiance-patch') return; draft.patch.enabled = value })} label="Ambiance enabled" />
                      </div>
                      <div>
                        <div className="text-[10px] text-zinc-500 mb-1">Interval (s)</div>
                        <input type="number" min={1} step={1} value={action.patch.intervalSeconds ?? 30}
                          onChange={(e) => updateAction(index, (draft) => { if (draft.kind !== 'ambiance-patch') return; draft.patch.intervalSeconds = Number(e.target.value) })}
                          className="w-full font-mono text-xs" />
                      </div>
                      <div>
                        <div className="text-[10px] text-zinc-500 mb-1">Max open widgets</div>
                        <input type="number" min={1} step={1} value={action.patch.maxOpenWidgets ?? 2}
                          onChange={(e) => updateAction(index, (draft) => { if (draft.kind !== 'ambiance-patch') return; draft.patch.maxOpenWidgets = Number(e.target.value) })}
                          className="w-full font-mono text-xs" />
                      </div>
                      <div className="col-span-2">
                        <div className="text-[10px] text-zinc-500 mb-1">Open while one open chance</div>
                        <input type="number" min={0} max={1} step={0.05} value={action.patch.openWhileOneOpenChance ?? 0.35}
                          onChange={(e) => updateAction(index, (draft) => { if (draft.kind !== 'ambiance-patch') return; draft.patch.openWhileOneOpenChance = Number(e.target.value) })}
                          className="w-full font-mono text-xs" />
                      </div>
                    </div>
                  )}
                </div>
              ))}
              <select defaultValue="" onChange={(e) => { const kind = e.target.value as EventAction['kind']; if (!kind) return; e.target.value = ''; addAction(kind) }} className="w-full text-sm">
                <option value="">More action types…</option>
                <option value="desktop-config">Desktop config</option>
                <option value="widget-theme-overrides">Widget theme overrides</option>
                <option value="widget-layout">Apply widget layout</option>
                <option value="widget-command">Widget command</option>
                <option value="ambiance-patch">Ambiance patch</option>
              </select>
            </div>
          </ConfigSectionPanel>

          <ConfigSectionPanel label="Effects">
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {COMMON_EVENT_EFFECT_TYPES.map((type) => (
                  <button key={type} type="button" onClick={() => addEffect(type)}
                    className="rounded-full border border-zinc-700/70 bg-zinc-950/60 px-3 py-1.5 text-[11px] font-semibold text-zinc-300 transition hover:border-cyan-400/35 hover:text-cyan-200">
                    + {type}
                  </button>
                ))}
              </div>
              {def.effects.length === 0 && <div className="text-[10px] text-zinc-600 italic">No effects configured.</div>}
              {def.effects.map((eff, index) => (
                <div key={`${def.id}-effect-${index}`} className="space-y-3 border-b border-zinc-700/40 py-3 last:border-b-0">
                  <div className="flex items-center gap-3">
                    <span className="flex-1 text-xs font-mono text-zinc-300">{eff.type}</span>
                    <input type="number" min={0} max={10} step={0.1} value={eff.delay ?? 0}
                      onChange={(e) => update((d) => { d.effects[index] = { ...d.effects[index], delay: Number(e.target.value) } })}
                      className="w-20 font-mono text-xs" title="Delay (s)" />
                    <span className="text-[10px] text-zinc-600">s</span>
                    <button onClick={() => update((d) => { d.effects.splice(index, 1) })} className="rounded-md px-2 py-1 text-[11px] text-red-400 transition hover:bg-red-500/10 hover:text-red-200">Remove</button>
                  </div>
                  {eff.type === 'desktop-notification' && (() => {
                    const cfg = normalizeDesktopNotificationEffectConfig(eff.cfg)
                    return (
                      <div className="grid grid-cols-2 gap-2 pl-1">
                        <div className="col-span-2">
                          <div className="text-[10px] text-zinc-500 mb-1">Title</div>
                          <input type="text" value={cfg.title} onChange={(e) => updateDesktopNotificationEffect(index, (draft) => { draft.title = e.target.value })} className="w-full text-xs" />
                        </div>
                        <div className="col-span-2">
                          <div className="text-[10px] text-zinc-500 mb-1">Body</div>
                          <textarea value={cfg.body} onChange={(e) => updateDesktopNotificationEffect(index, (draft) => { draft.body = e.target.value })} className="w-full min-h-[72px] text-xs" />
                        </div>
                        <div>
                          <div className="text-[10px] text-zinc-500 mb-1">Icon</div>
                          <input type="text" value={cfg.icon ?? ''} onChange={(e) => updateDesktopNotificationEffect(index, (draft) => { draft.icon = e.target.value || undefined })} className="w-full text-xs font-mono" />
                        </div>
                        <div>
                          <div className="text-[10px] text-zinc-500 mb-1">Duration (ms)</div>
                          <input type="number" min={0} step={250} value={cfg.durationMs ?? DEFAULT_DESKTOP_NOTIFICATION_DURATION_MS}
                            onChange={(e) => updateDesktopNotificationEffect(index, (draft) => { draft.durationMs = Number(e.target.value) || 0 })}
                            className="w-full font-mono text-xs" />
                        </div>
                      </div>
                    )
                  })()}
                </div>
              ))}
              <select defaultValue="" onChange={(e) => { const type = e.target.value as EffectType; if (!type) return; e.target.value = ''; addEffect(type) }} className="w-full text-sm">
                <option value="">More effects…</option>
                {EVENT_EFFECT_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
            </div>
          </ConfigSectionPanel>
        </div>
      </div>
    </div>
  )
}
