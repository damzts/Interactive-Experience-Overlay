import { useCallback, useEffect, useRef, useState } from 'react'
import { STATE, withDesktopAmbianceDefaults } from '@ieomlabs/shared'
import type { DesktopAmbianceConfig } from '@ieomlabs/shared'
import { useAdminStore } from '../../store/useAdminStore'
import { ConfigApplyBar, ConfigPageIntro, ConfigSectionPanel, isSameDraft } from '../../shared/ui'
import {
  createDefaultNavBehavior, createDefaultWidgetBehavior,
  WidgetAmbianceSection, LayoutAmbianceSection, SceneAmbianceSection,
} from './DesktopAmbianceSections'
import type { AmbianceUpdater } from './DesktopAmbianceSections'

function formatRelative(ts: number | null): string {
  if (!ts) return '—'
  const d = ts - Date.now()
  if (d <= 0) return 'now'
  const s = Math.ceil(d / 1000)
  if (s < 60) return `in ${s}s`
  return `in ${Math.ceil(s / 60)}m`
}

function formatAgo(ts: number | null): string {
  if (!ts) return '—'
  const d = Date.now() - ts
  if (d < 1000) return 'just now'
  const s = Math.round(d / 1000)
  if (s < 60) return `${s}s ago`
  return `${Math.round(s / 60)}m ago`
}

// ── DesktopAmbiancePanel ─────────────────────────────────────────────

export function DesktopAmbiancePanel() {
  const saveConfig         = useAdminStore((s) => s.saveConfig)
  const allApps            = useAdminStore((s) => s.config.applications)
  const allLayouts         = useAdminStore((s) => s.config.widgetLayouts ?? [])
  const allScenes          = useAdminStore((s) => s.config.scenes ?? {})
  const rawDesktopAmbiance = useAdminStore((s) => s.config.desktopAmbiance)
  const ambianceDiag       = useAdminStore((s) => s.runtimeDiagnostics.ambiance)

  const userLayouts = allLayouts.filter((l) => l.source === 'user')
  const sceneEntries: Array<{ id: string; label: string; icon: string }> = [
    { id: STATE.LOBBY,   label: 'Lobby',   icon: '🌐' },
    { id: STATE.DESKTOP, label: 'Desktop', icon: '🖥' },
    ...Object.values(allScenes)
      .filter((s) => s.id !== STATE.LOBBY && s.id !== STATE.DESKTOP)
      .map((s) => ({ id: s.id, label: s.label, icon: '🎬' })),
  ]

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
      <ConfigPageIntro title="Ghost User">
        Simulates an AI agent using the Desktop OS — opens widgets, applies layouts, and switches scenes. One
        engine drives widget, layout, and scene targets together, so they share this single tick loop and save.
      </ConfigPageIntro>

      <ConfigSectionPanel label="Engine status">
        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <div className="rounded-xl border border-white/6 bg-white/[0.02] px-5 py-4">
            <div className="text-[9px] uppercase tracking-wider text-zinc-600 mb-0.5">Last tick</div>
            <div className="text-zinc-300 font-medium">{formatAgo(ambianceDiag.lastTickAt)}</div>
          </div>
          <div className="rounded-xl border border-white/6 bg-white/[0.02] px-5 py-4">
            <div className="text-[9px] uppercase tracking-wider text-zinc-600 mb-0.5">Overlay ready</div>
            <div className="text-zinc-300 font-medium">{ambianceDiag.overlayReady ? 'Yes' : 'No'}</div>
          </div>
          <div className="rounded-xl border border-white/6 bg-white/[0.02] px-5 py-4">
            <div className="text-[9px] uppercase tracking-wider text-zinc-600 mb-0.5">Last action</div>
            <div className="text-zinc-400">
              {ambianceDiag.lastAction
                ? `${ambianceDiag.lastAction} · ${ambianceDiag.lastActionWidgetId ?? '—'} · ${formatAgo(ambianceDiag.lastActionAt)}`
                : '—'}
            </div>
          </div>
          <div className="rounded-xl border border-white/6 bg-white/[0.02] px-5 py-4">
            <div className="text-[9px] uppercase tracking-wider text-zinc-600 mb-0.5">Status</div>
            <div className="text-zinc-400">
              {ambianceDiag.inFlight ? `in flight (${ambianceDiag.pendingPhase ?? '—'})` : (ambianceDiag.lastSkipReason ?? 'idle')}
            </div>
          </div>
        </div>
      </ConfigSectionPanel>

      <ConfigSectionPanel label="Widget ambiance">
        <WidgetAmbianceSection
          form={draft}
          update={updateAmbiance}
          allApps={allApps}
          onEnableAll={enableAllAmbianceTargets}
          showEnableAll={!simConfig.enabled || totalAmbianceEnabled === 0}
        />
      </ConfigSectionPanel>

      <ConfigSectionPanel label="Layout ambiance">
        <LayoutAmbianceSection form={draft} update={updateAmbiance} userLayouts={userLayouts} />
      </ConfigSectionPanel>

      <ConfigSectionPanel label="Scene ambiance">
        <SceneAmbianceSection form={draft} update={updateAmbiance} sceneEntries={sceneEntries} />
      </ConfigSectionPanel>

      <ConfigApplyBar
        label="Ghost User"
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
