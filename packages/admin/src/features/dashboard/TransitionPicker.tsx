import { useMemo } from 'react'
import type { TransitionStep } from '@ieomlabs/shared'
import { socket } from '../../socket/client'
import { useAdminStore } from '../../store/useAdminStore'
import {
  TRANSITION_ICONS,
  TRANSITION_OPTIONS,
  encodeMediaTransitionValue,
  getMediaTransitionLabel,
  stepToStr,
  strToStep,
} from '../../shared/transitionLibrary'

/**
 * TransitionChipPicker — compact pipeline builder.
 *
 * Top: available transition chips (click to append to pipeline).
 * Bottom: active pipeline chips in order (✕ to remove, ↑↓ to reorder, Test to preview all).
 */
export function TransitionChipPicker({
  label,
  steps,
  onChange,
}: {
  label: string
  steps: TransitionStep[]
  onChange: (steps: TransitionStep[]) => void
}) {
  const mediaLibrary = useAdminStore((s) => s.config.sourceMedia ?? [])

  const allOptions = useMemo(() => [
    ...TRANSITION_OPTIONS.map((t) => ({ id: t.id, label: t.label, icon: TRANSITION_ICONS[t.id] ?? '▶' })),
    ...mediaLibrary.map((e) => ({
      id: encodeMediaTransitionValue(e),
      label: getMediaTransitionLabel(e),
      icon: e.type === 'video' ? '🎬' : '🖼',
    })),
  ], [mediaLibrary])

  const append = (id: string) => onChange([...steps, strToStep(id)])
  const remove = (idx: number) => onChange(steps.filter((_, i) => i !== idx))
  const moveUp = (idx: number) => {
    if (idx === 0) return
    const next = [...steps];[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]; onChange(next)
  }
  const moveDown = (idx: number) => {
    if (idx >= steps.length - 1) return
    const next = [...steps];[next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]; onChange(next)
  }
  const testPipeline = () => {
    if (steps.length) socket.emit('transition:preview', steps)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wide">{label}</span>
        {steps.length > 0 && (
          <button type="button" onClick={testPipeline}
            className="text-[10px] rounded border border-cyan-500/40 bg-cyan-600/20 px-2 py-0.5 text-cyan-300 hover:bg-cyan-600/35 transition-colors">
            Test ▶
          </button>
        )}
      </div>

      {/* Available chips */}
      <div className="flex flex-wrap gap-1">
        {allOptions.map((opt) => (
          <button key={opt.id} type="button" onClick={() => append(opt.id)}
            className="flex items-center gap-1 rounded-full border border-zinc-700/60 bg-zinc-900/60 px-2 py-0.5 text-[10px] text-zinc-400 hover:border-cyan-500/50 hover:text-cyan-300 transition-colors">
            <span>{opt.icon}</span>
            <span>{opt.label}</span>
          </button>
        ))}
      </div>

      {/* Active pipeline */}
      {steps.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 rounded-lg border border-zinc-800/60 bg-zinc-950/40 px-2 py-2">
          {steps.map((step, idx) => {
            const opt = allOptions.find((o) => o.id === step.id || o.id === stepToStr(step))
            return (
              <span key={`${step.id}-${idx}`}
                className="flex items-center gap-1 rounded-full border border-cyan-500/40 bg-cyan-600/15 px-2 py-0.5 text-[10px] text-cyan-200">
                <span>{opt?.icon ?? '▶'}</span>
                <span>{opt?.label ?? step.id}</span>
                {idx > 0 && (
                  <button type="button" onClick={() => moveUp(idx)} className="opacity-50 hover:opacity-100 ml-0.5">↑</button>
                )}
                {idx < steps.length - 1 && (
                  <button type="button" onClick={() => moveDown(idx)} className="opacity-50 hover:opacity-100">↓</button>
                )}
                <button type="button" onClick={() => remove(idx)} className="opacity-50 hover:opacity-100 ml-0.5">✕</button>
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}
