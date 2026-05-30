import { useState, useEffect, useCallback } from 'react'
import type { POVSwitchingConfig, TransitionConfig } from '@ieom/shared'
import { getPovConfig, updatePovConfig } from '../../api/povApi'
import {
  Btn,
  ConfigSectionPanel,
  ConfigNotice,
  ConfigPageIntro,
  ConfigChoiceButton,
  Slider,
  Field,
} from '../../shared/ui'

/** Default config values matching the design document */
const DEFAULTS: POVSwitchingConfig = {
  pollIntervalMs: 100,
  rollingWindowMs: 2000,
  cooldownMs: 3000,
  activityThreshold: 0.15,
  silenceThreshold: 0.05,
  healthCheckIntervalMs: 10000,
  maxConnections: 10,
  transition: { type: 'cut', durationMs: 0 },
  scoreEmitIntervalMs: 500,
  dbFloor: -60,
  dbCeiling: 0,
}

export function PovConfigPanel() {
  const [config, setConfig] = useState<POVSwitchingConfig>(DEFAULTS)
  const [draft, setDraft] = useState<POVSwitchingConfig>(DEFAULTS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load current config on mount
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const data = await getPovConfig()
        if (!cancelled) {
          setConfig(data)
          setDraft(data)
          setLoading(false)
        }
      } catch (err) {
        if (!cancelled) {
          setLoading(false)
          setError('Failed to load POV configuration')
        }
      }
    }
    void load()
    return () => { cancelled = true }
  }, [])

  const handleSave = useCallback(async () => {
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const updated = await updatePovConfig(draft)
      setConfig(updated)
      setDraft(updated)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      // Retain form values on failure
      setError(err instanceof Error ? err.message : 'Failed to save configuration')
    } finally {
      setSaving(false)
    }
  }, [draft])

  const handleReset = useCallback(() => {
    setDraft(config)
    setError(null)
  }, [config])

  const updateDraft = useCallback(<K extends keyof POVSwitchingConfig>(
    key: K,
    value: POVSwitchingConfig[K],
  ) => {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }, [])

  const updateTransition = useCallback((partial: Partial<TransitionConfig>) => {
    setDraft((prev) => ({
      ...prev,
      transition: { ...prev.transition, ...partial },
    }))
  }, [])

  if (loading) {
    return (
      <div className="w-full max-w-none space-y-0 pt-1">
        <ConfigPageIntro title="POV Switching Configuration" eyebrow="Camera System">
          Loading configuration…
        </ConfigPageIntro>
      </div>
    )
  }

  return (
    <div className="w-full max-w-none space-y-0 pt-1">
      <ConfigPageIntro title="POV Switching Configuration" eyebrow="Camera System">
        Configure automatic camera switching behavior including cooldown timing, activity thresholds, audio monitoring parameters, and transition effects.
      </ConfigPageIntro>

      {/* Status indicators */}
      {saved && (
        <ConfigNotice tone="success" className="mb-3">
          ✔ Configuration saved successfully. Changes applied.
        </ConfigNotice>
      )}
      {error && (
        <ConfigNotice tone="danger" className="mb-3">
          ✖ {error}
        </ConfigNotice>
      )}

      {/* Switching Behavior */}
      <ConfigSectionPanel label="Switching Behavior" first>
        <ConfigNotice>
          Controls how aggressively the system switches between camera feeds based on audio activity.
        </ConfigNotice>
        <div className="mt-4 space-y-2">
          <Slider
            label="Cooldown"
            value={draft.cooldownMs / 1000}
            min={1}
            max={30}
            step={0.5}
            unit="s"
            onChange={(v) => updateDraft('cooldownMs', Math.round(v * 1000))}
          />
          <Slider
            label="Activity Threshold"
            value={draft.activityThreshold}
            min={0.01}
            max={1.0}
            step={0.01}
            onChange={(v) => updateDraft('activityThreshold', v)}
          />
          <Slider
            label="Silence Threshold"
            value={draft.silenceThreshold}
            min={0.0}
            max={1.0}
            step={0.01}
            onChange={(v) => updateDraft('silenceThreshold', v)}
          />
        </div>
      </ConfigSectionPanel>

      {/* Audio Monitoring */}
      <ConfigSectionPanel label="Audio Monitoring">
        <ConfigNotice>
          Adjust how frequently audio levels are sampled and the window used for computing activity scores.
        </ConfigNotice>
        <div className="mt-4 space-y-2">
          <Slider
            label="Poll Interval"
            value={draft.pollIntervalMs}
            min={50}
            max={1000}
            step={10}
            unit="ms"
            onChange={(v) => updateDraft('pollIntervalMs', Math.round(v))}
          />
          <Slider
            label="Rolling Window"
            value={draft.rollingWindowMs}
            min={500}
            max={10000}
            step={100}
            unit="ms"
            onChange={(v) => updateDraft('rollingWindowMs', Math.round(v))}
          />
        </div>
      </ConfigSectionPanel>

      {/* Transition Settings */}
      <ConfigSectionPanel label="Transition">
        <ConfigNotice>
          Choose how camera switches appear on the output stream.
        </ConfigNotice>
        <div className="mt-4 space-y-3">
          <Field label="Transition Type">
            <div className="flex gap-2">
              <ConfigChoiceButton
                selected={draft.transition.type === 'cut'}
                onClick={() => updateTransition({ type: 'cut', durationMs: 0 })}
              >
                Cut
              </ConfigChoiceButton>
              <ConfigChoiceButton
                selected={draft.transition.type === 'fade'}
                onClick={() => updateTransition({ type: 'fade', durationMs: draft.transition.durationMs || 500 })}
              >
                Fade
              </ConfigChoiceButton>
            </div>
          </Field>
          {draft.transition.type === 'fade' && (
            <Slider
              label="Fade Duration"
              value={draft.transition.durationMs}
              min={100}
              max={5000}
              step={50}
              unit="ms"
              onChange={(v) => updateTransition({ durationMs: Math.round(v) })}
            />
          )}
        </div>
      </ConfigSectionPanel>

      {/* Save / Reset */}
      <div className="mt-5 flex items-center gap-3 px-0.5">
        <Btn variant="primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Apply Configuration'}
        </Btn>
        <Btn variant="default" onClick={handleReset} disabled={saving}>
          Reset
        </Btn>
      </div>
    </div>
  )
}
