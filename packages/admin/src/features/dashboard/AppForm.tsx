import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  DEFAULT_RECYCLE_BIN_SETTINGS,
  DEFAULT_STICKY_NOTES_SETTINGS,
  DEFAULT_WIDGET_THEME_PRESETS,
  getWidgetSource,
  isSystemWidget,
  resolveSourceInstance,
  withDesktopConfigDefaults,
} from '@ieom/shared'
import type {
  Application,
  AppConfig,
  DesktopConfig,
  EffectType,
  WidgetThemeConfig,
} from '@ieom/shared'
import { socket } from '../../socket/client'
import { useAdminStore } from '../../store/useAdminStore'
import { AssetSelectionInput } from '../asset-library/AssetLibrary'
import {
  WIDGET_SKINS,
  WIDGET_THEME_ANIMATIONS,
  WIDGET_THEME_ATMOSPHERES,
} from '../../shared/adminDesktopOptions'
import {
  LAUNCH_PIPELINE_EFFECT_TYPES,
  createEffectDraft,
} from '../asset-library/eventPresets'
import { getSafeSceneSources } from '../../shared/sourceCatalog'
import {
  Btn,
  ConfigApplyBar,
  ConfigChoiceButton,
  ConfigNotice,
  ConfigSectionPanel,
  IconGlyph,
  isSameDraft,
  Slider,
  Toggle,
} from '../../shared/ui'
import { WIDGET_HEIGHT_MAX, WIDGET_HEIGHT_MIN, WIDGET_WIDTH_MAX, WIDGET_WIDTH_MIN, WIDGET_Z_INDEX_MAX, WIDGET_Z_INDEX_MIN } from './constants'
import { ThemeAppearanceFields } from './formAtoms'
const postPreviewConfigPatch = (_patch: unknown) => {} // no-op: embedded preview removed
import { RecycleBinConfigSection, StickyNotesConfigSection } from './DefaultStylingEditor'
import {
  clampWidgetDimension,
  getDefaultWidgetSize,
  resolveAppWidgetComponent,
  resolveWidgetDefaultZIndexFromConfig,
  resolveWidgetPositionFromConfig,
  resolveWidgetRuntimeZIndex,
  resolveWidgetSizeFromConfig,
  resolveWidgetThemeOverrideFromConfig,
} from './widgetHelpers'

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
  const sourceWidgetThemeOverride   = resolveWidgetThemeOverrideFromConfig(persistedApp)
  const effectiveWidgetThemeOverride = runtimeWidgetThemeOverride ?? sourceWidgetThemeOverride

  const [form,                      setForm]                      = useState<Application>(app)
  const [widgetSize,                setWidgetSize]                = useState(() => resolveWidgetSizeFromConfig(persistedApp, persistedDesktopConfig))
  const [widgetPosition,            setWidgetPosition]            = useState(() => resolveWidgetPositionFromConfig(persistedApp, persistedDesktopConfig))
  const [widgetDefaultZIndex,       setWidgetDefaultZIndex]       = useState<number>(() => resolveWidgetDefaultZIndexFromConfig(persistedApp, persistedDesktopConfig))
  const [widgetThemeOverrideEnabled, setWidgetThemeOverrideEnabled] = useState(() => !!effectiveWidgetThemeOverride)
  const [widgetThemeOverride,       setWidgetThemeOverride]       = useState<WidgetThemeConfig>(() => structuredClone(effectiveWidgetThemeOverride ?? persistedDesktopConfig.globalThemeDefault.widgetTheme))
  const [recycleBinFullOnStart,     setRecycleBinFullOnStart]     = useState(() => persistedDesktopConfig.recycleBin.fullOnStart)
  const [saving,          setSaving]          = useState(false)
  const [saved,           setSaved]           = useState(false)
  const [clearingOverride, setClearingOverride] = useState(false)
  const [clearOverrideError, setClearOverrideError] = useState<string | null>(null)
  const [detectedCameras, setDetectedCameras] = useState<{ deviceId: string; label: string }[]>([])
  const [detectingCameras, setDetectingCameras] = useState(false)
  const [cameraLabelsGranted, setCameraLabelsGranted] = useState(false)
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

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
    widgetThemeOverrideEnabled !== !!sourceWidgetThemeOverride
    || (widgetThemeOverrideEnabled && !isSameDraft(widgetThemeOverride, sourceWidgetThemeOverride ?? persistedDesktopConfig.globalThemeDefault.widgetTheme))
  )
  const recycleBinFullOnStartDirty = isRecycleBinDecoration && recycleBinFullOnStart !== persistedDesktopConfig.recycleBin.fullOnStart
  const dirty = appDirty || widgetPositionDirty || widgetSizeDirty || widgetDefaultZIndexDirty || widgetThemeOverrideDirty || recycleBinFullOnStartDirty

  const widgetThemePreviewPatch = useMemo(() => {
    if (form.appType !== 'widget') return null
    const nextApp = { ...persistedApp, themeOverride: widgetThemeOverrideEnabled ? structuredClone(widgetThemeOverride) : undefined }
    return {
      applications: persistedConfig.applications.map((a) => a.id === form.id ? nextApp : a),
    } as Partial<AppConfig>
  }, [form.appType, form.id, persistedApp, persistedConfig.applications, widgetThemeOverride, widgetThemeOverrideEnabled])

  useEffect(() => {
    setForm(persistedApp)
    setWidgetPosition(resolveWidgetPositionFromConfig(persistedApp, persistedDesktopConfig))
    setWidgetSize(resolveWidgetSizeFromConfig(persistedApp, persistedDesktopConfig))
    setWidgetDefaultZIndex(resolveWidgetDefaultZIndexFromConfig(persistedApp, persistedDesktopConfig))
    setRecycleBinFullOnStart(persistedDesktopConfig.recycleBin.fullOnStart)
    setSaved(false)
  }, [persistedApp, persistedDesktopConfig])

  useEffect(() => {
    if (persistedApp.appType !== 'widget') return
    setWidgetThemeOverrideEnabled(!!sourceWidgetThemeOverride)
    setWidgetThemeOverride(structuredClone(sourceWidgetThemeOverride ?? persistedDesktopConfig.globalThemeDefault.widgetTheme))
  }, [sourceWidgetThemeOverride, persistedApp.appType, persistedDesktopConfig.globalThemeDefault.widgetTheme])

  useEffect(() => () => {
    if (savedTimer.current) clearTimeout(savedTimer.current)
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

  const buildDraftPersistence = useCallback(() => {
    const draftApp: Application = structuredClone(form)
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

      nextWidgetPositions[draftApp.id] = { x: Math.max(0, Math.round(widgetPosition.x)), y: Math.max(0, Math.round(widgetPosition.y)) }

      if (normalizedWidth === defaults.width && normalizedHeight === defaults.height) {
        delete nextWidgetSizes[draftApp.id]
      } else {
        nextWidgetSizes[draftApp.id] = { width: normalizedWidth, height: normalizedHeight }
      }

      nextWidgetDefaultZIndices[draftApp.id] = Math.max(0, Math.round(widgetDefaultZIndex))

      draftApp.themeOverride = widgetThemeOverrideEnabled ? structuredClone(widgetThemeOverride) : undefined

      nextDesktop.widgetPositions       = Object.keys(nextWidgetPositions).length       ? nextWidgetPositions       : undefined
      nextDesktop.widgetSizes           = Object.keys(nextWidgetSizes).length           ? nextWidgetSizes           : undefined
      nextDesktop.widgetDefaultZIndices = Object.keys(nextWidgetDefaultZIndices).length ? nextWidgetDefaultZIndices : undefined
    }

    if (isRecycleBinDecoration && recycleBinFullOnStart !== persistedDesktopConfig.recycleBin.fullOnStart) {
      const nextDesktop = ensureNextDesktopConfig()
      nextDesktop.recycleBin = { ...nextDesktop.recycleBin, fullOnStart: recycleBinFullOnStart }
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
    const updates = buildDraftPersistence()
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
    setWidgetThemeOverrideEnabled(!!sourceWidgetThemeOverride)
    setWidgetThemeOverride(structuredClone(sourceWidgetThemeOverride ?? persistedDesktopConfig.globalThemeDefault.widgetTheme))
    setRecycleBinFullOnStart(persistedDesktopConfig.recycleBin.fullOnStart)
    setSaved(false)
  }

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
    <div className="space-y-4">
      <ConfigApplyBar label="Application Configuration" dirty={dirty} saving={saving} saved={saved} onApply={apply} onReset={reset} alwaysShow />
      <div style={{display:'flex',flexDirection:'column',gap:'1.25rem',paddingTop:'1rem'}}>

        {form.appType === 'widget' && (
          <ConfigSectionPanel label="Runtime Override" first>
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className={hasRuntimeOverride ? 'text-[11px] font-medium text-red-100' : 'text-[11px] font-medium text-zinc-400'}>
                  {hasRuntimeOverride ? 'Runtime override active' : 'No runtime override active'}
                </div>
                <span className="flex-1" />
                <span className={['inline-block h-2.5 w-2.5 rounded-full transition-all', hasRuntimeOverride
                  ? 'bg-red-400 shadow-[0_0_10px_rgba(248,113,113,0.95),0_0_20px_rgba(239,68,68,0.55)]'
                  : 'bg-zinc-700 shadow-[0_0_0_rgba(0,0,0,0)]'].join(' ')} />
              </div>
              <div className="space-y-1.5 rounded border border-zinc-800/80 bg-zinc-950/40 px-5 py-4">
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
          <div className="space-y-4">
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
                Default Stack Order
                <span className="text-zinc-600 ml-1">(higher = nearer the front by default)</span>
              </div>
              <div className="flex gap-2 items-center">
                <input type="number" min={WIDGET_Z_INDEX_MIN} max={WIDGET_Z_INDEX_MAX} value={widgetDefaultZIndex}
                  onChange={(e) => { setWidgetDefaultZIndex(Math.max(WIDGET_Z_INDEX_MIN, Math.min(WIDGET_Z_INDEX_MAX, Math.round(Number(e.target.value) || 0)))) }}
                  className="w-24 font-mono text-xs" />
              </div>
              <div className="text-[10px] text-zinc-600 mt-1">
                Baseline stack order for this widget. Layout configurations can override this per-layout, and manual focus or taskbar clicks will still bring a window to the front at runtime.
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
                  if (value && !sourceWidgetThemeOverride) setWidgetThemeOverride(structuredClone(desktopConfig.globalThemeDefault.widgetTheme))
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
                      <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5">Motion</div>
                      <div className="grid grid-cols-2 gap-1.5">
                        {WIDGET_THEME_ANIMATIONS.map((animation) => (
                          <ConfigChoiceButton key={animation.id} type="button" selected={widgetThemeOverride.animation === animation.id}
                            onClick={() => { setWidgetThemeOverride((prev) => ({ ...prev, animation: animation.id })); setSaved(false) }}
                            className="min-h-0 flex-col items-start gap-1 px-3 py-2 text-left normal-case">
                            <span className="text-[11px] font-semibold leading-none">{animation.label}</span>
                            <span className="text-[10px] leading-relaxed text-zinc-500">{animation.description}</span>
                          </ConfigChoiceButton>
                        ))}
                      </div>
                      <div className="mt-2 space-y-1.5">
                        <Slider label="Intensity" value={Math.round(widgetThemeOverride.motionIntensity * 100)} min={0} max={300} step={5} unit="%"
                          onChange={(value) => { setWidgetThemeOverride((prev) => ({ ...prev, motionIntensity: value / 100 })); setSaved(false) }} />
                        <Slider label="Glow" value={Math.round(widgetThemeOverride.glowIntensity * 100)} min={0} max={300} step={5} unit="%"
                          onChange={(value) => { setWidgetThemeOverride((prev) => ({ ...prev, glowIntensity: value / 100 })); setSaved(false) }} />
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5">Atmosphere</div>
                      <div className="grid grid-cols-2 gap-1.5">
                        {WIDGET_THEME_ATMOSPHERES.map((atmosphere) => (
                          <ConfigChoiceButton key={atmosphere.id} type="button" selected={widgetThemeOverride.atmosphere === atmosphere.id}
                            onClick={() => { setWidgetThemeOverride((prev) => ({ ...prev, atmosphere: atmosphere.id })); setSaved(false) }}
                            className="min-h-0 flex-col items-start gap-1 px-3 py-2 text-left normal-case">
                            <span className="text-[11px] font-semibold leading-none">{atmosphere.label}</span>
                            <span className="text-[10px] leading-relaxed text-zinc-500">{atmosphere.description}</span>
                          </ConfigChoiceButton>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5">Chrome</div>
                      <div className="space-y-1.5">
                        <Slider label="Opacity" value={Math.round(widgetThemeOverride.shellOpacity * 100)} min={10} max={100} step={5} unit="%"
                          onChange={(value) => { setWidgetThemeOverride((prev) => ({ ...prev, shellOpacity: value / 100 })); setSaved(false) }} />
                        <Slider label="Shadow" value={Math.round(widgetThemeOverride.shadowIntensity * 100)} min={0} max={300} step={5} unit="%"
                          onChange={(value) => { setWidgetThemeOverride((prev) => ({ ...prev, shadowIntensity: value / 100 })); setSaved(false) }} />
                        <Slider label="Radius" value={widgetThemeOverride.borderRadius} min={0} max={32} step={1} unit="px"
                          onChange={(value) => { setWidgetThemeOverride((prev) => ({ ...prev, borderRadius: value })); setSaved(false) }} />
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <Btn type="button" onClick={() => { setWidgetThemeOverride(structuredClone(desktopConfig.globalThemeDefault.widgetTheme)); setSaved(false) }} className="px-2 py-1 text-[10px]">
                        Copy Desktop Theme
                      </Btn>
                    </div>
                  </div>
                </>
              ) : (
                <div className="rounded border border-zinc-800 bg-zinc-900/40 px-5 py-4 text-[10px] leading-relaxed text-zinc-500">
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
            <div className="space-y-4">
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
            <div className="space-y-4">
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
                <div className="rounded border border-zinc-800 bg-zinc-900/40 px-5 py-4 space-y-1">
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
            <div className="space-y-4">
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

// ── Extracted components ──────────────────────────────────────────────
// NewWidgetForm   → ./NewWidgetForm.tsx
// WidgetLayoutPanel → ./WidgetLayoutPanel.tsx
// EventForm       → ./EventForm.tsx

