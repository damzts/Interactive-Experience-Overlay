import { useEffect, useState } from 'react'
import { EFFECT_CATALOG, getEffectLabel } from '@ieomlabs/shared'
import type { EffectType, Sequence, SequenceStep } from '@ieomlabs/shared'
import { socket } from '../../socket/client'
import { updateSequence, deleteSequence } from '../../api/sequencesApi'
import { ConfigPanel } from '../../components/organisms'
import { SchemaForm } from '../media-library/SchemaForm'
import { EFFECT_CATEGORIES, createEffectDraft } from '../media-library/eventPresets'
import { Btn } from '../../shared/ui'

function createStepDraft(type: EffectType): SequenceStep {
  return { effect: createEffectDraft(type) }
}

function stepKindLabel(step: SequenceStep): string {
  if (step.effect) return getEffectLabel(step.effect.type)
  if (step.renderer) return step.renderer
  if (step.waitForSignal) return `⏸ wait for signal`
  if (step.emitSignal) return `📡 emit signal`
  if (step.parallel) return `⫲ parallel group (${step.parallel.length})`
  return '—'
}

export function SequenceEditor({ sequence, onSaved, onDeleted }: {
  sequence: Sequence
  onSaved?: (next: Sequence) => void
  onDeleted?: () => void
}) {
  const [label, setLabel] = useState(sequence.label)
  const [steps, setSteps] = useState<SequenceStep[]>(sequence.steps)
  const [collapsed, setCollapsed] = useState<number[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setLabel(sequence.label)
    setSteps(sequence.steps)
    setCollapsed([])
  }, [sequence.id])

  const dirty = label !== sequence.label || JSON.stringify(steps) !== JSON.stringify(sequence.steps)

  const addStep = (type: EffectType) => {
    setSteps((prev) => [...prev, createStepDraft(type)])
  }

  const removeStep = (idx: number) => setSteps((prev) => prev.filter((_, i) => i !== idx))

  const moveUp = (idx: number) => {
    if (idx === 0) return
    setSteps((prev) => {
      const next = [...prev];[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]; return next
    })
  }
  const moveDown = (idx: number) => {
    setSteps((prev) => {
      if (idx >= prev.length - 1) return prev
      const next = [...prev];[next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]; return next
    })
  }

  const toggleCollapsed = (idx: number) => {
    setCollapsed((prev) => prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx])
  }

  const updateStepCfg = (idx: number, key: string, value: unknown) => {
    setSteps((prev) => prev.map((step, i) => {
      if (i !== idx || !step.effect) return step
      return { ...step, effect: { ...step.effect, cfg: { ...step.effect.cfg, [key]: value } as any } }
    }))
  }

  const updateStepWaitMs = (idx: number, waitMs: number | undefined) => {
    setSteps((prev) => prev.map((step, i) => i === idx ? { ...step, waitMs } : step))
  }

  const updateStep = (idx: number, patch: Partial<SequenceStep>) => {
    setSteps((prev) => prev.map((step, i) => i === idx ? { ...step, ...patch } : step))
  }

  const testSequence = () => {
    if (steps.length) socket.emit('transition:preview', steps)
  }

  const save = async () => {
    setSaving(true)
    try {
      const next = await updateSequence(sequence.id, { label: label.trim() || sequence.label, steps })
      onSaved?.(next)
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    await deleteSequence(sequence.id)
    onDeleted?.()
  }

  return (
    <div className="space-y-3">
      <ConfigPanel title="Sequence">
        <div className="space-y-3">
          <input type="text" placeholder="Sequence name" value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="w-full text-xs" />

          <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/50 px-3 py-3">
            <div className="mb-2 text-[10px] uppercase tracking-[0.14em] text-zinc-500">Add Effect</div>
            <select defaultValue="" onChange={(event) => {
              const type = event.target.value as EffectType
              if (!type) return
              event.target.value = ''
              addStep(type)
            }} className="w-full text-sm">
              <option value="">Select effect type…</option>
              {EFFECT_CATEGORIES.map((cat) => (
                <optgroup key={cat.label} label={cat.label}>
                  {cat.effects.map((type) => <option key={type} value={type}>{getEffectLabel(type)}</option>)}
                </optgroup>
              ))}
            </select>
            <div className="mt-2 flex items-center gap-2">
              <button type="button"
                onClick={() => setSteps((prev) => [...prev, { waitForSignal: { event: '', timeoutMs: 30000 } }])}
                className="rounded-md border border-zinc-700/80 bg-zinc-900/80 px-2.5 py-1 text-[11px] text-zinc-300 hover:border-zinc-500">
                + Wait for signal
              </button>
              <button type="button"
                onClick={() => setSteps((prev) => [...prev, { emitSignal: { event: '' } }])}
                className="rounded-md border border-zinc-700/80 bg-zinc-900/80 px-2.5 py-1 text-[11px] text-zinc-300 hover:border-zinc-500">
                + Emit signal
              </button>
              <button type="button"
                onClick={() => setSteps((prev) => [...prev, { parallel: [] }])}
                className="rounded-md border border-zinc-700/80 bg-zinc-900/80 px-2.5 py-1 text-[11px] text-zinc-300 hover:border-zinc-500">
                + Parallel group
              </button>
            </div>
          </div>

          {steps.length === 0 && <div className="text-[10px] italic text-zinc-600">No steps yet — add an effect above.</div>}

          <div className="space-y-3">
            {steps.map((step, idx) => {
              const type = step.effect?.type
              const fields = type ? EFFECT_CATALOG[type]?.fields ?? [] : []
              return (
                <div key={idx} className="space-y-3 rounded-2xl border border-cyan-500/25 bg-cyan-500/5 px-4 py-4">
                  <div className="flex items-start gap-2 border-b border-zinc-800/80 pb-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] uppercase tracking-[0.14em] text-cyan-300/80">Step {idx + 1}</div>
                      <div className="mt-1 font-mono text-xs text-zinc-300">{stepKindLabel(step)}</div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => moveUp(idx)} disabled={idx === 0}
                        className="rounded-md border border-zinc-700/80 bg-zinc-900/80 px-2 py-1 text-[11px] text-zinc-300 disabled:opacity-30">↑</button>
                      <button type="button" onClick={() => moveDown(idx)} disabled={idx === steps.length - 1}
                        className="rounded-md border border-zinc-700/80 bg-zinc-900/80 px-2 py-1 text-[11px] text-zinc-300 disabled:opacity-30">↓</button>
                      <button type="button" onClick={() => toggleCollapsed(idx)}
                        className="rounded-md border border-zinc-700/80 bg-zinc-900/80 px-2.5 py-1 text-[11px] font-medium text-zinc-300">
                        {collapsed.includes(idx) ? 'Expand' : 'Collapse'}
                      </button>
                      <button type="button" onClick={() => removeStep(idx)}
                        className="rounded-md border border-red-500/45 bg-red-500/12 px-2.5 py-1 text-[11px] font-semibold text-red-200">✕</button>
                    </div>
                  </div>

                  {!collapsed.includes(idx) && (
                    <div className="space-y-3">
                      {!step.waitForSignal && (
                        <label className="block text-[10px] text-zinc-500">
                          {step.parallel
                            ? <>Fixed group duration (ms) <span className="normal-case font-normal text-zinc-600">(blank = wait for all sub-steps; set = cut off stragglers)</span></>
                            : <>Wait before next step (ms) <span className="normal-case font-normal text-zinc-600">(blank = use effect's own duration)</span></>}
                          <input type="number" min={0} step={100} value={step.waitMs ?? ''}
                            onChange={(e) => updateStepWaitMs(idx, e.target.value === '' ? undefined : Number(e.target.value))}
                            className="mt-1 w-full text-xs" />
                        </label>
                      )}
                      {type && fields.length > 0 && (
                        <SchemaForm
                          fields={fields}
                          values={step.effect!.cfg as Record<string, unknown>}
                          onChange={(key, value) => updateStepCfg(idx, key, value)}
                        />
                      )}
                      {step.waitForSignal && (
                        <div className="grid grid-cols-2 gap-2">
                          <label className="block text-[10px] text-zinc-500">
                            Signal event <span className="normal-case font-normal text-zinc-600">(kernel or widget, e.g. twitch:follow)</span>
                            <input type="text" value={step.waitForSignal.event}
                              onChange={(e) => updateStep(idx, { waitForSignal: { ...step.waitForSignal!, event: e.target.value } })}
                              placeholder="e.g. audio:beat" className="mt-1 w-full text-xs font-mono" />
                          </label>
                          <label className="block text-[10px] text-zinc-500">
                            Timeout (ms) <span className="normal-case font-normal text-zinc-600">(advance anyway after)</span>
                            <input type="number" min={0} step={500} value={step.waitForSignal.timeoutMs ?? 30000}
                              onChange={(e) => updateStep(idx, { waitForSignal: { ...step.waitForSignal!, timeoutMs: Number(e.target.value) || 30000 } })}
                              className="mt-1 w-full text-xs" />
                          </label>
                        </div>
                      )}
                      {step.emitSignal && (
                        <div className="grid grid-cols-2 gap-2">
                          <label className="block text-[10px] text-zinc-500">
                            Signal event <span className="normal-case font-normal text-zinc-600">(widgets + automation rules react)</span>
                            <input type="text" value={step.emitSignal.event}
                              onChange={(e) => updateStep(idx, { emitSignal: { ...step.emitSignal!, event: e.target.value } })}
                              placeholder="e.g. show:hype-done" className="mt-1 w-full text-xs font-mono" />
                          </label>
                          <label className="block text-[10px] text-zinc-500">
                            Payload JSON <span className="normal-case font-normal text-zinc-600">(optional)</span>
                            <input type="text" defaultValue={step.emitSignal.payload ? JSON.stringify(step.emitSignal.payload) : ''}
                              onBlur={(e) => {
                                let payload: Record<string, unknown> | undefined
                                try { payload = e.target.value.trim() ? JSON.parse(e.target.value) : undefined } catch { payload = undefined }
                                updateStep(idx, { emitSignal: { ...step.emitSignal!, payload } })
                              }}
                              placeholder='{"mood":"hype"}' className="mt-1 w-full text-xs font-mono" />
                          </label>
                        </div>
                      )}
                      {step.parallel && (
                        <label className="block text-[10px] text-zinc-500">
                          Sub-steps JSON <span className="normal-case font-normal text-zinc-600">(array of steps run concurrently — same shape as sequence steps)</span>
                          <textarea rows={5} defaultValue={JSON.stringify(step.parallel, null, 2)}
                            onBlur={(e) => {
                              try {
                                const parsed = JSON.parse(e.target.value)
                                if (Array.isArray(parsed)) updateStep(idx, { parallel: parsed })
                              } catch { /* keep previous on invalid JSON */ }
                            }}
                            className="mt-1 w-full text-xs font-mono" />
                        </label>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <div className="flex items-center justify-between pt-2">
            <Btn variant="danger" onClick={remove}>Delete Sequence</Btn>
            <div className="flex items-center gap-2">
              {steps.length > 0 && (
                <Btn variant="ghost" onClick={testSequence}>Test ▶</Btn>
              )}
              <Btn variant="primary" onClick={save} disabled={!dirty || saving}>
                {saving ? 'Saving…' : 'Save'}
              </Btn>
            </div>
          </div>
        </div>
      </ConfigPanel>
    </div>
  )
}
