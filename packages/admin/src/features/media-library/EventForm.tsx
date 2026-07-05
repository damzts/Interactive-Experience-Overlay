import { useMemo, useState, type ReactNode } from 'react'
import { DEFAULT_WIDGET_THEME_PRESETS, EFFECT_CATALOG, getEffectLabel, withDesktopConfigDefaults } from '@ieomlabs/shared'
import type {
  DesktopConfig,
  EffectType,
  EventAction,
  EventDesktopTheme,
  EventWidgetThemePatch,
  WidgetThemeConfig,
} from '@ieomlabs/shared'
import { useAdminStore } from '../../store/useAdminStore'
import { SchemaForm } from './SchemaForm'
import {
  DESKTOP_THEMES,
  GOOGLE_FONTS,
  ICON_ANIMATIONS,
  SCREENSAVER_PRESETS,
  WIDGET_SKINS,
  WIDGET_THEME_ANIMATIONS,
  WIDGET_THEME_ATMOSPHERES,
  WIDGET_SHAPES,
} from '../../shared/adminDesktopOptions'
import { Btn, ConfigCard, ConfigChoiceButton, ConfigSectionPanel, HexColorInput, Slider, Toggle } from '../../shared/ui'
import {
  createEffectDraft,
  createEventActionDraft,
  describeEventSetup,
  EFFECT_CATEGORIES,
  EVENT_EFFECT_TYPES,
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

  const SFX_PRESET_IDS = ['startup', 'transition', 'death', 'victory', 'revive', 'glitch', 'dial-up-connect', 'win98-error', 'mmorpg-ding', 'loot', 'level-up-chime'] as const

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
        {renderChainPicker(effectIndex)}
      </div>
    )
  }

  const renderChainPicker = (effectIndex: number) => {
    const effect = def.effects[effectIndex]
    const chain = effect?.chain
    return (
      <div className="mt-3 border-t border-zinc-800/60 pt-3">
        <div className="mb-1 text-[10px] text-zinc-500">Chain another effect</div>
        <div className="flex items-center gap-2">
          <select
            value={chain?.effect.type ?? ''}
            onChange={(event) => {
              const type = event.target.value as EffectType | ''
              updateEffect(effectIndex, (draft) => {
                if (!type) { draft.chain = undefined; return }
                draft.chain = { chance: draft.chain?.chance ?? 0.5, effect: createEffectDraft(type) }
              })
            }}
            className="flex-1 text-xs"
          >
            <option value="">(none)</option>
            {EVENT_EFFECT_TYPES.map((type) => <option key={type} value={type}>{getEffectLabel(type)}</option>)}
          </select>
          {chain && (
            <>
              <input
                type="number" min={0} max={100} step={5}
                value={Math.round(chain.chance * 100)}
                onChange={(event) => updateEffect(effectIndex, (draft) => {
                  if (!draft.chain) return
                  draft.chain = { ...draft.chain, chance: Math.max(0, Math.min(100, Number(event.target.value))) / 100 }
                })}
                className="w-16 text-xs font-mono"
                title="Chance the chained effect fires"
              />
              <span className="text-[10px] text-zinc-600">%</span>
            </>
          )}
        </div>
      </div>
    )
  }

  const updateEffectCfg = (index: number, key: string, value: unknown) => {
    update((draft) => {
      const effect = draft.effects[index]
      if (!effect) return
      ;(effect.cfg as Record<string, unknown>)[key] = value
    })
  }

  // Effect editors are generated from the shared EFFECT_CATALOG field
  // schemas — no per-type editor code. See SchemaForm.
  const renderEffectConfig = (effect: EventDef['effects'][number], index: number) => {
    const fields = EFFECT_CATALOG[effect.type]?.fields ?? []
    if (!fields.length) {
      return (
        <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/55 px-5 py-4 text-[11px] text-zinc-500">
          This effect uses the built-in animation with no extra configuration beyond timing.
        </div>
      )
    }
    return (
      <div className="space-y-4 pl-1">
        <SchemaForm
          fields={fields}
          values={effect.cfg as Record<string, unknown>}
          onChange={(key, value) => updateEffectCfg(index, key, value)}
        />
        {effect.type !== 'audio-sfx' && renderSfxPicker(index, effect.sfx)}
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
              delete draft.shape
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
      <div>
        <div className="mb-1 text-[10px] text-zinc-500">Shape</div>
        <select
          value={theme.shape}
          onChange={(event) => onChange((draft) => { draft.shape = event.target.value as WidgetThemeConfig['shape'] })}
          className="w-full text-xs"
        >
          {WIDGET_SHAPES.map((shape) => (
            <option key={shape.id} value={shape.id}>{shape.label}</option>
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
                      {cat.effects.map((type) => <option key={type} value={type}>{getEffectLabel(type)}</option>)}
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
