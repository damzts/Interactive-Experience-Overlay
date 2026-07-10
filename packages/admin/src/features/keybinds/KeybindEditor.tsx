import { useEffect, useState } from 'react'
import type { EventConfig } from '@ieomlabs/shared'
import { useAdminStore } from '../../store/useAdminStore'
import { ConfigPageIntro, ConfigSectionPanel, ConfigNotice } from '../../shared/ui'
import { Button } from '../../components/atoms'
import { ConfigPanel } from '../../components/organisms'
import { socket } from '../../socket/client'

interface BindingRow {
  id: string
  key: string
  presetId: string
}

const PRESET_TYPE_BADGE: Record<'effect' | 'action', { label: string; className: string }> = {
  effect: { label: 'Effect', className: 'bg-cyan-500/10 text-cyan-300' },
  action: { label: 'Action', className: 'bg-violet-500/10 text-violet-300' },
}

function PresetTypeBadge({ presetType }: { presetType?: 'effect' | 'action' }) {
  const badge = presetType ? PRESET_TYPE_BADGE[presetType] : null
  return (
    <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] ${badge ? badge.className : 'bg-zinc-500/10 text-zinc-400'}`}>
      {badge ? badge.label : 'Legacy'}
    </span>
  )
}

/** Preset Rotation entries (Ambiance → Preset Rotation) live in the same
 *  sourceEvents array but swap the whole config, not something a keybind
 *  should fire directly — filtered out of the picker. */
function isPresetRotationEvent(event: EventConfig): boolean {
  return event.actions?.length === 1 && event.actions[0].kind === 'preset-apply'
}

function createBindingRow(): BindingRow {
  return {
    id: `bind-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    key: '',
    presetId: '',
  }
}

function rowsFromKeybinds(keybinds: Record<string, string>): BindingRow[] {
  return Object.entries(keybinds).map(([key, presetId], index) => ({ id: `bind-${index}-${key}`, key, presetId }))
}

function keybindMapFromRows(rows: BindingRow[]): Record<string, string> {
  const keybinds: Record<string, string> = {}
  rows.forEach((row) => {
    const key = row.key.trim()
    const presetId = row.presetId.trim()
    if (!key || !presetId) return
    keybinds[key] = presetId
  })
  return keybinds
}

export function KeybindEditor() {
  const config = useAdminStore((s) => s.config)
  const saveConfig = useAdminStore((s) => s.saveConfig)
  const presets = (config.sourceEvents ?? []).filter((e) => !isPresetRotationEvent(e))
  const presetById = Object.fromEntries(presets.map((p) => [p.id, p]))

  const [rows, setRows] = useState<BindingRow[]>(() => rowsFromKeybinds(config.keybinds))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [capturingRowId, setCapturingRowId] = useState<string | null>(null)

  useEffect(() => {
    setRows(rowsFromKeybinds(config.keybinds))
  }, [config.keybinds])

  useEffect(() => {
    if (!capturingRowId) return

    const handler = (e: KeyboardEvent) => {
      e.preventDefault()
      const key = e.key === ' ' ? 'Space' : e.key
      setRows((prev) => prev.map((row) => row.id === capturingRowId ? { ...row, key } : row))
      setCapturingRowId(null)
    }

    window.addEventListener('keydown', handler, { once: true })
    return () => window.removeEventListener('keydown', handler)
  }, [capturingRowId])

  const handleSave = async () => {
    setSaving(true)
    await saveConfig({ keybinds: keybindMapFromRows(rows) })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleReset = () => {
    setRows(rowsFromKeybinds(config.keybinds))
    setCapturingRowId(null)
  }

  const runBinding = (row: BindingRow) => {
    if (!row.presetId.trim()) return
    socket.emit('keybind:execute', { presetId: row.presetId.trim() })
  }

  const updateRowPreset = (rowId: string, presetId: string) => {
    setRows((prev) => prev.map((row) => row.id === rowId ? { ...row, presetId } : row))
  }

  return (
    <div className="w-full max-w-none space-y-0 pt-1">
      <ConfigPageIntro title="Keybind Configuration">
        Capture keyboard shortcuts and bind each one to a saved preset — Effect or Action, authored
        in Graphics → Effects. Input Engine only triggers presets; it doesn't configure them.
      </ConfigPageIntro>

      <ConfigPanel title="Keybind Editor">
        {presets.length === 0 ? (
          <ConfigNotice tone="info">
            No presets exist yet. Create an Effect or Action preset in Graphics → Effects before binding a key.
          </ConfigNotice>
        ) : (
          <ConfigNotice>
            Capture a key, pick a saved preset, and use Run to fire it before you save the binding.
          </ConfigNotice>
        )}

        <ConfigSectionPanel label="Bindings" className="mt-4">
          <div className="space-y-2">
            {rows.length === 0 && (
              <div className="text-[10px] italic text-zinc-600 px-1">No bindings configured yet.</div>
            )}
            {rows.map((row) => {
              const capturing = capturingRowId === row.id
              const preset = presetById[row.presetId]
              return (
                <div
                  key={row.id}
                  className="flex flex-wrap items-center gap-2 rounded-xl border border-white/6 bg-white/[0.02] px-4 py-3"
                >
                  <Button
                    variant={capturing ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setCapturingRowId(row.id)}
                    className="min-w-24 justify-center"
                  >
                    {capturing ? 'Press Key…' : row.key || 'Set Key'}
                  </Button>

                  <select
                    value={row.presetId}
                    onChange={(e) => updateRowPreset(row.id, e.target.value)}
                    className="min-w-0 flex-1 text-xs"
                  >
                    <option value="">— select preset —</option>
                    {presets.map((p) => (
                      <option key={p.id} value={p.id}>{p.icon} {p.label}</option>
                    ))}
                  </select>

                  {preset && <PresetTypeBadge presetType={preset.presetType} />}

                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button variant="primary" size="sm" onClick={() => runBinding(row)} title="Run binding" disabled={!row.presetId}>
                      Run
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => setRows((prev) => prev.filter((current) => current.id !== row.id))}
                      title="Remove binding"
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>

          <Button variant="secondary" size="sm" onClick={() => setRows((prev) => [...prev, createBindingRow()])} className="mt-3">
            + Add Binding
          </Button>
        </ConfigSectionPanel>

        <div className="mt-4 flex items-center gap-2">
          <Button variant="success" size="sm" onClick={handleSave} disabled={saving} loading={saving}>
            {saved ? '✔ Saved' : '💾 Save Keybinds'}
          </Button>
          <Button variant="primary" size="sm" onClick={handleReset}>↺ Revert</Button>
        </div>
      </ConfigPanel>
    </div>
  )
}
