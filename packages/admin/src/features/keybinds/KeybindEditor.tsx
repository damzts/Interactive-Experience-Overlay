import { useEffect, useMemo, useState } from 'react'
import { useAdminStore } from '../../store/useAdminStore'
import { ConfigPageIntro, ConfigTable, ConfigToolbar } from '../../shared/ui'
import { Button } from '../../components/atoms'
import { ConfigPanel } from '../../components/organisms'
import { socket } from '../../socket/client'

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

/** Notice component for informational/warning messages within config panels */
function Notice({ tone = 'info', children, className = '' }: { tone?: 'info' | 'warning' | 'danger' | 'success'; children: React.ReactNode; className?: string }) {
  const toneStyles: Record<string, string> = {
    info: 'border-[var(--color-primary-400)]/25 bg-[var(--color-primary-500)]/10 text-[var(--color-primary-100)]',
    warning: 'border-[var(--color-accent-400)]/30 bg-[var(--color-accent-500)]/12 text-[var(--color-accent-100)]',
    danger: 'border-[var(--color-danger-400)]/30 bg-[var(--color-danger-500)]/12 text-[var(--color-danger-400)]',
    success: 'border-[var(--color-success-400)]/30 bg-[var(--color-success-500)]/12 text-[var(--color-success-400)]',
  }
  return (
    <div className={`rounded-[var(--radius-lg)] border px-3 py-2.5 text-sm shadow-[var(--shadow-sm)] backdrop-blur ${toneStyles[tone]} ${className}`.trim()}>
      {children}
    </div>
  )
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
      .filter((app) => !!app.widgetComponent)
      .map((app) => ({
        value: `widget:${app.id}`,
        label: `Toggle ${app.label}`,
        detail: 'Widget',
      }))
    const eventOptions = (config.sourceEvents ?? []).map((eventDef) => ({
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
  }, [config.applications, config.sourceEvents, config.scenes])

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

      <ConfigPanel title="Keybind Editor">
        <Notice>
          Choose the execution scope, capture a key, and use Run to validate the mapping before you save it.
        </Notice>
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
                        <Button
                          variant={capturing ? 'secondary' : 'ghost'}
                          size="sm"
                          onClick={() => setCapturingRowId(row.id)}
                          className="min-w-28 justify-center"
                        >
                          {capturing ? 'Press Key…' : row.key || 'Set Key'}
                        </Button>
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
                          <div className="mt-1 text-[10px] uppercase tracking-[0.16em] text-[var(--color-text-muted)]">{selectedAction.detail}</div>
                        )}
                      </td>
                      <td>
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => runBinding(row)}
                            title="Run binding"
                          >
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
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </ConfigTable>
        </div>
        {rows.length === 0 && (
          <Notice tone="info" className="mt-4">
            No bindings configured yet. Add an Admin or OBS binding to begin.
          </Notice>
        )}
        <ConfigToolbar className="mt-4">
          <Button variant="secondary" size="sm" onClick={() => setRows((prev) => [...prev, createBindingRow('admin')])}>+ Add Admin Binding</Button>
          <Button variant="secondary" size="sm" onClick={() => setRows((prev) => [...prev, createBindingRow('obs')])}>+ Add OBS Binding</Button>
          <Button variant="success" size="sm" onClick={handleSave} disabled={saving} loading={saving}>
            {saved ? '✔ Saved' : '💾 Save Keybinds'}
          </Button>
          <Button variant="primary" size="sm" onClick={handleReset}>↺ Revert</Button>
        </ConfigToolbar>
      </ConfigPanel>
    </div>
  )
}
