import { useEffect, useState } from 'react'
import { STATE } from '@ieom/shared'
import { useAdminStore } from '../../store/useAdminStore'
import { socket } from '../../socket/client'
import { Btn, ConfigCard, ConfigPageIntro, ConfigSectionPanel } from '../../shared/ui'

interface HistoryEntry { from: STATE; to: STATE; at: number }

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

const STATE_LABEL: Record<string, string> = {
  [STATE.LOBBY]: 'Lobby',
  [STATE.DESKTOP]: 'Desktop',
  [STATE.TRANSITIONING]: 'Transitioning',
}

function stateLabel(s: string) {
  return STATE_LABEL[s] ?? s
}

export function SceneMachinePanel() {
  const currentState = useAdminStore((s) => s.currentState)
  const [history, setHistory] = useState<HistoryEntry[]>([])

  useEffect(() => {
    const handler = ({ state, previousState }: { state: STATE; previousState: STATE }) => {
      if (state === STATE.TRANSITIONING) return
      setHistory((h) => [{ from: previousState, to: state, at: Date.now() }, ...h].slice(0, 10))
    }
    socket.on('state:update', handler)
    return () => { socket.off('state:update', handler) }
  }, [])

  const triggerScene = (target: STATE) => socket.emit('scene:change', target)

  return (
    <div className="space-y-5">
      <ConfigPageIntro
        icon="🔄"
        title="Scene Machine"
        description="Live state of the scene state machine. Use controls to force transitions or recover from bad state."
      />

      <ConfigSectionPanel label="Current state">
        <ConfigCard>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="text-[9px] uppercase tracking-wider text-zinc-600 mb-0.5">Active scene</div>
              <div className="text-lg font-bold text-cyan-300">{stateLabel(currentState)}</div>
              <div className="text-[10px] text-zinc-500 mt-0.5 font-mono">{currentState}</div>
            </div>
            <div
              className={'h-3 w-3 rounded-full shrink-0 ' + (
                currentState === STATE.TRANSITIONING
                  ? 'bg-amber-400 animate-pulse'
                  : 'bg-emerald-400'
              )}
            />
          </div>
        </ConfigCard>
      </ConfigSectionPanel>

      <ConfigSectionPanel label="Force transition">
        <div className="flex gap-2">
          <Btn
            type="button"
            variant={currentState === STATE.LOBBY ? 'active' : 'default'}
            onClick={() => triggerScene(STATE.LOBBY)}
            className="flex-1 py-2 text-xs"
          >
            🖥 Lobby
          </Btn>
          <Btn
            type="button"
            variant={currentState === STATE.DESKTOP ? 'active' : 'default'}
            onClick={() => triggerScene(STATE.DESKTOP)}
            className="flex-1 py-2 text-xs"
          >
            💾 Desktop
          </Btn>
        </div>
      </ConfigSectionPanel>

      {history.length > 0 && (
        <ConfigSectionPanel label="Transition history">
          <div className="space-y-1">
            {history.map((entry, i) => (
              <div key={i} className="flex items-center gap-2 text-[11px] rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2">
                <span className="text-zinc-500 font-mono shrink-0">{formatTime(entry.at)}</span>
                <span className="text-zinc-400">{stateLabel(entry.from)}</span>
                <span className="text-zinc-600">→</span>
                <span className="text-zinc-200 font-medium">{stateLabel(entry.to)}</span>
              </div>
            ))}
          </div>
        </ConfigSectionPanel>
      )}
    </div>
  )
}
