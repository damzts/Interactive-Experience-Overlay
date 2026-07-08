import { useEffect, useState } from 'react'
import type { Sequence } from '@ieomlabs/shared'
import { fetchSequences } from '../../api/sequencesApi'
import { SequenceEditor } from './SequenceEditor'

/** Hosts a single Sequence's editor, re-fetching the list after
 *  save/delete so NavListBox's sidebar stays in sync. */
export function SequencesHost({ sequenceId, onDeleted }: { sequenceId: string; onDeleted?: () => void }) {
  const [sequence, setSequence] = useState<Sequence | null>(null)

  const reload = async () => {
    const all = await fetchSequences()
    setSequence(all.find((s) => s.id === sequenceId) ?? null)
  }

  useEffect(() => { void reload() }, [sequenceId])

  if (!sequence) return <div className="p-4 text-xs text-zinc-500">Loading…</div>

  return (
    <SequenceEditor
      sequence={sequence}
      onSaved={setSequence}
      onDeleted={onDeleted}
    />
  )
}
