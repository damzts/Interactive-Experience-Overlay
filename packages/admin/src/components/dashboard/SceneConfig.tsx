import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { withDesktopConfigDefaults } from '@ieom/shared'
import type { Scene, SourceInstance, SourcePreset, TransitionStep } from '@ieom/shared'
import { socket } from '../../socket/client'
import { useAdminStore } from '../../store/useAdminStore'
import { AssetSelectionInput } from '../AssetLibrary'
import { getSafeSceneSources, SOURCE_CATALOG } from '../sourceCatalog'
import { resolveSourceInstance } from '@ieom/shared'
import { Btn, ConfigCard, ConfigNotice, ConfigSectionPanel } from '../ui'
import { DASHBOARD_SAVE_BUTTON_CLASS } from './constants'
import { TransitionList } from './TransitionPicker'
import { StyleEditor } from './StyleEditor'
import {
  clone,
  createApplicationSnapshot,
  createSceneSnapshot,
  resolveApplicationDefaultSnapshot,
  resolveSceneDefaultSnapshot,
} from './widgetHelpers'

// ── SourcesEditor ─────────────────────────────────────────────────────

export function SourcesEditor({ sceneId }: { sceneId: string }) {
  const config     = useAdminStore((s) => s.config)
  const saveConfig = useAdminStore((s) => s.saveConfig)
  const scene      = config.scenes[sceneId] as (typeof config.scenes)[string] | undefined
  const sources    = (scene?.sources ?? []) as SourceInstance[]
  const sourcePresets = config.sourcePresets ?? []

  const save = (next: SourceInstance[]) =>
    saveConfig({ scenes: { [sceneId]: { ...config.scenes[sceneId], sources: next } } })

  const toggle = (id: string) => save(sources.map((s) => s.id === id ? { ...s, visible: !s.visible } : s))
  const remove = (id: string) => { save(sources.filter((s) => s.id !== id)) }

  const updateSourcePreset = (id: string, presetId: string) => {
    save(sources.map((source) => source.id === id ? { ...source, sourcePresetId: presetId || undefined } : source))
  }

  const normalizeSourceOrder = useCallback((ordered: SourceInstance[]) => (
    ordered.map((source, index) => ({ ...source, zIndex: index }))
  ), [])

  const moveUp = (id: string) => {
    const ordered = [...sources].sort((a, b) => a.zIndex - b.zIndex)
    const index = ordered.findIndex((source) => source.id === id)
    if (index <= 0) return
    ;[ordered[index - 1], ordered[index]] = [ordered[index], ordered[index - 1]]
    save(normalizeSourceOrder(ordered))
  }

  const moveDown = (id: string) => {
    const ordered = [...sources].sort((a, b) => a.zIndex - b.zIndex)
    const index = ordered.findIndex((source) => source.id === id)
    if (index < 0 || index === ordered.length - 1) return
    ;[ordered[index], ordered[index + 1]] = [ordered[index + 1], ordered[index]]
    save(normalizeSourceOrder(ordered))
  }

  const addSource = (preset?: SourcePreset) => {
    const newSrc: SourceInstance = {
      id: `scene-source-${Date.now()}`,
      sourcePresetId: preset?.id,
      position: preset?.defaultPosition ?? { x: 0, y: 0, width: 1920, height: 1080 },
      zIndex: sources.length,
      visible: true,
    }
    save([...sources, newSrc])
  }

  const sorted = [...sources].sort((a, b) => a.zIndex - b.zIndex)

  return (
    <div className="space-y-2">
      {sorted.map((src) => {
        const resolved = resolveSourceInstance(src, sourcePresets)
        const meta = SOURCE_CATALOG.find((c) => c.type === resolved?.pluginType)
        return (
          <ConfigCard key={src.id} className="overflow-hidden p-0">
            <div className="flex items-center gap-2 px-3 py-2">
              <button type="button" title={src.visible ? 'Hide' : 'Show'} onClick={() => toggle(src.id)}
                className={'w-2 h-2 rounded-full shrink-0 transition-colors ' + (src.visible ? 'bg-emerald-400 hover:bg-emerald-600' : 'bg-zinc-600 hover:bg-zinc-400')} />
              <span className="text-[10px] text-zinc-500 shrink-0">{meta?.icon ?? '▣'}</span>
              <div className="min-w-0 flex-1">
                <select value={src.sourcePresetId ?? ''} onChange={(event) => updateSourcePreset(src.id, event.target.value)} className="w-full text-xs">
                  <option value="">-- Pick source preset --</option>
                  {sourcePresets.map((preset) => {
                    const sourceMeta = SOURCE_CATALOG.find((entry) => entry.type === preset.pluginType)
                    return <option key={preset.id} value={preset.id}>{preset.label} · {sourceMeta?.label ?? preset.pluginType}</option>
                  })}
                </select>
              </div>
              <div className="flex shrink-0 flex-col gap-1">
                <Btn type="button" variant="ghost" onClick={() => moveUp(src.id)} disabled={sorted[0]?.id === src.id} className="px-2 py-1 text-[10px]">Up</Btn>
                <Btn type="button" variant="ghost" onClick={() => moveDown(src.id)} disabled={sorted[sorted.length - 1]?.id === src.id} className="px-2 py-1 text-[10px]">Down</Btn>
              </div>
              <Btn type="button" variant="danger" onClick={() => remove(src.id)} className="px-2 py-0.5 text-[10px]">Delete</Btn>
            </div>
          </ConfigCard>
        )
      })}

      {sourcePresets.length ? (
        <Btn type="button" onClick={() => addSource()} variant="ghost"
          className="mt-1 w-full justify-center border-dashed border-zinc-700/80 py-2 text-xs text-zinc-400 hover:text-cyan-200">
          Add
        </Btn>
      ) : (
        <ConfigNotice tone="info">No source presets yet. Create them from the Asset Library Sources tab first.</ConfigNotice>
      )}
    </div>
  )
}

// ── SceneConfig ───────────────────────────────────────────────────────

export function SceneConfig({ sceneId }: { sceneId: string }) {
  const config     = useAdminStore((s) => s.config)
  const saveConfig = useAdminStore((s) => s.saveConfig)
  const linkedApp  = config.applications.find((a) => a.targetSceneId === sceneId)
  const scene      = config.scenes[sceneId]
  const defaultSnapshot = useMemo(() => resolveSceneDefaultSnapshot(sceneId, scene), [scene, sceneId])
  const [saving, setSaving] = useState(false)
  const [saveDefaultArmed, setSaveDefaultArmed] = useState(false)
  const saveDefaultTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setSaveDefaultArmed(false)
  }, [sceneId, scene, linkedApp])

  useEffect(() => () => {
    if (saveDefaultTimer.current) clearTimeout(saveDefaultTimer.current)
  }, [])

  const updateAppTransitions = (key: 'introTransitions' | 'exitTransitions', steps: TransitionStep[]) => {
    if (!linkedApp) return
    const apps = config.applications.map((a) =>
      a.id === linkedApp.id ? { ...a, [key]: steps.length ? steps : undefined } : a
    )
    saveConfig({ applications: apps })
  }

  const restoreDefaults = async () => {
    const snapshot = clone(defaultSnapshot)
    const nextScene: Scene = {
      ...scene,
      label: snapshot.label,
      backgroundOpaque: snapshot.backgroundOpaque,
      sources: clone(snapshot.sources),
      style: snapshot.style ? clone(snapshot.style) : undefined,
      lobbyConfig: snapshot.lobbyConfig ? clone(snapshot.lobbyConfig) : undefined,
      introTransitions: snapshot.introTransitions ? clone(snapshot.introTransitions) : undefined,
      exitTransitions: snapshot.exitTransitions ? clone(snapshot.exitTransitions) : undefined,
      musicTrack: snapshot.musicTrack,
      defaultConfig: scene.defaultConfig ?? snapshot,
    }

    let applications = config.applications
    if (linkedApp) {
      const appDefaults = resolveApplicationDefaultSnapshot(linkedApp)
      const { widgetDefaults: _widgetDefaults, ...linkedAppDefaults } = appDefaults
      applications = config.applications.map((entry) => (
        entry.id === linkedApp.id
          ? { ...entry, ...linkedAppDefaults, defaultConfig: entry.defaultConfig ?? appDefaults }
          : entry
      ))
    }

    setSaving(true)
    await saveConfig({ scenes: { [sceneId]: nextScene }, applications })
    setSaving(false)
    setSaveDefaultArmed(false)
  }

  const saveCurrentAsDefault = async () => {
    if (!saveDefaultArmed) {
      setSaveDefaultArmed(true)
      if (saveDefaultTimer.current) clearTimeout(saveDefaultTimer.current)
      saveDefaultTimer.current = setTimeout(() => setSaveDefaultArmed(false), 3500)
      return
    }

    setSaving(true)
    if (saveDefaultTimer.current) clearTimeout(saveDefaultTimer.current)

    let applications = config.applications
    if (linkedApp) {
      const appSnapshot = createApplicationSnapshot(linkedApp, withDesktopConfigDefaults(config.desktopConfig))
      applications = config.applications.map((entry) => (
        entry.id === linkedApp.id ? { ...entry, defaultConfig: appSnapshot } : entry
      ))
    }

    await saveConfig({
      scenes: { [sceneId]: { ...scene, defaultConfig: createSceneSnapshot(scene) } },
      applications,
    })

    setSaving(false)
    setSaveDefaultArmed(false)
  }

  return (
    <div className="space-y-3">
      <div className="ml-auto flex w-fit flex-wrap gap-2">
        <Btn type="button" variant={saveDefaultArmed ? 'warning' : 'default'}
          onClick={() => { void saveCurrentAsDefault() }}
          className={DASHBOARD_SAVE_BUTTON_CLASS} disabled={saving}>
          {saveDefaultArmed ? 'Click Again to Confirm' : 'Save Current as Default'}
        </Btn>
        <Btn type="button" variant="ghost"
          onClick={() => { void restoreDefaults() }}
          className={DASHBOARD_SAVE_BUTTON_CLASS} disabled={saving}>
          Restore Defaults
        </Btn>
      </div>
      <div className="space-y-0 pt-1">
        <ConfigSectionPanel label="Sources" first>
          <SourcesEditor sceneId={sceneId} />
        </ConfigSectionPanel>
        {linkedApp && (
          <ConfigSectionPanel label="Transitions">
            <div className="space-y-3">
              <div>
                <div className="text-[10px] text-zinc-500 mb-1">Intro (entering)</div>
                <TransitionList value={linkedApp.introTransitions ?? []} onChange={(steps) => updateAppTransitions('introTransitions', steps)} />
              </div>
              <div>
                <div className="text-[10px] text-zinc-500 mb-1">Exit (leaving)</div>
                <TransitionList value={linkedApp.exitTransitions ?? []} onChange={(steps) => updateAppTransitions('exitTransitions', steps)} />
              </div>
            </div>
          </ConfigSectionPanel>
        )}
      </div>
      <StyleEditor sceneId={sceneId} />
      <div className="space-y-0">
        <ConfigSectionPanel label="Background Music">
          <div className="text-[10px] text-zinc-500 mb-2">Loop a music track while this scene is active. Leave blank for silence.</div>
          <input
            type="text"
            placeholder="/assets/audio/music/ambient/track.mp3"
            value={config.scenes[sceneId]?.musicTrack ?? ''}
            onChange={(e) => {
              const val = e.target.value.trim() || undefined
              saveConfig({ scenes: { [sceneId]: { ...config.scenes[sceneId], musicTrack: val } } })
            }}
            className="w-full font-mono text-xs"
          />
          <div className="text-[10px] text-zinc-600 mt-1">Crossfade: 1.5 s</div>
        </ConfigSectionPanel>
      </div>
    </div>
  )
}
