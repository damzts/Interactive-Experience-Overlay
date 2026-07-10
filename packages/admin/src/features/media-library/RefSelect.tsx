/**
 * RefSelect — entity picker behind the FieldDef type 'ref'.
 *
 * Resolves options per refKind: scenes/widgets/layouts/window-presets live
 * in the config store; presets and sequences are fetched once per mount.
 * A configured-but-missing id stays selectable (marked "missing") so a
 * stale reference is visible instead of silently dropped, and a ✎ toggle
 * switches to a free-text input for ids the picker can't list yet.
 */
import { useEffect, useState } from 'react'
import type { RefKind } from '@ieomlabs/shared'
import { useAdminStore } from '../../store/useAdminStore'
import { fetchPresets } from '../../api/presetsApi'
import { fetchSequences } from '../../api/sequencesApi'

interface RefOption { id: string; label: string }

function useRefOptions(refKind: RefKind): RefOption[] {
  const scenes        = useAdminStore((s) => s.config.scenes)
  const applications  = useAdminStore((s) => s.config.applications)
  const widgetLayouts = useAdminStore((s) => s.config.widgetLayouts ?? [])
  const windowPresets = useAdminStore((s) => s.config.windowPresets ?? [])
  const sourceEvents  = useAdminStore((s) => s.config.sourceEvents ?? [])
  const [fetched, setFetched] = useState<RefOption[]>([])

  useEffect(() => {
    if (refKind !== 'preset' && refKind !== 'sequence') return
    let cancelled = false
    const load = refKind === 'preset'
      ? fetchPresets().then((list) => list.map((p) => ({ id: p.id, label: p.label })))
      : fetchSequences().then((list) => list.map((s) => ({ id: s.id, label: s.label })))
    load.then((options) => { if (!cancelled) setFetched(options) }).catch(() => {})
    return () => { cancelled = true }
  }, [refKind])

  switch (refKind) {
    case 'scene':         return Object.values(scenes).map((s) => ({ id: s.id, label: s.label }))
    case 'widget':        return applications.map((a) => ({ id: a.id, label: a.label }))
    case 'widget-layout': return widgetLayouts.map((l) => ({ id: l.id, label: l.label }))
    case 'window-preset': return windowPresets.map((p) => ({ id: p.id, label: p.label }))
    case 'event':         return sourceEvents.map((e) => ({ id: e.id, label: e.label }))
    case 'preset':
    case 'sequence':      return fetched
  }
}

export function RefSelect({ refKind, value, onChange, optional, placeholder }: {
  refKind: RefKind
  value: string
  onChange: (value: string | undefined) => void
  optional?: boolean
  placeholder?: string
}) {
  const options = useRefOptions(refKind)
  const [manual, setManual] = useState(false)

  // Keep a configured-but-missing id selectable so it isn't silently lost.
  const known = options.some((o) => o.id === value)
  const displayOptions = value && !known
    ? [{ id: value, label: `${value} (missing)` }, ...options]
    : options

  const emit = (raw: string) => onChange(raw === '' && optional ? undefined : raw)

  return (
    <div className="flex items-center gap-1.5">
      {manual ? (
        <input
          type="text"
          value={value ?? ''}
          placeholder={placeholder ?? 'entity id'}
          onChange={(e) => emit(e.target.value)}
          className="w-full font-mono text-xs"
        />
      ) : (
        <select
          value={value ?? ''}
          onChange={(e) => emit(e.target.value)}
          className="w-full text-xs [&>option]:bg-zinc-900"
        >
          <option value="">{placeholder ?? '— select —'}</option>
          {displayOptions.map((o) => (
            <option key={o.id} value={o.id}>{o.label}</option>
          ))}
        </select>
      )}
      <button
        type="button"
        title={manual ? 'Pick from list' : 'Type an id manually'}
        onClick={() => setManual((m) => !m)}
        className="shrink-0 rounded-md border border-white/10 bg-white/5 px-1.5 py-1 text-[10px] text-zinc-500 hover:border-white/25 hover:text-zinc-300"
      >
        {manual ? '▾' : '✎'}
      </button>
    </div>
  )
}
