import { useMemo, useState, type ReactNode } from 'react'
import { EFFECT_CATALOG, getEffectLabel } from '@ieomlabs/shared'
import type { EffectConfig, EffectType } from '@ieomlabs/shared'
import { useAdminStore } from '../../store/useAdminStore'
import { SchemaForm } from './SchemaForm'
import { Btn, ConfigCard, ConfigChoiceButton, ConfigSectionPanel, Slider } from '../../shared/ui'
import { ActionFields } from '../../shared/ActionFields'
import {
  createEffectDraft,
  describeEventSetup,
  EFFECT_CATEGORIES,
  EVENT_EFFECT_TYPES,
  isBlankAction,
  isBlankEffect,
  normalizeDraftEffectConfig,
  type EventDraft,
} from './eventPresets'

export function EventForm({
  def,
  onUpdate,
  onDelete,
  showOverview = true,
  showDeleteButton = true,
  layout = 'default',
}: {
  def: EventDraft
  onUpdate: (d: EventDraft) => void
  onDelete?: () => void
  showOverview?: boolean
  showDeleteButton?: boolean
  layout?: 'default' | 'flat-grid'
}) {
  const config = useAdminStore((s) => s.config)
  const widgetApps = useMemo(() => config.applications, [config.applications])
  const widgetLayouts = useAdminStore((s) => s.config.widgetLayouts ?? [])
  const [collapsedActionIndexes, setCollapsedActionIndexes] = useState<number[]>([])
  const [collapsedEffectIndexes, setCollapsedEffectIndexes] = useState<number[]>([])
  const normalizedEffects = useMemo(() => def.effects.map((effect) => normalizeDraftEffectConfig(effect)), [def.effects])
  // Scene ids are data-driven: every scene defined in config, including the built-in DESKTOP.
  const sceneIds = useMemo(() => Object.keys(config.scenes ?? {}), [config.scenes])

  const update = (fn: (d: EventDraft) => void) => {
    const next: EventDraft = {
      ...def,
      auto: { ...def.auto },
      effects: def.effects.map((effect) => structuredClone(normalizeDraftEffectConfig(effect))),
      actions: structuredClone(def.actions ?? []),
    }
    fn(next)
    onUpdate(next)
  }

  const updateEffect = (index: number, updater: (effect: EffectConfig) => void) => {
    update((draft) => {
      const effect = draft.effects[index]
      if (!effect || isBlankEffect(effect)) return
      updater(effect)
    })
  }

  const addBlankAction = () => {
    update((draft) => {
      draft.actions = [...(draft.actions ?? []), { kind: '' }]
    })
  }

  const addBlankEffect = () => {
    update((draft) => {
      draft.effects.push({ type: '' })
    })
  }

  const setEffectKind = (index: number, type: EffectType | '') => {
    update((draft) => {
      draft.effects[index] = type ? createEffectDraft(type) : { type: '' }
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
    const chain = effect && !isBlankEffect(effect) ? effect.chain : undefined
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
      if (!effect || isBlankEffect(effect)) return
      ;(effect.cfg as Record<string, unknown>)[key] = value
    })
  }

  // Effect editors are generated from the shared EFFECT_CATALOG field
  // schemas — no per-type editor code. See SchemaForm.
  const renderEffectConfig = (effect: EffectConfig, index: number) => {
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

  const runtimeActionsSection = wrapGridItem(
    <ConfigSectionPanel label="Runtime Actions" first>
            <div className="space-y-4">
              {(def.actions ?? []).length === 0 && <div className="text-[10px] italic text-zinc-600">No runtime actions configured.</div>}
              <div className="grid gap-4 pt-2">
              {(def.actions ?? []).map((action, index) => (
                <div key={`${def.id}-action-${index}`}>
                <div className="space-y-4 rounded-2xl border border-cyan-500/25 bg-cyan-500/5 px-5 py-5 shadow-[0_10px_30px_rgba(0,0,0,0.14),inset_0_1px_0_rgba(255,255,255,0.04)] ring-1 ring-black/15">
                  <div className="flex items-start justify-between gap-3 border-b border-zinc-800/80 pb-3">
                    <div className="text-[10px] uppercase tracking-[0.14em] text-cyan-300/80">Action {index + 1}</div>
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

                  {!collapsedActionIndexes.includes(index) ? (
                    <ActionFields
                      action={action}
                      onChange={(next) => update((draft) => {
                        const actions = [...(draft.actions ?? [])]
                        actions[index] = next
                        draft.actions = actions
                      })}
                      widgetApps={widgetApps}
                    />
                  ) : !isBlankAction(action) && (
                    <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/55 px-5 py-4 text-[11px] text-zinc-500">
                      Configuration hidden. Expand this action to edit its settings.
                    </div>
                  )}
                </div>
                </div>
              ))}
              </div>

              <Btn type="button" variant="ghost" onClick={addBlankAction} className="w-full justify-center border-dashed border-zinc-700/80 py-2 text-xs">
                + Add Action
              </Btn>
            </div>
              </ConfigSectionPanel>,
            'xl:col-start-1'
  )

  const effectsSection = wrapGridItem(
    <ConfigSectionPanel label="Effects" first>
            <div className="space-y-4">
              {normalizedEffects.length === 0 && <div className="text-[10px] italic text-zinc-600">No effects configured.</div>}
              <div className="grid gap-4 pt-2">
              {normalizedEffects.map((effect, index) => (
                <div key={`${def.id}-effect-${index}`}>
                <div className="space-y-4 rounded-2xl border border-cyan-500/25 bg-cyan-500/5 px-5 py-5 shadow-[0_10px_30px_rgba(0,0,0,0.14),inset_0_1px_0_rgba(255,255,255,0.04)] ring-1 ring-black/15">
                  <div className="flex items-start gap-3 border-b border-zinc-800/80 pb-3">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 text-[10px] uppercase tracking-[0.14em] text-cyan-300/80">Effect {index + 1}</div>
                      <select
                        value={effect.type}
                        onChange={(event) => setEffectKind(index, event.target.value as EffectType | '')}
                        className="w-full text-xs"
                      >
                        <option value="">— type —</option>
                        {EFFECT_CATEGORIES.map((cat) => (
                          <optgroup key={cat.label} label={cat.label}>
                            {cat.effects.map((type) => <option key={type} value={type}>{getEffectLabel(type)}</option>)}
                          </optgroup>
                        ))}
                      </select>
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

                  {!isBlankEffect(effect) && !collapsedEffectIndexes.includes(index) && (
                    <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 px-5 py-4 space-y-4">
                      <Slider label="Delay" value={effect.delay ?? 0} min={0} max={10} step={0.1} unit="s" onChange={(value) => updateEffect(index, (draft) => {
                        draft.delay = value
                      })} />
                      <Slider label="Chance" value={effect.chance ?? 1} min={0} max={1} step={0.05} onChange={(value) => updateEffect(index, (draft) => {
                        draft.chance = value
                      })} />
                      <div>
                        <div className="mb-1 text-[10px] text-zinc-500">
                          Scene condition <span className="normal-case font-normal text-zinc-600">(optional — leave blank to fire in any scene)</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {sceneIds.map((s) => {
                            const active = (effect.sceneIs ?? []).includes(s)
                            return (
                              <ConfigChoiceButton
                                key={s}
                                selected={active}
                                onClick={() => updateEffect(index, (draft) => {
                                  const current = draft.sceneIs ?? []
                                  const next = active ? current.filter((x: string) => x !== s) : [...current, s]
                                  draft.sceneIs = next.length ? next : undefined
                                })}
                              >
                                {s}
                              </ConfigChoiceButton>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  {!isBlankEffect(effect) && !collapsedEffectIndexes.includes(index) && renderEffectConfig(effect, index)}

                  {!isBlankEffect(effect) && collapsedEffectIndexes.includes(index) && (
                    <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/55 px-5 py-4 text-[11px] text-zinc-500">
                      Configuration hidden. Expand this effect to edit its settings.
                    </div>
                  )}
                </div>
                </div>
              ))}
              </div>

              <Btn type="button" variant="ghost" onClick={addBlankEffect} className="w-full justify-center border-dashed border-zinc-700/80 py-2 text-xs">
                + Add Effect
              </Btn>
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
            {def.presetType !== 'effect' && (
              <ConfigCard className="text-left">
                <div className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">Runtime Actions</div>
                <div className="mt-1 text-sm font-semibold text-zinc-100">{def.actions?.length ?? 0}</div>
              </ConfigCard>
            )}
            {def.presetType !== 'action' && (
              <ConfigCard className="text-left">
                <div className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">Overlay Effects</div>
                <div className="mt-1 text-sm font-semibold text-zinc-100">{def.effects.length}</div>
              </ConfigCard>
            )}
          </div>
        </>
      )}

      {flatGrid ? (
        <div className="grid items-start gap-4 xl:grid-cols-2">
          {def.presetType !== 'effect' && runtimeActionsSection}
          {def.presetType !== 'action' && effectsSection}
          {!def.builtIn && showDeleteButton && onDelete && (
            <div className="pt-1 xl:col-span-2">
              <Btn variant="danger" onClick={onDelete} className="w-full py-2.5 text-sm">Delete Event</Btn>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {!def.builtIn && showDeleteButton && onDelete && (
            <div className="pt-1">
              <Btn variant="danger" onClick={onDelete} className="w-full py-2.5 text-sm">Delete Event</Btn>
            </div>
          )}

          <div className="grid items-start gap-4 xl:grid-cols-2">
            {def.presetType !== 'effect' && runtimeActionsSection}
            {def.presetType !== 'action' && effectsSection}
          </div>
        </div>
      )}
    </div>
  )
}
