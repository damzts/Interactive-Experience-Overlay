import { useState } from 'react'
import { Panel, Toggle } from '../components/ui'

function SliderRow({ label, min, max, step, value, unit, onChange }: {
  label: string; min: number; max: number; step: number; value: number; unit: string; onChange: (v: number) => void
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-zinc-400 w-24 shrink-0">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1" />
      <span className="text-xs text-zinc-300 w-20 shrink-0">{value} {unit}</span>
    </div>
  )
}

export function EventsPanel() {
  const [idleTv, setIdleTv] = useState(false)
  const [idleTimeout, setIdleTimeout] = useState(5)
  const [glitchEnabled, setGlitchEnabled] = useState(false)
  const [glitchFreq, setGlitchFreq] = useState(15)
  const [msgEnabled, setMsgEnabled] = useState(false)
  const [msgFreq, setMsgFreq] = useState(10)
  const [messages, setMessages] = useState([
    '[SERVER]: connection unstable',
    '[SERVER]: packet loss detected',
    '[SERVER]: resume session?',
    '[SYSTEM]: low memory warning',
  ])
  const [newMsg, setNewMsg] = useState('')

  return (
    <div className="flex flex-col gap-4 max-w-xl">

      <Panel title="⏱ Idle → TV Auto-switch">
        <p className="text-xs text-zinc-400 mb-3">After the specified time with no scene change, automatically switch to TV mode.</p>
        <Toggle checked={idleTv} onChange={setIdleTv} label="Enable" />
        {idleTv && (
          <div className="mt-3">
            <SliderRow label="Idle timeout" min={1} max={30} step={1} value={idleTimeout} unit="min" onChange={setIdleTimeout} />
          </div>
        )}
      </Panel>

      <Panel title="📡 Random Network Glitch">
        <p className="text-xs text-zinc-400 mb-3">Periodically fires the Network Glitch overlay — a broadcast interruption effect.</p>
        <Toggle checked={glitchEnabled} onChange={setGlitchEnabled} label="Enable" />
        {glitchEnabled && <div className="mt-3"><SliderRow label="Frequency" min={5}
          max={60} step={5} value={glitchFreq} unit="min avg" onChange={setGlitchFreq} /></div>}
      </Panel>

      <Panel title="💬 System Messages">
        <p className="text-xs text-zinc-400 mb-3">Random [SERVER]: messages appear in the overlay at the configured interval.</p>
        <Toggle checked={msgEnabled} onChange={setMsgEnabled} label="Enable" />
        {msgEnabled && (
          <div className="mt-3 space-y-3">
            <SliderRow label="Frequency" min={2} max={30} step={1} value={msgFreq} unit="min avg" onChange={setMsgFreq} />
            <div className="text-xs text-zinc-400">Message pool:</div>
            <div className="bg-zinc-900 rounded border border-zinc-700 h-28 overflow-y-auto p-2 space-y-1">
              {messages.map((m, i) => (
                <div key={i} className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs text-zinc-300">{m}</span>
                  <button onClick={() => setMessages((ms) => ms.filter((_, j) => j !== i))}
                    className="text-zinc-500 hover:text-red-400 text-xs px-1">✕</button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input type="text" value={newMsg} onChange={(e) => setNewMsg(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && newMsg.trim()) { setMessages((ms) => [...ms, newMsg.trim()]); setNewMsg('') } }}
                placeholder="Add message… (Enter)" className="flex-1" />
              <button onClick={() => { if (newMsg.trim()) { setMessages((ms) => [...ms, newMsg.trim()]); setNewMsg('') } }}
                className="px-3 py-1.5 rounded bg-zinc-700 hover:bg-zinc-600 text-sm border border-zinc-600 text-zinc-100">Add</button>
            </div>
          </div>
        )}
      </Panel>

      <Panel title="🗄 Archive Corruption">
        <p className="text-xs text-zinc-400">Rare random event — an old screenshot from the imagescrap library surfaces with a corrupted-file aesthetic.</p>
        <span className="inline-block mt-2 text-[10px] bg-cyan-900/40 border border-cyan-700/40 text-cyan-400 px-2 py-0.5 rounded">rare</span>
      </Panel>

      <div className="text-xs text-amber-400/80 bg-amber-900/20 border border-amber-700/30 rounded px-3 py-2">
        ⚠ Event persistence requires the SQLite backend planned for v2. Settings are active for the current session only.
      </div>
    </div>
  )
}
