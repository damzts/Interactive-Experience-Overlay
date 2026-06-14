import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, forwardRef } from 'react'
import {
  DEFAULT_STICKY_NOTES_SETTINGS,
  DEFAULT_WIDGET_THEME_PRESETS,
  getWidgetSource,
  isSystemWidget,
  resolveWindowInstance,
  withDesktopConfigDefaults,
} from '@ieomlabs/shared'
import type {
  Application,
  AppConfig,
  DesktopConfig,
  WidgetThemeConfig,
} from '@ieomlabs/shared'
import { socket } from '../../socket/client'
import { useAdminStore } from '../../store/useAdminStore'
import { AssetSelectionInput } from '../asset-library/AssetLibrary'
import { WIDGET_SKINS } from '../../shared/adminDesktopOptions'
import {
  LAUNCH_PIPELINE_EFFECT_TYPES,
  createEffectDraft,
} from '../asset-library/eventPresets'
import { getSafeSceneWindows } from '../../shared/windowCatalog'
import {
  ConfigApplyBar,
  ConfigChoiceButton,
  IconGlyph,
  isSameDraft,
  OverlayCanvas,
} from '../../shared/ui'
import { Button, Toggle } from '../../components/atoms'
import { ConfigPanel } from '../../components/organisms'
import { WIDGET_HEIGHT_MAX, WIDGET_HEIGHT_MIN, WIDGET_WIDTH_MAX, WIDGET_WIDTH_MIN, WIDGET_Z_INDEX_MAX, WIDGET_Z_INDEX_MIN } from './constants'
const postPreviewConfigPatch = (_patch: unknown) => {} // no-op: embedded preview removed
import { StickyNotesConfigSection } from './DefaultStylingEditor'
import {
  clampWidgetDimension,
  getDefaultWidgetSize,
  resolveAppWidgetComponent,
  resolveWidgetDefaultZIndexFromConfig,
  resolveWidgetPositionFromConfig,
  resolveWidgetRuntimeZIndex,
  resolveWidgetSizeFromConfig,
  resolveWidgetThemeFromConfig,
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
  const runtimeConfig = useAdminStore((s) => s.runtimeConfig)
  const saveConfig           = useAdminStore((s) => s.saveConfig)
  const desktopConfig        = useMemo(() => withDesktopConfigDefaults(config.desktopConfig), [config.desktopConfig])
  const persistedDesktopConfig = useMemo(() => withDesktopConfigDefaults(persistedConfig.desktopConfig), [persistedConfig.desktopConfig])
  const persistedApp = useMemo(
    () => persistedConfig.applications.find((entry) => entry.id === app.id) ?? app,
    [app, persistedConfig.applications],
  )
  const runtimeWidgetTheme  = runtimeConfig.desktopConfig?.widgetThemes?.[app.id]
  const sourceWidgetTheme   = resolveWidgetThemeFromConfig(persistedApp)

  const [form,                      setForm]                      = useState<Application>(app)
  const [widgetSize,                setWidgetSize]                = useState(() => resolveWidgetSizeFromConfig(persistedApp))
  const [widgetPosition,            setWidgetPosition]            = useState(() => resolveWidgetPositionFromConfig(persistedApp))
  const [widgetDefaultZIndex,       setWidgetDefaultZIndex]       = useState<number>(() => resolveWidgetDefaultZIndexFromConfig(persistedApp))
  const [widgetTheme, setWidgetTheme] = useState<WidgetThemeConfig>(() => structuredClone(sourceWidgetTheme ?? DEFAULT_WIDGET_THEME_PRESETS[WIDGET_SKINS[0].id]))
  const [saving,          setSaving]          = useState(false)
  const [saved,           setSaved]           = useState(false)
  const [clearingRuntime, setClearingRuntime] = useState(false)
  const [clearRuntimeError, setClearRuntimeError] = useState<string | null>(null)
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

  const widgetComponent = resolveAppWidgetComponent(form)
  const widgetSource    = getWidgetSource(form)
  const isProtectedSystemWidget = isSystemWidget(form)
  const isStickyNotesWidget    = form.id === 'sticky-notes'
  const stickyNotesConfig = form.stickyNotesSettings ?? DEFAULT_STICKY_NOTES_SETTINGS
  const windowPresets     = config.windowPresets ?? []
  const selectedSourceSceneId = form.windowWidgetSettings?.sceneId ?? ''
  const selectedSourceScene   = selectedSourceSceneId ? config.scenes[selectedSourceSceneId] : undefined
  const selectedSourceSceneWindows = getSafeSceneWindows(selectedSourceScene)
  const availableSourceScenes = useMemo(
    () => Object.values(config.scenes).filter((scene) => {
      const windows = getSafeSceneWindows(scene)
      return windows.length > 0 || scene.id === selectedSourceSceneId
    }),
    [config.scenes, selectedSourceSceneId],
  )
  const availableWindows = selectedSourceSceneWindows
  const selectedWindow   = availableWindows.find((w) => w.id === form.windowWidgetSettings?.windowId)
  const selectedWindowResolved = selectedWindow ? resolveWindowInstance(selectedWindow, windowPresets) : null

  useEffect(() => {
    if (widgetComponent !== 'camera') return
    void enumerateCameras(false)
  }, [widgetComponent, enumerateCameras])

  const sourceWidgetPosition      = resolveWidgetPositionFromConfig(persistedApp)
  const sourceWidgetSize          = resolveWidgetSizeFromConfig(persistedApp)
  const sourceWidgetDefaultZIndex = resolveWidgetDefaultZIndexFromConfig(persistedApp)
  const liveWidgetPosition        = resolveWidgetPositionFromConfig(app)
  const liveWidgetSize            = resolveWidgetSizeFromConfig(app)
  const liveWidgetRuntimeZIndex   = resolveWidgetRuntimeZIndex(app)
  const hasRuntimeWidgetTheme = !!runtimeWidgetTheme

  // True RAM deltas — only set when the runtime is actively overriding the persisted value
  const runtimePos    = runtimeConfig.widgetPositions?.[app.id]
  const runtimeSize   = runtimeConfig.widgetSizes?.[app.id]
  const runtimeZIndex = runtimeConfig.widgetZIndices?.[app.id]
  const hasRuntimeLayout = !!(runtimePos || runtimeSize || runtimeZIndex !== undefined)
  const hasRuntimeOverride       = hasRuntimeLayout || hasRuntimeWidgetTheme
  const appDirty = !isSameDraft(form, persistedApp)
  const widgetPositionDirty      = widgetPosition.x !== sourceWidgetPosition.x || widgetPosition.y !== sourceWidgetPosition.y
  const widgetSizeDirty          = widgetSize.width !== sourceWidgetSize.width || widgetSize.height !== sourceWidgetSize.height
  const widgetDefaultZIndexDirty = widgetDefaultZIndex !== sourceWidgetDefaultZIndex
  const widgetThemeDirty = !isSameDraft(widgetTheme, sourceWidgetTheme ?? DEFAULT_WIDGET_THEME_PRESETS[WIDGET_SKINS[0].id])
  const dirty = appDirty || widgetPositionDirty || widgetSizeDirty || widgetDefaultZIndexDirty || widgetThemeDirty

  const widgetThemePreviewPatch = useMemo(() => {
    const nextApp = { ...persistedApp, theme: structuredClone(widgetTheme) }
    return {
      applications: persistedConfig.applications.map((a) => a.id === form.id ? nextApp : a),
    } as Partial<AppConfig>
  }, [form.id, persistedApp, persistedConfig.applications, widgetTheme])

  useEffect(() => {
    setForm(persistedApp)
    setWidgetPosition(resolveWidgetPositionFromConfig(persistedApp))
    setWidgetSize(resolveWidgetSizeFromConfig(persistedApp))
    setWidgetDefaultZIndex(resolveWidgetDefaultZIndexFromConfig(persistedApp))
    setSaved(false)
  }, [persistedApp, persistedDesktopConfig])

  useEffect(() => {
    setWidgetTheme(structuredClone(sourceWidgetTheme ?? DEFAULT_WIDGET_THEME_PRESETS[WIDGET_SKINS[0].id]))
  }, [sourceWidgetTheme])

  useEffect(() => () => {
    if (savedTimer.current) clearTimeout(savedTimer.current)
    postPreviewConfigPatch(null)
  }, [])

  useEffect(() => {
    postPreviewConfigPatch(widgetThemeDirty ? widgetThemePreviewPatch : null)
  }, [widgetThemeDirty, widgetThemePreviewPatch])

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

  const buildDraftPersistence = useCallback(() => {
    const draftApp: Application = structuredClone(form)
    const updates: Partial<typeof config> = {}

    const normalizedWidth  = clampWidgetDimension(widgetSize.width,  WIDGET_WIDTH_MIN,  WIDGET_WIDTH_MAX,  sourceWidgetSize.width)
    const normalizedHeight = clampWidgetDimension(widgetSize.height, WIDGET_HEIGHT_MIN, WIDGET_HEIGHT_MAX, sourceWidgetSize.height)
    const defaults = getDefaultWidgetSize(draftApp)

    draftApp.windowPosition = { x: Math.max(0, Math.round(widgetPosition.x)), y: Math.max(0, Math.round(widgetPosition.y)) }
    draftApp.windowSize = (normalizedWidth === defaults.width && normalizedHeight === defaults.height)
      ? undefined
      : { width: normalizedWidth, height: normalizedHeight }
    draftApp.zIndexDefault = Math.max(0, Math.round(widgetDefaultZIndex))
    draftApp.theme = structuredClone(widgetTheme)

    const apps = [...persistedConfig.applications]
    const idx = apps.findIndex((entry) => entry.id === draftApp.id)
    if (idx !== -1) apps[idx] = draftApp; else apps.push(draftApp)
    updates.applications = apps

    return updates
  }, [config, form, persistedConfig.applications, persistedDesktopConfig, sourceWidgetSize, widgetDefaultZIndex, widgetPosition, widgetSize, widgetTheme])

  const apply = async () => {
    setSaving(true)
    try {
      const updates = buildDraftPersistence()
      await saveConfig(updates)
      if (savedTimer.current) clearTimeout(savedTimer.current)
      setSaved(true)
      savedTimer.current = setTimeout(() => setSaved(false), 1500)
    } finally {
      setSaving(false)
    }
  }

  const reset = () => {
    setForm(persistedApp)
    setWidgetPosition(resolveWidgetPositionFromConfig(persistedApp))
    setWidgetSize(resolveWidgetSizeFromConfig(persistedApp))
    setWidgetDefaultZIndex(resolveWidgetDefaultZIndexFromConfig(persistedApp))
    setWidgetTheme(structuredClone(sourceWidgetTheme ?? DEFAULT_WIDGET_THEME_PRESETS[WIDGET_SKINS[0].id]))
    setSaved(false)
  }

  useImperativeHandle(ref, () => ({ apply, reset, dirty }), [apply, dirty])

  useEffect(() => { onDirtyChange?.(dirty) }, [dirty, onDirtyChange])

  const resetWidgetRuntimeLayout = () => {
    if (!hasRuntimeLayout || clearingRuntime) return
    setClearingRuntime(true)
    setClearRuntimeError(null)
    socket.emit('runtime:config:widget:reset', form.id, (err: string | null) => {
      setClearingRuntime(false)
      if (err) { setClearRuntimeError(err); return }
      setClearRuntimeError(null)
    })
  }

  return (
    <div className="space-y-3">
      <div className="space-y-0 pt-3">

        <ConfigPanel title="Runtime State" className="mb-4">
            <div className="space-y-3">

              {/* Live indicator */}
              <div className="flex items-center gap-2">
                <span className={[
                  'inline-block h-2 w-2 rounded-full transition-all',
                  hasRuntimeOverride
                    ? 'bg-[var(--color-accent-400)] shadow-[0_0_8px_rgba(251,191,36,0.8)]'
                    : 'bg-[var(--color-border-strong)]',
                ].join(' ')} />
                <span className="text-[10px] text-[var(--color-text-muted)]">
                  {hasRuntimeOverride ? 'Runtime config active' : 'Live matches persisted'}
                </span>
              </div>

              {/* State rows */}
              <div className="rounded border border-[var(--color-border-default)] bg-[var(--color-bg-base)]/40 divide-y divide-[var(--color-border-default)]">

                {/* Position */}
                <div className="px-3 py-2 space-y-1">
                  <div className="text-[9px] uppercase tracking-[0.14em] text-[var(--color-text-muted)]">Position</div>
                  <div className="flex justify-between text-[10px]">
                    <span className="text-[var(--color-text-muted)]">Persisted</span>
                    <span className="font-mono text-[var(--color-text-secondary)]">
                      {sourceWidgetPosition.x}, {sourceWidgetPosition.y}
                    </span>
                  </div>
                  {runtimePos && (
                    <div className="flex justify-between text-[10px]">
                      <span className="text-[var(--color-accent-400)]">Live</span>
                      <span className="font-mono text-[var(--color-accent-300)]">
                        {liveWidgetPosition.x}, {liveWidgetPosition.y}
                      </span>
                    </div>
                  )}
                </div>

                {/* Size */}
                <div className="px-3 py-2 space-y-1">
                  <div className="text-[9px] uppercase tracking-[0.14em] text-[var(--color-text-muted)]">Size</div>
                  <div className="flex justify-between text-[10px]">
                    <span className="text-[var(--color-text-muted)]">Persisted</span>
                    <span className="font-mono text-[var(--color-text-secondary)]">
                      {sourceWidgetSize.width} × {sourceWidgetSize.height}
                    </span>
                  </div>
                  {runtimeSize && (
                    <div className="flex justify-between text-[10px]">
                      <span className="text-[var(--color-accent-400)]">Live</span>
                      <span className="font-mono text-[var(--color-accent-300)]">
                        {liveWidgetSize.width} × {liveWidgetSize.height}
                      </span>
                    </div>
                  )}
                </div>

                {/* Z-index */}
                <div className="px-3 py-2 space-y-1">
                  <div className="text-[9px] uppercase tracking-[0.14em] text-[var(--color-text-muted)]">Stack order</div>
                  <div className="flex justify-between text-[10px]">
                    <span className="text-[var(--color-text-muted)]">Default</span>
                    <span className="font-mono text-[var(--color-text-secondary)]">{sourceWidgetDefaultZIndex}</span>
                  </div>
                  {runtimeZIndex !== undefined && (
                    <div className="flex justify-between text-[10px]">
                      <span className="text-[var(--color-accent-400)]">Live</span>
                      <span className="font-mono text-[var(--color-accent-300)]">{liveWidgetRuntimeZIndex}</span>
                    </div>
                  )}
                </div>

                {/* Theme */}
                <div className="px-3 py-2 space-y-1">
                  <div className="text-[9px] uppercase tracking-[0.14em] text-[var(--color-text-muted)]">Theme</div>
                  <div className="flex justify-between text-[10px]">
                    <span className="text-[var(--color-text-muted)]">Persisted</span>
                    <span className="font-mono text-[var(--color-text-secondary)]">
                      {sourceWidgetTheme
                        ? [sourceWidgetTheme.skin, sourceWidgetTheme.animation, sourceWidgetTheme.atmosphere].filter(Boolean).join(' / ')
                        : 'inherited'}
                    </span>
                  </div>
                  {hasRuntimeWidgetTheme && runtimeWidgetTheme && (
                    <div className="flex justify-between text-[10px]">
                      <span className="text-[var(--color-accent-400)]">Live</span>
                      <span className="font-mono text-[var(--color-accent-300)]">
                        {[runtimeWidgetTheme.skin, runtimeWidgetTheme.animation, runtimeWidgetTheme.atmosphere].filter(Boolean).join(' / ')}
                      </span>
                    </div>
                  )}
                </div>

              </div>

              {clearRuntimeError && <Notice tone="danger">{clearRuntimeError}</Notice>}

              {hasRuntimeLayout && (
                <div className="flex justify-end">
                  <Button variant="secondary" size="sm" onClick={resetWidgetRuntimeLayout} disabled={clearingRuntime}>
                    {clearingRuntime ? 'Clearing...' : 'Clear Layout Override'}
                  </Button>
                </div>
              )}

            </div>
          </ConfigPanel>

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

        <ConfigPanel title="Widget Window Defaults" className="mb-4">
            {/* Visual drag+resize preview — same canvas as Scene windows */}
            <OverlayCanvas
              items={[{
                id: app.id,
                x: widgetPosition.x,
                y: widgetPosition.y,
                width: widgetSize.width,
                height: widgetSize.height,
              }]}
              selectedId={app.id}
              onSelect={() => {}}
              onChange={(_id, patch) => {
                if (patch.x !== undefined || patch.y !== undefined) {
                  setWidgetPosition((prev) => ({
                    x: Math.max(0, patch.x ?? prev.x),
                    y: Math.max(0, patch.y ?? prev.y),
                  }))
                }
                if (patch.width !== undefined || patch.height !== undefined) {
                  setWidgetSize((prev) => ({
                    width:  Math.max(WIDGET_WIDTH_MIN,  Math.min(WIDGET_WIDTH_MAX,  patch.width  ?? prev.width)),
                    height: Math.max(WIDGET_HEIGHT_MIN, Math.min(WIDGET_HEIGHT_MAX, patch.height ?? prev.height)),
                  }))
                }
              }}
              renderItem={() => (
                <div className="absolute inset-0 flex items-center justify-center gap-1.5 overflow-hidden">
                  <IconGlyph icon={form.icon} label={form.label} size={14} />
                  <span className="text-[9px] text-white/70 truncate">{form.label}</span>
                </div>
              )}
            />

            {/* Numeric inputs for precision */}
            <div className="mt-3 grid grid-cols-2 gap-2">
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
            <div className="mt-2 text-[10px] text-[var(--color-text-muted)]">Drag and resize in the preview, or type exact values above.</div>
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

            {/* Default Widget Theme */}
            <div className="mt-3 pt-3 border-t border-[var(--color-border-default)] space-y-2">
              <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">Default Widget Theme</div>
              {hasRuntimeWidgetTheme && (
                <Notice className="px-3 py-2 text-[10px]" tone="info">
                  Runtime theme active — persisted value shown below.
                </Notice>
              )}
              <select
                value={widgetTheme.skin}
                onChange={(e) => {
                  setWidgetTheme(structuredClone(DEFAULT_WIDGET_THEME_PRESETS[e.target.value]))
                  setSaved(false)
                }}
                className="w-full text-xs"
              >
                {WIDGET_SKINS.map((skin) => (
                  <option key={skin.id} value={skin.id}>{skin.label}</option>
                ))}
              </select>
            </div>
          </ConfigPanel>

        {isStickyNotesWidget && (
          <StickyNotesConfigSection value={stickyNotesConfig} onChange={updateStickyNotesConfig} />
        )}

        {widgetComponent === 'camera' && (
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

        {widgetComponent === 'window' && (
          <ConfigPanel title="Window Binding" className="mb-4">
            <div className="space-y-3">
              <div className="text-[10px] text-[var(--color-text-secondary)]">
                Window widgets render one scene window inside a desktop window. Bind this widget to any configured window and change it later without recreating the widget.
              </div>
              <div>
                <div className="text-[10px] text-[var(--color-text-muted)] mb-1">Scene</div>
                <select value={selectedSourceSceneId}
                  onChange={(e) => update((d) => {
                    const nextSceneId = e.target.value
                    const nextScene = config.scenes[nextSceneId]
                    const nextSceneWindows = getSafeSceneWindows(nextScene)
                    const currentWindowId = d.windowWidgetSettings?.windowId
                    const nextWindowId = nextSceneWindows.some((w) => w.id === currentWindowId) ? currentWindowId : (nextSceneWindows[0]?.id ?? '')
                    d.windowWidgetSettings = nextSceneId ? { sceneId: nextSceneId, windowId: nextWindowId } : undefined
                  })}
                  className="w-full text-xs">
                  <option value="">— Select scene —</option>
                  {availableSourceScenes.map((scene) => <option key={scene.id} value={scene.id}>{scene.label}</option>)}
                </select>
              </div>
              <div>
                <div className="text-[10px] text-[var(--color-text-muted)] mb-1">Window</div>
                <select value={form.windowWidgetSettings?.windowId ?? ''}
                  onChange={(e) => update((d) => { d.windowWidgetSettings = { sceneId: d.windowWidgetSettings?.sceneId ?? '', windowId: e.target.value } })}
                  disabled={!selectedSourceSceneId || availableWindows.length === 0}
                  className="w-full text-xs">
                  <option value="">{selectedSourceSceneId ? '— Select window —' : '— Choose a scene first —'}</option>
                  {availableWindows.map((w) => (
                    <option key={w.id} value={w.id}>{w.id} · {resolveWindowInstance(w, windowPresets)?.rendererType ?? 'unbound'}</option>
                  ))}
                </select>
              </div>
              {availableSourceScenes.length === 0 && (
                <div className="text-[10px] text-[var(--color-accent-300)] leading-relaxed">No scene windows are configured yet. Add a window to any scene, then bind this widget to it.</div>
              )}
              {selectedSourceSceneId && availableWindows.length === 0 && (
                <div className="text-[10px] text-[var(--color-text-muted)]">This scene currently has no windows to bind.</div>
              )}
              {selectedWindow && selectedSourceScene && (
                <div className="rounded border border-[var(--color-border-default)] bg-[var(--color-bg-base)]/40 px-3 py-2 space-y-1">
                  <div className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider">Current Binding</div>
                  <div className="text-[11px] text-[var(--color-text-primary)]">{selectedSourceScene.label}</div>
                  <div className="text-[10px] text-[var(--color-text-secondary)] font-mono">{selectedWindow.id} · {selectedWindowResolved?.rendererType ?? 'unbound'}</div>
                </div>
              )}
            </div>
          </ConfigPanel>
        )}

        {form.id === 'gallery' && (
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

