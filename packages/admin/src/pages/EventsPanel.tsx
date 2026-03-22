import { useState } from 'react'
import { Panel, Toggle, Btn, Slider, ConfigNotice, ConfigPageIntro } from '../components/ui'

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
      <ConfigPageIntro title="Event Utilities">
        Tune the temporary runtime event behaviors used for ambient automation, broadcast glitches, and system message experiments.
      </ConfigPageIntro>

      <Panel title="⏱ Idle → TV Auto-switch">
        <p className="text-xs text-zinc-400 mb-3">After the specified time with no scene change, automatically switch to TV mode.</p>
        <Toggle checked={idleTv} onChange={setIdleTv} label="Enable" />
        {idleTv && (
          <div className="mt-3">
            <Slider label="Idle timeout" min={1} max={30} step={1} value={idleTimeout} unit=" min" onChange={setIdleTimeout} />
          </div>
        )}
      </Panel>

      <Panel title="📡 Random Network Glitch">
        <p className="text-xs text-zinc-400 mb-3">Periodically fires the Network Glitch overlay — a broadcast interruption effect.</p>
        <Toggle checked={glitchEnabled} onChange={setGlitchEnabled} label="Enable" />
        {glitchEnabled && <div className="mt-3"><Slider label="Frequency" min={5}
          max={60} step={5} value={glitchFreq} unit=" min avg" onChange={setGlitchFreq} /></div>}
      </Panel>

      <Panel title="💬 System Messages">
        <p className="text-xs text-zinc-400 mb-3">Random [SERVER]: messages appear in the overlay at the configured interval.</p>
        <Toggle checked={msgEnabled} onChange={setMsgEnabled} label="Enable" />
        {msgEnabled && (
          <div className="mt-3 space-y-3">
            <Slider label="Frequency" min={2} max={30} step={1} value={msgFreq} unit=" min avg" onChange={setMsgFreq} />
            <div className="text-xs text-zinc-400">Message pool:</div>
            <div className="bg-zinc-900 rounded border border-zinc-700 h-28 overflow-y-auto p-2 space-y-1">
              {messages.map((m, i) => (
                <div key={i} className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs text-zinc-300">{m}</span>
                  <Btn variant="danger" onClick={() => setMessages((ms) => ms.filter((_, j) => j !== i))}
                    className="px-2 py-0.5 text-[10px]">Delete</Btn>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input type="text" value={newMsg} onChange={(e) => setNewMsg(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && newMsg.trim()) { setMessages((ms) => [...ms, newMsg.trim()]); setNewMsg('') } }}
                placeholder="Add message… (Enter)" className="flex-1" />
              <Btn onClick={() => { if (newMsg.trim()) { setMessages((ms) => [...ms, newMsg.trim()]); setNewMsg('') } }}
                className="px-3 py-1.5 text-sm">Add</Btn>
            </div>
          </div>
        )}
      </Panel>

      <Panel title="🗄 Archive Corruption">
        <p className="text-xs text-zinc-400">Rare random event — an old screenshot from the imagescrap library surfaces with a corrupted-file aesthetic.</p>
        <span className="inline-block mt-2 text-[10px] bg-cyan-900/40 border border-cyan-700/40 text-cyan-400 px-2 py-0.5 rounded">rare</span>
      </Panel>

      <ConfigNotice tone="warning">
        Event persistence requires the SQLite backend planned for v2. Settings are active for the current session only.
      </ConfigNotice>
    </div>
  )
}
