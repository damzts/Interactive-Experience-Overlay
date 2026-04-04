import { useMemo } from 'react'
import { DEFAULT_DESKTOP_NOTIFICATION_DURATION_MS, DEFAULT_WIDGET_THEME_PRESETS, STATE, withDesktopConfigDefaults } from '@ieom/shared'
import type { DesktopConfig, DesktopNotificationEffectConfig, EffectType, EventAction, WidgetThemeConfig } from '@ieom/shared'
import { useAdminStore } from '../../store/useAdminStore'
import {
  DESKTOP_THEMES,
  GOOGLE_FONTS,
  ICON_ANIMATIONS,
  SCREENSAVER_PRESETS,
  WIDGET_SKINS,
  WIDGET_THEME_ANIMATIONS,
  WIDGET_THEME_ATMOSPHERES,
} from '../adminDesktopOptions'
import { Btn, ConfigCard, ConfigChoiceButton, ConfigSectionPanel, HexColorInput, Slider, Toggle } from '../ui'
import {
  COMMON_EVENT_ACTION_KINDS,
  COMMON_EVENT_EFFECT_TYPES,
  createEffectDraft,
  createEventActionDraft,
  describeEventSetup,
  EVENT_EFFECT_TYPES,
  getEventActionLabel,
  normalizeDesktopNotificationEffectConfig,
  type EventDef,
} from './eventPresets'

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
  const config = useAdminStore((s) => s.config)
  const desktopConfig = withDesktopConfigDefaults(config.desktopConfig)
  const widgetApps = useMemo(() => config.applications.filter((app) => app.appType === 'widget'), [config.applications])
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
    update((draft) => {
      const effect = draft.effects[index]
      if (!effect || effect.type !== 'desktop-notification') return
      const nextCfg = normalizeDesktopNotificationEffectConfig(effect.cfg)
      updater(nextCfg)
      draft.effects[index] = { ...effect, cfg: nextCfg }
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

  const renderThemeFields = (theme: WidgetThemeConfig, onChange: (updater: (draft: WidgetThemeConfig) => void) => void) => (
    <div className="grid grid-cols-2 gap-2 pl-1">
      <div>
        <div className="mb-1 text-[10px] text-zinc-500">Skin</div>
        <select
          value={theme.skin}
          onChange={(event) => onChange((draft) => Object.assign(draft, structuredClone(DEFAULT_WIDGET_THEME_PRESETS[event.target.value as keyof typeof DEFAULT_WIDGET_THEME_PRESETS])))}
          className="w-full text-xs"
        >
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
        <div className="mb-1 text-[10px] text-zinc-500">Motion</div>
        <input
          type="number"
          min={0}
          max={3}
          step={0.05}
          value={theme.motionIntensity}
          onChange={(event) => onChange((draft) => { draft.motionIntensity = Number(event.target.value) })}
          className="w-full font-mono text-xs"
        />
      </div>
      <div>
        <div className="mb-1 text-[10px] text-zinc-500">Glow</div>
        <input
          type="number"
          min={0}
          max={3}
          step={0.05}
          value={theme.glowIntensity}
          onChange={(event) => onChange((draft) => { draft.glowIntensity = Number(event.target.value) })}
          className="w-full font-mono text-xs"
        />
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

      <div className="grid items-start gap-4 grid-cols-[280px_minmax(0,1fr)]">
        <div className="sticky top-0 space-y-0">
          {!def.builtIn && (
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
            </ConfigSectionPanel>
          )}

          <ConfigSectionPanel label="Trigger" first={def.builtIn}>
            <Toggle checked={def.auto.enabled} onChange={(value) => update((draft) => { draft.auto.enabled = value })} label="Enable auto-trigger" />
            {def.auto.enabled && (
              <div className="mt-3 space-y-3">
                <div>
                  <div className="mb-1 text-[10px] text-zinc-400">Mode</div>
                  <div className="flex gap-2">
                    {(['interval', 'idle'] as const).map((mode) => (
                      <ConfigChoiceButton key={mode} type="button" selected={def.auto.mode === mode} onClick={() => update((draft) => { draft.auto.mode = mode })} className="flex-1 py-2 text-sm">
                        {mode}
                      </ConfigChoiceButton>
                    ))}
                  </div>
                </div>
                {def.auto.mode === 'interval' && (
                  <Slider label="Avg every" value={def.auto.intervalMin} min={1} max={60} step={1} unit="min" onChange={(value) => update((draft) => { draft.auto.intervalMin = value })} />
                )}
                {def.auto.mode === 'idle' && (
                  <Slider label="After idle" value={def.auto.idleMin} min={1} max={30} step={1} unit="min" onChange={(value) => update((draft) => { draft.auto.idleMin = value })} />
                )}
                <Slider label="Chance" value={Math.round(def.auto.chance * 100)} min={0} max={100} step={5} unit="%" onChange={(value) => update((draft) => { draft.auto.chance = value / 100 })} />
                <Slider label="Cooldown" value={def.auto.cooldownMin} min={0} max={120} step={1} unit="min" onChange={(value) => update((draft) => { draft.auto.cooldownMin = value })} />
                <div>
                  <div className="mb-1 text-[10px] text-zinc-400">Allowed states</div>
                  <div className="flex gap-2">
                    {[STATE.DESKTOP, STATE.LOBBY].map((stateId) => {
                      const selected = (def.auto.allowedStates ?? []).includes(stateId)
                      return (
                        <ConfigChoiceButton
                          key={stateId}
                          type="button"
                          selected={selected}
                          onClick={() => update((draft) => {
                            const next = new Set(draft.auto.allowedStates ?? [])
                            if (next.has(stateId)) next.delete(stateId)
                            else next.add(stateId)
                            draft.auto.allowedStates = next.size ? [...next] : undefined
                          })}
                          className="flex-1 py-2 text-sm"
                        >
                          {stateId}
                        </ConfigChoiceButton>
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
                  <button
                    key={kind}
                    type="button"
                    onClick={() => addAction(kind)}
                    className="rounded-full border border-zinc-700/70 bg-zinc-950/60 px-3 py-1.5 text-[11px] font-semibold text-zinc-300 transition hover:border-cyan-400/35 hover:text-cyan-200"
                  >
                    + {getEventActionLabel(kind)}
                  </button>
                ))}
              </div>
              {(def.actions ?? []).length === 0 && <div className="text-[10px] italic text-zinc-600">No runtime actions configured.</div>}
              {(def.actions ?? []).map((action, index) => (
                <div key={`${def.id}-action-${index}`} className="space-y-3 rounded-xl border border-zinc-800/70 bg-zinc-950/45 px-4 py-4">
                  <div className="flex items-center gap-3">
                    <span className="flex-1 font-mono text-xs text-zinc-300">{action.kind}</span>
                    <button
                      type="button"
                      onClick={() => update((draft) => { draft.actions?.splice(index, 1) })}
                      className="rounded-md px-2 py-1 text-[11px] text-red-400 transition hover:bg-red-500/10 hover:text-red-200"
                    >
                      Remove
                    </button>
                  </div>

                  {action.kind === 'desktop-config' && (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2 pl-1">
                        <div>
                          <div className="mb-1 text-[10px] text-zinc-500">Desktop theme</div>
                          <select value={action.patch.theme ?? 'win98'} onChange={(event) => updateAction(index, (draft) => {
                            if (draft.kind !== 'desktop-config') return
                            draft.patch.theme = event.target.value as DesktopConfig['theme']
                          })} className="w-full text-xs">
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
                        <div>
                          <div className="mb-1 text-[10px] text-zinc-500">Icon intensity</div>
                          <input type="number" min={0} max={3} step={0.05} value={action.patch.iconMotion ?? 1} onChange={(event) => updateAction(index, (draft) => {
                            if (draft.kind !== 'desktop-config') return
                            draft.patch.iconMotion = Number(event.target.value)
                          })} className="w-full font-mono text-xs" />
                        </div>
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
                        <div className="mb-1 text-[10px] text-zinc-500">Target widgets</div>
                        <div className="flex flex-wrap gap-1">
                          {widgetApps.map((app) => {
                            const selected = action.widgetIds.includes(app.id)
                            return (
                              <ConfigChoiceButton key={app.id} type="button" selected={selected} onClick={() => updateAction(index, (draft) => {
                                if (draft.kind !== 'widget-theme-overrides') return
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
                        if (draft.kind !== 'widget-theme-overrides') return
                        draft.clearExisting = value
                      })} label="Reset existing overrides first" />
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
                  )}

                  {action.kind === 'widget-command' && (
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

                  {action.kind === 'ambiance-patch' && (
                    <div className="grid grid-cols-2 gap-2 pl-1">
                      <div className="col-span-2">
                        <Toggle checked={action.patch.enabled ?? false} onChange={(value) => updateAction(index, (draft) => {
                          if (draft.kind !== 'ambiance-patch') return
                          draft.patch.enabled = value
                        })} label="Ambiance enabled" />
                      </div>
                      <div>
                        <div className="mb-1 text-[10px] text-zinc-500">Interval (s)</div>
                        <input type="number" min={1} step={1} value={action.patch.intervalSeconds ?? 30} onChange={(event) => updateAction(index, (draft) => {
                          if (draft.kind !== 'ambiance-patch') return
                          draft.patch.intervalSeconds = Number(event.target.value)
                        })} className="w-full font-mono text-xs" />
                      </div>
                      <div>
                        <div className="mb-1 text-[10px] text-zinc-500">Max open widgets</div>
                        <input type="number" min={1} step={1} value={action.patch.maxOpenWidgets ?? 2} onChange={(event) => updateAction(index, (draft) => {
                          if (draft.kind !== 'ambiance-patch') return
                          draft.patch.maxOpenWidgets = Number(event.target.value)
                        })} className="w-full font-mono text-xs" />
                      </div>
                      <div className="col-span-2">
                        <div className="mb-1 text-[10px] text-zinc-500">Open while one open chance</div>
                        <input type="number" min={0} max={1} step={0.05} value={action.patch.openWhileOneOpenChance ?? 0.35} onChange={(event) => updateAction(index, (draft) => {
                          if (draft.kind !== 'ambiance-patch') return
                          draft.patch.openWhileOneOpenChance = Number(event.target.value)
                        })} className="w-full font-mono text-xs" />
                      </div>
                    </div>
                  )}
                </div>
              ))}

              <select defaultValue="" onChange={(event) => {
                const kind = event.target.value as EventAction['kind']
                if (!kind) return
                event.target.value = ''
                addAction(kind)
              }} className="w-full text-sm">
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
                  <button
                    key={type}
                    type="button"
                    onClick={() => addEffect(type)}
                    className="rounded-full border border-zinc-700/70 bg-zinc-950/60 px-3 py-1.5 text-[11px] font-semibold text-zinc-300 transition hover:border-cyan-400/35 hover:text-cyan-200"
                  >
                    + {type}
                  </button>
                ))}
              </div>
              {def.effects.length === 0 && <div className="text-[10px] italic text-zinc-600">No effects configured.</div>}
              {def.effects.map((effect, index) => (
                <div key={`${def.id}-effect-${index}`} className="space-y-3 border-b border-zinc-700/40 py-3 last:border-b-0">
                  <div className="flex items-center gap-3">
                    <span className="flex-1 font-mono text-xs text-zinc-300">{effect.type}</span>
                    <input type="number" min={0} max={10} step={0.1} value={effect.delay ?? 0} onChange={(event) => update((draft) => {
                      draft.effects[index] = { ...draft.effects[index], delay: Number(event.target.value) }
                    })} className="w-20 font-mono text-xs" title="Delay (s)" />
                    <span className="text-[10px] text-zinc-600">s</span>
                    <button onClick={() => update((draft) => { draft.effects.splice(index, 1) })} className="rounded-md px-2 py-1 text-[11px] text-red-400 transition hover:bg-red-500/10 hover:text-red-200">Remove</button>
                  </div>
                  {effect.type === 'desktop-notification' && (() => {
                    const cfg = normalizeDesktopNotificationEffectConfig(effect.cfg)
                    return (
                      <div className="grid grid-cols-2 gap-2 pl-1">
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
                        <div>
                          <div className="mb-1 text-[10px] text-zinc-500">Duration (ms)</div>
                          <input type="number" min={0} step={250} value={cfg.durationMs ?? DEFAULT_DESKTOP_NOTIFICATION_DURATION_MS} onChange={(event) => updateDesktopNotificationEffect(index, (draft) => { draft.durationMs = Number(event.target.value) || 0 })} className="w-full font-mono text-xs" />
                        </div>
                      </div>
                    )
                  })()}
                </div>
              ))}
              <select defaultValue="" onChange={(event) => {
                const type = event.target.value as EffectType
                if (!type) return
                event.target.value = ''
                addEffect(type)
              }} className="w-full text-sm">
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
