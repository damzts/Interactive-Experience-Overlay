import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  DEFAULT_CONFIG,
  DEFAULT_DESKTOP_CONFIG,
  DEFAULT_SYSTEM_WIDGET_LAYOUTS,
  DEFAULT_WIDGET_THEME_PRESETS,
  STATE,
  withDesktopConfigDefaults,
  withLobbyConfigDefaults,
  withOverlayStyleDefaults,
} from '@ieom/shared'
import type { Application, AppConfig, DesktopConfig, DesktopTheme, LobbyConfig, OverlayStyle, Scene, SourceInstance, WidgetThemeConfig } from '@ieom/shared'
import { socket } from '../../socket/client'
import { useAdminStore } from '../../store/useAdminStore'
import {
  Btn,
  ConfigApplyBar,
  ConfigChoiceButton,
  ConfigSectionPanel,
  isSameDraft,
  Slider,
  Toggle,
} from '../../shared/ui'
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
import { LabeledHexColorRow, ThemeAppearanceFields } from './formAtoms'
const postPreviewConfigPatch = (_patch: unknown) => {} // no-op: embedded preview removed
import { TransitionList, compactTransitionSteps } from './TransitionPicker'
import { StyleSections } from './StyleEditor'
import { SourcesEditor } from './SceneConfig'
import type { ThemeAppearance } from './types'

// ── ScenePanel ────────────────────────────────────────────────────────
// Scene-level config: transitions, sources, style, music.
// Lobby/Desktop specific config lives in LobbyThemeEditor / DesktopThemeEditor.

type ScenePanelDraft = {
  introTransitions: any[]
  exitTransitions:  any[]
  style:            OverlayStyle
  // user scene only
  sources:          SourceInstance[]
  musicTrack:       string
}

function buildScenePanelDraft(
  sceneId: string,
  config: ReturnType<typeof useAdminStore.getState>['config'],
): ScenePanelDraft {
  const scene = config.scenes[sceneId] as (Scene & { introTransitions?: any[]; exitTransitions?: any[] }) | undefined
  const isLobby   = sceneId === STATE.LOBBY
  const isDesktop = sceneId === STATE.DESKTOP
  const linkedApp = !isLobby && !isDesktop
    ? config.applications.find((a) => a.targetSceneId === sceneId)
    : undefined

  return {
    introTransitions: structuredClone(
      isLobby || isDesktop ? (scene?.introTransitions ?? []) : (linkedApp?.introTransitions ?? [])
    ),
    exitTransitions: structuredClone(
      isLobby || isDesktop ? (scene?.exitTransitions ?? []) : (linkedApp?.exitTransitions ?? [])
    ),
    style:      structuredClone(withOverlayStyleDefaults(scene?.style, config.overlayStyle)),
    sources:    structuredClone(scene?.sources ?? []),
    musicTrack: scene?.musicTrack ?? '',
  }
}

export function ScenePanel({ sceneId }: { sceneId: string }) {
  const config        = useAdminStore((s) => s.config)
  const saveConfig    = useAdminStore((s) => s.saveConfig)
  const sourcePresets = config.sourcePresets ?? []

  const isLobby   = sceneId === STATE.LOBBY
  const isDesktop = sceneId === STATE.DESKTOP
  const isUser    = !isLobby && !isDesktop

  const sourceDraft = buildScenePanelDraft(sceneId, config)
  const [draft,  setDraft]  = useState<ScenePanelDraft>(sourceDraft)
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const dirty = !isSameDraft(draft, sourceDraft)

  useEffect(() => {
    setDraft(buildScenePanelDraft(sceneId, config))
    setSaved(false)
  }, [sceneId])

  useEffect(() => () => {
    if (savedTimer.current) clearTimeout(savedTimer.current)
  }, [])

  const update = useCallback((updater: (d: ScenePanelDraft) => void) => {
    setDraft((prev) => { const next = structuredClone(prev); updater(next); return next })
    setSaved(false)
  }, [])

  const apply = useCallback(async () => {
    setSaving(true)
    const scene = config.scenes[sceneId] ?? {}
    const compactIntro = compactTransitionSteps(draft.introTransitions)
    const compactExit  = compactTransitionSteps(draft.exitTransitions)

    if (isLobby) {
      await saveConfig({
        scenes: {
          [STATE.LOBBY]: {
            ...scene,
            style: draft.style,
            introTransitions: compactIntro.length ? compactIntro : undefined,
            exitTransitions:  compactExit.length  ? compactExit  : undefined,
          },
        },
      })
    } else if (isDesktop) {
      await saveConfig({
        scenes: {
          [STATE.DESKTOP]: {
            ...scene,
            style: draft.style,
            introTransitions: compactIntro.length ? compactIntro : undefined,
            exitTransitions:  compactExit.length  ? compactExit  : undefined,
          },
        },
      })
    } else {
      const linkedApp = config.applications.find((a) => a.targetSceneId === sceneId)
      const nextScene: Scene = {
        ...scene as Scene,
        style: draft.style,
        sources: draft.sources,
        musicTrack: draft.musicTrack.trim() || undefined,
      }
      const applications = linkedApp
        ? config.applications.map((a) => a.id === linkedApp.id
            ? {
                ...a,
                introTransitions: compactIntro.length ? compactIntro : undefined,
                exitTransitions:  compactExit.length  ? compactExit  : undefined,
              }
            : a)
        : config.applications
      await saveConfig({ scenes: { [sceneId]: nextScene }, applications })
    }

    setSaving(false)
    if (savedTimer.current) clearTimeout(savedTimer.current)
    setSaved(true)
    savedTimer.current = setTimeout(() => setSaved(false), 1500)
  }, [config, draft, isLobby, isDesktop, sceneId, saveConfig])

  const reset = useCallback(() => {
    setDraft(buildScenePanelDraft(sceneId, config))
    setSaved(false)
  }, [sceneId, config])

  const label = isLobby ? 'Lobby Scene' : isDesktop ? 'Desktop Scene' : 'Scene Configuration'

  return (
    <div className="space-y-3">
      <ConfigApplyBar label={label} dirty={dirty} saving={saving} saved={saved} onApply={apply} onReset={reset} alwaysShow />
      <div className="space-y-0 pt-3">

        <ConfigSectionPanel label="Transitions" first>
          <div className="space-y-3">
            {([
              { key: 'introTransitions' as const, label: 'Intro (entering)' },
              { key: 'exitTransitions'  as const, label: 'Exit (leaving)'   },
            ]).map(({ key, label: tLabel }) => (
              <div key={key}>
                <div className="text-[10px] text-zinc-500 mb-1">{tLabel}</div>
                <TransitionList
                  value={draft[key]}
                  onChange={(steps) => update((d) => { d[key] = steps })}
                />
              </div>
            ))}
          </div>
        </ConfigSectionPanel>

        {isUser && (
          <ConfigSectionPanel label="Sources">
            <SourcesEditor
              sources={draft.sources}
              sourcePresets={sourcePresets}
              onChange={(next) => update((d) => { d.sources = next })}
            />
          </ConfigSectionPanel>
        )}

        <StyleSections
          sceneId={sceneId}
          style={draft.style}
          update={(updater) => update((d) => { updater(d.style) })}
        />

        {isUser && (
          <ConfigSectionPanel label="Background Music">
            <div className="text-[10px] text-zinc-500 mb-2">Loop a music track while this scene is active. Leave blank for silence.</div>
            <input
              type="text"
              placeholder="/assets/audio/music/ambient/track.mp3"
              value={draft.musicTrack}
              onChange={(e) => update((d) => { d.musicTrack = e.target.value })}
              className="w-full font-mono text-xs"
            />
            <div className="text-[10px] text-zinc-600 mt-1">Crossfade: 1.5 s</div>
          </ConfigSectionPanel>
        )}
      </div>
    </div>
  )
}

// ── LobbyThemeEditor ──────────────────────────────────────────────────

export function LobbyThemeEditor() {
  const config     = useAdminStore((s) => s.config)
  const saveConfig = useAdminStore((s) => s.saveConfig)
  const scene      = config.scenes[STATE.LOBBY] as (Scene & { lobbyConfig?: LobbyConfig }) | undefined
  const sourceForm = withLobbyConfigDefaults(scene?.lobbyConfig)

  const [form,   setForm]   = useState<LobbyConfig>(sourceForm)
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const dirty = !isSameDraft(form, sourceForm)

  useEffect(() => {
    setForm(withLobbyConfigDefaults(scene?.lobbyConfig))
    setSaved(false)
  }, [config.scenes])

  useEffect(() => () => {
    if (savedTimer.current) clearTimeout(savedTimer.current)
  }, [])

  const update = useCallback((updater: (d: LobbyConfig) => void) => {
    setForm((prev) => { const next = structuredClone(prev); updater(next); return next })
    setSaved(false)
  }, [])

  const apply = useCallback(async () => {
    setSaving(true)
    await saveConfig({ scenes: { [STATE.LOBBY]: { ...config.scenes[STATE.LOBBY], lobbyConfig: form } } })
    setSaving(false)
    if (savedTimer.current) clearTimeout(savedTimer.current)
    setSaved(true)
    savedTimer.current = setTimeout(() => setSaved(false), 1500)
  }, [config.scenes, form, saveConfig])

  const reset = useCallback(() => {
    setForm(withLobbyConfigDefaults(scene?.lobbyConfig))
    setSaved(false)
  }, [scene])

  return (
    <div className="space-y-3">
      <ConfigApplyBar label="Lobby Global Theme" dirty={dirty} saving={saving} saved={saved} onApply={apply} onReset={reset} alwaysShow />
      <div className="space-y-0 pt-3">
        <LobbyConfigSections form={form} update={update} first />
      </div>
    </div>
  )
}

// ── DesktopThemeEditor ────────────────────────────────────────────────

export function DesktopThemeEditor() {
  const config                 = useAdminStore((s) => s.config)
  const saveConfig             = useAdminStore((s) => s.saveConfig)
  const setRuntimeConfigOverride = useAdminStore((s) => s.setRuntimeConfigOverride)
  const desktopScene           = config.scenes[STATE.DESKTOP]
  const sourceDesktopConfig    = useMemo(() => withDesktopConfigDefaults(config.desktopConfig), [config.desktopConfig])
  const sourceStyle            = useMemo(
    () => structuredClone(withOverlayStyleDefaults((desktopScene as { style?: OverlayStyle } | undefined)?.style, config.overlayStyle)),
    [desktopScene, config.overlayStyle],
  )
  const sourceThemeDefault     = sourceDesktopConfig.globalThemeDefault
  const randomDesktopThemes    = useMemo(() => DESKTOP_THEMES.filter((e) => e.id !== 'custom'), [])
  const factoryDesktopConfig   = useMemo(() => structuredClone(withDesktopConfigDefaults(DEFAULT_CONFIG.desktopConfig)), [])
  const factoryDesktopStyle    = useMemo(
    () => structuredClone(withOverlayStyleDefaults((DEFAULT_CONFIG.scenes[STATE.DESKTOP] as { style?: OverlayStyle } | undefined)?.style, DEFAULT_CONFIG.overlayStyle)),
    [],
  )
  const factorySystemWidgets   = useMemo(
    () => DEFAULT_CONFIG.applications
      .filter((e): e is Application => e.appType === 'widget' && e.widgetSource === 'system')
      .map((e) => structuredClone(e)),
    [],
  )
  const factorySystemWidgetById = useMemo(
    () => new Map(factorySystemWidgets.map((e) => [e.id, e] as const)),
    [factorySystemWidgets],
  )

  const [theme, setTheme]             = useState<DesktopTheme>(() => sourceThemeDefault.theme)
  const [appearance, setAppearance]   = useState<ThemeAppearance>(() => structuredClone(sourceThemeDefault.appearance))
  const [widgetTheme, setWidgetTheme] = useState<WidgetThemeConfig>(() => structuredClone(sourceThemeDefault.widgetTheme))
  const [form, setForm]               = useState<DesktopConfig>(() => structuredClone(sourceDesktopConfig))
  const [saving, setSaving]           = useState(false)
  const [saved,  setSaved]            = useState(false)
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
      <ConfigApplyBar label="Desktop Theme" dirty={dirty} saving={saving} saved={saved} onApply={apply} onReset={reset} alwaysShow />
      <div className="grid gap-4 rounded-2xl border border-zinc-800/80 bg-zinc-950/40 p-4 lg:grid-cols-2">
        <Btn type="button" variant="warning" onClick={() => { void performFactoryReset() }}
          className="justify-center px-3 py-2 text-[11px] uppercase tracking-[0.16em]">
          {factoryResetArmed ? 'Confirm Factory Reset' : 'Perform Factory Reset'}
        </Btn>
        <Btn type="button" variant="ghost" onClick={clearAllRuntime}
          className="justify-center px-3 py-2 text-[11px] uppercase tracking-[0.16em]">
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
                onClick={() => { const next = pickRandom(randomDesktopThemes, theme); if (next) { setTheme(next.id); setSaved(false) } }}
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
                onClick={() => { const next = pickRandom(WIDGET_SKINS, widgetTheme.skin); if (next) { setWidgetTheme(structuredClone(DEFAULT_WIDGET_THEME_PRESETS[next.id])); setSaved(false) } }}
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
            <div className="grid grid-cols-2 gap-1.5">
              {WIDGET_THEME_ANIMATIONS.map((animation) => (
                <ConfigChoiceButton key={animation.id} type="button" selected={widgetTheme.animation === animation.id}
                  onClick={() => { setWidgetTheme((prev) => ({ ...prev, animation: animation.id })); setSaved(false) }}
                  className="min-h-0 flex-col items-start gap-1 px-3 py-2 text-left normal-case">
                  <span className="text-[11px] font-semibold leading-none">{animation.label}</span>
                  <span className="text-[10px] leading-relaxed text-zinc-500">{animation.description}</span>
                </ConfigChoiceButton>
              ))}
            </div>
            <div className="mt-2 space-y-1.5">
              <Slider label="Intensity" value={Math.round(widgetTheme.motionIntensity * 100)} min={0} max={300} step={5} unit="%"
                onChange={(value) => { setWidgetTheme((prev) => ({ ...prev, motionIntensity: value / 100 })); setSaved(false) }} />
              <Slider label="Glow" value={Math.round(widgetTheme.glowIntensity * 100)} min={0} max={300} step={5} unit="%"
                onChange={(value) => { setWidgetTheme((prev) => ({ ...prev, glowIntensity: value / 100 })); setSaved(false) }} />
            </div>
            <div className="border-t border-zinc-800 pt-3 space-y-2">
              <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Atmosphere</div>
              <div className="grid grid-cols-2 gap-1.5">
                {WIDGET_THEME_ATMOSPHERES.map((atmosphere) => (
                  <ConfigChoiceButton key={atmosphere.id} type="button" selected={widgetTheme.atmosphere === atmosphere.id}
                    onClick={() => { setWidgetTheme((prev) => ({ ...prev, atmosphere: atmosphere.id })); setSaved(false) }}
                    className="min-h-0 flex-col items-start gap-1 px-3 py-2 text-left normal-case">
                    <span className="text-[11px] font-semibold leading-none">{atmosphere.label}</span>
                    <span className="text-[10px] leading-relaxed text-zinc-500">{atmosphere.description}</span>
                  </ConfigChoiceButton>
                ))}
              </div>
            </div>
            <div className="border-t border-zinc-800 pt-3 space-y-2">
              <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Chrome</div>
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
        </ConfigSectionPanel>
        <DesktopConfigSections form={form} update={update} />
      </div>
    </div>
  )
}

// ── LobbyConfigSections ───────────────────────────────────────────────

function LobbyConfigSections({ form, update, first }: {
  form: LobbyConfig
  update: (updater: (d: LobbyConfig) => void) => void
  first?: boolean
}) {
  return (
    <>
      <ConfigSectionPanel label="Ambient Light" first={first}>
        <LabeledHexColorRow label="" value={form.ambientColor} onChange={(v) => update((d) => { d.ambientColor = v })} />
        <Slider label="Intensity" value={form.ambientIntensity} min={0} max={2} step={0.01} onChange={(v) => update((d) => { d.ambientIntensity = v })} />
      </ConfigSectionPanel>
      <ConfigSectionPanel label="Fog">
        <LabeledHexColorRow label="" value={form.fogColor} onChange={(v) => update((d) => { d.fogColor = v })} />
        <Slider label="Near" value={form.fogNear} min={1} max={20} step={0.5} onChange={(v) => update((d) => { d.fogNear = v })} />
        <Slider label="Far"  value={form.fogFar}  min={5} max={60} step={1}   onChange={(v) => update((d) => { d.fogFar  = v })} />
      </ConfigSectionPanel>
      <ConfigSectionPanel label="World">
        <LabeledHexColorRow label="Sky Top" value={form.skyTopColor}     onChange={(v) => update((d) => { d.skyTopColor     = v })} />
        <LabeledHexColorRow label="Horizon" value={form.skyHorizonColor} onChange={(v) => update((d) => { d.skyHorizonColor = v })} />
        <LabeledHexColorRow label="Floor"   value={form.floorColor}      onChange={(v) => update((d) => { d.floorColor      = v })} />
        <Slider label="Reflectivity" value={form.floorReflectivity} min={0} max={1} step={0.05} onChange={(v) => update((d) => { d.floorReflectivity = v })} />
      </ConfigSectionPanel>
      <ConfigSectionPanel label="CRT Glow">
        <LabeledHexColorRow label="" value={form.crtGlowColor} onChange={(v) => update((d) => { d.crtGlowColor = v })} />
      </ConfigSectionPanel>
      <ConfigSectionPanel label="Atmosphere">
        <Toggle checked={form.dustMotes} onChange={(v) => update((d) => { d.dustMotes = v })} label="Dust motes" />
        <div className="mt-2 space-y-1">
          <Slider label="Camera FOV" value={form.cameraFov}  min={30}  max={120}  step={1}  onChange={(v) => update((d) => { d.cameraFov  = v })} />
          <Slider label="Stars"      value={form.starsCount} min={0}   max={2000} step={50} onChange={(v) => update((d) => { d.starsCount = v })} />
        </div>
      </ConfigSectionPanel>
      <ConfigSectionPanel label="Room Life">
        <div className="space-y-3">
          <div>
            <Toggle checked={form.virtualPet.enabled} onChange={(v) => update((d) => { d.virtualPet.enabled = v })} label="Virtual pet" />
            {form.virtualPet.enabled && (
              <div className="mt-2 space-y-1">
                <LabeledHexColorRow label="Body"  value={form.virtualPet.color}          onChange={(v) => update((d) => { d.virtualPet.color          = v })} />
                <LabeledHexColorRow label="Charm" value={form.virtualPet.accessoryColor} onChange={(v) => update((d) => { d.virtualPet.accessoryColor = v })} />
              </div>
            )}
          </div>
          <div>
            <Toggle checked={form.lavaLamp.enabled} onChange={(v) => update((d) => { d.lavaLamp.enabled = v })} label="Lava lamp" />
            {form.lavaLamp.enabled && (
              <div className="mt-2 space-y-1">
                <LabeledHexColorRow label="Glass" value={form.lavaLamp.glassColor}  onChange={(v) => update((d) => { d.lavaLamp.glassColor  = v })} />
                <LabeledHexColorRow label="Wax"   value={form.lavaLamp.liquidColor} onChange={(v) => update((d) => { d.lavaLamp.liquidColor = v })} />
                <LabeledHexColorRow label="Glow"  value={form.lavaLamp.glowColor}   onChange={(v) => update((d) => { d.lavaLamp.glowColor   = v })} />
              </div>
            )}
          </div>
          <div>
            <Toggle checked={form.fishTank.enabled} onChange={(v) => update((d) => { d.fishTank.enabled = v })} label="Fish tank" />
            {form.fishTank.enabled && (
              <div className="mt-2 space-y-1">
                <LabeledHexColorRow label="Glass" value={form.fishTank.glassColor} onChange={(v) => update((d) => { d.fishTank.glassColor = v })} />
                <LabeledHexColorRow label="Water" value={form.fishTank.waterColor} onChange={(v) => update((d) => { d.fishTank.waterColor = v })} />
                <LabeledHexColorRow label="Fish"  value={form.fishTank.fishColor}  onChange={(v) => update((d) => { d.fishTank.fishColor  = v })} />
                <Slider label="Count" value={form.fishTank.fishCount} min={1} max={8} step={1} onChange={(v) => update((d) => { d.fishTank.fishCount = v })} />
              </div>
            )}
          </div>
        </div>
      </ConfigSectionPanel>
    </>
  )
}

// ── DesktopConfigSections ─────────────────────────────────────────────

function DesktopConfigSections({ form, update, first }: {
  form: DesktopConfig
  update: (updater: (d: DesktopConfig) => void) => void
  first?: boolean
}) {
  return (
    <>
      <ConfigSectionPanel label="Desktop Icons" first={first}>
        <div className="space-y-3">
          <div>
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Icons</div>
            <div className="text-[10px] text-zinc-500 leading-relaxed">
              Turn off auto-arrange to drag icons directly on the desktop. Manual dragging saves each application icon position for you.
            </div>
          </div>
          <Slider label="Size" value={iconSizeToSliderValue(form.defaultIconSize)} min={0} max={2} step={1}
            onChange={(value) => update((d) => { d.defaultIconSize = sliderValueToIconSize(value) })} />
          <div className="text-[10px] text-zinc-500 -mt-1 pl-[7rem]">Current default: {labelizeIconSize(form.defaultIconSize)}</div>
          <Toggle checked={form.autoArrangeIcons} onChange={(v) => update((d) => { d.autoArrangeIcons = v })} label="Auto-arrange icons" />
          <div>
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5">Ambient motion</div>
            <div className="grid grid-cols-2 gap-1.5">
              {ICON_ANIMATIONS.map((mode) => (
                <ConfigChoiceButton key={mode.id} type="button" selected={form.iconAnimation === mode.id}
                  onClick={() => update((d) => { d.iconAnimation = mode.id })}
                  className="min-h-0 flex-col items-start gap-1 px-3 py-2 text-left normal-case">
                  <span className="text-[11px] font-semibold leading-none">{mode.label}</span>
                  <span className="text-[10px] leading-relaxed text-zinc-500">{mode.description}</span>
                </ConfigChoiceButton>
              ))}
            </div>
            <div className="mt-2">
              <Slider label="Motion" value={Math.round(form.iconMotion * 100)} min={0} max={300} step={5} unit="%"
                onChange={(value) => update((d) => { d.iconMotion = value / 100 })} />
            </div>
          </div>
          <div>
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5">Arrangement</div>
            <div className="grid grid-cols-2 gap-1.5">
              {ICON_ARRANGEMENTS.map((arr) => (
                <ConfigChoiceButton key={arr.id} type="button" selected={(form.iconArrangement ?? 'grid') === arr.id}
                  onClick={() => update((d) => { d.iconArrangement = arr.id })}
                  className="min-h-0 flex-col items-start gap-1 px-3 py-2 text-left normal-case">
                  <span className="text-[11px] font-semibold leading-none">{arr.label}</span>
                  <span className="text-[10px] leading-relaxed text-zinc-500">{arr.description}</span>
                </ConfigChoiceButton>
              ))}
            </div>
            <div className="mt-2">
              <Slider label="Motion" value={Math.round((form.iconArrangementMotion ?? 1) * 100)} min={0} max={300} step={5} unit="%"
                onChange={(value) => update((d) => { d.iconArrangementMotion = value / 100 })} />
            </div>
          </div>
        </div>
      </ConfigSectionPanel>
      <ConfigSectionPanel label="Screen Saver">
        <Toggle checked={form.screenSaver.enabled} onChange={(v) => update((d) => { d.screenSaver.enabled = v })} label="Enable" />
        {form.screenSaver.enabled && (
          <div className="mt-2 grid gap-2 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-end">
            <div>
              <div className="text-[10px] text-zinc-500 mb-1">Idle timeout (min)</div>
              <input type="number" min={1} max={60} value={form.screenSaver.timeoutMinutes}
                onChange={(e) => update((d) => { d.screenSaver.timeoutMinutes = Number(e.target.value) })}
                className="w-20 font-mono text-xs" />
            </div>
            <div>
              <div className="text-[10px] text-zinc-500 mb-1">Preset</div>
              <select value={form.screenSaver.preset}
                onChange={(e) => update((d) => { d.screenSaver.preset = e.target.value as DesktopConfig['screenSaver']['preset'] })}
                className="w-full text-xs">
                {SCREENSAVER_PRESETS.map((preset) => <option key={preset.id} value={preset.id}>{preset.label}</option>)}
              </select>
            </div>
            <button onClick={() => socket.emit('desktop:screen-saver:test', { preset: form.screenSaver.preset })}
              className="rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 hover:text-zinc-100 sm:self-end">
              Test
            </button>
          </div>
        )}
      </ConfigSectionPanel>
      <ConfigSectionPanel label="System Sounds">
        <div className="text-[10px] text-zinc-500 mb-2">Relative to <span className="font-mono text-zinc-400">assets/sfx/system/</span></div>
        {(['startup', 'error', 'notify', 'click', 'close'] as const).map((key) => (
          <div key={key} className="flex items-center gap-2 mb-1.5">
            <label className="text-[11px] text-zinc-400 w-12 shrink-0 capitalize">{key}</label>
            <input type="text" value={form.systemSounds[key]}
              onChange={(e) => update((d) => { d.systemSounds[key] = e.target.value })}
              placeholder={key + '.wav'} className="flex-1 font-mono text-[11px]" />
          </div>
        ))}
      </ConfigSectionPanel>
    </>
  )
}
