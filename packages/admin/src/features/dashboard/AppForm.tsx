import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, forwardRef } from 'react'
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
  ConfigApplyBar,
  ConfigChoiceButton,
  IconGlyph,
  isSameDraft,
  Slider,
} from '../../shared/ui'
import { Button, Toggle } from '../../components/atoms'
import { ConfigPanel } from '../../components/organisms'
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

// ── Inline Notice component ───────────────────────────────────────────

function Notice({ tone = 'info', children, className = '' }: { tone?: 'info' | 'warning' | 'danger' | 'success'; children: React.ReactNode; className?: string }) {
  const toneStyles: Record<string, string> = {
    info: 'border-[var(--color-primary-400)]/25 bg-[var(--color-primary-500)]/10 text-[var(--color-primary-100)]',
    warning: 'border-[var(--color-accent-400)]/30 bg-[var(--color-accent-500)]/12 text-[var(--color-accent-100)]',
    danger: 'border-[var(--color-danger-400)]/30 bg-[var(--color-danger-500)]/12 text-[var(--color-danger-400)]',
    success: 'border-[var(--color-success-400)]/30 bg-[var(--color-success-500)]/12 text-[var(--color-success-400)]',
  }
  return (
    <div className={`rounded-[var(--radius-lg)] border px-3 py-2.5 text-sm shadow-[var(--shadow-sm)] backdrop-blur ${toneStyles[tone]} ${className}`}>
      {children}
    </div>
  )
}

// ── AppForm ───────────────────────────────────────────────────────────

export type AppFormHandle = { apply: () => Promise<void>; reset: () => void; dirty: boolean }

export const AppForm = forwardRef<AppFormHandle, { app: Application; onDelete: () => void; embedded?: boolean; onDirtyChange?: (dirty: boolean) => void }>(
function AppForm({ app, onDelete, embedded = false, onDirtyChange }, ref) {
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
  const [widgetSize,                setWidgetSize]                = useState(() => resolveWidgetSizeFromConfig(persistedApp))
  const [widgetPosition,            setWidgetPosition]            = useState(() => resolveWidgetPositionFromConfig(persistedApp))
  const [widgetDefaultZIndex,       setWidgetDefaultZIndex]       = useState<number>(() => resolveWidgetDefaultZIndexFromConfig(persistedApp))
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

  const sourceWidgetPosition    = resolveWidgetPositionFromConfig(persistedApp)
  const sourceWidgetSize        = resolveWidgetSizeFromConfig(persistedApp)
  const sourceWidgetDefaultZIndex = resolveWidgetDefaultZIndexFromConfig(persistedApp)
  const liveWidgetPosition      = resolveWidgetPositionFromConfig(app)
  const liveWidgetSize          = resolveWidgetSizeFromConfig(app)
  const liveWidgetRuntimeZIndex = resolveWidgetRuntimeZIndex(app)
  const runtimeWidgetOverride = runtimeConfigOverride.desktopConfig
  const hasRuntimeWidgetThemeOverride = form.appType === 'widget' && !!runtimeWidgetThemeOverride

  const runtimeOverrideEntries = form.appType === 'widget' ? [
    {
      key: 'Window Position',
      value: `${sourceWidgetPosition.x}, ${sourceWidgetPosition.y}`,
      active: false,
    },
    {
      key: 'Window Size',
      value: `${sourceWidgetSize.width}x${sourceWidgetSize.height}px`,
      active: false,
    },
    {
      key: 'Stack Order',
      value: String(sourceWidgetDefaultZIndex),
      active: false,
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
    setWidgetPosition(resolveWidgetPositionFromConfig(persistedApp))
    setWidgetSize(resolveWidgetSizeFromConfig(persistedApp))
    setWidgetDefaultZIndex(resolveWidgetDefaultZIndexFromConfig(persistedApp))
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
    const updates: Partial<typeof config> = {}

    if (draftApp.appType === 'widget') {
      const normalizedWidth  = clampWidgetDimension(widgetSize.width,  WIDGET_WIDTH_MIN,  WIDGET_WIDTH_MAX,  sourceWidgetSize.width)
      const normalizedHeight = clampWidgetDimension(widgetSize.height, WIDGET_HEIGHT_MIN, WIDGET_HEIGHT_MAX, sourceWidgetSize.height)
      const defaults = getDefaultWidgetSize(draftApp)

      draftApp.windowPosition = { x: Math.max(0, Math.round(widgetPosition.x)), y: Math.max(0, Math.round(widgetPosition.y)) }
      draftApp.windowSize = (normalizedWidth === defaults.width && normalizedHeight === defaults.height)
        ? undefined
        : { width: normalizedWidth, height: normalizedHeight }
      draftApp.zIndexDefault = Math.max(0, Math.round(widgetDefaultZIndex))
      draftApp.themeOverride = widgetThemeOverrideEnabled ? structuredClone(widgetThemeOverride) : undefined
    }

    if (isRecycleBinDecoration && recycleBinFullOnStart !== persistedDesktopConfig.recycleBin.fullOnStart) {
      updates.desktopConfig = { ...persistedDesktopConfig, recycleBin: { ...persistedDesktopConfig.recycleBin, fullOnStart: recycleBinFullOnStart } }
    }

    const apps = [...persistedConfig.applications]
    const idx = apps.findIndex((entry) => entry.id === draftApp.id)
    if (idx !== -1) apps[idx] = draftApp; else apps.push(draftApp)
    updates.applications = apps

    // Task 7: No scenes write — server syncs scene label from app label in saveApplications
    return updates
  }, [config, form, isRecycleBinDecoration, persistedConfig.applications, persistedDesktopConfig, recycleBinFullOnStart, sourceWidgetSize, widgetDefaultZIndex, widgetPosition, widgetSize, widgetThemeOverride, widgetThemeOverrideEnabled])

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
    setWidgetPosition(resolveWidgetPositionFromConfig(persistedApp))
    setWidgetSize(resolveWidgetSizeFromConfig(persistedApp))
    setWidgetDefaultZIndex(resolveWidgetDefaultZIndexFromConfig(persistedApp))
    setWidgetThemeOverrideEnabled(!!sourceWidgetThemeOverride)
    setWidgetThemeOverride(structuredClone(sourceWidgetThemeOverride ?? persistedDesktopConfig.globalThemeDefault.widgetTheme))
    setRecycleBinFullOnStart(persistedDesktopConfig.recycleBin.fullOnStart)
    setSaved(false)
  }

  useImperativeHandle(ref, () => ({ apply, reset, dirty }), [apply, dirty])

  useEffect(() => { onDirtyChange?.(dirty) }, [dirty, onDirtyChange])

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
      <div className="space-y-0 pt-3">

        {form.appType === 'widget' && (
          <ConfigPanel title="Runtime Override" className="mb-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className={hasRuntimeOverride ? 'text-[11px] font-medium text-[var(--color-danger-400)]' : 'text-[11px] font-medium text-[var(--color-text-muted)]'}>
                  {hasRuntimeOverride ? 'Runtime override active' : 'No runtime override active'}
                </div>
                <span className="flex-1" />
                <span className={['inline-block h-2.5 w-2.5 rounded-full transition-all', hasRuntimeOverride
                  ? 'bg-[var(--color-danger-400)] shadow-[0_0_10px_rgba(248,113,113,0.95),0_0_20px_rgba(239,68,68,0.55)]'
                  : 'bg-[var(--color-border-strong)] shadow-[0_0_0_rgba(0,0,0,0)]'].join(' ')} />
              </div>
              <div className="space-y-1.5 rounded border border-[var(--color-border-default)] bg-[var(--color-bg-base)]/40 px-3 py-2">
                {runtimeOverrideEntries.map((entry) => (
                  <div key={entry.key} className="flex items-start justify-between gap-3 text-[10px]">
                    <div className="uppercase tracking-[0.14em] text-[var(--color-text-muted)]">{entry.key}</div>
                    <div className={entry.active ? 'text-right font-mono text-[var(--color-text-primary)]' : 'text-right font-mono text-[var(--color-text-muted)]'}>{entry.value}</div>
                  </div>
                ))}
              </div>
              {clearOverrideError && <Notice tone="danger">{clearOverrideError}</Notice>}
              <div className="flex justify-end">
                <Button variant="secondary" size="sm" onClick={clearWidgetRuntimeOverride} disabled={!hasRuntimeOverride || clearingOverride}>
                  {clearingOverride ? 'Clearing Override...' : 'Clear Override'}
                </Button>
              </div>
            </div>
          </ConfigPanel>
        )}

        <ConfigPanel title="Identity" className="mb-4">
          <div className="space-y-3">
            <div>
              <div className="text-[10px] text-[var(--color-text-muted)] mb-1">Label</div>
              <input type="text" value={form.label} onChange={(e) => update((d) => { d.label = e.target.value })} className="w-full text-xs" />
            </div>
            <div>
              <div className="text-[10px] text-[var(--color-text-muted)] mb-1">Icon</div>
              <div className="flex gap-2 items-center">
                <div className="w-11 h-11 flex items-center justify-center bg-[var(--color-bg-elevated)] rounded border border-[var(--color-border-strong)] overflow-hidden shrink-0">
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
              <div className="text-[10px] text-[var(--color-text-muted)] mb-1">Size</div>
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
        </ConfigPanel>

        {form.appType !== 'widget' && (
          <ConfigPanel title="Position" className="mb-4">
            <div className="text-[10px] text-[var(--color-text-muted)] mb-2">1920×1080 canvas, pixels from top-left.</div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-[10px] text-[var(--color-text-muted)] mb-1">X</div>
                <input type="number" min={0} max={1850} value={form.iconPosition?.x ?? 16}
                  onChange={(e) => update((d) => { d.iconPosition = { x: Number(e.target.value), y: d.iconPosition?.y ?? 16 } })}
                  className="w-full font-mono text-xs" />
              </div>
              <div>
                <div className="text-[10px] text-[var(--color-text-muted)] mb-1">Y</div>
                <input type="number" min={0} max={990} value={form.iconPosition?.y ?? 16}
                  onChange={(e) => update((d) => { d.iconPosition = { x: d.iconPosition?.x ?? 16, y: Number(e.target.value) } })}
                  className="w-full font-mono text-xs" />
              </div>
            </div>
            <div className="text-[10px] text-[var(--color-text-muted)] mt-1.5">Tip: X=16, Y increments of 94</div>
            <div className="text-[10px] text-[var(--color-text-muted)] mt-1">Desktop icons can also be dragged live when auto-arrange is off.</div>
          </ConfigPanel>
        )}

        {form.appType === 'widget' && (
          <ConfigPanel title="Widget Window Defaults" className="mb-4">
            <div className="flex justify-end mb-3">
              <Button variant="secondary" size="sm" onClick={useCurrentWidgetValues}>Use Current</Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-[10px] text-[var(--color-text-muted)] mb-1">Width</div>
                <input type="number" min={WIDGET_WIDTH_MIN} max={WIDGET_WIDTH_MAX} value={widgetSize.width}
                  onChange={(e) => setWidgetSize((prev) => ({ ...prev, width: Number(e.target.value) }))}
                  className="w-full font-mono text-xs" />
              </div>
              <div>
                <div className="text-[10px] text-[var(--color-text-muted)] mb-1">Height</div>
                <input type="number" min={WIDGET_HEIGHT_MIN} max={WIDGET_HEIGHT_MAX} value={widgetSize.height}
                  onChange={(e) => setWidgetSize((prev) => ({ ...prev, height: Number(e.target.value) }))}
                  className="w-full font-mono text-xs" />
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-[var(--color-border-default)]">
              <div className="text-[10px] text-[var(--color-text-muted)] mb-2">Position</div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="text-[10px] text-[var(--color-text-muted)] mb-1">X</div>
                  <input type="number" min={0} max={1850} value={widgetPosition.x}
                    onChange={(e) => setWidgetPosition((prev) => ({ ...prev, x: Number(e.target.value) }))}
                    className="w-full font-mono text-xs" />
                </div>
                <div>
                  <div className="text-[10px] text-[var(--color-text-muted)] mb-1">Y</div>
                  <input type="number" min={0} max={990} value={widgetPosition.y}
                    onChange={(e) => setWidgetPosition((prev) => ({ ...prev, y: Number(e.target.value) }))}
                    className="w-full font-mono text-xs" />
                </div>
              </div>
              <div className="mt-2 text-[10px] text-[var(--color-text-muted)]">Saved desktop position for this widget window.</div>
            </div>
            <div className="mt-3 pt-3 border-t border-[var(--color-border-default)]">
              <div className="text-[10px] text-[var(--color-text-muted)] mb-1">
                Default Stack Order
                <span className="text-[var(--color-text-muted)] ml-1">(higher = nearer the front by default)</span>
              </div>
              <div className="flex gap-2 items-center">
                <input type="number" min={WIDGET_Z_INDEX_MIN} max={WIDGET_Z_INDEX_MAX} value={widgetDefaultZIndex}
                  onChange={(e) => { setWidgetDefaultZIndex(Math.max(WIDGET_Z_INDEX_MIN, Math.min(WIDGET_Z_INDEX_MAX, Math.round(Number(e.target.value) || 0)))) }}
                  className="w-24 font-mono text-xs" />
              </div>
              <div className="text-[10px] text-[var(--color-text-muted)] mt-1">
                Baseline stack order for this widget. Layout configurations can override this per-layout, and manual focus or taskbar clicks will still bring a window to the front at runtime.
              </div>
            </div>
          </ConfigPanel>
        )}

        {form.appType === 'widget' && (
          <ConfigPanel title="Widget Theme Override" className="mb-4">
            <div className="space-y-4">
              <div className="text-[10px] text-[var(--color-text-muted)] leading-relaxed">
                Keep widgets self-sufficient by giving each one its own skin, theming, motion, and atmosphere profile. Leave this off to inherit the shared desktop widget theme.
              </div>
              {hasRuntimeWidgetThemeOverride && (
                <Notice className="px-3 py-2 text-[10px]" tone="info">
                  Runtime override active. The values below reflect the live override currently applied to this widget.
                </Notice>
              )}
              <Toggle checked={widgetThemeOverrideEnabled}
                onChange={(value) => {
                  setWidgetThemeOverrideEnabled(value)
                  if (value && !sourceWidgetThemeOverride) setWidgetThemeOverride(structuredClone(desktopConfig.globalThemeDefault.widgetTheme))
                  setSaved(false)
                }}
                size="sm"
                label="Use widget-specific appearance" />
              {widgetThemeOverrideEnabled ? (
                <>
                  <div className="grid grid-cols-2 gap-1.5 border-t border-[var(--color-border-default)] pt-3">
                    {WIDGET_SKINS.map((skin) => (
                      <ConfigChoiceButton key={skin.id} type="button" selected={widgetThemeOverride.skin === skin.id}
                        onClick={() => { setWidgetThemeOverride(structuredClone(DEFAULT_WIDGET_THEME_PRESETS[skin.id])); setSaved(false) }}
                        className="min-h-0 flex-col items-start gap-1 px-3 py-2 text-left normal-case" title={skin.description}>
                        <span className="text-[11px] font-semibold leading-none">{skin.label}</span>
                        <span className="text-[10px] leading-relaxed text-[var(--color-text-muted)]">{skin.description}</span>
                      </ConfigChoiceButton>
                    ))}
                  </div>
                  <div className="border-t border-[var(--color-border-default)] pt-3">
                    <ThemeAppearanceFields appearance={widgetThemeOverride as any}
                      onChange={(updater) => { setWidgetThemeOverride((prev) => { const next = structuredClone(prev); updater(next as any); return next }); setSaved(false) }}
                      helperText="Use a different font, accent, and text color when this widget should feel like its own application instead of just another window using the global chrome." />
                  </div>
                  <div className="border-t border-[var(--color-border-default)] pt-3 space-y-3">
                    <div>
                      <div className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider mb-1.5">Motion</div>
                      <div className="grid grid-cols-2 gap-1.5">
                        {WIDGET_THEME_ANIMATIONS.map((animation) => (
                          <ConfigChoiceButton key={animation.id} type="button" selected={widgetThemeOverride.animation === animation.id}
                            onClick={() => { setWidgetThemeOverride((prev) => ({ ...prev, animation: animation.id })); setSaved(false) }}
                            className="min-h-0 flex-col items-start gap-1 px-3 py-2 text-left normal-case">
                            <span className="text-[11px] font-semibold leading-none">{animation.label}</span>
                            <span className="text-[10px] leading-relaxed text-[var(--color-text-muted)]">{animation.description}</span>
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
                      <div className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider mb-1.5">Atmosphere</div>
                      <div className="grid grid-cols-2 gap-1.5">
                        {WIDGET_THEME_ATMOSPHERES.map((atmosphere) => (
                          <ConfigChoiceButton key={atmosphere.id} type="button" selected={widgetThemeOverride.atmosphere === atmosphere.id}
                            onClick={() => { setWidgetThemeOverride((prev) => ({ ...prev, atmosphere: atmosphere.id })); setSaved(false) }}
                            className="min-h-0 flex-col items-start gap-1 px-3 py-2 text-left normal-case">
                            <span className="text-[11px] font-semibold leading-none">{atmosphere.label}</span>
                            <span className="text-[10px] leading-relaxed text-[var(--color-text-muted)]">{atmosphere.description}</span>
                          </ConfigChoiceButton>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider mb-1.5">Chrome</div>
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
                      <Button variant="secondary" size="sm" onClick={() => { setWidgetThemeOverride(structuredClone(desktopConfig.globalThemeDefault.widgetTheme)); setSaved(false) }}>
                        Copy Desktop Theme
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="rounded border border-[var(--color-border-default)] bg-[var(--color-bg-base)]/40 px-3 py-2 text-[10px] leading-relaxed text-[var(--color-text-muted)]">
                  This widget currently inherits the shared desktop widget theme from the Desktop environment editor.
                </div>
              )}
            </div>
          </ConfigPanel>
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
          <ConfigPanel title="Camera Defaults" className="mb-4">
            <div className="space-y-3">
              <div className="text-[10px] text-[var(--color-text-secondary)]">
                Configure the camera for this widget. The widget displays video only — no controls. Open OBS with <span className="font-mono text-[var(--color-text-primary)]">?obs=1</span> in the browser source URL.
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <div className="text-[10px] text-[var(--color-text-muted)]">Camera device</div>
                  {!cameraLabelsGranted && (
                    <Button variant="secondary" size="sm" disabled={detectingCameras} onClick={() => void enumerateCameras(true)}>
                      {detectingCameras ? 'Detecting...' : '🔓 Get real names'}
                    </Button>
                  )}
                </div>
                {detectingCameras && detectedCameras.length === 0 ? (
                  <div className="text-[10px] text-[var(--color-text-muted)] italic">Detecting devices...</div>
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
                <div className="text-[10px] text-[var(--color-text-muted)] mt-1">
                  {!cameraLabelsGranted && detectedCameras.length > 0
                    ? 'Generic names — click "Get real names" to see actual system labels.'
                    : 'The label is saved on the server. OBS uses it to find the same camera automatically.'}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input id={`cam-mirror-${form.id}`} type="checkbox" checked={form.cameraSettings?.mirror ?? false}
                  onChange={(e) => update((d) => { d.cameraSettings = { ...(d.cameraSettings ?? {}), mirror: e.target.checked } })} />
                <label htmlFor={`cam-mirror-${form.id}`} className="text-[11px] text-[var(--color-text-primary)] cursor-pointer">Mirror (flip horizontally)</label>
              </div>
            </div>
          </ConfigPanel>
        )}

        {form.appType === 'widget' && widgetComponent === 'source' && (
          <ConfigPanel title="Source Binding" className="mb-4">
            <div className="space-y-3">
              <div className="text-[10px] text-[var(--color-text-secondary)]">
                Source widgets render one scene source inside a desktop window. Bind this widget to any configured source and change it later without recreating the widget.
              </div>
              <div>
                <div className="text-[10px] text-[var(--color-text-muted)] mb-1">Scene</div>
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
                <div className="text-[10px] text-[var(--color-text-muted)] mb-1">Source</div>
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
                <div className="text-[10px] text-[var(--color-accent-300)] leading-relaxed">No scene sources are configured yet. Add a source to any scene, then bind this widget to it.</div>
              )}
              {selectedSourceSceneId && availableSources.length === 0 && (
                <div className="text-[10px] text-[var(--color-text-muted)]">This scene currently has no sources to bind.</div>
              )}
              {selectedSource && selectedSourceScene && (
                <div className="rounded border border-[var(--color-border-default)] bg-[var(--color-bg-base)]/40 px-3 py-2 space-y-1">
                  <div className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider">Current Binding</div>
                  <div className="text-[11px] text-[var(--color-text-primary)]">{selectedSourceScene.label}</div>
                  <div className="text-[10px] text-[var(--color-text-secondary)] font-mono">{selectedSource.id} · {selectedSourceResolved?.pluginType ?? 'unbound'}</div>
                </div>
              )}
            </div>
          </ConfigPanel>
        )}

        {supportsSceneTransitions && (
          <ConfigPanel title="Launch Pipeline" className="mb-4">
            <div className="text-[10px] text-[var(--color-text-muted)] mb-2">Effects fired before the scene change. Fires in order, each with its own delay.</div>
            <Toggle checked={!!form.launchPipeline} label="Enable" size="sm"
              onChange={(v) => update((d) => { d.launchPipeline = v ? { effects: [], delayMs: 0 } : undefined })} />
            {form.launchPipeline && (
              <div className="mt-3 space-y-3">
                <Slider label="Scene change delay (ms)" value={form.launchPipeline.delayMs} min={0} max={5000} step={100}
                  onChange={(v) => update((d) => { if (d.launchPipeline) d.launchPipeline.delayMs = v })} />
                <div>
                  <div className="text-[10px] text-[var(--color-text-muted)] mb-1">Effects</div>
                  {form.launchPipeline.effects.length === 0 && <div className="text-[10px] text-[var(--color-text-muted)] italic">No effects added.</div>}
                  {form.launchPipeline.effects.map((eff, i) => (
                    <div key={i} className="flex items-center gap-2 py-1 border-b border-[var(--color-border-default)]">
                      <span className="flex-1 text-[11px] font-mono text-[var(--color-text-primary)]">{eff.type}</span>
                      <input type="number" min={0} max={10} step={0.1} value={eff.delay ?? 0}
                        onChange={(e) => update((d) => { if (!d.launchPipeline) return; d.launchPipeline.effects[i] = { ...d.launchPipeline.effects[i], delay: Number(e.target.value) } })}
                        className="w-16 font-mono text-xs" title="Delay (s)" />
                      <span className="text-[9px] text-[var(--color-text-muted)]">s</span>
                      <button onClick={() => update((d) => { if (!d.launchPipeline) return; d.launchPipeline.effects.splice(i, 1) })}
                        className="text-[10px] text-[var(--color-danger-500)] hover:text-[var(--color-danger-400)] px-1">✕</button>
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
          </ConfigPanel>
        )}

        {form.appType === 'widget' && form.id === 'gallery' && (
          <ConfigPanel title="Gallery Settings" className="mb-4">
            <div className="space-y-3">
              <Toggle checked={form.gallerySettings?.randomOrder ?? true} label="Random order" size="sm"
                onChange={(v) => update((d) => { d.gallerySettings = { randomOrder: v, autoPlay: d.gallerySettings?.autoPlay ?? false, intervalSec: d.gallerySettings?.intervalSec ?? 8 } })} />
              <Toggle checked={form.gallerySettings?.autoPlay ?? false} label="Auto play" size="sm"
                onChange={(v) => update((d) => { d.gallerySettings = { randomOrder: d.gallerySettings?.randomOrder ?? true, autoPlay: v, intervalSec: d.gallerySettings?.intervalSec ?? 8 } })} />
              <div>
                <div className="text-[10px] text-[var(--color-text-muted)] mb-1">Auto interval (seconds)</div>
                <input type="number" min={2} max={120} value={form.gallerySettings?.intervalSec ?? 8}
                  onChange={(e) => update((d) => { d.gallerySettings = { randomOrder: d.gallerySettings?.randomOrder ?? true, autoPlay: d.gallerySettings?.autoPlay ?? false, intervalSec: Math.max(2, Math.min(120, Number(e.target.value) || 8)) } })}
                  className="w-24 font-mono text-xs" />
                <div className="text-[10px] text-[var(--color-text-muted)] mt-1">Playback controls in overlay use Previous / Play / Next.</div>
              </div>
            </div>
          </ConfigPanel>
        )}
      </div>

      <button onClick={onDelete} disabled={isProtectedSystemWidget}
        className={'text-xs px-2 py-1 rounded border transition-colors ' + (
          isProtectedSystemWidget
            ? 'border-[var(--color-border-default)] text-[var(--color-text-muted)] cursor-not-allowed'
            : 'text-[var(--color-danger-400)] hover:text-[var(--color-danger-400)] border-[var(--color-danger-500)]/50 hover:border-[var(--color-danger-400)]'
        )}>
        {isProtectedSystemWidget ? 'Protected' : 'Remove'}
      </button>
      {!embedded && <ConfigApplyBar label="Application Configuration" dirty={dirty} saving={saving} saved={saved} onApply={apply} onReset={reset} alwaysShow />}
    </div>
  )
})

// ── Extracted components ──────────────────────────────────────────────
// NewWidgetForm   → ./NewWidgetForm.tsx
// WidgetLayoutPanel → ./WidgetLayoutPanel.tsx
// EventForm       → ./EventForm.tsx

