import { useState, useEffect } from 'react'
import { useAdminStore } from '../store/useAdminStore'
import { Panel, Btn } from '../components/ui'

const ACTIONS = [
  'scene:lobby',
  'scene:gameplay',
  'scene:tv',
  'scene:music',
  'scene:archive',
  'overlay:death',
  'overlay:victory',
  'overlay:revive',
  'overlay:network_glitch',
  'panic',
]

export function KeybindEditor() {
  const config = useAdminStore((s) => s.config)
  const saveConfig = useAdminStore((s) => s.saveConfig)

  const [obs, setObs] = useState<Record<string, string>>(() => ({ ...config.keybinds.obs }))
  const [admin, setAdmin] = useState<Record<string, string>>(() => ({ ...config.keybinds.admin }))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [capturingCell, setCapturingCell] = useState<{ kind: 'obs' | 'admin'; action: string } | null>(null)

  useEffect(() => {
    setObs({ ...config.keybinds.obs })
    setAdmin({ ...config.keybinds.admin })
  }, [config.keybinds])

  // Key capture: listen once when a cell is active
  useEffect(() => {
    if (!capturingCell) return
    const { kind, action } = capturingCell

    const handler = (e: KeyboardEvent) => {
      e.preventDefault()
      const key = e.key === ' ' ? 'Space' : e.key
      if (kind === 'obs') {
        setObs((prev) => ({ ...prev, [key]: action }))
      } else {
        setAdmin((prev) => ({ ...prev, [key]: action }))
      }
      setCapturingCell(null)
    }

    window.addEventListener('keydown', handler, { once: true })
    return () => window.removeEventListener('keydown', handler)
  }, [capturingCell])

  const getKey = (map: Record<string, string>, action: string) =>
    Object.entries(map).find(([, v]) => v === action)?.[0] ?? '—'

  const handleSave = async () => {
    setSaving(true)
    await saveConfig({ keybinds: { obs, admin } })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleReset = () => {
    setObs({ ...config.keybinds.obs })
    setAdmin({ ...config.keybinds.admin })
  }

  return (
    <div className="max-w-2xl">
      <Panel title="Keybind Editor">
        <p className="text-xs text-zinc-400 mb-4">
          Click a keybind cell, then press the new key to capture it. OBS keybinds are forwarded
          via obs-websocket; Admin keybinds work when the admin tab is focused.
        </p>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left border-b border-zinc-700">
              <th className="pb-2 text-zinc-400 font-medium">Action</th>
              <th className="pb-2 text-zinc-400 font-medium text-center w-32">OBS Hotkey</th>
              <th className="pb-2 text-zinc-400 font-medium text-center w-32">Admin Hotkey</th>
            </tr>
          </thead>
          <tbody>
            {ACTIONS.map((action) => {
              const obsKey = getKey(obs, action)
              const adminKey = getKey(admin, action)
              const isCaptObs = capturingCell?.kind === 'obs' && capturingCell.action === action
              const isCaptAdmin = capturingCell?.kind === 'admin' && capturingCell.action === action
              return (
                <tr key={action} className="border-b border-zinc-800/60">
                  <td className="py-1.5 font-mono text-xs text-zinc-300">{action}</td>
                  <td className="py-1.5 text-center">
                    <button
                      onClick={() => setCapturingCell({ kind: 'obs', action })}
                      className={`px-2 py-0.5 rounded text-xs border transition-colors min-w-16 ${
                        isCaptObs
                          ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 font-bold'
                          : 'bg-zinc-700 border-zinc-600 text-zinc-200 hover:bg-zinc-600'
                      }`}
                    >
                      {isCaptObs ? '⌨ Press…' : obsKey}
                    </button>
                  </td>
                  <td className="py-1.5 text-center">
                    <button
                      onClick={() => setCapturingCell({ kind: 'admin', action })}
                      className={`px-2 py-0.5 rounded text-xs border transition-colors min-w-16 ${
                        isCaptAdmin
                          ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 font-bold'
                          : 'bg-zinc-700 border-zinc-600 text-zinc-200 hover:bg-zinc-600'
                      }`}
                    >
                      {isCaptAdmin ? '⌨ Press…' : adminKey}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <div className="flex gap-2 mt-4">
          <Btn variant="primary" onClick={handleSave} disabled={saving}>
            {saved ? '✔ Saved' : saving ? 'Saving…' : '💾 Save Keybinds'}
          </Btn>
          <Btn onClick={handleReset}>↺ Revert</Btn>
        </div>
      </Panel>
    </div>
  )
}
