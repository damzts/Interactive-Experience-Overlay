import { useMemo, useState, type ReactNode } from 'react'
import { DEFAULT_DESKTOP_NOTIFICATION_DURATION_MS, DEFAULT_WIDGET_THEME_PRESETS, withDesktopConfigDefaults } from '@ieomlabs/shared'
import type {
  AchievementUnlockConfig,
  AudioSfxConfig,
  BlueScreenConfig,
  ChromaticAberrationConfig,
  ConfettiBurstConfig,
  CorruptionBurstConfig,
  DesktopConfig,
  DesktopNotificationEffectConfig,
  DialUpConnectConfig,
  DvdBounceConfig,
  EffectType,
  ErrorDialogConfig,
  EventAction,
  EventDesktopTheme,
  EventWidgetThemePatch,
  FilmBurnConfig,
  FireworksConfig,
  FloatiesConfig,
  FriendJoinConfig,
  ImageOverlayConfig,
  LevelUpConfig,
  NeonGlowConfig,
  NetworkGlitchConfig,
  NotificationBoxConfig,
  PixelTransitionConfig,
  ScanLinesSweepConfig,
  ScreenShakeConfig,
  StaticBurstConfig,
  SystemAlertConfig,
  TerminalToastConfig,
  TvOffConfig,
  TypewriterConfig,
  VhsGlitchConfig,
  VideoOverlayConfig,
  VignettePulseConfig,
  WidgetThemeConfig,
  XpGainConfig,
} from '@ieomlabs/shared'
import { useAdminStore } from '../../store/useAdminStore'
import { AssetSelectionInput } from './AssetLibrary'
import {
  DESKTOP_THEMES,
  GOOGLE_FONTS,
  ICON_ANIMATIONS,
  SCREENSAVER_PRESETS,
  WIDGET_SKINS,
  WIDGET_THEME_ANIMATIONS,
  WIDGET_THEME_ATMOSPHERES,
} from '../../shared/adminDesktopOptions'
import { Btn, ConfigCard, ConfigChoiceButton, ConfigSectionPanel, HexColorInput, Slider, Toggle } from '../../shared/ui'
import {
  createEffectDraft,
  createEventActionDraft,
  describeEventSetup,
  EFFECT_CATEGORIES,
  normalizeDesktopNotificationEffectConfig,
  normalizeEventEffectConfig,
  type EventDef,
} from './eventPresets'

export function EventForm({
  def,
  onUpdate,
  onDelete,
  showOverview = true,
  showDeleteButton = true,
  layout = 'default',
}: {
  def: EventDef
  onUpdate: (d: EventDef) => void
  onDelete?: () => void
  showOverview?: boolean
  showDeleteButton?: boolean
  layout?: 'default' | 'flat-grid'
}) {
  const config = useAdminStore((s) => s.config)
  const desktopConfig = withDesktopConfigDefaults(config.desktopConfig)
  const widgetApps = useMemo(() => config.applications, [config.applications])
  const widgetLayouts = useAdminStore((s) => s.config.widgetLayouts ?? [])
  const [collapsedActionIndexes, setCollapsedActionIndexes] = useState<number[]>([])
  const [collapsedEffectIndexes, setCollapsedEffectIndexes] = useState<number[]>([])
  const normalizedEffects = useMemo(() => def.effects.map((effect) => normalizeEventEffectConfig(effect)), [def.effects])

  const update = (fn: (d: EventDef) => void) => {
    const next: EventDef = {
      ...def,
      auto: { ...def.auto },
      effects: def.effects.map((effect) => structuredClone(normalizeEventEffectConfig(effect))),
      actions: structuredClone(def.actions ?? []),
    }
    fn(next)
    onUpdate(next)
  }

  const updateDesktopNotificationEffect = (index: number, updater: (cfg: DesktopNotificationEffectConfig) => void) => {
    update((draft) => {
      const effect = draft.effects[index]
      if (!effect || effect.type !== 'desktop-notification') return
      const nextCfg = normalizeDesktopNotificationEffectConfig(effect.cfg)
      updater(nextCfg)
      draft.effects[index] = { ...effect, cfg: nextCfg }
    })
  }

  const updateEffect = (index: number, updater: (effect: EventDef['effects'][number]) => void) => {
    update((draft) => {
      const effect = draft.effects[index]
      if (!effect) return
      updater(effect)
    })
  }

  const updateAction = (index: number, updater: (action: EventAction) => void) => {
    update((draft) => {
      const action = draft.actions?.[index]
      if (!action) return
      updater(action)
    })
  }

  const addAction = (kind: EventAction['kind']) => {
    update((draft) => {
      draft.actions = [...(draft.actions ?? []), createEventActionDraft(kind)]
    })
  }

  const addEffect = (type: EffectType) => {
    update((draft) => {
      draft.effects.push(createEffectDraft(type))
    })
  }

  const toggleActionCollapsed = (index: number) => {
    setCollapsedActionIndexes((current) => (
      current.includes(index)
        ? current.filter((entry) => entry !== index)
        : [...current, index]
    ))
  }

  const toggleEffectCollapsed = (index: number) => {
    setCollapsedEffectIndexes((current) => (
      current.includes(index)
        ? current.filter((entry) => entry !== index)
        : [...current, index]
    ))
  }

  const flatGrid = layout === 'flat-grid'

  type WidgetThemeRuntimeDraft = EventWidgetThemePatch
  type WidgetThemeEditorView = Omit<WidgetThemeConfig, 'skin'> & { skin: WidgetThemeConfig['skin'] | 'random' }

  const getThemeEditorView = (themePatch?: WidgetThemeRuntimeDraft | null): WidgetThemeEditorView => {
    const selectedSkin = themePatch?.skin
    const baseSkin = selectedSkin && selectedSkin !== 'random' ? selectedSkin : 'metalheart'
    const { skin: _skin, ...themePatchWithoutSkin } = themePatch ?? {}
    return {
      ...DEFAULT_WIDGET_THEME_PRESETS[baseSkin],
      ...themePatchWithoutSkin,
      skin: selectedSkin ?? baseSkin,
    } as WidgetThemeEditorView
  }

  const wrapGridItem = (children: ReactNode, className = '') => (
    flatGrid ? <div className={`min-w-0 ${className}`.trim()}>{children}</div> : children
  )

  const SFX_PRESET_IDS = ['startup', 'transition', 'death', 'victory', 'revive', 'glitch'] as const

  const renderSfxPicker = (effectIndex: number, currentSfx?: string) => {
    const isCustom = !!currentSfx && !SFX_PRESET_IDS.includes(currentSfx as typeof SFX_PRESET_IDS[number])
    const selectValue = isCustom ? '__custom__' : (currentSfx ?? '')
    return (
      <div className="mt-4 border-t border-zinc-800/60 pt-4">
        <div className="mb-1 text-[10px] text-zinc-500">Paired SFX</div>
        <div className="flex gap-2">
          <select
            value={selectValue}
            onChange={(event) => {
              const val = event.target.value
              updateEffect(effectIndex, (draft) => {
                if (val === '') { draft.sfx = undefined; return }
                if (val !== '__custom__') { draft.sfx = val }
              })
            }}
            className="flex-1 text-xs"
          >
            <option value="">(none)</option>
            {SFX_PRESET_IDS.map(id => <option key={id} value={id}>{id}</option>)}
            <option value="__custom__">Custom URL…</option>
          </select>
          {(selectValue === '__custom__' || isCustom) && (
            <input
              type="text"
              value={isCustom ? currentSfx : ''}
              placeholder="https://... or /assets/sfx/..."
              onChange={(event) => updateEffect(effectIndex, (draft) => { draft.sfx = event.target.value || undefined })}
              className="flex-1 text-xs font-mono"
            />
          )}
        </div>
      </div>
    )
  }

  const renderEffectConfig = (effect: EventDef['effects'][number], index: number) => {
    if (effect.type === 'desktop-notification') {
      const cfg = normalizeDesktopNotificationEffectConfig(effect.cfg)
      return (
        <div className="pl-1">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <div className="mb-1 text-[10px] text-zinc-500">Title</div>
              <input type="text" value={cfg.title} onChange={(event) => updateDesktopNotificationEffect(index, (draft) => { draft.title = event.target.value })} className="w-full text-xs" />
            </div>
            <div className="col-span-2">
              <div className="mb-1 text-[10px] text-zinc-500">Body</div>
              <textarea value={cfg.body} onChange={(event) => updateDesktopNotificationEffect(index, (draft) => { draft.body = event.target.value })} className="min-h-[72px] w-full text-xs" />
            </div>
            <div>
              <div className="mb-1 text-[10px] text-zinc-500">Icon</div>
              <input type="text" value={cfg.icon ?? ''} onChange={(event) => updateDesktopNotificationEffect(index, (draft) => { draft.icon = event.target.value || undefined })} className="w-full text-xs font-mono" />
            </div>
            <Slider label="Duration" value={cfg.durationMs ?? DEFAULT_DESKTOP_NOTIFICATION_DURATION_MS} min={0} max={10000} step={250} unit="ms" onChange={(value) => updateDesktopNotificationEffect(index, (draft) => { draft.durationMs = value || 0 })} />
          </div>
          {renderSfxPicker(index, effect.sfx)}
        </div>
      )
    }

    if (effect.type === 'notification-box') {
      const cfg = effect.cfg as NotificationBoxConfig
      return (
        <div className="pl-1">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="mb-1 text-[10px] text-zinc-500">Title</div>
              <input type="text" value={cfg.title} onChange={(event) => updateEffect(index, (draft) => {
                if (draft.type !== 'notification-box') return
                draft.cfg.title = event.target.value
              })} className="w-full text-xs" />
            </div>
            <div>
              <div className="mb-1 text-[10px] text-zinc-500">Icon</div>
              <input type="text" value={cfg.icon} onChange={(event) => updateEffect(index, (draft) => {
                if (draft.type !== 'notification-box') return
                draft.cfg.icon = event.target.value
              })} className="w-full text-xs font-mono" />
            </div>
            <div className="col-span-2">
              <div className="mb-1 text-[10px] text-zinc-500">Body</div>
              <textarea value={cfg.body} onChange={(event) => updateEffect(index, (draft) => {
                if (draft.type !== 'notification-box') return
                draft.cfg.body = event.target.value
              })} className="min-h-[72px] w-full text-xs" />
            </div>
            <Slider label="Dismiss" value={cfg.autoDismiss} min={0} max={15} step={0.5} unit="s" onChange={(value) => updateEffect(index, (draft) => {
              if (draft.type !== 'notification-box') return
              draft.cfg.autoDismiss = value
            })} />
          </div>
          {renderSfxPicker(index, effect.sfx)}
        </div>
      )
    }

    if (effect.type === 'terminal-toast') {
      const cfg = effect.cfg as TerminalToastConfig
      return (
        <div className="pl-1">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <div className="mb-1 text-[10px] text-zinc-500">Messages</div>
              <textarea value={cfg.messages.join('\n')} onChange={(event) => updateEffect(index, (draft) => {
                if (draft.type !== 'terminal-toast') return
                draft.cfg.messages = event.target.value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
              })} className="min-h-[88px] w-full text-xs font-mono" />
              <div className="mt-1 text-[10px] text-zinc-600">One line per terminal message.</div>
            </div>
            <Slider label="Duration" value={cfg.duration} min={0.5} max={10} step={0.25} unit="s" onChange={(value) => updateEffect(index, (draft) => {
              if (draft.type !== 'terminal-toast') return
              draft.cfg.duration = value
            })} />
            <div>
              <div className="mb-1 text-[10px] text-zinc-500">Position</div>
              <select value={cfg.position} onChange={(event) => updateEffect(index, (draft) => {
                if (draft.type !== 'terminal-toast') return
                draft.cfg.position = event.target.value as TerminalToastConfig['position']
              })} className="w-full text-xs">
                <option value="bottom-left">Bottom left</option>
                <option value="bottom-right">Bottom right</option>
                <option value="top-left">Top left</option>
                <option value="top-right">Top right</option>
              </select>
            </div>
          </div>
          {renderSfxPicker(index, effect.sfx)}
        </div>
      )
    }

    if (effect.type === 'floaties') {
      const cfg = effect.cfg as FloatiesConfig
      return (
        <div className="pl-1">
          <div className="grid grid-cols-3 gap-4">
            <Slider label="Count" value={cfg.count} min={1} max={100} step={1} onChange={(value) => updateEffect(index, (draft) => {
              if (draft.type !== 'floaties') return
              draft.cfg.count = value
            })} />
            <Slider label="Duration" value={cfg.duration} min={0.5} max={10} step={0.25} unit="s" onChange={(value) => updateEffect(index, (draft) => {
              if (draft.type !== 'floaties') return
              draft.cfg.duration = value
            })} />
            <Slider label="Speed" value={cfg.speed} min={0.1} max={5} step={0.1} onChange={(value) => updateEffect(index, (draft) => {
              if (draft.type !== 'floaties') return
              draft.cfg.speed = value
            })} />
          </div>
          {renderSfxPicker(index, effect.sfx)}
        </div>
      )
    }

    if (effect.type === 'corruption-burst') {
      const cfg = effect.cfg as CorruptionBurstConfig
      return (
        <div className="pl-1">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="mb-1 text-[10px] text-zinc-500">Intensity</div>
              <select value={cfg.intensity} onChange={(event) => updateEffect(index, (draft) => {
                if (draft.type !== 'corruption-burst') return
                draft.cfg.intensity = event.target.value as CorruptionBurstConfig['intensity']
              })} className="w-full text-xs">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <Slider label="Duration" value={cfg.duration} min={0.2} max={5} step={0.1} unit="s" onChange={(value) => updateEffect(index, (draft) => {
              if (draft.type !== 'corruption-burst') return
              draft.cfg.duration = value
            })} />
          </div>
          {renderSfxPicker(index, effect.sfx)}
        </div>
      )
    }

    if (effect.type === 'network-glitch') {
      const cfg = effect.cfg as NetworkGlitchConfig
      return (
        <div className="pl-1">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <div className="mb-1 text-[10px] text-zinc-500">Message</div>
              <input type="text" value={cfg.message} onChange={(event) => updateEffect(index, (draft) => {
                if (draft.type !== 'network-glitch') return
                draft.cfg.message = event.target.value
              })} className="w-full text-xs font-mono" />
            </div>
            <Slider label="Duration" value={cfg.duration} min={0.2} max={5} step={0.1} unit="s" onChange={(value) => updateEffect(index, (draft) => {
              if (draft.type !== 'network-glitch') return
              draft.cfg.duration = value
            })} />
          </div>
          {renderSfxPicker(index, effect.sfx)}
        </div>
      )
    }

    if (effect.type === 'vignette-pulse') {
      const cfg = effect.cfg as VignettePulseConfig
      return (
        <div className="pl-1">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="mb-1 text-[10px] text-zinc-500">Color</div>
              <HexColorInput value={cfg.color} onChange={(value) => updateEffect(index, (draft) => {
                if (draft.type !== 'vignette-pulse') return
                draft.cfg.color = value
              })} />
            </div>
            <Slider label="Opacity" value={cfg.opacity} min={0} max={1} step={0.05} onChange={(value) => updateEffect(index, (draft) => {
              if (draft.type !== 'vignette-pulse') return
              draft.cfg.opacity = value
            })} />
            <Slider label="Duration" value={cfg.duration} min={0.2} max={5} step={0.1} unit="s" onChange={(value) => updateEffect(index, (draft) => {
              if (draft.type !== 'vignette-pulse') return
              draft.cfg.duration = value
            })} />
            <div>
              <div className="mb-1 text-[10px] text-zinc-500">Center text</div>
              <input type="text" value={cfg.text} onChange={(event) => updateEffect(index, (draft) => {
                if (draft.type !== 'vignette-pulse') return
                draft.cfg.text = event.target.value
              })} className="w-full text-xs" placeholder="Optional overlay text" />
            </div>
          </div>
          {renderSfxPicker(index, effect.sfx)}
        </div>
      )
    }

    if (effect.type === 'screen-shake') {
      const cfg = effect.cfg as ScreenShakeConfig
      return (
        <div className="pl-1">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="mb-1 text-[10px] text-zinc-500">Intensity</div>
              <select value={cfg.intensity} onChange={(event) => updateEffect(index, (draft) => {
                if (draft.type !== 'screen-shake') return
                draft.cfg.intensity = event.target.value as ScreenShakeConfig['intensity']
              })} className="w-full text-xs">
                <option value="light">Light</option>
                <option value="medium">Medium</option>
                <option value="heavy">Heavy</option>
              </select>
            </div>
            <Slider label="Duration" value={cfg.duration} min={0.1} max={3} step={0.05} unit="s" onChange={(value) => updateEffect(index, (draft) => {
              if (draft.type !== 'screen-shake') return
              draft.cfg.duration = value
            })} />
          </div>
          {renderSfxPicker(index, effect.sfx)}
        </div>
      )
    }

    if (effect.type === 'typewriter') {
      const cfg = effect.cfg as TypewriterConfig
      return (
        <div className="pl-1">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <div className="mb-1 text-[10px] text-zinc-500">Text</div>
              <textarea value={cfg.text} onChange={(event) => updateEffect(index, (draft) => {
                if (draft.type !== 'typewriter') return
                draft.cfg.text = event.target.value
              })} className="min-h-[72px] w-full text-xs font-mono" />
            </div>
            <div>
              <div className="mb-1 text-[10px] text-zinc-500">Position</div>
              <select value={cfg.position} onChange={(event) => updateEffect(index, (draft) => {
                if (draft.type !== 'typewriter') return
                draft.cfg.position = event.target.value as TypewriterConfig['position']
              })} className="w-full text-xs">
                <option value="top">Top</option>
                <option value="center">Center</option>
                <option value="bottom">Bottom</option>
              </select>
            </div>
            <div>
              <div className="mb-1 text-[10px] text-zinc-500">Color</div>
              <HexColorInput value={cfg.color} onChange={(value) => updateEffect(index, (draft) => {
                if (draft.type !== 'typewriter') return
                draft.cfg.color = value
              })} />
            </div>
            <Slider label="Font size" value={cfg.fontSize} min={12} max={128} step={2} unit="px" onChange={(value) => updateEffect(index, (draft) => {
              if (draft.type !== 'typewriter') return
              draft.cfg.fontSize = value
            })} />
            <Slider label="Duration" value={cfg.duration} min={0.5} max={10} step={0.1} unit="s" onChange={(value) => updateEffect(index, (draft) => {
              if (draft.type !== 'typewriter') return
              draft.cfg.duration = value
            })} />
          </div>
          {renderSfxPicker(index, effect.sfx)}
        </div>
      )
    }

    if (effect.type === 'static-burst') {
      const cfg = effect.cfg as StaticBurstConfig
      return (
        <div className="pl-1">
          <div className="grid grid-cols-2 gap-4">
            <Slider label="Opacity" value={cfg.opacity} min={0} max={1} step={0.05} onChange={(value) => updateEffect(index, (draft) => {
              if (draft.type !== 'static-burst') return
              draft.cfg.opacity = value
            })} />
            <Slider label="Duration" value={cfg.duration} min={0.1} max={3} step={0.05} unit="s" onChange={(value) => updateEffect(index, (draft) => {
              if (draft.type !== 'static-burst') return
              draft.cfg.duration = value
            })} />
          </div>
          {renderSfxPicker(index, effect.sfx)}
        </div>
      )
    }

    if (effect.type === 'image-overlay') {
      const cfg = effect.cfg as ImageOverlayConfig
      return (
        <div className="space-y-4 pl-1">
          <div>
            <div className="mb-1 text-[10px] text-zinc-500">Image asset</div>
            <AssetSelectionInput
              value={cfg.src}
              onChange={(value) => updateEffect(index, (draft) => {
                if (draft.type !== 'image-overlay') return
                draft.cfg.src = value
              })}
              kinds={['image']}
              modalTitle="Select image overlay"
              placeholder="/assets/... or https://..."
              buttonLabel="Browse Images"
              hint="Use a transparent PNG or APNG for alert-style graphics."
              previewKind="image"
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="mb-1 text-[10px] text-zinc-500">Width (px)</div>
              <input type="number" min={0} step={1} value={cfg.width ?? ''} onChange={(event) => updateEffect(index, (draft) => {
                if (draft.type !== 'image-overlay') return
                draft.cfg.width = event.target.value === '' ? undefined : Number(event.target.value)
              })} className="w-full font-mono text-xs" />
            </div>
            <div>
              <div className="mb-1 text-[10px] text-zinc-500">Height (px)</div>
              <input type="number" min={0} step={1} value={cfg.height ?? ''} onChange={(event) => updateEffect(index, (draft) => {
                if (draft.type !== 'image-overlay') return
                draft.cfg.height = event.target.value === '' ? undefined : Number(event.target.value)
              })} className="w-full font-mono text-xs" />
            </div>
            <Slider label="Opacity" value={cfg.opacity ?? 1} min={0} max={1} step={0.05} onChange={(value) => updateEffect(index, (draft) => {
              if (draft.type !== 'image-overlay') return
              draft.cfg.opacity = value
            })} />
            <div>
              <div className="mb-1 text-[10px] text-zinc-500">X (px)</div>
              <input type="number" step={1} value={cfg.x ?? ''} onChange={(event) => updateEffect(index, (draft) => {
                if (draft.type !== 'image-overlay') return
                draft.cfg.x = event.target.value === '' ? undefined : Number(event.target.value)
              })} className="w-full font-mono text-xs" />
            </div>
            <div>
              <div className="mb-1 text-[10px] text-zinc-500">Y (px)</div>
              <input type="number" step={1} value={cfg.y ?? ''} onChange={(event) => updateEffect(index, (draft) => {
                if (draft.type !== 'image-overlay') return
                draft.cfg.y = event.target.value === '' ? undefined : Number(event.target.value)
              })} className="w-full font-mono text-xs" />
            </div>
            <Slider label="Duration" value={cfg.duration} min={0.1} max={15} step={0.1} unit="s" onChange={(value) => updateEffect(index, (draft) => {
              if (draft.type !== 'image-overlay') return
              draft.cfg.duration = value
            })} />
          </div>
        </div>
      )
    }

    if (effect.type === 'video-overlay') {
      const cfg = effect.cfg as VideoOverlayConfig
      return (
        <div className="space-y-4 pl-1">
          <div>
            <div className="mb-1 text-[10px] text-zinc-500">Video asset</div>
            <AssetSelectionInput
              value={cfg.src}
              onChange={(value) => updateEffect(index, (draft) => {
                if (draft.type !== 'video-overlay') return
                draft.cfg.src = value
              })}
              kinds={['video']}
              modalTitle="Select video overlay"
              placeholder="/assets/... or https://..."
              buttonLabel="Browse Videos"
              hint="Use WebM or MP4 overlays. Set duration to 0 to play once to the end."
              previewKind="video"
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="mb-1 text-[10px] text-zinc-500">Width (px)</div>
              <input type="number" min={0} step={1} value={cfg.width ?? ''} onChange={(event) => updateEffect(index, (draft) => {
                if (draft.type !== 'video-overlay') return
                draft.cfg.width = event.target.value === '' ? undefined : Number(event.target.value)
              })} className="w-full font-mono text-xs" />
            </div>
            <div>
              <div className="mb-1 text-[10px] text-zinc-500">Height (px)</div>
              <input type="number" min={0} step={1} value={cfg.height ?? ''} onChange={(event) => updateEffect(index, (draft) => {
                if (draft.type !== 'video-overlay') return
                draft.cfg.height = event.target.value === '' ? undefined : Number(event.target.value)
              })} className="w-full font-mono text-xs" />
            </div>
            <Slider label="Opacity" value={cfg.opacity ?? 1} min={0} max={1} step={0.05} onChange={(value) => updateEffect(index, (draft) => {
              if (draft.type !== 'video-overlay') return
              draft.cfg.opacity = value
            })} />
            <div>
              <div className="mb-1 text-[10px] text-zinc-500">X (px)</div>
              <input type="number" step={1} value={cfg.x ?? ''} onChange={(event) => updateEffect(index, (draft) => {
                if (draft.type !== 'video-overlay') return
                draft.cfg.x = event.target.value === '' ? undefined : Number(event.target.value)
              })} className="w-full font-mono text-xs" />
            </div>
            <div>
              <div className="mb-1 text-[10px] text-zinc-500">Y (px)</div>
              <input type="number" step={1} value={cfg.y ?? ''} onChange={(event) => updateEffect(index, (draft) => {
                if (draft.type !== 'video-overlay') return
                draft.cfg.y = event.target.value === '' ? undefined : Number(event.target.value)
              })} className="w-full font-mono text-xs" />
            </div>
            <Slider label="Duration" value={cfg.duration} min={0} max={15} step={0.1} unit="s" onChange={(value) => updateEffect(index, (draft) => {
              if (draft.type !== 'video-overlay') return
              draft.cfg.duration = value
            })} />
          </div>
          <Toggle checked={cfg.loop ?? false} onChange={(value) => updateEffect(index, (draft) => {
            if (draft.type !== 'video-overlay') return
            draft.cfg.loop = value
          })} label="Loop video until effect completes" />
        </div>
      )
    }

    if (effect.type === 'death-overlay' || effect.type === 'victory-overlay' || effect.type === 'revive-overlay') {
      const speed = typeof effect.cfg?.speed === 'number' ? effect.cfg.speed : 1
      const speedPercent = Math.round(speed * 100)
      return (
        <div className="pl-1">
          <Slider label="Speed" value={speedPercent} min={10} max={300} step={10} unit="%" onChange={(value) => updateEffect(index, (draft) => {
            if (draft.type !== 'death-overlay' && draft.type !== 'victory-overlay' && draft.type !== 'revive-overlay') return
            const nextPercent = Math.min(300, Math.max(10, value || 100))
            draft.cfg = { ...draft.cfg, speed: nextPercent / 100 }
          })} />
          {renderSfxPicker(index, effect.sfx)}
        </div>
      )
    }

    // ── New effects ──────────────────────────────────────────────────

    if (effect.type === 'achievement-unlock') {
      const cfg = effect.cfg as AchievementUnlockConfig
      return (
        <div className="space-y-4 pl-1">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <div className="mb-1 text-[10px] text-zinc-500">Title</div>
              <input type="text" value={cfg.title} onChange={(e) => updateEffect(index, (d) => { if (d.type !== 'achievement-unlock') return; d.cfg.title = e.target.value })} className="w-full text-xs" />
            </div>
            <div className="col-span-2">
              <div className="mb-1 text-[10px] text-zinc-500">Description</div>
              <input type="text" value={cfg.description} onChange={(e) => updateEffect(index, (d) => { if (d.type !== 'achievement-unlock') return; d.cfg.description = e.target.value })} className="w-full text-xs" />
            </div>
            <div>
              <div className="mb-1 text-[10px] text-zinc-500">Icon</div>
              <input type="text" value={cfg.icon ?? ''} onChange={(e) => updateEffect(index, (d) => { if (d.type !== 'achievement-unlock') return; d.cfg.icon = e.target.value || undefined })} className="w-full text-xs font-mono" placeholder="🏆" />
            </div>
            <div>
              <div className="mb-1 text-[10px] text-zinc-500">Points</div>
              <input type="number" value={cfg.points ?? ''} min={0} onChange={(e) => updateEffect(index, (d) => { if (d.type !== 'achievement-unlock') return; d.cfg.points = e.target.value === '' ? undefined : Number(e.target.value) })} className="w-full text-xs font-mono" placeholder="10" />
            </div>
            <Slider label="Duration" value={cfg.durationMs ?? 4000} min={1000} max={10000} step={250} unit="ms" onChange={(v) => updateEffect(index, (d) => { if (d.type !== 'achievement-unlock') return; d.cfg.durationMs = v })} />
          </div>
          {renderSfxPicker(index, effect.sfx)}
        </div>
      )
    }

    if (effect.type === 'system-alert') {
      const cfg = effect.cfg as SystemAlertConfig
      return (
        <div className="space-y-4 pl-1">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <div className="mb-1 text-[10px] text-zinc-500">Title</div>
              <input type="text" value={cfg.title} onChange={(e) => updateEffect(index, (d) => { if (d.type !== 'system-alert') return; d.cfg.title = e.target.value })} className="w-full text-xs" />
            </div>
            <div className="col-span-2">
              <div className="mb-1 text-[10px] text-zinc-500">Message</div>
              <textarea value={cfg.message} onChange={(e) => updateEffect(index, (d) => { if (d.type !== 'system-alert') return; d.cfg.message = e.target.value })} className="min-h-[72px] w-full text-xs" />
            </div>
            <Slider label="Duration" value={cfg.durationMs ?? 4000} min={1000} max={10000} step={250} unit="ms" onChange={(v) => updateEffect(index, (d) => { if (d.type !== 'system-alert') return; d.cfg.durationMs = v })} />
          </div>
          {renderSfxPicker(index, effect.sfx)}
        </div>
      )
    }

    if (effect.type === 'error-dialog') {
      const cfg = effect.cfg as ErrorDialogConfig
      return (
        <div className="space-y-4 pl-1">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <div className="mb-1 text-[10px] text-zinc-500">Title</div>
              <input type="text" value={cfg.title} onChange={(e) => updateEffect(index, (d) => { if (d.type !== 'error-dialog') return; d.cfg.title = e.target.value })} className="w-full text-xs" />
            </div>
            <div className="col-span-2">
              <div className="mb-1 text-[10px] text-zinc-500">Message</div>
              <textarea value={cfg.message} onChange={(e) => updateEffect(index, (d) => { if (d.type !== 'error-dialog') return; d.cfg.message = e.target.value })} className="min-h-[72px] w-full text-xs" />
            </div>
            <Slider label="Duration" value={cfg.durationMs ?? 3500} min={1000} max={10000} step={250} unit="ms" onChange={(v) => updateEffect(index, (d) => { if (d.type !== 'error-dialog') return; d.cfg.durationMs = v })} />
          </div>
          {renderSfxPicker(index, effect.sfx)}
        </div>
      )
    }

    if (effect.type === 'friend-join') {
      const cfg = effect.cfg as FriendJoinConfig
      return (
        <div className="space-y-4 pl-1">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <div className="mb-1 text-[10px] text-zinc-500">Username</div>
              <input type="text" value={cfg.username} onChange={(e) => updateEffect(index, (d) => { if (d.type !== 'friend-join') return; d.cfg.username = e.target.value })} className="w-full text-xs font-mono" />
            </div>
            <div className="col-span-2">
              <div className="mb-1 text-[10px] text-zinc-500">Tagline</div>
              <input type="text" value={cfg.tagline ?? ''} onChange={(e) => updateEffect(index, (d) => { if (d.type !== 'friend-join') return; d.cfg.tagline = e.target.value || undefined })} className="w-full text-xs" placeholder="has joined your session" />
            </div>
            <Slider label="Duration" value={cfg.durationMs ?? 3500} min={1000} max={10000} step={250} unit="ms" onChange={(v) => updateEffect(index, (d) => { if (d.type !== 'friend-join') return; d.cfg.durationMs = v })} />
          </div>
          {renderSfxPicker(index, effect.sfx)}
        </div>
      )
    }

    if (effect.type === 'vhs-glitch') {
      const cfg = effect.cfg as VhsGlitchConfig
      return (
        <div className="space-y-4 pl-1">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="mb-1 text-[10px] text-zinc-500">Intensity</div>
              <select value={cfg.intensity} onChange={(e) => updateEffect(index, (d) => { if (d.type !== 'vhs-glitch') return; d.cfg.intensity = e.target.value as VhsGlitchConfig['intensity'] })} className="w-full text-xs">
                <option value="subtle">Subtle</option>
                <option value="moderate">Moderate</option>
                <option value="extreme">Extreme</option>
              </select>
            </div>
            <Slider label="Duration" value={cfg.duration} min={0.5} max={8} step={0.25} unit="s" onChange={(v) => updateEffect(index, (d) => { if (d.type !== 'vhs-glitch') return; d.cfg.duration = v })} />
          </div>
          {renderSfxPicker(index, effect.sfx)}
        </div>
      )
    }

    if (effect.type === 'scan-lines-sweep') {
      const cfg = effect.cfg as ScanLinesSweepConfig
      return (
        <div className="space-y-4 pl-1">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="mb-1 text-[10px] text-zinc-500">Color</div>
              <HexColorInput value={cfg.color ?? '#000000'} onChange={(v) => updateEffect(index, (d) => { if (d.type !== 'scan-lines-sweep') return; d.cfg.color = v })} />
            </div>
            <Slider label="Opacity" value={cfg.opacity ?? 0.15} min={0.05} max={0.6} step={0.05} onChange={(v) => updateEffect(index, (d) => { if (d.type !== 'scan-lines-sweep') return; d.cfg.opacity = v })} />
            <Slider label="Duration" value={cfg.duration} min={0.5} max={6} step={0.25} unit="s" onChange={(v) => updateEffect(index, (d) => { if (d.type !== 'scan-lines-sweep') return; d.cfg.duration = v })} />
          </div>
          {renderSfxPicker(index, effect.sfx)}
        </div>
      )
    }

    if (effect.type === 'neon-glow') {
      const cfg = effect.cfg as NeonGlowConfig
      return (
        <div className="space-y-4 pl-1">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="mb-1 text-[10px] text-zinc-500">Color</div>
              <HexColorInput value={cfg.color ?? '#00ccff'} onChange={(v) => updateEffect(index, (d) => { if (d.type !== 'neon-glow') return; d.cfg.color = v })} />
            </div>
            <div>
              <div className="mb-1 text-[10px] text-zinc-500">Intensity</div>
              <select value={cfg.intensity} onChange={(e) => updateEffect(index, (d) => { if (d.type !== 'neon-glow') return; d.cfg.intensity = e.target.value as NeonGlowConfig['intensity'] })} className="w-full text-xs">
                <option value="soft">Soft</option>
                <option value="medium">Medium</option>
                <option value="intense">Intense</option>
              </select>
            </div>
            <Toggle checked={cfg.rainbow ?? false} onChange={(v) => updateEffect(index, (d) => { if (d.type !== 'neon-glow') return; d.cfg.rainbow = v })} label="Rainbow cycle" />
            <Slider label="Duration" value={cfg.duration} min={0.5} max={10} step={0.25} unit="s" onChange={(v) => updateEffect(index, (d) => { if (d.type !== 'neon-glow') return; d.cfg.duration = v })} />
          </div>
          {renderSfxPicker(index, effect.sfx)}
        </div>
      )
    }

    if (effect.type === 'chromatic-aberration') {
      const cfg = effect.cfg as ChromaticAberrationConfig
      return (
        <div className="space-y-4 pl-1">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="mb-1 text-[10px] text-zinc-500">Intensity</div>
              <select value={cfg.intensity} onChange={(e) => updateEffect(index, (d) => { if (d.type !== 'chromatic-aberration') return; d.cfg.intensity = e.target.value as ChromaticAberrationConfig['intensity'] })} className="w-full text-xs">
                <option value="subtle">Subtle</option>
                <option value="moderate">Moderate</option>
                <option value="extreme">Extreme</option>
              </select>
            </div>
            <Slider label="Duration" value={cfg.duration} min={0.3} max={6} step={0.1} unit="s" onChange={(v) => updateEffect(index, (d) => { if (d.type !== 'chromatic-aberration') return; d.cfg.duration = v })} />
          </div>
          {renderSfxPicker(index, effect.sfx)}
        </div>
      )
    }

    if (effect.type === 'film-burn') {
      const cfg = effect.cfg as FilmBurnConfig
      return (
        <div className="space-y-4 pl-1">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="mb-1 text-[10px] text-zinc-500">Corner origin</div>
              <select value={cfg.corner} onChange={(e) => updateEffect(index, (d) => { if (d.type !== 'film-burn') return; d.cfg.corner = e.target.value as FilmBurnConfig['corner'] })} className="w-full text-xs">
                <option value="tl">Top left</option>
                <option value="tr">Top right</option>
                <option value="bl">Bottom left</option>
                <option value="br">Bottom right</option>
              </select>
            </div>
            <Slider label="Duration" value={cfg.duration} min={0.5} max={6} step={0.25} unit="s" onChange={(v) => updateEffect(index, (d) => { if (d.type !== 'film-burn') return; d.cfg.duration = v })} />
          </div>
          {renderSfxPicker(index, effect.sfx)}
        </div>
      )
    }

    if (effect.type === 'tv-off') {
      const cfg = effect.cfg as TvOffConfig
      return (
        <div className="space-y-4 pl-1">
          <Slider label="Duration" value={cfg.duration ?? 1.2} min={0.5} max={4} step={0.1} unit="s" onChange={(v) => updateEffect(index, (d) => { if (d.type !== 'tv-off') return; d.cfg.duration = v })} />
          {renderSfxPicker(index, effect.sfx)}
        </div>
      )
    }

    if (effect.type === 'blue-screen') {
      const cfg = effect.cfg as BlueScreenConfig
      return (
        <div className="space-y-4 pl-1">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="mb-1 text-[10px] text-zinc-500">Error code</div>
              <input type="text" value={cfg.errorCode ?? ''} onChange={(e) => updateEffect(index, (d) => { if (d.type !== 'blue-screen') return; d.cfg.errorCode = e.target.value || undefined })} className="w-full text-xs font-mono" placeholder="0x0000007E" />
            </div>
            <Slider label="Duration" value={cfg.duration} min={1} max={10} step={0.5} unit="s" onChange={(v) => updateEffect(index, (d) => { if (d.type !== 'blue-screen') return; d.cfg.duration = v })} />
            <div className="col-span-2">
              <div className="mb-1 text-[10px] text-zinc-500">Error params</div>
              <input type="text" value={cfg.message ?? ''} onChange={(e) => updateEffect(index, (d) => { if (d.type !== 'blue-screen') return; d.cfg.message = e.target.value || undefined })} className="w-full text-xs font-mono" placeholder="(0xC0000005, 0xF741B367, ...)" />
            </div>
          </div>
          {renderSfxPicker(index, effect.sfx)}
        </div>
      )
    }

    if (effect.type === 'pixel-transition') {
      const cfg = effect.cfg as PixelTransitionConfig
      return (
        <div className="space-y-4 pl-1">
          <div className="grid grid-cols-2 gap-4">
            <Slider label="Pixel size" value={cfg.pixelSize ?? 20} min={5} max={80} step={5} unit="px" onChange={(v) => updateEffect(index, (d) => { if (d.type !== 'pixel-transition') return; d.cfg.pixelSize = v })} />
            <Slider label="Duration" value={cfg.duration} min={0.5} max={5} step={0.25} unit="s" onChange={(v) => updateEffect(index, (d) => { if (d.type !== 'pixel-transition') return; d.cfg.duration = v })} />
          </div>
          {renderSfxPicker(index, effect.sfx)}
        </div>
      )
    }

    if (effect.type === 'dial-up-connect') {
      const cfg = effect.cfg as DialUpConnectConfig
      return (
        <div className="space-y-4 pl-1">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="mb-1 text-[10px] text-zinc-500">ISP name</div>
              <input type="text" value={cfg.isp ?? ''} onChange={(e) => updateEffect(index, (d) => { if (d.type !== 'dial-up-connect') return; d.cfg.isp = e.target.value || undefined })} className="w-full text-xs" placeholder="NetConnect ISP" />
            </div>
            <div>
              <div className="mb-1 text-[10px] text-zinc-500">Speed</div>
              <input type="text" value={cfg.speed ?? ''} onChange={(e) => updateEffect(index, (d) => { if (d.type !== 'dial-up-connect') return; d.cfg.speed = e.target.value || undefined })} className="w-full text-xs font-mono" placeholder="56k" />
            </div>
            <Slider label="Duration" value={cfg.duration} min={3} max={15} step={0.5} unit="s" onChange={(v) => updateEffect(index, (d) => { if (d.type !== 'dial-up-connect') return; d.cfg.duration = v })} />
          </div>
          {renderSfxPicker(index, effect.sfx)}
        </div>
      )
    }

    if (effect.type === 'confetti-burst') {
      const cfg = effect.cfg as ConfettiBurstConfig
      return (
        <div className="space-y-4 pl-1">
          <div className="grid grid-cols-2 gap-4">
            <Slider label="Count" value={cfg.count ?? 80} min={10} max={200} step={10} onChange={(v) => updateEffect(index, (d) => { if (d.type !== 'confetti-burst') return; d.cfg.count = v })} />
            <Slider label="Duration" value={cfg.duration} min={1} max={8} step={0.25} unit="s" onChange={(v) => updateEffect(index, (d) => { if (d.type !== 'confetti-burst') return; d.cfg.duration = v })} />
          </div>
          {renderSfxPicker(index, effect.sfx)}
        </div>
      )
    }

    if (effect.type === 'xp-gain') {
      const cfg = effect.cfg as XpGainConfig
      return (
        <div className="space-y-4 pl-1">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="mb-1 text-[10px] text-zinc-500">Text</div>
              <input type="text" value={cfg.text} onChange={(e) => updateEffect(index, (d) => { if (d.type !== 'xp-gain') return; d.cfg.text = e.target.value })} className="w-full text-xs font-mono" placeholder="+XP" />
            </div>
            <div>
              <div className="mb-1 text-[10px] text-zinc-500">Color</div>
              <HexColorInput value={cfg.color ?? '#f5c400'} onChange={(v) => updateEffect(index, (d) => { if (d.type !== 'xp-gain') return; d.cfg.color = v })} />
            </div>
            <Slider label="Count" value={cfg.count ?? 5} min={1} max={20} step={1} onChange={(v) => updateEffect(index, (d) => { if (d.type !== 'xp-gain') return; d.cfg.count = v })} />
            <Slider label="Font size" value={cfg.fontSize ?? 36} min={16} max={96} step={4} unit="px" onChange={(v) => updateEffect(index, (d) => { if (d.type !== 'xp-gain') return; d.cfg.fontSize = v })} />
            <Slider label="Duration" value={cfg.duration} min={0.5} max={6} step={0.25} unit="s" onChange={(v) => updateEffect(index, (d) => { if (d.type !== 'xp-gain') return; d.cfg.duration = v })} />
          </div>
          {renderSfxPicker(index, effect.sfx)}
        </div>
      )
    }

    if (effect.type === 'fireworks') {
      const cfg = effect.cfg as FireworksConfig
      return (
        <div className="space-y-4 pl-1">
          <div className="grid grid-cols-2 gap-4">
            <Slider label="Bursts" value={cfg.count ?? 4} min={1} max={12} step={1} onChange={(v) => updateEffect(index, (d) => { if (d.type !== 'fireworks') return; d.cfg.count = v })} />
            <Slider label="Duration" value={cfg.duration} min={1} max={8} step={0.25} unit="s" onChange={(v) => updateEffect(index, (d) => { if (d.type !== 'fireworks') return; d.cfg.duration = v })} />
          </div>
          {renderSfxPicker(index, effect.sfx)}
        </div>
      )
    }

    if (effect.type === 'dvd-bounce') {
      const cfg = effect.cfg as DvdBounceConfig
      return (
        <div className="space-y-4 pl-1">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="mb-1 text-[10px] text-zinc-500">Text</div>
              <input type="text" value={cfg.text ?? ''} onChange={(e) => updateEffect(index, (d) => { if (d.type !== 'dvd-bounce') return; d.cfg.text = e.target.value || undefined })} className="w-full text-xs font-mono" placeholder="DVD" />
            </div>
            <Slider label="Duration" value={cfg.duration} min={3} max={30} step={1} unit="s" onChange={(v) => updateEffect(index, (d) => { if (d.type !== 'dvd-bounce') return; d.cfg.duration = v })} />
          </div>
          {renderSfxPicker(index, effect.sfx)}
        </div>
      )
    }

    if (effect.type === 'level-up') {
      const cfg = effect.cfg as LevelUpConfig
      return (
        <div className="space-y-4 pl-1">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="mb-1 text-[10px] text-zinc-500">Text</div>
              <input type="text" value={cfg.text ?? ''} onChange={(e) => updateEffect(index, (d) => { if (d.type !== 'level-up') return; d.cfg.text = e.target.value || undefined })} className="w-full text-xs font-mono" placeholder="LEVEL UP" />
            </div>
            <div>
              <div className="mb-1 text-[10px] text-zinc-500">Color</div>
              <HexColorInput value={cfg.color ?? '#f5c400'} onChange={(v) => updateEffect(index, (d) => { if (d.type !== 'level-up') return; d.cfg.color = v })} />
            </div>
            <div>
              <div className="mb-1 text-[10px] text-zinc-500">Level number</div>
              <input type="number" value={cfg.level ?? ''} min={1} onChange={(e) => updateEffect(index, (d) => { if (d.type !== 'level-up') return; d.cfg.level = e.target.value === '' ? undefined : Number(e.target.value) })} className="w-full text-xs font-mono" placeholder="optional" />
            </div>
            <Slider label="Duration" value={cfg.duration} min={1} max={6} step={0.25} unit="s" onChange={(v) => updateEffect(index, (d) => { if (d.type !== 'level-up') return; d.cfg.duration = v })} />
          </div>
          {renderSfxPicker(index, effect.sfx)}
        </div>
      )
    }

    if (effect.type === 'audio-sfx') {
      const cfg = effect.cfg as AudioSfxConfig
      return (
        <div className="space-y-4 pl-1">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="mb-1 text-[10px] text-zinc-500">Sound</div>
              <select value={cfg.sfxId} onChange={(e) => updateEffect(index, (d) => { if (d.type !== 'audio-sfx') return; d.cfg.sfxId = e.target.value as AudioSfxConfig['sfxId'] })} className="w-full text-xs">
                <option value="startup">startup</option>
                <option value="transition">transition</option>
                <option value="death">death</option>
                <option value="victory">victory</option>
                <option value="revive">revive</option>
                <option value="glitch">glitch</option>
                <option value="custom">Custom URL…</option>
              </select>
            </div>
            <Slider label="Volume" value={cfg.volume ?? 1} min={0} max={1} step={0.05} onChange={(v) => updateEffect(index, (d) => { if (d.type !== 'audio-sfx') return; d.cfg.volume = v })} />
            {cfg.sfxId === 'custom' && (
              <div className="col-span-2">
                <div className="mb-1 text-[10px] text-zinc-500">Custom URL</div>
                <input type="text" value={cfg.customUrl ?? ''} onChange={(e) => updateEffect(index, (d) => { if (d.type !== 'audio-sfx') return; d.cfg.customUrl = e.target.value || undefined })} className="w-full text-xs font-mono" placeholder="https://... or /assets/sfx/..." />
              </div>
            )}
          </div>
        </div>
      )
    }

    return (
      <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/55 px-5 py-4 text-[11px] text-zinc-500">
        This effect uses the built-in animation with no extra configuration beyond timing.
      </div>
    )
  }

  const renderThemeFields = (themePatch: WidgetThemeRuntimeDraft | undefined, onChange: (updater: (draft: WidgetThemeRuntimeDraft) => void) => void) => {
    const theme = getThemeEditorView(themePatch)

    return (
    <div className="grid grid-cols-2 gap-2 pl-1">
      <div>
        <div className="mb-1 text-[10px] text-zinc-500">Skin</div>
        <select
          value={theme.skin}
          onChange={(event) => onChange((draft) => {
            const nextSkin = event.target.value as WidgetThemeConfig['skin'] | 'random'
            if (nextSkin === 'random') {
              delete draft.fontFamily
              delete draft.accentColor
              delete draft.textColor
              delete draft.animation
              delete draft.atmosphere
              delete draft.motionIntensity
              delete draft.glowIntensity
              draft.skin = 'random'
              return
            }

            Object.assign(draft, structuredClone(DEFAULT_WIDGET_THEME_PRESETS[nextSkin]))
          })}
          className="w-full text-xs"
        >
          <option value="random">Random</option>
          {WIDGET_SKINS.map((skin) => (
            <option key={skin.id} value={skin.id}>{skin.label}</option>
          ))}
        </select>
      </div>
      <div>
        <div className="mb-1 text-[10px] text-zinc-500">Font</div>
        <select
          value={theme.fontFamily}
          onChange={(event) => onChange((draft) => { draft.fontFamily = event.target.value })}
          className="w-full text-xs"
        >
          {GOOGLE_FONTS.map((font) => (
            <option key={font.css} value={font.css}>{font.name}</option>
          ))}
        </select>
      </div>
      <div>
        <div className="mb-1 text-[10px] text-zinc-500">Accent</div>
        <HexColorInput value={theme.accentColor} onChange={(value) => onChange((draft) => { draft.accentColor = value })} />
      </div>
      <div>
        <div className="mb-1 text-[10px] text-zinc-500">Text</div>
        <HexColorInput value={theme.textColor} onChange={(value) => onChange((draft) => { draft.textColor = value })} />
      </div>
      <div>
        <div className="mb-1 text-[10px] text-zinc-500">Animation</div>
        <select
          value={theme.animation}
          onChange={(event) => onChange((draft) => { draft.animation = event.target.value as WidgetThemeConfig['animation'] })}
          className="w-full text-xs"
        >
          {WIDGET_THEME_ANIMATIONS.map((animation) => (
            <option key={animation.id} value={animation.id}>{animation.label}</option>
          ))}
        </select>
      </div>
      <div>
        <div className="mb-1 text-[10px] text-zinc-500">Atmosphere</div>
        <select
          value={theme.atmosphere}
          onChange={(event) => onChange((draft) => { draft.atmosphere = event.target.value as WidgetThemeConfig['atmosphere'] })}
          className="w-full text-xs"
        >
          {WIDGET_THEME_ATMOSPHERES.map((atmosphere) => (
            <option key={atmosphere.id} value={atmosphere.id}>{atmosphere.label}</option>
          ))}
        </select>
      </div>
      <Slider label="Motion" value={theme.motionIntensity} min={0} max={3} step={0.05} onChange={(value) => onChange((draft) => { draft.motionIntensity = value })} />
      <Slider label="Glow" value={theme.glowIntensity} min={0} max={3} step={0.05} onChange={(value) => onChange((draft) => { draft.glowIntensity = value })} />
    </div>
    )
  }

  const identitySection = !def.builtIn ? wrapGridItem(
    <ConfigSectionPanel label="Identity" first>
      <div className="space-y-3">
        <div>
          <div className="mb-1 text-[10px] text-zinc-400">Label</div>
          <input type="text" value={def.label} onChange={(event) => update((draft) => { draft.label = event.target.value })} className="w-full" />
        </div>
        <div>
          <div className="mb-1 text-[10px] text-zinc-400">Icon</div>
          <input type="text" value={def.icon} onChange={(event) => update((draft) => { draft.icon = event.target.value })} className="w-full" placeholder="⚡" />
        </div>
        <div>
          <div className="mb-1 text-[10px] text-zinc-400">Description</div>
          <textarea value={def.desc} onChange={(event) => update((draft) => { draft.desc = event.target.value })} className="min-h-[88px] w-full text-sm" />
        </div>
      </div>
    </ConfigSectionPanel>,
    'xl:col-start-1'
  ) : null


  const runtimeActionsSection = wrapGridItem(
    <ConfigSectionPanel label="Runtime Actions" first>
            <div className="space-y-4">
              <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/50 px-3 py-3">
                <div className="mb-2 text-[10px] uppercase tracking-[0.14em] text-zinc-500">Add Runtime Action</div>
                <select defaultValue="" onChange={(event) => {
                  const kind = event.target.value as EventAction['kind']
                  if (!kind) return
                  event.target.value = ''
                  addAction(kind)
                }} className="w-full text-sm">
                  <option value="">Select action type…</option>
                  <option value="desktop-config">Desktop config</option>
                  <option value="widget-themes">Widget themes</option>
                  <option value="widget-layout">Apply widget layout</option>
                  <option value="widget-command">Widget command</option>
                  <option value="ambiance-patch">Ambiance patch</option>
                </select>
              </div>
              {(def.actions ?? []).length === 0 && <div className="text-[10px] italic text-zinc-600">No runtime actions configured.</div>}
              <div className="grid gap-4 pt-2">
              {(def.actions ?? []).map((action, index) => (
                <div key={`${def.id}-action-${index}`}>
                <div className="space-y-4 rounded-2xl border border-cyan-500/25 bg-cyan-500/5 px-5 py-5 shadow-[0_10px_30px_rgba(0,0,0,0.14),inset_0_1px_0_rgba(255,255,255,0.04)] ring-1 ring-black/15">
                  <div className="flex items-start gap-3 border-b border-zinc-800/80 pb-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] uppercase tracking-[0.14em] text-cyan-300/80">Action {index + 1}</div>
                      <div className="mt-1 font-mono text-xs text-zinc-300">{action.kind}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => toggleActionCollapsed(index)}
                        className="rounded-md border border-zinc-700/80 bg-zinc-900/80 px-2.5 py-1 text-[11px] font-medium text-zinc-300 transition hover:border-zinc-600/80 hover:text-zinc-100"
                      >
                        {collapsedActionIndexes.includes(index) ? 'Expand' : 'Collapse'}
                      </button>
                      <button
                        type="button"
                        onClick={() => update((draft) => { draft.actions?.splice(index, 1) })}
                        className="rounded-md border border-red-500/45 bg-red-500/12 px-2.5 py-1 text-[11px] font-semibold text-red-200 transition hover:border-red-400/60 hover:bg-red-500/20 hover:text-red-50"
                      >
                        Remove Action
                      </button>
                    </div>
                  </div>

                  {!collapsedActionIndexes.includes(index) && action.kind === 'desktop-config' && (
                    <div className="space-y-2">
                      <div className="rounded border border-zinc-800/70 bg-zinc-900/45 px-5 py-4">
                        <Slider label="Revert after" value={action.timeoutSeconds ?? 30} min={5} max={600} step={5} unit="s" onChange={(value) => updateAction(index, (draft) => {
                          if (draft.kind !== 'desktop-config') return
                          draft.timeoutSeconds = value
                        })} />
                      </div>
                      <div className="grid grid-cols-2 gap-2 pl-1">
                        <div>
                          <div className="mb-1 text-[10px] text-zinc-500">Desktop theme</div>
                          <select value={action.patch.theme ?? 'win98'} onChange={(event) => updateAction(index, (draft) => {
                            if (draft.kind !== 'desktop-config') return
                            draft.patch.theme = event.target.value as EventDesktopTheme
                          })} className="w-full text-xs">
                            <option value="random">Random</option>
                            {DESKTOP_THEMES.map((theme) => <option key={theme.id} value={theme.id}>{theme.label}</option>)}
                          </select>
                        </div>
                        <div>
                          <div className="mb-1 text-[10px] text-zinc-500">Icon motion</div>
                          <select value={action.patch.iconAnimation ?? 'none'} onChange={(event) => updateAction(index, (draft) => {
                            if (draft.kind !== 'desktop-config') return
                            draft.patch.iconAnimation = event.target.value as DesktopConfig['iconAnimation']
                          })} className="w-full text-xs">
                            {ICON_ANIMATIONS.map((mode) => <option key={mode.id} value={mode.id}>{mode.label}</option>)}
                          </select>
                        </div>
                        <Slider label="Intensity" value={action.patch.iconMotion ?? 1} min={0} max={3} step={0.05} onChange={(value) => updateAction(index, (draft) => {
                          if (draft.kind !== 'desktop-config') return
                          draft.patch.iconMotion = value
                        })} />
                        <div>
                          <div className="mb-1 text-[10px] text-zinc-500">Screen saver</div>
                          <select value={action.patch.screenSaver?.preset ?? desktopConfig.screenSaver.preset} onChange={(event) => updateAction(index, (draft) => {
                            if (draft.kind !== 'desktop-config') return
                            draft.patch.screenSaver = {
                              enabled: draft.patch.screenSaver?.enabled ?? desktopConfig.screenSaver.enabled,
                              timeoutMinutes: draft.patch.screenSaver?.timeoutMinutes ?? desktopConfig.screenSaver.timeoutMinutes,
                              preset: event.target.value as DesktopConfig['screenSaver']['preset'],
                            }
                          })} className="w-full text-xs">
                            {SCREENSAVER_PRESETS.map((preset) => <option key={preset.id} value={preset.id}>{preset.label}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="rounded border border-zinc-800/70 bg-zinc-900/45 py-2">
                        <div className="px-3 pb-2 text-[10px] uppercase tracking-wider text-zinc-500">Global Widget Theme</div>
                        {renderThemeFields(action.patch.widgetTheme, (updater) => updateAction(index, (draft) => {
                          if (draft.kind !== 'desktop-config') return
                          const nextTheme: EventWidgetThemePatch = { ...(draft.patch.widgetTheme ?? {}) }
                          updater(nextTheme)
                          draft.patch.widgetTheme = nextTheme
                        }))}
                      </div>
                    </div>
                  )}

                  {!collapsedActionIndexes.includes(index) && action.kind === 'widget-themes' && (
                    <div className="space-y-2">
                      <div className="rounded border border-zinc-800/70 bg-zinc-900/45 px-5 py-4">
                        <Slider label="Revert after" value={action.timeoutSeconds ?? 30} min={5} max={600} step={5} unit="s" onChange={(value) => updateAction(index, (draft) => {
                          if (draft.kind !== 'widget-themes') return
                          draft.timeoutSeconds = value
                        })} />
                      </div>
                      <div>
                        <div className="mb-1 text-[10px] text-zinc-500">Target widgets</div>
                        <div className="flex flex-wrap gap-1">
                          {widgetApps.map((app) => {
                            const selected = action.widgetIds.includes(app.id)
                            return (
                              <ConfigChoiceButton key={app.id} type="button" selected={selected} onClick={() => updateAction(index, (draft) => {
                                if (draft.kind !== 'widget-themes') return
                                const next = new Set(draft.widgetIds)
                                if (next.has(app.id)) next.delete(app.id)
                                else next.add(app.id)
                                draft.widgetIds = [...next]
                              })} className="text-[10px]">
                                {app.label}
                              </ConfigChoiceButton>
                            )
                          })}
                        </div>
                      </div>
                      <Toggle checked={action.clearExisting ?? false} onChange={(value) => updateAction(index, (draft) => {
                        if (draft.kind !== 'widget-themes') return
                        draft.clearExisting = value
                      })} label="Reset existing themes first" />
                      <div className="rounded border border-zinc-800/70 bg-zinc-900/45 py-2">
                        <div className="px-3 pb-2 text-[10px] uppercase tracking-wider text-zinc-500">Theme</div>
                        {renderThemeFields(action.theme, (updater) => updateAction(index, (draft) => {
                          if (draft.kind !== 'widget-themes') return
                          const nextTheme: EventWidgetThemePatch = { ...(draft.theme ?? {}) }
                          updater(nextTheme)
                          draft.theme = nextTheme
                        }))}
                      </div>
                    </div>
                  )}

                  {!collapsedActionIndexes.includes(index) && action.kind === 'widget-layout' && (
                    <div className="space-y-2">
                      <div className="rounded border border-zinc-800/70 bg-zinc-900/45 px-5 py-4">
                        <Slider label="Revert after" value={action.timeoutSeconds ?? 30} min={5} max={600} step={5} unit="s" onChange={(value) => updateAction(index, (draft) => {
                          if (draft.kind !== 'widget-layout') return
                          draft.timeoutSeconds = value
                        })} />
                      </div>
                      <div>
                        <div className="mb-1 text-[10px] text-zinc-500">Layout</div>
                        <select value={action.layoutId} onChange={(event) => updateAction(index, (draft) => {
                          if (draft.kind !== 'widget-layout') return
                          draft.layoutId = event.target.value
                        })} className="w-full text-xs">
                          <option value="">Select a layout</option>
                          {widgetLayouts.map((layout) => <option key={layout.id} value={layout.id}>{layout.label}</option>)}
                        </select>
                      </div>
                    </div>
                  )}

                  {!collapsedActionIndexes.includes(index) && action.kind === 'widget-command' && (
                    <div className="grid grid-cols-2 gap-2 pl-1">
                      <div>
                        <div className="mb-1 text-[10px] text-zinc-500">Widget</div>
                        <select value={action.widgetId} onChange={(event) => updateAction(index, (draft) => {
                          if (draft.kind !== 'widget-command') return
                          draft.widgetId = event.target.value
                        })} className="w-full text-xs">
                          {widgetApps.map((app) => <option key={app.id} value={app.id}>{app.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <div className="mb-1 text-[10px] text-zinc-500">Action</div>
                        <select value={action.action} onChange={(event) => updateAction(index, (draft) => {
                          if (draft.kind !== 'widget-command') return
                          draft.action = event.target.value as 'open' | 'close' | 'toggle'
                        })} className="w-full text-xs">
                          <option value="toggle">Toggle</option>
                          <option value="open">Open</option>
                          <option value="close">Close</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {!collapsedActionIndexes.includes(index) && action.kind === 'ambiance-patch' && (
                    <div className="grid grid-cols-2 gap-2 pl-1">
                      <div className="col-span-2 rounded border border-zinc-800/70 bg-zinc-900/45 px-5 py-4">
                        <Slider label="Revert after" value={action.timeoutSeconds ?? 30} min={5} max={600} step={5} unit="s" onChange={(value) => updateAction(index, (draft) => {
                          if (draft.kind !== 'ambiance-patch') return
                          draft.timeoutSeconds = value
                        })} />
                      </div>
                      <div className="col-span-2">
                        <Toggle checked={action.patch.enabled ?? false} onChange={(value) => updateAction(index, (draft) => {
                          if (draft.kind !== 'ambiance-patch') return
                          draft.patch.enabled = value
                        })} label="Ambiance enabled" />
                      </div>
                      <Slider label="Interval" value={action.patch.intervalSeconds ?? 30} min={1} max={120} step={1} unit="s" onChange={(value) => updateAction(index, (draft) => {
                        if (draft.kind !== 'ambiance-patch') return
                        draft.patch.intervalSeconds = value
                      })} />
                      <Slider label="Max open" value={action.patch.maxOpenWidgets ?? 2} min={1} max={8} step={1} onChange={(value) => updateAction(index, (draft) => {
                        if (draft.kind !== 'ambiance-patch') return
                        draft.patch.maxOpenWidgets = value
                      })} />
                      <div className="col-span-2">
                        <Slider label="Open chance" value={action.patch.openWhileOneOpenChance ?? 0.35} min={0} max={1} step={0.05} onChange={(value) => updateAction(index, (draft) => {
                          if (draft.kind !== 'ambiance-patch') return
                          draft.patch.openWhileOneOpenChance = value
                        })} />
                      </div>
                    </div>
                  )}

                  {collapsedActionIndexes.includes(index) && (
                    <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/55 px-5 py-4 text-[11px] text-zinc-500">
                      Configuration hidden. Expand this action to edit its settings.
                    </div>
                  )}
                </div>
                </div>
              ))}
              </div>

            </div>
              </ConfigSectionPanel>,
            'xl:col-start-1'
  )

  const effectsSection = wrapGridItem(
    <ConfigSectionPanel label="Effects" first>
            <div className="space-y-4">
              <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/50 px-3 py-3">
                <div className="mb-2 text-[10px] uppercase tracking-[0.14em] text-zinc-500">Add Effect</div>
                <select defaultValue="" onChange={(event) => {
                  const type = event.target.value as EffectType
                  if (!type) return
                  event.target.value = ''
                  addEffect(type)
                }} className="w-full text-sm">
                  <option value="">Select effect type…</option>
                  {EFFECT_CATEGORIES.map((cat) => (
                    <optgroup key={cat.label} label={cat.label}>
                      {cat.effects.map((type) => <option key={type} value={type}>{type}</option>)}
                    </optgroup>
                  ))}
                </select>
              </div>
              {normalizedEffects.length === 0 && <div className="text-[10px] italic text-zinc-600">No effects configured.</div>}
              <div className="grid gap-4 pt-2">
              {normalizedEffects.map((effect, index) => (
                <div key={`${def.id}-effect-${index}`}>
                <div className="space-y-4 rounded-2xl border border-cyan-500/25 bg-cyan-500/5 px-5 py-5 shadow-[0_10px_30px_rgba(0,0,0,0.14),inset_0_1px_0_rgba(255,255,255,0.04)] ring-1 ring-black/15">
                  <div className="flex items-start gap-3 border-b border-zinc-800/80 pb-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] uppercase tracking-[0.14em] text-cyan-300/80">Effect {index + 1}</div>
                      <div className="mt-1 font-mono text-xs text-zinc-300">{effect.type}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => toggleEffectCollapsed(index)}
                        className="rounded-md border border-zinc-700/80 bg-zinc-900/80 px-2.5 py-1 text-[11px] font-medium text-zinc-300 transition hover:border-zinc-600/80 hover:text-zinc-100"
                      >
                        {collapsedEffectIndexes.includes(index) ? 'Expand' : 'Collapse'}
                      </button>
                      <button
                        type="button"
                        onClick={() => update((draft) => { draft.effects.splice(index, 1) })}
                        className="rounded-md border border-red-500/45 bg-red-500/12 px-2.5 py-1 text-[11px] font-semibold text-red-200 transition hover:border-red-400/60 hover:bg-red-500/20 hover:text-red-50"
                      >
                        Remove Effect
                      </button>
                    </div>
                  </div>

                  {!collapsedEffectIndexes.includes(index) && (
                    <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 px-5 py-4">
                      <Slider label="Delay" value={effect.delay ?? 0} min={0} max={10} step={0.1} unit="s" onChange={(value) => update((draft) => {
                        draft.effects[index] = { ...draft.effects[index], delay: value }
                      })} />
                    </div>
                  )}

                  {!collapsedEffectIndexes.includes(index) && renderEffectConfig(effect, index)}

                  {collapsedEffectIndexes.includes(index) && (
                    <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/55 px-5 py-4 text-[11px] text-zinc-500">
                      Configuration hidden. Expand this effect to edit its settings.
                    </div>
                  )}
                </div>
                </div>
              ))}
              </div>
            </div>
              </ConfigSectionPanel>,
            'xl:col-start-2'
  )

  return (
    <div className="space-y-4">
      {showOverview && (
        <>
          <div className="flex items-center gap-4 rounded-xl border border-zinc-700/60 bg-zinc-800/50 px-4 py-4">
            <span className="text-3xl">{def.icon}</span>
            <div className="min-w-0">
              <div className="text-base font-bold text-zinc-100">{def.label}</div>
              <div className="font-mono text-xs text-zinc-500">{def.id}</div>
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

      {flatGrid ? (
        <div className="grid items-start gap-4 xl:grid-cols-2">
          {identitySection ?? <div className="hidden xl:block" aria-hidden="true" />}
          {runtimeActionsSection}
          {effectsSection}
          {!def.builtIn && showDeleteButton && onDelete && (
            <div className="pt-1 xl:col-span-2">
              <Btn variant="danger" onClick={onDelete} className="w-full py-2.5 text-sm">Delete Event</Btn>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {identitySection && (
            <div className="grid items-start gap-4">
              {identitySection}
            </div>
          )}

          {!def.builtIn && showDeleteButton && onDelete && (
            <div className="pt-1">
              <Btn variant="danger" onClick={onDelete} className="w-full py-2.5 text-sm">Delete Event</Btn>
            </div>
          )}

          <div className="grid items-start gap-4 xl:grid-cols-2">
            {runtimeActionsSection}
            {effectsSection}
          </div>
        </div>
      )}
    </div>
  )
}
