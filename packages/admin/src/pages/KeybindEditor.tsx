import { useEffect, useMemo, useState } from 'react'
import { useAdminStore } from '../store/useAdminStore'
import { Panel, Btn } from '../components/ui'
import { socket } from '../socket/client'

type BindingScope = 'obs' | 'admin'

interface BindingRow {
  id: string
  scope: BindingScope
  key: string
  action: string
}

interface ActionOption {
  value: string
  label: string
  detail: string
}

function createBindingRow(scope: BindingScope, action = 'scene:desktop'): BindingRow {
  return {
    id: `${scope}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    scope,
    key: '',
    action,
  }
}

function rowsFromKeybinds(obs: Record<string, string>, admin: Record<string, string>): BindingRow[] {
  return [
    ...Object.entries(obs).map(([key, action], index) => ({ id: `obs-${index}-${key}`, scope: 'obs' as const, key, action })),
    ...Object.entries(admin).map(([key, action], index) => ({ id: `admin-${index}-${key}`, scope: 'admin' as const, key, action })),
  ]
}

function keybindMapsFromRows(rows: BindingRow[]) {
  const obs: Record<string, string> = {}
  const admin: Record<string, string> = {}

  rows.forEach((row) => {
    const key = row.key.trim()
    const action = row.action.trim()
    if (!key || !action) return
    if (row.scope === 'obs') obs[key] = action
    else admin[key] = action
  })

  return { obs, admin }
}

export function KeybindEditor() {
  const config = useAdminStore((s) => s.config)
  const saveConfig = useAdminStore((s) => s.saveConfig)

  const actionOptions = useMemo<ActionOption[]>(() => {
    const sceneOptions = Object.values(config.scenes).map((scene) => ({
      value: `scene:${scene.id}`,
      label: `Go to ${scene.label}`,
      detail: 'Scene',
    }))
    const widgetOptions = config.applications
      .filter((app) => app.appType === 'widget')
      .map((app) => ({
        value: `widget:${app.id}`,
        label: `Toggle ${app.label}`,
        detail: 'Widget',
      }))
    const eventOptions = (config.events ?? []).map((eventDef) => ({
      value: `event:${eventDef.id}`,
      label: `Fire ${eventDef.label}`,
      detail: 'Event',
    }))

    return [
      { value: 'panic', label: 'Panic to Desktop', detail: 'System' },
      ...sceneOptions,
      ...widgetOptions,
      ...eventOptions,
    ]
  }, [config.applications, config.events, config.scenes])

  const [rows, setRows] = useState<BindingRow[]>(() => rowsFromKeybinds(config.keybinds.obs, config.keybinds.admin))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [capturingRowId, setCapturingRowId] = useState<string | null>(null)

  useEffect(() => {
    setRows(rowsFromKeybinds(config.keybinds.obs, config.keybinds.admin))
  }, [config.keybinds.admin, config.keybinds.obs])

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
    await saveConfig({ keybinds: keybindMapsFromRows(rows) })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleReset = () => {
    setRows(rowsFromKeybinds(config.keybinds.obs, config.keybinds.admin))
    setCapturingRowId(null)
  }

  const runBinding = (row: BindingRow) => {
    const action = row.action.trim()
    if (!action) return
    socket.emit('keybind:execute', {
      scope: row.scope,
      key: row.key.trim() || undefined,
      action,
    })
  }

  const updateRow = (rowId: string, updater: (row: BindingRow) => BindingRow) => {
    setRows((prev) => prev.map((row) => row.id === rowId ? updater(row) : row))
  }

  return (
    <div className="max-w-3xl">
      <Panel title="Keybind Editor">
        <p className="text-xs text-zinc-400 mb-4">
          Add as many bindings as you want. Choose whether the binding belongs to OBS or the focused admin panel,
          capture the key, then map it to a scene, widget, event, or panic action. Use Run to validate a row before saving.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left border-b border-zinc-700">
                <th className="pb-2 text-zinc-400 font-medium w-24">Scope</th>
                <th className="pb-2 text-zinc-400 font-medium w-32">Key</th>
                <th className="pb-2 text-zinc-400 font-medium">Action</th>
                <th className="pb-2 text-zinc-400 font-medium w-24 text-right">Test</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const selectedAction = actionOptions.find((option) => option.value === row.action)
                const capturing = capturingRowId === row.id

                return (
                  <tr key={row.id} className="border-b border-zinc-800/60 align-top">
                    <td className="py-2 pr-2">
                      <select
                        value={row.scope}
                        onChange={(e) => updateRow(row.id, (current) => ({ ...current, scope: e.target.value as BindingScope }))}
                        className="text-xs"
                      >
                        <option value="admin">Admin</option>
                        <option value="obs">OBS</option>
                      </select>
                    </td>
                    <td className="py-2 pr-2">
                      <button
                        onClick={() => setCapturingRowId(row.id)}
                        className={`px-2 py-1 rounded text-xs border transition-colors min-w-24 ${
                          capturing
                            ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 font-bold'
                            : 'bg-zinc-700 border-zinc-600 text-zinc-200 hover:bg-zinc-600'
                        }`}
                      >
                        {capturing ? '⌨ Press…' : row.key || 'Set key'}
                      </button>
                    </td>
                    <td className="py-2 pr-2">
                      <select
                        value={row.action}
                        onChange={(e) => updateRow(row.id, (current) => ({ ...current, action: e.target.value }))}
                        className="text-xs"
                      >
                        {actionOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.detail} — {option.label}
                          </option>
                        ))}
                      </select>
                      {selectedAction && (
                        <div className="text-[10px] text-zinc-500 mt-1">{selectedAction.detail}</div>
                      )}
                    </td>
                    <td className="py-2 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => runBinding(row)}
                          className="px-2 py-1 rounded text-[10px] border border-cyan-700/50 text-cyan-300 hover:border-cyan-500/60 hover:text-cyan-200 transition-colors"
                          title="Run binding"
                        >
                          Run
                        </button>
                        <button
                          onClick={() => setRows((prev) => prev.filter((current) => current.id !== row.id))}
                          className="text-[10px] text-zinc-500 hover:text-red-400 px-1 transition-colors"
                          title="Remove binding"
                        >
                          ✕
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {rows.length === 0 && (
          <div className="text-xs text-zinc-600 italic py-3 text-center">No bindings configured yet.</div>
        )}
        <div className="flex flex-wrap gap-2 mt-4">
          <Btn onClick={() => setRows((prev) => [...prev, createBindingRow('admin')])}>+ Add Admin Binding</Btn>
          <Btn onClick={() => setRows((prev) => [...prev, createBindingRow('obs')])}>+ Add OBS Binding</Btn>
          <Btn variant="primary" onClick={handleSave} disabled={saving}>
            {saved ? '✔ Saved' : saving ? 'Saving…' : '💾 Save Keybinds'}
          </Btn>
          <Btn onClick={handleReset}>↺ Revert</Btn>
        </div>
      </Panel>
    </div>
  )
}
