import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  DEFAULT_CONFIG,
  DEFAULT_SYSTEM_WIDGET_LAYOUTS,
  DEFAULT_WIDGET_THEME_PRESETS,
  STATE,
  withDesktopConfigDefaults,
  withOverlayStyleDefaults,
} from '@ieom/shared'
import type { Application, AppConfig, DesktopConfig, DesktopTheme, OverlayStyle, WidgetThemeConfig } from '@ieom/shared'
import { socket } from '../../socket/client'
import { useAdminStore } from '../../store/useAdminStore'
import { ConfigApplyBar, ConfigChoiceButton, isSameDraft, Slider } from '../../shared/ui'
import { Toggle, Button } from '../../components/atoms'
import { ConfigPanel } from '../../components/organisms'
import {
  DESKTOP_THEMES,
  ICON_ANIMATIONS,
  ICON_ARRANGEMENTS,
  SCREENSAVER_PRESETS,
  WIDGET_SKINS,
  WIDGET_THEME_ANIMATIONS,
  WIDGET_THEME_ATMOSPHERES,
  iconSizeToSliderValue,
  labelizeIconSize,
  sliderValueToIconSize,
} from '../../shared/adminDesktopOptions'
import { ThemeAppearanceFields } from './formAtoms'
import type { ThemeAppearance } from './types'

const postPreviewConfigPatch = (_patch: unknown) => {}

function DesktopConfigSections({ form, update }: {
  form: DesktopConfig
  update: (updater: (d: DesktopConfig) => void) => void
}) {
  return (
    <>
      <ConfigPanel title="Desktop Icons" className="mb-4">
        <div className="space-y-3">
          <div>
            <div className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider mb-1">Icons</div>
            <div className="text-[10px] text-[var(--color-text-muted)] leading-relaxed">
              Turn off auto-arrange to drag icons directly on the desktop. Manual dragging saves each application icon position for you.
            </div>
          </div>
          <Slider label="Size" value={iconSizeToSliderValue(form.defaultIconSize)} min={0} max={2} step={1}
            onChange={(value) => update((d) => { d.defaultIconSize = sliderValueToIconSize(value) })} />
          <div className="text-[10px] text-[var(--color-text-muted)] -mt-1 pl-[7rem]">Current default: {labelizeIconSize(form.defaultIconSize)}</div>
          <Toggle checked={form.autoArrangeIcons} onChange={(v) => update((d) => { d.autoArrangeIcons = v })} size="sm" label="Auto-arrange icons" />
          <div>
            <div className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider mb-1.5">Ambient motion</div>
            <div className="grid grid-cols-2 gap-1.5">
              {ICON_ANIMATIONS.map((mode) => (
                <ConfigChoiceButton key={mode.id} type="button" selected={form.iconAnimation === mode.id}
                  onClick={() => update((d) => { d.iconAnimation = mode.id })}
                  className="min-h-0 flex-col items-start gap-1 px-3 py-2 text-left normal-case">
                  <span className="text-[11px] font-semibold leading-none">{mode.label}</span>
                  <span className="text-[10px] leading-relaxed text-[var(--color-text-muted)]">{mode.description}</span>
                </ConfigChoiceButton>
              ))}
            </div>
            <div className="mt-2">
              <Slider label="Motion" value={Math.round(form.iconMotion * 100)} min={0} max={300} step={5} unit="%"
                onChange={(value) => update((d) => { d.iconMotion = value / 100 })} />
            </div>
          </div>
          <div>
            <div className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider mb-1.5">Arrangement</div>
            <div className="grid grid-cols-2 gap-1.5">
              {ICON_ARRANGEMENTS.map((arr) => (
                <ConfigChoiceButton key={arr.id} type="button" selected={(form.iconArrangement ?? 'grid') === arr.id}
                  onClick={() => update((d) => { d.iconArrangement = arr.id })}
                  className="min-h-0 flex-col items-start gap-1 px-3 py-2 text-left normal-case">
                  <span className="text-[11px] font-semibold leading-none">{arr.label}</span>
                  <span className="text-[10px] leading-relaxed text-[var(--color-text-muted)]">{arr.description}</span>
                </ConfigChoiceButton>
              ))}
            </div>
            <div className="mt-2">
              <Slider label="Motion" value={Math.round((form.iconArrangementMotion ?? 1) * 100)} min={0} max={300} step={5} unit="%"
                onChange={(value) => update((d) => { d.iconArrangementMotion = value / 100 })} />
            </div>
          </div>
        </div>
      </ConfigPanel>
      <ConfigPanel title="Screen Saver" className="mb-4">
        <Toggle checked={form.screenSaver.enabled} onChange={(v) => update((d) => { d.screenSaver.enabled = v })} size="sm" label="Enable" />
        {form.screenSaver.enabled && (
          <div className="mt-2 grid gap-2 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-end">
            <div>
              <div className="text-[10px] text-[var(--color-text-muted)] mb-1">Idle timeout (min)</div>
              <input type="number" min={1} max={60} value={form.screenSaver.timeoutMinutes}
                onChange={(e) => update((d) => { d.screenSaver.timeoutMinutes = Number(e.target.value) })}
                className="w-20 font-mono text-xs" />
            </div>
            <div>
              <div className="text-[10px] text-[var(--color-text-muted)] mb-1">Preset</div>
              <select value={form.screenSaver.preset}
                onChange={(e) => update((d) => { d.screenSaver.preset = e.target.value as DesktopConfig['screenSaver']['preset'] })}
                className="w-full text-xs">
                {SCREENSAVER_PRESETS.map((preset) => <option key={preset.id} value={preset.id}>{preset.label}</option>)}
              </select>
            </div>
            <button onClick={() => socket.emit('desktop:screen-saver:test', { preset: form.screenSaver.preset })}
              className="rounded border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] px-3 py-1.5 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] sm:self-end">
              Test
            </button>
          </div>
        )}
      </ConfigPanel>
      <ConfigPanel title="System Sounds" className="mb-4">
        <div className="text-[10px] text-[var(--color-text-muted)] mb-2">Relative to <span className="font-mono text-[var(--color-text-secondary)]">assets/sfx/system/</span></div>
        {(['startup', 'error', 'notify', 'click', 'close'] as const).map((key) => (
          <div key={key} className="flex items-center gap-2 mb-1.5">
            <label className="text-[11px] text-[var(--color-text-secondary)] w-12 shrink-0 capitalize">{key}</label>
            <input type="text" value={form.systemSounds[key]}
              onChange={(e) => update((d) => { d.systemSounds[key] = e.target.value })}
              placeholder={key + '.wav'} className="flex-1 font-mono text-[11px]" />
          </div>
        ))}
      </ConfigPanel>
    </>
  )
}

export function DesktopThemeEditor() {
  const config                   = useAdminStore((s) => s.config)
  const saveConfig               = useAdminStore((s) => s.saveConfig)
  const setRuntimeConfigOverride = useAdminStore((s) => s.setRuntimeConfigOverride)
  const desktopScene             = config.scenes[STATE.DESKTOP]
  const sourceDesktopConfig      = useMemo(() => withDesktopConfigDefaults(config.desktopConfig), [config.desktopConfig])
  const sourceStyle              = useMemo(
    () => structuredClone(withOverlayStyleDefaults((desktopScene as { style?: OverlayStyle } | undefined)?.style, config.overlayStyle)),
    [desktopScene, config.overlayStyle],
  )
  const sourceThemeDefault    = sourceDesktopConfig.globalThemeDefault
  const randomDesktopThemes   = useMemo(() => DESKTOP_THEMES.filter((e) => e.id !== 'custom'), [])
  const factoryDesktopConfig  = useMemo(() => structuredClone(withDesktopConfigDefaults(DEFAULT_CONFIG.desktopConfig)), [])
  const factoryDesktopStyle   = useMemo(
    () => structuredClone(withOverlayStyleDefaults((DEFAULT_CONFIG.scenes[STATE.DESKTOP] as { style?: OverlayStyle } | undefined)?.style, DEFAULT_CONFIG.overlayStyle)),
    [],
  )
  const factorySystemWidgets  = useMemo(
    () => DEFAULT_CONFIG.applications
      .filter((e): e is Application => e.appType === 'widget' && e.widgetSource === 'system')
      .map((e) => structuredClone(e)),
    [],
  )
  const factorySystemWidgetById = useMemo(
    () => new Map(factorySystemWidgets.map((e) => [e.id, e] as const)),
    [factorySystemWidgets],
  )

  const [theme,       setTheme]       = useState<DesktopTheme>(() => sourceThemeDefault.theme)
  const [appearance,  setAppearance]  = useState<ThemeAppearance>(() => structuredClone(sourceThemeDefault.appearance))
  const [widgetTheme, setWidgetTheme] = useState<WidgetThemeConfig>(() => structuredClone(sourceThemeDefault.widgetTheme))
  const [form,        setForm]        = useState<DesktopConfig>(() => structuredClone(sourceDesktopConfig))
  const [saving,      setSaving]      = useState(false)
  const [saved,       setSaved]       = useState(false)
  const [factoryResetArmed, setFactoryResetArmed] = useState(false)
  const savedTimer        = useRef<ReturnType<typeof setTimeout> | null>(null)
  const factoryResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const update = useCallback((updater: (d: DesktopConfig) => void) => {
    setForm((prev) => { const next = structuredClone(prev); updater(next); return next })
    setSaved(false)
  }, [])

  const dirty = theme !== sourceThemeDefault.theme
    || !isSameDraft(appearance, sourceThemeDefault.appearance)
    || !isSameDraft(widgetTheme, sourceThemeDefault.widgetTheme)
    || !isSameDraft(form, sourceDesktopConfig)

  const previewPatch = useMemo(() => {
    const nextStyle = structuredClone(sourceStyle)
    nextStyle.fontFamily  = appearance.fontFamily
    nextStyle.accentColor = appearance.accentColor
    nextStyle.textColor   = appearance.textColor
    return {
      desktopConfig: { globalThemeDefault: { theme, widgetTheme } },
      scenes: { [STATE.DESKTOP]: { ...config.scenes[STATE.DESKTOP], style: nextStyle } },
    } as unknown as Partial<AppConfig>
  }, [appearance, config.scenes, sourceStyle, theme, widgetTheme])

  useEffect(() => {
    setTheme(sourceThemeDefault.theme)
    setAppearance(structuredClone(sourceThemeDefault.appearance))
    setWidgetTheme(structuredClone(sourceThemeDefault.widgetTheme))
    setForm(structuredClone(sourceDesktopConfig))
    setFactoryResetArmed(false)
    setSaved(false)
  }, [config.desktopConfig, config.overlayStyle, desktopScene])

  useEffect(() => () => {
    if (savedTimer.current) clearTimeout(savedTimer.current)
    if (factoryResetTimer.current) clearTimeout(factoryResetTimer.current)
    postPreviewConfigPatch(null)
  }, [])

  useEffect(() => {
    postPreviewConfigPatch(dirty ? previewPatch : null)
  }, [dirty, previewPatch])

  const pickRandom = useCallback(<T extends { id: string }>(entries: T[], currentId: string) => {
    if (entries.length <= 1) return entries[0] ?? null
    const pool = entries.filter((e) => e.id !== currentId)
    return (pool.length > 0 ? pool : entries)[Math.floor(Math.random() * (pool.length || entries.length))] ?? null
  }, [])

  const buildNextStyle = useCallback((ap: ThemeAppearance) => {
    const next = structuredClone(sourceStyle)
    next.fontFamily  = ap.fontFamily
    next.accentColor = ap.accentColor
    next.textColor   = ap.textColor
    return next
  }, [sourceStyle])

  const apply = useCallback(async () => {
    setSaving(true)
    await saveConfig({
      desktopConfig: {
        ...structuredClone(form),
        globalThemeDefault: { theme, widgetTheme: structuredClone(widgetTheme), appearance: structuredClone(appearance) },
      },
      scenes: { [STATE.DESKTOP]: { ...config.scenes[STATE.DESKTOP], style: buildNextStyle(appearance) } },
    } as unknown as Partial<AppConfig>)
    setSaving(false)
    if (savedTimer.current) clearTimeout(savedTimer.current)
    setSaved(true)
    savedTimer.current = setTimeout(() => setSaved(false), 1500)
  }, [appearance, buildNextStyle, config.scenes, form, saveConfig, theme, widgetTheme])

  const reset = useCallback(() => {
    setTheme(sourceThemeDefault.theme)
    setAppearance(structuredClone(sourceThemeDefault.appearance))
    setWidgetTheme(structuredClone(sourceThemeDefault.widgetTheme))
    setForm(structuredClone(sourceDesktopConfig))
    setSaved(false)
  }, [sourceDesktopConfig, sourceThemeDefault])

  const performFactoryReset = useCallback(async () => {
    if (!factoryResetArmed) {
      setFactoryResetArmed(true)
      if (factoryResetTimer.current) clearTimeout(factoryResetTimer.current)
      factoryResetTimer.current = setTimeout(() => setFactoryResetArmed(false), 3500)
      return
    }
    if (factoryResetTimer.current) clearTimeout(factoryResetTimer.current)
    setFactoryResetArmed(false)
    setSaving(true)
    const currentIds = new Set(config.applications.filter((e) => factorySystemWidgetById.has(e.id)).map((e) => e.id))
    const nextApplications = [
      ...config.applications.map((e) => { const fw = factorySystemWidgetById.get(e.id); return fw ? structuredClone(fw) : e }),
      ...factorySystemWidgets.filter((e) => !currentIds.has(e.id)).map((e) => structuredClone(e)),
    ]
    await saveConfig({
      applications: nextApplications,
      desktopConfig: {
        ...factoryDesktopConfig,
        widgetPositions: undefined,
        widgetSizes: undefined,
        widgetLayouts: structuredClone(DEFAULT_SYSTEM_WIDGET_LAYOUTS),
      },
      scenes: { [STATE.DESKTOP]: { ...config.scenes[STATE.DESKTOP], style: factoryDesktopStyle } },
    } as unknown as Partial<AppConfig>)
    setSaving(false)
    if (savedTimer.current) clearTimeout(savedTimer.current)
    setSaved(true)
    savedTimer.current = setTimeout(() => setSaved(false), 1500)
  }, [config.applications, config.scenes, factoryDesktopConfig, factoryDesktopStyle, factorySystemWidgetById, factorySystemWidgets, saveConfig, factoryResetArmed])

  const clearAllRuntime = useCallback(() => {
    postPreviewConfigPatch(null)
    setRuntimeConfigOverride({})
    socket.emit('runtime:config:override:clear', (err: string | null) => {
      if (err) console.error('[admin] failed to clear runtime overrides', err)
    })
  }, [setRuntimeConfigOverride])

  return (
    <div className="space-y-3">
      <div className="grid gap-4 rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-bg-base)]/40 p-4 lg:grid-cols-2">
        <Button variant="danger" size="sm" onClick={() => { void performFactoryReset() }}
          className="justify-center px-3 py-2 text-[11px] uppercase tracking-[0.16em]">
          {factoryResetArmed ? 'Confirm Factory Reset' : 'Perform Factory Reset'}
        </Button>
        <Button variant="ghost" size="sm" onClick={clearAllRuntime}
          className="justify-center px-3 py-2 text-[11px] uppercase tracking-[0.16em]">
          Clear All Runtime
        </Button>
      </div>
      <div className="space-y-0 pt-3">
        <ConfigPanel title="Desktop Theme" className="mb-4">
          <div className="space-y-4">
            <div className="text-[10px] text-[var(--color-text-muted)] leading-relaxed">
              Theme presets style desktop chrome only. The overlay stays transparent until the desktop Background panel is explicitly set to show wallpaper, gradients, patterns, or video.
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {DESKTOP_THEMES.map((entry) => (
                <ConfigChoiceButton key={entry.id} type="button" selected={theme === entry.id}
                  onClick={() => { setTheme(entry.id); setSaved(false) }}
                  className="min-h-0 flex-col items-start gap-1 px-3 py-2 text-left normal-case">
                  <span className="text-[11px] font-semibold leading-none">{entry.label}</span>
                  <span className="text-[10px] leading-relaxed text-[var(--color-text-muted)]">{entry.description}</span>
                </ConfigChoiceButton>
              ))}
              <ConfigChoiceButton type="button" selected={false}
                onClick={() => { const next = pickRandom(randomDesktopThemes, theme); if (next) { setTheme(next.id); setSaved(false) } }}
                className="min-h-0 flex-col items-start gap-1 px-3 py-2 text-left normal-case">
                <span className="text-[11px] font-semibold leading-none">Random</span>
                <span className="text-[10px] leading-relaxed text-[var(--color-text-muted)]">Pick a desktop theme preset at random, excluding Custom and usually excluding the current pick.</span>
              </ConfigChoiceButton>
            </div>
            <div className="border-t border-[var(--color-border-default)] pt-3">
              <ThemeAppearanceFields appearance={appearance}
                onChange={(updater) => { setAppearance((prev) => { const next = structuredClone(prev); updater(next); return next }); setSaved(false) }}
                helperText="Font, accent, and text color ride on top of the preset so they are visible without turning the desktop background opaque." />
            </div>
          </div>
        </ConfigPanel>
        <ConfigPanel title="Widget Theme" className="mb-4">
          <div className="space-y-4">
            <div className="text-[10px] text-[var(--color-text-muted)] leading-relaxed">
              This is the global widget theme applied to all widgets unless a widget-specific override is enabled in that widget's own configuration panel.
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {WIDGET_SKINS.map((skin) => (
                <ConfigChoiceButton key={skin.id} type="button" selected={widgetTheme.skin === skin.id}
                  onClick={() => { setWidgetTheme(structuredClone(DEFAULT_WIDGET_THEME_PRESETS[skin.id])); setSaved(false) }}
                  className="min-h-0 flex-col items-start gap-1 px-3 py-2 text-left normal-case" title={skin.description}>
                  <span className="text-[11px] font-semibold leading-none">{skin.label}</span>
                  <span className="text-[10px] leading-relaxed text-[var(--color-text-muted)]">{skin.description}</span>
                </ConfigChoiceButton>
              ))}
              <ConfigChoiceButton type="button" selected={false}
                onClick={() => { const next = pickRandom(WIDGET_SKINS, widgetTheme.skin); if (next) { setWidgetTheme(structuredClone(DEFAULT_WIDGET_THEME_PRESETS[next.id])); setSaved(false) } }}
                className="min-h-0 flex-col items-start gap-1 px-3 py-2 text-left normal-case">
                <span className="text-[11px] font-semibold leading-none">Random</span>
                <span className="text-[10px] leading-relaxed text-[var(--color-text-muted)]">Pick a widget skin preset at random and load its baseline palette, motion, and atmosphere profile.</span>
              </ConfigChoiceButton>
            </div>
            <div className="border-t border-[var(--color-border-default)] pt-3">
              <ThemeAppearanceFields appearance={widgetTheme as unknown as ThemeAppearance}
                onChange={(updater) => { setWidgetTheme((prev) => { const next = structuredClone(prev); updater(next as unknown as ThemeAppearance); return next }); setSaved(false) }}
                helperText="Each skin ships with its own baseline palette and font. Use these overrides when you want to tint the skin without switching presets." />
            </div>
          </div>
        </ConfigPanel>
        <ConfigPanel title="Widget Motion" className="mb-4">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-1.5">
              {WIDGET_THEME_ANIMATIONS.map((animation) => (
                <ConfigChoiceButton key={animation.id} type="button" selected={widgetTheme.animation === animation.id}
                  onClick={() => { setWidgetTheme((prev) => ({ ...prev, animation: animation.id })); setSaved(false) }}
                  className="min-h-0 flex-col items-start gap-1 px-3 py-2 text-left normal-case">
                  <span className="text-[11px] font-semibold leading-none">{animation.label}</span>
                  <span className="text-[10px] leading-relaxed text-[var(--color-text-muted)]">{animation.description}</span>
                </ConfigChoiceButton>
              ))}
            </div>
            <div className="mt-2 space-y-1.5">
              <Slider label="Intensity" value={Math.round(widgetTheme.motionIntensity * 100)} min={0} max={300} step={5} unit="%"
                onChange={(value) => { setWidgetTheme((prev) => ({ ...prev, motionIntensity: value / 100 })); setSaved(false) }} />
              <Slider label="Glow" value={Math.round(widgetTheme.glowIntensity * 100)} min={0} max={300} step={5} unit="%"
                onChange={(value) => { setWidgetTheme((prev) => ({ ...prev, glowIntensity: value / 100 })); setSaved(false) }} />
            </div>
            <div className="border-t border-[var(--color-border-default)] pt-3 space-y-2">
              <div className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider">Atmosphere</div>
              <div className="grid grid-cols-2 gap-1.5">
                {WIDGET_THEME_ATMOSPHERES.map((atmosphere) => (
                  <ConfigChoiceButton key={atmosphere.id} type="button" selected={widgetTheme.atmosphere === atmosphere.id}
                    onClick={() => { setWidgetTheme((prev) => ({ ...prev, atmosphere: atmosphere.id })); setSaved(false) }}
                    className="min-h-0 flex-col items-start gap-1 px-3 py-2 text-left normal-case">
                    <span className="text-[11px] font-semibold leading-none">{atmosphere.label}</span>
                    <span className="text-[10px] leading-relaxed text-[var(--color-text-muted)]">{atmosphere.description}</span>
                  </ConfigChoiceButton>
                ))}
              </div>
            </div>
            <div className="border-t border-[var(--color-border-default)] pt-3 space-y-2">
              <div className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider">Chrome</div>
              <div className="space-y-1.5">
                <Slider label="Opacity" value={Math.round(widgetTheme.shellOpacity * 100)} min={10} max={100} step={5} unit="%"
                  onChange={(value) => { setWidgetTheme((prev) => ({ ...prev, shellOpacity: value / 100 })); setSaved(false) }} />
                <Slider label="Shadow" value={Math.round(widgetTheme.shadowIntensity * 100)} min={0} max={300} step={5} unit="%"
                  onChange={(value) => { setWidgetTheme((prev) => ({ ...prev, shadowIntensity: value / 100 })); setSaved(false) }} />
                <Slider label="Radius" value={widgetTheme.borderRadius} min={0} max={32} step={1} unit="px"
                  onChange={(value) => { setWidgetTheme((prev) => ({ ...prev, borderRadius: value })); setSaved(false) }} />
              </div>
            </div>
          </div>
        </ConfigPanel>
        <DesktopConfigSections form={form} update={update} />
      </div>
      <ConfigApplyBar label="Desktop Theme" dirty={dirty} saving={saving} saved={saved} onApply={apply} onReset={reset} alwaysShow />
    </div>
  )
}
