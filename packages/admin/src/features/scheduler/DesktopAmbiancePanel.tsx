import { useCallback, useEffect, useRef, useState } from 'react'
import { STATE, withDesktopAmbianceDefaults } from '@ieomlabs/shared'
import type { DesktopAmbianceConfig } from '@ieomlabs/shared'
import { useAdminStore } from '../../store/useAdminStore'
import { ConfigApplyBar, ConfigCard, ConfigPageIntro, ConfigSectionPanel, Toggle, isSameDraft } from '../../shared/ui'
import {
  createDefaultNavBehavior, createDefaultWidgetBehavior,
  WidgetAmbianceSection, LayoutAmbianceSection, SceneAmbianceSection,
} from './DesktopAmbianceSections'
import type { AmbianceUpdater } from './DesktopAmbianceSections'

// ── DesktopAmbiancePanel ("Desktop Interaction") ─────────────────────

export function DesktopAmbiancePanel() {
  const saveConfig         = useAdminStore((s) => s.saveConfig)
  const allApps            = useAdminStore((s) => s.config.applications)
  const allLayouts         = useAdminStore((s) => s.config.widgetLayouts ?? [])
  const allScenes          = useAdminStore((s) => s.config.scenes ?? {})
  const rawDesktopAmbiance = useAdminStore((s) => s.config.desktopAmbiance)

  const userLayouts = allLayouts.filter((l) => l.source === 'user')
  const sceneEntries: Array<{ id: string; label: string; icon: string }> = Object.values(allScenes)
    .map((s) => ({ id: s.id, label: s.label, icon: s.id === STATE.DESKTOP ? '🖥' : '🎬' }))

  const sourceConfig = withDesktopAmbianceDefaults(rawDesktopAmbiance)

  const [draft, setDraft] = useState<DesktopAmbianceConfig>(() => structuredClone(sourceConfig))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const dirty = !isSameDraft(draft, sourceConfig)

  useEffect(() => {
    if (dirty) return
    setDraft((prev) => (isSameDraft(prev, sourceConfig) ? prev : structuredClone(sourceConfig)))
    setSaved(false)
  }, [dirty, sourceConfig])

  useEffect(() => () => { if (savedTimer.current) clearTimeout(savedTimer.current) }, [])

  const updateAmbiance: AmbianceUpdater = useCallback((key, updater) => {
    setDraft((prev) => {
      const next = structuredClone(prev)
      updater(next[key])
      setSaved(false)
      return next
    })
  }, [])

  const enableAllAmbianceTargets = useCallback(() => {
    updateAmbiance('widgetSimulation', (ws) => {
      ws.enabled = true
      allApps.forEach((app) => {
        ws.behaviors[app.id] = { ...createDefaultWidgetBehavior(true), ...ws.behaviors[app.id], enabled: true }
      })
      userLayouts.forEach((l) => {
        if (!ws.layoutBehaviors) ws.layoutBehaviors = {}
        ws.layoutBehaviors[l.id] = { ...createDefaultNavBehavior(true), ...ws.layoutBehaviors?.[l.id], enabled: true }
      })
      sceneEntries.forEach((s) => {
        if (!ws.sceneBehaviors) ws.sceneBehaviors = {}
        ws.sceneBehaviors[s.id] = { ...createDefaultNavBehavior(true), ...ws.sceneBehaviors?.[s.id], enabled: true }
      })
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updateAmbiance, allApps, userLayouts, sceneEntries.length])

  const apply = useCallback(async () => {
    if (!dirty) return
    setSaving(true)
    await saveConfig({ desktopAmbiance: draft })
    setSaving(false)
    if (savedTimer.current) clearTimeout(savedTimer.current)
    setSaved(true)
    savedTimer.current = setTimeout(() => setSaved(false), 1500)
  }, [dirty, saveConfig, draft])

  const reset = useCallback(() => {
    setDraft(structuredClone(sourceConfig))
    setSaved(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawDesktopAmbiance])

  const simConfig = draft.widgetSimulation
  const totalAmbianceEnabled =
    Object.values(simConfig.behaviors).filter((b) => b?.enabled).length +
    Object.values(simConfig.layoutBehaviors ?? {}).filter((b) => b?.enabled).length +
    Object.values(simConfig.sceneBehaviors ?? {}).filter((b) => b?.enabled).length

  return (
    <div className="space-y-5">
      <ConfigPageIntro title="Desktop Interaction">
        Simulates an AI agent using the Desktop OS — opens widgets, applies layouts, and switches scenes. One
        engine drives widget, layout, and scene targets together, so they share this single tick loop and save.
      </ConfigPageIntro>

      {/* Master switch — runs the whole engine, independent of which
          individual widgets/layouts/scenes are enabled below. Turning
          this off stops all simulation immediately without touching the
          per-target selections, so re-enabling restores the same setup. */}
      <ConfigCard className="flex items-center justify-between p-5">
        <div>
          <div className="text-sm font-semibold text-zinc-100">Engine</div>
          <div className="text-[10px] text-zinc-500 mt-0.5">
            Master switch for the whole Desktop Interaction engine. Per-target toggles below only take
            effect while this is on.
          </div>
        </div>
        <Toggle
          checked={simConfig.enabled}
          onChange={(v) => updateAmbiance('widgetSimulation', (d) => { d.enabled = v })}
        />
      </ConfigCard>

      <ConfigSectionPanel label="Widget interaction">
        <WidgetAmbianceSection
          form={draft}
          update={updateAmbiance}
          allApps={allApps}
          onEnableAll={enableAllAmbianceTargets}
          showEnableAll={!simConfig.enabled || totalAmbianceEnabled === 0}
        />
      </ConfigSectionPanel>

      <ConfigSectionPanel label="Layout interaction">
        <LayoutAmbianceSection form={draft} update={updateAmbiance} userLayouts={userLayouts} />
      </ConfigSectionPanel>

      <ConfigSectionPanel label="Scene interaction">
        <SceneAmbianceSection form={draft} update={updateAmbiance} sceneEntries={sceneEntries} />
      </ConfigSectionPanel>

      <ConfigApplyBar
        label="Desktop Interaction"
        dirty={dirty}
        saving={saving}
        saved={saved}
        onApply={apply}
        onReset={reset}
        alwaysShow
      />
    </div>
  )
}
