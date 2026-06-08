import { useCallback, useEffect, useRef, useState } from 'react'
import { STATE, withLobbyConfigDefaults } from '@ieomlabs/shared'
import type { LobbyConfig, Scene } from '@ieomlabs/shared'
import { useAdminStore } from '../../store/useAdminStore'
import { ConfigApplyBar, isSameDraft, Slider } from '../../shared/ui'
import { Toggle } from '../../components/atoms'
import { ConfigPanel } from '../../components/organisms'
import { LabeledHexColorRow } from './formAtoms'

function LobbyConfigSections({ form, update, first: _first }: {
  form: LobbyConfig
  update: (updater: (d: LobbyConfig) => void) => void
  first?: boolean
}) {
  return (
    <>
      <ConfigPanel title="Ambient Light" className="mb-4">
        <LabeledHexColorRow label="" value={form.ambientColor} onChange={(v) => update((d) => { d.ambientColor = v })} />
        <Slider label="Intensity" value={form.ambientIntensity} min={0} max={2} step={0.01} onChange={(v) => update((d) => { d.ambientIntensity = v })} />
      </ConfigPanel>
      <ConfigPanel title="Fog" className="mb-4">
        <LabeledHexColorRow label="" value={form.fogColor} onChange={(v) => update((d) => { d.fogColor = v })} />
        <Slider label="Near" value={form.fogNear} min={1} max={20} step={0.5} onChange={(v) => update((d) => { d.fogNear = v })} />
        <Slider label="Far"  value={form.fogFar}  min={5} max={60} step={1}   onChange={(v) => update((d) => { d.fogFar  = v })} />
      </ConfigPanel>
      <ConfigPanel title="World" className="mb-4">
        <LabeledHexColorRow label="Sky Top" value={form.skyTopColor}     onChange={(v) => update((d) => { d.skyTopColor     = v })} />
        <LabeledHexColorRow label="Horizon" value={form.skyHorizonColor} onChange={(v) => update((d) => { d.skyHorizonColor = v })} />
        <LabeledHexColorRow label="Floor"   value={form.floorColor}      onChange={(v) => update((d) => { d.floorColor      = v })} />
        <Slider label="Reflectivity" value={form.floorReflectivity} min={0} max={1} step={0.05} onChange={(v) => update((d) => { d.floorReflectivity = v })} />
      </ConfigPanel>
      <ConfigPanel title="CRT Glow" className="mb-4">
        <LabeledHexColorRow label="" value={form.crtGlowColor} onChange={(v) => update((d) => { d.crtGlowColor = v })} />
      </ConfigPanel>
      <ConfigPanel title="Atmosphere" className="mb-4">
        <Toggle checked={form.dustMotes} onChange={(v) => update((d) => { d.dustMotes = v })} size="sm" label="Dust motes" />
        <div className="mt-2 space-y-1">
          <Slider label="Camera FOV" value={form.cameraFov}  min={30}  max={120}  step={1}  onChange={(v) => update((d) => { d.cameraFov  = v })} />
          <Slider label="Stars"      value={form.starsCount} min={0}   max={2000} step={50} onChange={(v) => update((d) => { d.starsCount = v })} />
        </div>
      </ConfigPanel>
      <ConfigPanel title="Room Life" className="mb-4">
        <div className="space-y-3">
          <div>
            <Toggle checked={form.virtualPet.enabled} onChange={(v) => update((d) => { d.virtualPet.enabled = v })} size="sm" label="Virtual pet" />
            {form.virtualPet.enabled && (
              <div className="mt-2 space-y-1">
                <LabeledHexColorRow label="Body"  value={form.virtualPet.color}          onChange={(v) => update((d) => { d.virtualPet.color          = v })} />
                <LabeledHexColorRow label="Charm" value={form.virtualPet.accessoryColor} onChange={(v) => update((d) => { d.virtualPet.accessoryColor = v })} />
              </div>
            )}
          </div>
          <div>
            <Toggle checked={form.lavaLamp.enabled} onChange={(v) => update((d) => { d.lavaLamp.enabled = v })} size="sm" label="Lava lamp" />
            {form.lavaLamp.enabled && (
              <div className="mt-2 space-y-1">
                <LabeledHexColorRow label="Glass" value={form.lavaLamp.glassColor}  onChange={(v) => update((d) => { d.lavaLamp.glassColor  = v })} />
                <LabeledHexColorRow label="Wax"   value={form.lavaLamp.liquidColor} onChange={(v) => update((d) => { d.lavaLamp.liquidColor = v })} />
                <LabeledHexColorRow label="Glow"  value={form.lavaLamp.glowColor}   onChange={(v) => update((d) => { d.lavaLamp.glowColor   = v })} />
              </div>
            )}
          </div>
          <div>
            <Toggle checked={form.fishTank.enabled} onChange={(v) => update((d) => { d.fishTank.enabled = v })} size="sm" label="Fish tank" />
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
      </ConfigPanel>
    </>
  )
}

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
      <div className="space-y-0 pt-3">
        <LobbyConfigSections form={form} update={update} first />
      </div>
      <ConfigApplyBar label="Lobby Global Theme" dirty={dirty} saving={saving} saved={saved} onApply={apply} onReset={reset} alwaysShow />
    </div>
  )
}
