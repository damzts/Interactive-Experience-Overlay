import { useEffect, useMemo, useState } from 'react'
import { useAdminStore } from '../store/useAdminStore'
import { Btn, ConfigNotice, ConfigPageIntro, ConfigSectionPanel, ConfigTable, ConfigToolbar } from '../components/ui'
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
    <div className="w-full max-w-none space-y-0 pt-1">
      <ConfigPageIntro title="Keybind Configuration">
        Capture admin and OBS shortcuts, map them to scenes, widgets, or events, and validate each row before you persist the change.
      </ConfigPageIntro>

      <ConfigSectionPanel label="Keybind Editor" first>
        <ConfigNotice>
          Choose the execution scope, capture a key, and use Run to validate the mapping before you save it.
        </ConfigNotice>
        <div className="mt-4 overflow-x-auto">
          <ConfigTable>
            <table>
              <thead>
                <tr>
                  <th className="w-24">Scope</th>
                  <th className="w-36">Key</th>
                  <th>Action</th>
                  <th className="w-44 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const selectedAction = actionOptions.find((option) => option.value === row.action)
                  const capturing = capturingRowId === row.id

                  return (
                    <tr key={row.id} className="align-top">
                      <td>
                        <select
                          value={row.scope}
                          onChange={(e) => updateRow(row.id, (current) => ({ ...current, scope: e.target.value as BindingScope }))}
                          className="text-xs"
                        >
                          <option value="admin">Admin</option>
                          <option value="obs">OBS</option>
                        </select>
                      </td>
                      <td>
                        <Btn
                          type="button"
                          variant={capturing ? 'warning' : 'default'}
                          onClick={() => setCapturingRowId(row.id)}
                          className="min-w-28 justify-center px-2.5 py-1 text-xs"
                        >
                          {capturing ? 'Press Key…' : row.key || 'Set Key'}
                        </Btn>
                      </td>
                      <td>
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
                          <div className="mt-1 text-[10px] uppercase tracking-[0.16em] text-zinc-500">{selectedAction.detail}</div>
                        )}
                      </td>
                      <td>
                        <div className="flex items-center justify-end gap-2">
                          <Btn
                            type="button"
                            variant="primary"
                            onClick={() => runBinding(row)}
                            className="px-2.5 py-1 text-xs"
                            title="Run binding"
                          >
                            Run
                          </Btn>
                          <Btn
                            type="button"
                            variant="danger"
                            onClick={() => setRows((prev) => prev.filter((current) => current.id !== row.id))}
                            className="px-2.5 py-1 text-xs"
                            title="Remove binding"
                          >
                            Delete
                          </Btn>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </ConfigTable>
        </div>
        {rows.length === 0 && (
          <ConfigNotice tone="info" className="mt-4">
            No bindings configured yet. Add an Admin or OBS binding to begin.
          </ConfigNotice>
        )}
        <ConfigToolbar className="mt-4">
          <Btn onClick={() => setRows((prev) => [...prev, createBindingRow('admin')])}>+ Add Admin Binding</Btn>
          <Btn onClick={() => setRows((prev) => [...prev, createBindingRow('obs')])}>+ Add OBS Binding</Btn>
          <Btn variant="primary" onClick={handleSave} disabled={saving}>
            {saved ? '✔ Saved' : saving ? 'Saving…' : '💾 Save Keybinds'}
          </Btn>
          <Btn onClick={handleReset}>↺ Revert</Btn>
        </ConfigToolbar>
      </ConfigSectionPanel>
    </div>
  )
}
