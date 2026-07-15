import { useCallback, useId, useState } from 'react'
import { useAdminStore } from '../../store/useAdminStore'
import type { CaptureSource } from '@ieomlabs/shared'
import { useScreenSharePublisher } from '../../hooks/useScreenSharePublisher'
import { Button } from '../../components/atoms'
import { ConfigPanel } from '../../components/organisms'

// ── Single source row ──────────────────────────────────────────────

function SourceRow({
  source,
  onUpdate,
  onRemove,
}: {
  source: CaptureSource
  onUpdate: (updated: CaptureSource) => void
  onRemove: () => void
}) {
  const { active, error, warning, start, stop } = useScreenSharePublisher(source.id, source.audio)
  const nameId = useId()

  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4 space-y-3">
      <div className="flex items-center gap-2">
        <input
          id={nameId}
          type="text"
          value={source.name}
          onChange={(e) => onUpdate({ ...source, name: e.target.value })}
          placeholder="Source name…"
          className="flex-1 text-xs"
        />
        <Button variant="secondary" size="sm" onClick={onRemove} disabled={active}>
          🗑
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-1.5 text-[11px] text-[var(--color-text-primary)] cursor-pointer">
          <input
            type="checkbox"
            checked={source.audio}
            onChange={(e) => onUpdate({ ...source, audio: e.target.checked })}
          />
          Capture audio
        </label>
      </div>

      <div className="flex items-center gap-2">
        {active ? (
          <Button variant="secondary" size="sm" onClick={stop}>⏹ Stop</Button>
        ) : (
          <Button variant="primary" size="sm" onClick={start}>🖥️ Start sharing</Button>
        )}
        {active && (
          <span className="text-[10px] text-[var(--color-success-400)]">● Live</span>
        )}
      </div>

      {error && (
        <div className="rounded border border-[var(--color-danger-500)]/60 bg-[var(--color-danger-500)]/10 px-3 py-2 text-[10px] text-[var(--color-danger-400)]">
          {error}
        </div>
      )}
      {!error && warning && (
        <div className="rounded border border-[var(--color-warning-500)]/60 bg-[var(--color-warning-500)]/10 px-3 py-2 text-[10px] text-[var(--color-warning-400)]">
          {warning}
        </div>
      )}
    </div>
  )
}

// ── Panel ──────────────────────────────────────────────────────────

export function CaptureSourcesPanel() {
  const storeCaptureSources = useAdminStore((s) => s.config.captureSources ?? [])
  const patchConfig = useAdminStore((s) => s.patchConfig)
  const saveConfig = useAdminStore((s) => s.saveConfig)
  const [saving, setSaving] = useState(false)

  const persist = useCallback(async (next: CaptureSource[]) => {
    patchConfig({ captureSources: next })
    setSaving(true)
    try {
      await saveConfig({ captureSources: next })
    } finally {
      setSaving(false)
    }
  }, [patchConfig, saveConfig])

  const handleUpdate = (id: string, updated: CaptureSource) => {
    void persist(storeCaptureSources.map((s) => (s.id === id ? updated : s)))
  }

  const handleRemove = (id: string) => {
    void persist(storeCaptureSources.filter((s) => s.id !== id))
  }

  const handleAdd = () => {
    const next: CaptureSource = {
      id: crypto.randomUUID(),
      name: `Source ${storeCaptureSources.length + 1}`,
      audio: false,
      autoStart: true,
    }
    void persist([...storeCaptureSources, next])
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <ConfigPanel title="Capture Sources">
        <div className="space-y-2 mb-2 text-[10px] text-[var(--color-text-secondary)]">
          Define named screen/window/tab capture sources here. Each source
          can be started independently and assigned to one or more screen
          share widgets. In the desktop app, sharing starts silently with no
          picker.
        </div>

        {storeCaptureSources.length === 0 && (
          <div className="text-[11px] text-[var(--color-text-muted)] italic py-2">
            No sources defined. Add one below.
          </div>
        )}

        <div className="space-y-3">
          {storeCaptureSources.map((source) => (
            <SourceRow
              key={source.id}
              source={source}
              onUpdate={(updated) => handleUpdate(source.id, updated)}
              onRemove={() => handleRemove(source.id)}
            />
          ))}
        </div>

        <div className="mt-3">
          <Button variant="secondary" size="sm" onClick={handleAdd}>
            + Add source
          </Button>
          {saving && (
            <span className="ml-2 text-[10px] text-[var(--color-text-muted)]">Saving…</span>
          )}
        </div>
      </ConfigPanel>
    </div>
  )
}
