import { useEffect, useMemo, useState } from 'react'
import type { MediaEntry, TransitionStep } from '@ieom/shared'
import { socket } from '../../socket/client'
import { useAdminStore } from '../../store/useAdminStore'
import { Btn } from '../ui'
import {
  TRANSITION_ICONS,
  TRANSITION_OPTIONS,
  TRANSITION_TEST_BUTTON_CLASS,
  encodeMediaTransitionValue,
  formatBuiltInTransitionValue,
  getMediaTransitionLabel,
  parseBuiltInTransitionValue,
  parseMediaTransitionValue,
  stepToStr,
  strToStep,
} from '../transitionLibrary'

export function TransitionPicker({
  value,
  onChange,
  placeholder = '— Default —',
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  const mediaLibrary = useAdminStore((s) => s.config.mediaLibrary ?? [])
  const [durationDraft, setDurationDraft] = useState('')

  const mediaParsed = value.startsWith('media:') ? parseMediaTransitionValue(value) : null
  const gsapParsed = !value.startsWith('media:') ? parseBuiltInTransitionValue(value) : null
  const selectedBuiltIn = TRANSITION_OPTIONS.find((transition) => transition.id === (gsapParsed?.id ?? ''))

  const savedCustomOptions = useMemo(() => (
    [...mediaLibrary]
      .sort((left, right) => getMediaTransitionLabel(left).localeCompare(getMediaTransitionLabel(right)))
      .map((entry) => ({ encoded: encodeMediaTransitionValue(entry), entry }))
  ), [mediaLibrary])

  const customOptions = useMemo(() => {
    if (!mediaParsed) return savedCustomOptions
    if (savedCustomOptions.some((option) => option.encoded === value)) return savedCustomOptions
    return [
      {
        encoded: value,
        entry: {
          id: 'current-transition',
          name: mediaParsed.name || getMediaTransitionLabel(mediaParsed),
          type: mediaParsed.type,
          url: mediaParsed.url,
          ...(mediaParsed.duration != null ? { duration: mediaParsed.duration } : {}),
        } satisfies MediaEntry,
      },
      ...savedCustomOptions,
    ]
  }, [mediaParsed, savedCustomOptions, value])

  useEffect(() => {
    setDurationDraft(gsapParsed?.duration?.toString() ?? '')
  }, [gsapParsed?.duration, gsapParsed?.id, value])

  const handleSelect = (nextValue: string) => {
    setDurationDraft('')
    onChange(nextValue)
  }

  const commitDuration = () => {
    if (!selectedBuiltIn) return
    onChange(formatBuiltInTransitionValue(selectedBuiltIn.id, durationDraft))
  }

  const previewValue = selectedBuiltIn
    ? formatBuiltInTransitionValue(selectedBuiltIn.id, durationDraft)
    : value

  return (
    <div className="space-y-1.5">
      <div className="flex items-start gap-1.5">
        <select
          value={mediaParsed ? value : gsapParsed?.id ?? ''}
          onChange={(event) => handleSelect(event.target.value)}
          className="flex-1 text-xs"
        >
          <option value="">{placeholder}</option>
          <optgroup label="System transitions">
            {TRANSITION_OPTIONS.map((transition) => (
              <option key={transition.id} value={transition.id}>
                {TRANSITION_ICONS[transition.id]} {transition.label}
              </option>
            ))}
          </optgroup>
          {customOptions.length > 0 && (
            <optgroup label="User transitions">
              {customOptions.map((option) => (
                <option key={option.encoded} value={option.encoded}>
                  {option.entry.type === 'image' ? '🖼' : '🎬'} {getMediaTransitionLabel(option.entry)}
                </option>
              ))}
            </optgroup>
          )}
        </select>
        <button
          type="button"
          disabled={!previewValue}
          onClick={() => {
            if (!previewValue) return
            if (selectedBuiltIn && previewValue !== value) onChange(previewValue)
            socket.emit('transition:preview', [strToStep(previewValue)])
          }}
          className={`shrink-0 ${TRANSITION_TEST_BUTTON_CLASS}`}
          title={previewValue ? 'Test on overlay' : 'Pick a transition first'}
        >
          Test
        </button>
      </div>

      {selectedBuiltIn && (
        <div className="flex items-center gap-2 pl-1">
          <span className="text-[10px] text-zinc-500 uppercase tracking-wide">Duration</span>
          <input
            type="number" min={0.1} max={60} step={0.1}
            value={durationDraft}
            onChange={(event) => setDurationDraft(event.target.value)}
            onBlur={commitDuration}
            onKeyDown={(event) => {
              if (event.key === 'Enter') { event.preventDefault(); commitDuration(); event.currentTarget.blur() }
            }}
            placeholder="default"
            className="w-24 text-xs font-mono"
          />
          <span className="text-[10px] text-zinc-600">sec</span>
        </div>
      )}

      {mediaParsed && (
        <div className="flex items-center gap-2 pl-1 text-[10px] text-zinc-500">
          <span className="truncate">{mediaParsed.url.split('/').pop() || mediaParsed.url}</span>
          {mediaParsed.duration != null && (
            <span className="shrink-0 font-mono text-zinc-600">{mediaParsed.duration}s</span>
          )}
        </div>
      )}
    </div>
  )
}

export function TransitionList({
  value,
  onChange,
}: {
  value: TransitionStep[]
  onChange: (steps: TransitionStep[]) => void
}) {
  const mediaLibrary = useAdminStore((s) => s.config.mediaLibrary ?? [])
  const steps = value ?? []

  const userTransitions = useMemo(
    () => [...mediaLibrary].sort((left, right) => getMediaTransitionLabel(left).localeCompare(getMediaTransitionLabel(right))),
    [mediaLibrary],
  )

  const transitionOptions = useMemo(() => ([
    ...TRANSITION_OPTIONS.map((transition) => ({
      value: transition.id,
      label: `${transition.label} · ${transition.id}`,
      group: 'system' as const,
    })),
    ...userTransitions.map((entry) => ({
      value: encodeMediaTransitionValue(entry),
      label: getMediaTransitionLabel(entry),
      group: 'user' as const,
      subtitle: entry.url,
    })),
  ]), [userTransitions])

  const addStep = (step: TransitionStep) => onChange([...steps, step])
  const updateStep = (idx: number, str: string) => {
    const next = [...steps]; next[idx] = strToStep(str); onChange(next)
  }
  const moveUp = (idx: number) => {
    if (idx === 0) return
    const next = [...steps];[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]; onChange(next)
  }
  const moveDown = (idx: number) => {
    if (idx === steps.length - 1) return
    const next = [...steps];[next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]; onChange(next)
  }
  const removeStep = (idx: number) => onChange(steps.filter((_, i) => i !== idx))

  return (
    <div className="space-y-2">
      {steps.map((step, idx) => (
        <div key={`${step.id}-${idx}`} className="flex items-start gap-2 rounded-lg border border-zinc-800/80 bg-zinc-950/50 px-3 py-2">
          <div className="min-w-0 flex-1">
            <select value={stepToStr(step)} onChange={(event) => updateStep(idx, event.target.value)} className="w-full text-xs">
              <option value="">-- Pick transition --</option>
              <optgroup label="System transitions">
                {transitionOptions.filter((o) => o.group === 'system').map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </optgroup>
              {transitionOptions.some((o) => o.group === 'user') && (
                <optgroup label="User transitions">
                  {transitionOptions.filter((o) => o.group === 'user').map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>
          <div className="flex shrink-0 flex-col gap-1">
            <Btn type="button" variant="ghost" onClick={() => moveUp(idx)} disabled={idx === 0} className="px-2 py-1 text-[10px]">Up</Btn>
            <Btn type="button" variant="ghost" onClick={() => moveDown(idx)} disabled={idx === steps.length - 1} className="px-2 py-1 text-[10px]">Down</Btn>
          </div>
          <Btn type="button" variant="danger" onClick={() => removeStep(idx)} className="px-2 py-1 text-[10px]">Delete</Btn>
        </div>
      ))}
      {transitionOptions.length ? (
        <Btn type="button" onClick={() => addStep({ id: '' })} variant="ghost"
          className="mt-1 w-full justify-center border-dashed border-zinc-700/80 py-2 text-xs text-zinc-400 hover:text-cyan-200">
          Add
        </Btn>
      ) : (
        <div className="rounded border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-[10px] text-zinc-500">
          No transitions available yet. Create user transitions in the Asset Library Transitions tab first.
        </div>
      )}
    </div>
  )
}

export function compactTransitionSteps(steps: TransitionStep[]) {
  return steps.filter((step) => step.id)
}
