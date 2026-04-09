import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  DEFAULT_CONFIG,
  DEFAULT_DESKTOP_CONFIG,
  DEFAULT_SYSTEM_WIDGET_LAYOUTS,
  DEFAULT_WIDGET_THEME_PRESETS,
  STATE,
  withDesktopConfigDefaults,
  withOverlayStyleDefaults,
} from '@ieom/shared'
import type { Application, AppConfig, DesktopConfig, OverlayStyle, RecycleBinSettings, StickyNotesSettings, WidgetThemeConfig } from '@ieom/shared'
import { socket } from '../../socket/client'
import { useAdminStore } from '../../store/useAdminStore'
import { AssetSelectionInput } from '../AssetLibrary'
import {
  DESKTOP_THEMES,
  WIDGET_SKINS,
  WIDGET_THEME_ANIMATIONS,
  WIDGET_THEME_ATMOSPHERES,
} from '../adminDesktopOptions'
import { Btn, ConfigApplyBar, ConfigChoiceButton, ConfigSectionPanel, HexColorInput, isSameDraft, Slider, Toggle } from '../ui'
import { DASHBOARD_SAVE_BUTTON_CLASS } from './constants'
import { ThemeAppearanceFields } from './formAtoms'
import { postPreviewConfigPatch } from './previewUtils'
import type { ThemeAppearance } from './types'

// ── StickyNotesConfigSection ──────────────────────────────────────────

export function StickyNotesConfigSection({
  value,
  onChange,
}: {
  value: StickyNotesSettings
  onChange: (updater: (draft: StickyNotesSettings) => void) => void
}) {
  return (
    <ConfigSectionPanel label="Sticky Notes">
      <div className="text-[10px] text-zinc-500 mb-1">Default note text</div>
      <textarea value={value.text} onChange={(e) => onChange((draft) => { draft.text = e.target.value })}
        className="w-full min-h-[110px] text-xs font-mono" />
      <div className="mt-3 text-[10px] text-zinc-500 mb-1">Note color</div>
      <HexColorInput value={value.color} onChange={(nextValue) => onChange((draft) => { draft.color = nextValue })}
        className="max-w-sm gap-2" pickerClassName="w-20 h-9 p-1 shrink-0" textClassName="font-mono text-xs flex-1 min-w-0" />
    </ConfigSectionPanel>
  )
}

// ── RecycleBinConfigSection ───────────────────────────────────────────

export function RecycleBinConfigSection({
  settings,
  fullOnStart,
  onSettingsChange,
  onFullOnStartChange,
}: {
  settings: RecycleBinSettings
  fullOnStart: boolean
  onSettingsChange: (updater: (draft: RecycleBinSettings) => void) => void
  onFullOnStartChange: (nextValue: boolean) => void
}) {
  return (
    <ConfigSectionPanel label="Recycle Bin">
      <Toggle checked={fullOnStart} onChange={onFullOnStartChange} label="Starts full" />
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div>
          <div className="text-[10px] text-zinc-500 mb-1">Empty icon</div>
          <AssetSelectionInput value={settings.emptyIcon}
            onChange={(nextValue) => onSettingsChange((draft) => { draft.emptyIcon = nextValue })}
            kinds={['image']} modalTitle="Recycle Bin Empty Icon"
            placeholder="Emoji or /assets/icons/recycle-empty.png" buttonLabel="Choose Image" previewKind="image" />
        </div>
        <div>
          <div className="text-[10px] text-zinc-500 mb-1">Full icon</div>
          <AssetSelectionInput value={settings.fullIcon}
            onChange={(nextValue) => onSettingsChange((draft) => { draft.fullIcon = nextValue })}
            kinds={['image']} modalTitle="Recycle Bin Full Icon"
            placeholder="Emoji or /assets/icons/recycle-full.png" buttonLabel="Choose Image" previewKind="image" />
        </div>
      </div>
    </ConfigSectionPanel>
  )
}

// ── DefaultStylingEditor ──────────────────────────────────────────────

type GlobalThemeConfirmAction = 'factory-reset' | 'restore-global-theme' | 'save-global-theme'

export function DefaultStylingEditor() {
  const config = useAdminStore((s) => s.config)
  const saveConfig = useAdminStore((s) => s.saveConfig)
  const setRuntimeConfigOverride = useAdminStore((s) => s.setRuntimeConfigOverride)
  const desktopScene = config.scenes[STATE.DESKTOP]
  const sourceDesktopConfig = useMemo(() => withDesktopConfigDefaults(config.desktopConfig), [config.desktopConfig])
  const sourceStyle = useMemo(
    () => structuredClone(withOverlayStyleDefaults((desktopScene as { style?: OverlayStyle } | undefined)?.style, config.overlayStyle)),
    [desktopScene, config.overlayStyle],
  )
  const sourceAppearance = useMemo<ThemeAppearance>(() => ({
    fontFamily:  sourceStyle.fontFamily,
    accentColor: sourceStyle.accentColor,
    textColor:   sourceStyle.textColor,
  }), [sourceStyle])
  const sourceThemeDefault = sourceDesktopConfig.globalThemeDefault
  const randomDesktopThemes = useMemo(() => DESKTOP_THEMES.filter((entry) => entry.id !== 'custom'), [])
  const factoryDesktopConfig = useMemo(() => structuredClone(withDesktopConfigDefaults(DEFAULT_CONFIG.desktopConfig)), [])
  const factoryDesktopStyle  = useMemo(
    () => structuredClone(withOverlayStyleDefaults((DEFAULT_CONFIG.scenes[STATE.DESKTOP] as { style?: OverlayStyle } | undefined)?.style, DEFAULT_CONFIG.overlayStyle)),
    [],
  )
  const factorySystemWidgets = useMemo(
    () => DEFAULT_CONFIG.applications
      .filter((entry): entry is Application => entry.appType === 'widget' && entry.widgetSource === 'system')
      .map((entry) => structuredClone(entry)),
    [],
  )
  const factorySystemWidgetById = useMemo(
    () => new Map(factorySystemWidgets.map((entry) => [entry.id, entry] as const)),
    [factorySystemWidgets],
  )

  const [theme, setTheme]           = useState<DesktopConfig['theme']>(() => sourceDesktopConfig.theme)
  const [appearance, setAppearance] = useState<ThemeAppearance>(() => sourceAppearance)
  const [widgetTheme, setWidgetTheme] = useState<DesktopConfig['widgetTheme']>(() => structuredClone(sourceDesktopConfig.widgetTheme))
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)
  const [pendingConfirmAction, setPendingConfirmAction] = useState<GlobalThemeConfirmAction | null>(null)
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const confirmActionTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const dirty = theme !== sourceDesktopConfig.theme
    || !isSameDraft(appearance, sourceAppearance)
    || !isSameDraft(widgetTheme, sourceDesktopConfig.widgetTheme)

  const previewPatch = useMemo(() => {
    const nextDesktopStyle = structuredClone(sourceStyle)
    nextDesktopStyle.fontFamily  = appearance.fontFamily
    nextDesktopStyle.accentColor = appearance.accentColor
    nextDesktopStyle.textColor   = appearance.textColor
    return {
      desktopConfig: { theme, widgetTheme },
      scenes: { [STATE.DESKTOP]: { ...config.scenes[STATE.DESKTOP], style: nextDesktopStyle } },
    } as unknown as Partial<AppConfig>
  }, [appearance, config.scenes, sourceStyle, theme, widgetTheme])

  useEffect(() => {
    setTheme(sourceDesktopConfig.theme)
    setAppearance(sourceAppearance)
    setWidgetTheme(structuredClone(sourceDesktopConfig.widgetTheme))
    setPendingConfirmAction(null)
    setSaved(false)
  }, [config.desktopConfig, config.overlayStyle, desktopScene])

  const armConfirmation = useCallback((action: GlobalThemeConfirmAction) => {
    setPendingConfirmAction(action)
    if (confirmActionTimer.current) clearTimeout(confirmActionTimer.current)
    confirmActionTimer.current = setTimeout(() => setPendingConfirmAction(null), 3500)
    return false
  }, [])

  const consumeConfirmation = useCallback((action: GlobalThemeConfirmAction) => {
    if (pendingConfirmAction !== action) return armConfirmation(action)
    if (confirmActionTimer.current) clearTimeout(confirmActionTimer.current)
    setPendingConfirmAction(null)
    return true
  }, [armConfirmation, pendingConfirmAction])

  const pickRandomEntry = useCallback(<T extends { id: string }>(entries: T[], currentId: string) => {
    if (entries.length === 0) return null
    if (entries.length === 1) return entries[0]
    const candidates = entries.filter((entry) => entry.id !== currentId)
    const pool = candidates.length > 0 ? candidates : entries
    return pool[Math.floor(Math.random() * pool.length)] ?? pool[0]
  }, [])

  const buildNextDesktopStyle = useCallback((ap: ThemeAppearance) => {
    const next = structuredClone(sourceStyle)
    next.fontFamily  = ap.fontFamily
    next.accentColor = ap.accentColor
    next.textColor   = ap.textColor
    return next
  }, [sourceStyle])

  const apply = useCallback(async () => {
    if (!dirty) return
    setSaving(true)
    await saveConfig({
      desktopConfig: { theme, widgetTheme },
      scenes: { [STATE.DESKTOP]: { ...config.scenes[STATE.DESKTOP], style: buildNextDesktopStyle(appearance) } },
    } as unknown as Partial<AppConfig>)
    setSaving(false)
    if (savedTimer.current) clearTimeout(savedTimer.current)
    setSaved(true)
    savedTimer.current = setTimeout(() => setSaved(false), 1500)
  }, [appearance, config.scenes, dirty, saveConfig, sourceDesktopConfig, buildNextDesktopStyle, theme, widgetTheme])

  const reset = useCallback(() => {
    setTheme(sourceDesktopConfig.theme)
    setAppearance(sourceAppearance)
    setWidgetTheme(structuredClone(sourceDesktopConfig.widgetTheme))
    setPendingConfirmAction(null)
    setSaved(false)
  }, [sourceAppearance, sourceDesktopConfig.theme, sourceDesktopConfig.widgetTheme])

  const restoreSavedGlobalTheme = useCallback(async () => {
    if (!consumeConfirmation('restore-global-theme')) return
    setSaving(true)
    await saveConfig({
      desktopConfig: {
        theme: sourceThemeDefault.theme,
        widgetTheme: structuredClone(sourceThemeDefault.widgetTheme),
      },
      scenes: { [STATE.DESKTOP]: { ...config.scenes[STATE.DESKTOP], style: buildNextDesktopStyle(sourceThemeDefault.appearance) } },
    } as unknown as Partial<AppConfig>)
    setSaving(false)
    if (savedTimer.current) clearTimeout(savedTimer.current)
    setSaved(true)
    savedTimer.current = setTimeout(() => setSaved(false), 1500)
  }, [config.scenes, consumeConfirmation, saveConfig, buildNextDesktopStyle, sourceThemeDefault])

  const performFactoryReset = useCallback(async () => {
    if (!consumeConfirmation('factory-reset')) return
    setSaving(true)
    const currentFactoryWidgetIds = new Set(
      config.applications.filter((entry) => factorySystemWidgetById.has(entry.id)).map((entry) => entry.id),
    )
    const nextApplications = [
      ...config.applications.map((entry) => {
        const factoryWidget = factorySystemWidgetById.get(entry.id)
        return factoryWidget ? structuredClone(factoryWidget) : entry
      }),
      ...factorySystemWidgets.filter((entry) => !currentFactoryWidgetIds.has(entry.id)).map((entry) => structuredClone(entry)),
    ]
    await saveConfig({
      applications: nextApplications,
      desktopConfig: {
        ...factoryDesktopConfig,
        theme: DEFAULT_DESKTOP_CONFIG.theme,
        widgetTheme: structuredClone(DEFAULT_DESKTOP_CONFIG.widgetTheme),
        widgetPositions: undefined,
        widgetSizes: undefined,
        widgetThemeOverrides: undefined,
        widgetLayouts: structuredClone(DEFAULT_SYSTEM_WIDGET_LAYOUTS),
      },
      scenes: { [STATE.DESKTOP]: { ...config.scenes[STATE.DESKTOP], style: factoryDesktopStyle } },
    } as unknown as Partial<AppConfig>)
    setSaving(false)
    if (savedTimer.current) clearTimeout(savedTimer.current)
    setSaved(true)
    savedTimer.current = setTimeout(() => setSaved(false), 1500)
  }, [config.applications, config.scenes, consumeConfirmation, factoryDesktopConfig, factoryDesktopStyle, factorySystemWidgetById, factorySystemWidgets, saveConfig])

  const saveGlobalTheme = useCallback(async () => {
    if (!consumeConfirmation('save-global-theme')) return
    setSaving(true)
    await saveConfig({
      desktopConfig: {
        globalThemeDefault: { theme, widgetTheme: structuredClone(widgetTheme), appearance: structuredClone(appearance) },
      },
      scenes: { [STATE.DESKTOP]: { ...config.scenes[STATE.DESKTOP], style: buildNextDesktopStyle(appearance) } },
    } as unknown as Partial<AppConfig>)
    setSaving(false)
    if (savedTimer.current) clearTimeout(savedTimer.current)
    setSaved(true)
    savedTimer.current = setTimeout(() => setSaved(false), 1500)
  }, [appearance, config.scenes, consumeConfirmation, saveConfig, buildNextDesktopStyle, theme, widgetTheme])

  const clearAllRuntime = useCallback(() => {
    postPreviewConfigPatch(null)
    setRuntimeConfigOverride({})
    socket.emit('runtime:config:override:clear', (err: string | null) => {
      if (err) console.error('[admin] failed to clear runtime overrides', err)
    })
  }, [setRuntimeConfigOverride])

  useEffect(() => () => {
    if (savedTimer.current) clearTimeout(savedTimer.current)
    if (confirmActionTimer.current) clearTimeout(confirmActionTimer.current)
    postPreviewConfigPatch(null)
  }, [])

  useEffect(() => {
    postPreviewConfigPatch(dirty ? previewPatch : null)
  }, [dirty, previewPatch])

  return (
    <div className="space-y-3">
      <ConfigApplyBar label="Global Theme" dirty={dirty} saving={saving} saved={saved} onApply={apply} onReset={reset} />
      <div className="grid gap-4 rounded-2xl border border-zinc-800/80 bg-zinc-950/40 p-4 lg:grid-cols-2">
        <Btn type="button" variant="danger" onClick={() => { void performFactoryReset() }}
          className="justify-center px-3 py-2 text-[11px] uppercase tracking-[0.16em]">
          {pendingConfirmAction === 'factory-reset' ? 'Confirm Factory Reset' : 'Perform Factory Reset'}
        </Btn>
        <Btn type="button" variant={pendingConfirmAction === 'restore-global-theme' ? 'warning' : 'default'}
          onClick={() => { void restoreSavedGlobalTheme() }}
          className="justify-center px-3 py-2 text-[11px] uppercase tracking-[0.16em]">
          {pendingConfirmAction === 'restore-global-theme' ? 'Confirm Restore Global Theme' : 'Restore Global Theme'}
        </Btn>
        <Btn type="button" variant={pendingConfirmAction === 'save-global-theme' ? 'warning' : 'default'}
          onClick={() => { void saveGlobalTheme() }}
          className={`justify-center ${DASHBOARD_SAVE_BUTTON_CLASS}`}>
          {pendingConfirmAction === 'save-global-theme' ? 'Confirm Save Global Theme' : 'Save Global Theme'}
        </Btn>
        <Btn type="button" variant="ghost" onClick={clearAllRuntime} className="justify-center px-3 py-2 text-[11px] uppercase tracking-[0.16em]">
          Clear All Runtime
        </Btn>
      </div>
      <div className="space-y-0 pt-3">
        <ConfigSectionPanel label="Desktop Theme" first>
          <div className="space-y-4">
            <div className="text-[10px] text-zinc-500 leading-relaxed">
              Theme presets style desktop chrome only. The overlay stays transparent until the desktop Background panel is explicitly set to show wallpaper, gradients, patterns, or video.
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {DESKTOP_THEMES.map((entry) => (
                <ConfigChoiceButton key={entry.id} type="button" selected={theme === entry.id}
                  onClick={() => { setTheme(entry.id); setSaved(false) }}
                  className="min-h-0 flex-col items-start gap-1 px-3 py-2 text-left normal-case">
                  <span className="text-[11px] font-semibold leading-none">{entry.label}</span>
                  <span className="text-[10px] leading-relaxed text-zinc-500">{entry.description}</span>
                </ConfigChoiceButton>
              ))}
              <ConfigChoiceButton type="button" selected={false}
                onClick={() => { const next = pickRandomEntry(randomDesktopThemes, theme); if (next) { setTheme(next.id); setSaved(false) } }}
                className="min-h-0 flex-col items-start gap-1 px-3 py-2 text-left normal-case">
                <span className="text-[11px] font-semibold leading-none">Random</span>
                <span className="text-[10px] leading-relaxed text-zinc-500">Pick a desktop theme preset at random, excluding Custom and usually excluding the current pick.</span>
              </ConfigChoiceButton>
            </div>
            <div className="border-t border-zinc-800 pt-3">
              <ThemeAppearanceFields appearance={appearance}
                onChange={(updater) => { setAppearance((prev) => { const next = structuredClone(prev); updater(next); return next }); setSaved(false) }}
                helperText="Font, accent, and text color ride on top of the preset so they are visible without turning the desktop background opaque." />
            </div>
          </div>
        </ConfigSectionPanel>
        <ConfigSectionPanel label="Widget Theme">
          <div className="space-y-4">
            <div className="text-[10px] text-zinc-500 leading-relaxed">
              This is the global widget theme applied to all widgets unless a widget-specific override is enabled in that widget's own configuration panel.
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {WIDGET_SKINS.map((skin) => (
                <ConfigChoiceButton key={skin.id} type="button" selected={widgetTheme.skin === skin.id}
                  onClick={() => { setWidgetTheme(structuredClone(DEFAULT_WIDGET_THEME_PRESETS[skin.id])); setSaved(false) }}
                  className="min-h-0 flex-col items-start gap-1 px-3 py-2 text-left normal-case" title={skin.description}>
                  <span className="text-[11px] font-semibold leading-none">{skin.label}</span>
                  <span className="text-[10px] leading-relaxed text-zinc-500">{skin.description}</span>
                </ConfigChoiceButton>
              ))}
              <ConfigChoiceButton type="button" selected={false}
                onClick={() => { const next = pickRandomEntry(WIDGET_SKINS, widgetTheme.skin); if (next) { setWidgetTheme(structuredClone(DEFAULT_WIDGET_THEME_PRESETS[next.id])); setSaved(false) } }}
                className="min-h-0 flex-col items-start gap-1 px-3 py-2 text-left normal-case">
                <span className="text-[11px] font-semibold leading-none">Random</span>
                <span className="text-[10px] leading-relaxed text-zinc-500">Pick a widget skin preset at random and load its baseline palette, motion, and atmosphere profile.</span>
              </ConfigChoiceButton>
            </div>
            <div className="border-t border-zinc-800 pt-3">
              <ThemeAppearanceFields appearance={widgetTheme as unknown as ThemeAppearance}
                onChange={(updater) => { setWidgetTheme((prev) => { const next = structuredClone(prev); updater(next as unknown as ThemeAppearance); return next }); setSaved(false) }}
                helperText="Each skin ships with its own baseline palette and font. Use these overrides when you want to tint the skin without switching presets." />
            </div>
          </div>
        </ConfigSectionPanel>
        <ConfigSectionPanel label="Widget Motion">
          <div className="space-y-4">
            <div className="text-[10px] text-zinc-500 leading-relaxed">
              Animation changes how light, gloss, and ornament move across the widget shell. Atmosphere adds an always-on texture layer so the desktop feels alive even when viewers stare at it for a long time.
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {WIDGET_THEME_ANIMATIONS.map((animation) => (
                <ConfigChoiceButton key={animation.id} type="button" selected={widgetTheme.animation === animation.id}
                  onClick={() => { setWidgetTheme((prev) => ({ ...prev, animation: animation.id })); setSaved(false) }}
                  className="min-h-0 flex-col items-start gap-1 px-3 py-2 text-left normal-case" title={animation.description}>
                  <span className="text-[11px] font-semibold leading-none">{animation.label}</span>
                  <span className="text-[10px] leading-relaxed text-zinc-500">{animation.description}</span>
                </ConfigChoiceButton>
              ))}
            </div>
            <div className="border-t border-zinc-800 pt-3 space-y-3">
              <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Atmosphere</div>
              <div className="grid grid-cols-3 gap-1.5">
                {WIDGET_THEME_ATMOSPHERES.map((atmosphere) => (
                  <ConfigChoiceButton key={atmosphere.id} type="button" selected={widgetTheme.atmosphere === atmosphere.id}
                    onClick={() => { setWidgetTheme((prev) => ({ ...prev, atmosphere: atmosphere.id })); setSaved(false) }}
                    className="py-2 text-[11px]">
                    {atmosphere.label}
                  </ConfigChoiceButton>
                ))}
              </div>
              <Slider label="Motion" value={Math.round(widgetTheme.motionIntensity * 100)} min={0} max={300} step={5} unit="%"
                onChange={(value) => { setWidgetTheme((prev) => ({ ...prev, motionIntensity: value / 100 })); setSaved(false) }} />
              <Slider label="Glow" value={Math.round(widgetTheme.glowIntensity * 100)} min={0} max={300} step={5} unit="%"
                onChange={(value) => { setWidgetTheme((prev) => ({ ...prev, glowIntensity: value / 100 })); setSaved(false) }} />
            </div>
          </div>
        </ConfigSectionPanel>
      </div>
    </div>
  )
}
