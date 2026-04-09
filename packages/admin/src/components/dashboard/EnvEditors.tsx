import { useCallback, useEffect, useRef, useState } from 'react'
import { STATE, withDesktopConfigDefaults, withLobbyConfigDefaults } from '@ieom/shared'
import type { DesktopConfig, LobbyConfig } from '@ieom/shared'
import { socket } from '../../socket/client'
import { useAdminStore } from '../../store/useAdminStore'
import {
  ConfigApplyBar,
  ConfigSectionPanel,
  isSameDraft,
  Slider,
  Toggle,
} from '../ui'
import {
  ICON_ANIMATIONS,
  SCREENSAVER_PRESETS,
  iconSizeToSliderValue,
  labelizeIconSize,
  sliderValueToIconSize,
} from '../adminDesktopOptions'
import { LabeledHexColorRow } from './formAtoms'
import { TransitionList, compactTransitionSteps } from './TransitionPicker'

// ── LobbyConfigEditor ─────────────────────────────────────────────────

export function LobbyConfigEditor() {
  const config     = useAdminStore((s) => s.config)
  const saveConfig = useAdminStore((s) => s.saveConfig)
  const lobbyScene = config.scenes[STATE.LOBBY] as { lobbyConfig?: LobbyConfig; introTransitions?: any[]; exitTransitions?: any[] } | undefined
  const sourceForm = withLobbyConfigDefaults(lobbyScene?.lobbyConfig)
  const sourceIntroTransitions = structuredClone(lobbyScene?.introTransitions)
  const sourceExitTransitions  = structuredClone(lobbyScene?.exitTransitions)
  const [form, setForm] = useState<LobbyConfig>(() => sourceForm)
  const [introTransitions, setIntroTransitions] = useState<any[]>(sourceIntroTransitions || [])
  const [exitTransitions,  setExitTransitions]  = useState<any[]>(sourceExitTransitions  || [])
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dirty = !isSameDraft(form, sourceForm)
    || !isSameDraft(introTransitions, sourceIntroTransitions)
    || !isSameDraft(exitTransitions,  sourceExitTransitions)

  useEffect(() => {
    setForm(sourceForm)
    setIntroTransitions(sourceIntroTransitions || [])
    setExitTransitions(sourceExitTransitions  || [])
    setSaved(false)
  }, [config.scenes])

  const update = useCallback((updater: (d: LobbyConfig) => void) => {
    setForm((prev) => { const next = structuredClone(prev); updater(next); return next })
    setSaved(false)
  }, [])

  const apply = useCallback(async () => {
    if (!dirty) return
    setSaving(true)
    await saveConfig({
      scenes: {
        [STATE.LOBBY]: {
          ...config.scenes[STATE.LOBBY],
          lobbyConfig: form,
          introTransitions: compactTransitionSteps(introTransitions).length ? compactTransitionSteps(introTransitions) : undefined,
          exitTransitions:  compactTransitionSteps(exitTransitions).length  ? compactTransitionSteps(exitTransitions)  : undefined,
        },
      },
    })
    setSaving(false)
    if (savedTimer.current) clearTimeout(savedTimer.current)
    setSaved(true)
    savedTimer.current = setTimeout(() => setSaved(false), 1500)
  }, [dirty, saveConfig, config.scenes, form, introTransitions, exitTransitions])

  const reset = useCallback(() => {
    setForm(sourceForm)
    setIntroTransitions(sourceIntroTransitions || [])
    setExitTransitions(sourceExitTransitions  || [])
    setSaved(false)
  }, [sourceForm, sourceIntroTransitions, sourceExitTransitions])

  return (
    <div className="space-y-3">
      <ConfigApplyBar label="Lobby Configuration" dirty={dirty} saving={saving} saved={saved} onApply={apply} onReset={reset} alwaysShow />
      <div className="space-y-0 pt-3">
        <ConfigSectionPanel label="Transitions" first>
          <div className="space-y-3">
            {([
              { field: 'introTransitions' as const, label: 'Intro (entering)' },
              { field: 'exitTransitions'  as const, label: 'Exit (leaving)'   },
            ]).map(({ field, label }) => (
              <div key={field}>
                <div className="text-[10px] text-zinc-500 mb-1">{label}</div>
                <TransitionList
                  value={field === 'introTransitions' ? introTransitions : exitTransitions}
                  onChange={(steps) => {
                    if (field === 'introTransitions') setIntroTransitions(steps)
                    else setExitTransitions(steps)
                    setSaved(false)
                  }}
                />
              </div>
            ))}
          </div>
        </ConfigSectionPanel>
        <ConfigSectionPanel label="Ambient Light">
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
            <Slider label="Camera FOV" value={form.cameraFov}   min={30}  max={120}  step={1}  onChange={(v) => update((d) => { d.cameraFov   = v })} />
            <Slider label="Stars"      value={form.starsCount}  min={0}   max={2000} step={50} onChange={(v) => update((d) => { d.starsCount  = v })} />
          </div>
        </ConfigSectionPanel>
        <ConfigSectionPanel label="Room Life">
          <div className="space-y-3">
            <div>
              <Toggle checked={form.virtualPet.enabled} onChange={(v) => update((d) => { d.virtualPet.enabled = v })} label="Virtual pet" />
              {form.virtualPet.enabled && (
                <div className="mt-2 space-y-1">
                  <LabeledHexColorRow label="Body"  value={form.virtualPet.color}           onChange={(v) => update((d) => { d.virtualPet.color           = v })} />
                  <LabeledHexColorRow label="Charm" value={form.virtualPet.accessoryColor}  onChange={(v) => update((d) => { d.virtualPet.accessoryColor  = v })} />
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
      </div>
    </div>
  )
}

// ── DesktopConfigEditor ───────────────────────────────────────────────

export function DesktopConfigEditor() {
  const config     = useAdminStore((s) => s.config)
  const saveConfig = useAdminStore((s) => s.saveConfig)
  const desktopScene = config.scenes[STATE.DESKTOP]
  const sourceForm = withDesktopConfigDefaults(config.desktopConfig)
  const sourceIntroTransitions = structuredClone(desktopScene?.introTransitions)
  const sourceExitTransitions  = structuredClone(desktopScene?.exitTransitions)
  const [form, setForm] = useState<DesktopConfig>(() => sourceForm)
  const [introTransitions, setIntroTransitions] = useState<any[]>(sourceIntroTransitions || [])
  const [exitTransitions,  setExitTransitions]  = useState<any[]>(sourceExitTransitions  || [])
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dirty = !isSameDraft(form, sourceForm)
    || !isSameDraft(introTransitions, sourceIntroTransitions)
    || !isSameDraft(exitTransitions,  sourceExitTransitions)

  useEffect(() => {
    setForm(sourceForm)
    setIntroTransitions(sourceIntroTransitions || [])
    setExitTransitions(sourceExitTransitions  || [])
    setSaved(false)
  }, [config.desktopConfig, config.scenes])

  const update = useCallback((updater: (d: DesktopConfig) => void) => {
    setForm((prev) => { const next = structuredClone(prev); updater(next); return next })
    setSaved(false)
  }, [])

  const apply = useCallback(async () => {
    if (!dirty) return
    setSaving(true)
    await saveConfig({
      desktopConfig: form,
      scenes: {
        [STATE.DESKTOP]: {
          ...config.scenes[STATE.DESKTOP],
          introTransitions: compactTransitionSteps(introTransitions).length ? compactTransitionSteps(introTransitions) : undefined,
          exitTransitions:  compactTransitionSteps(exitTransitions).length  ? compactTransitionSteps(exitTransitions)  : undefined,
        },
      },
    })
    setSaving(false)
    if (savedTimer.current) clearTimeout(savedTimer.current)
    setSaved(true)
    savedTimer.current = setTimeout(() => setSaved(false), 1500)
  }, [dirty, saveConfig, config.scenes, form, introTransitions, exitTransitions])

  const reset = useCallback(() => {
    setForm(sourceForm)
    setIntroTransitions(sourceIntroTransitions || [])
    setExitTransitions(sourceExitTransitions  || [])
    setSaved(false)
  }, [sourceForm, sourceIntroTransitions, sourceExitTransitions])

  return (
    <div className="space-y-3">
      <ConfigApplyBar label="Desktop Configuration" dirty={dirty} saving={saving} saved={saved} onApply={apply} onReset={reset} alwaysShow />
      <div className="space-y-0 pt-3">
        <ConfigSectionPanel label="Transitions" first>
          <div className="space-y-3">
            {([
              { field: 'introTransitions' as const, label: 'Intro (entering)' },
              { field: 'exitTransitions'  as const, label: 'Exit (leaving)'   },
            ]).map(({ field, label }) => (
              <div key={field}>
                <div className="text-[10px] text-zinc-500 mb-1">{label}</div>
                <TransitionList
                  value={field === 'introTransitions' ? introTransitions : exitTransitions}
                  onChange={(steps) => {
                    if (field === 'introTransitions') setIntroTransitions(steps)
                    else setExitTransitions(steps)
                    setSaved(false)
                  }}
                />
              </div>
            ))}
          </div>
        </ConfigSectionPanel>
        <ConfigSectionPanel label="Desktop Icons">
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
              <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Ambient motion</div>
              <select value={form.iconAnimation}
                onChange={(e) => update((d) => { d.iconAnimation = e.target.value as DesktopConfig['iconAnimation'] })}
                className="w-full text-xs">
                {ICON_ANIMATIONS.map((mode) => <option key={mode.id} value={mode.id}>{mode.label}</option>)}
              </select>
            </div>
            <Slider label="Motion" value={Math.round(form.iconMotion * 100)} min={0} max={300} step={5} unit="%"
              onChange={(value) => update((d) => { d.iconMotion = value / 100 })} />
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
      </div>
    </div>
  )
}
