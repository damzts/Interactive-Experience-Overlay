import { useEffect, useState } from 'react'
import type { Sequence, SequenceStep } from '@ieomlabs/shared'
import { socket } from '../../socket/client'
import { updateSequence, deleteSequence } from '../../api/sequencesApi'
import { ConfigPanel } from '../../components/organisms'
import { StepListEditor } from './StepListEditor'
import { Btn } from '../../shared/ui'

export function SequenceEditor({ sequence, onSaved, onDeleted }: {
  sequence: Sequence
  onSaved?: (next: Sequence) => void
  onDeleted?: () => void
}) {
  const [label, setLabel] = useState(sequence.label)
  const [steps, setSteps] = useState<SequenceStep[]>(sequence.steps)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setLabel(sequence.label)
    setSteps(sequence.steps)
  }, [sequence.id])

  const dirty = label !== sequence.label || JSON.stringify(steps) !== JSON.stringify(sequence.steps)

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

          <StepListEditor steps={steps} onChange={setSteps} />

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
