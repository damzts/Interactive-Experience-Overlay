import { useMemo, useState } from 'react'
import { useAdminStore } from '../../store/useAdminStore'
import { Btn, ConfigNotice, ConfigPageIntro, ConfigSectionPanel } from '../../shared/ui'
import { socket } from '../../socket/client'
import { KeybindEditor } from './KeybindEditor'

type ActionButton = { id: string; label: string; icon: string; action: string }

function VirtualKeyboard({ actions }: { actions: ActionButton[] }) {
  const [cols, setCols] = useState(4)
  const fire = (action: string) => socket.emit('keybind:execute', { scope: 'admin', action })

  if (actions.length === 0) return (
    <ConfigNotice tone="info">No actions available. Add scenes, widgets, or events to populate the keyboard.</ConfigNotice>
  )

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Columns</span>
        {[2, 3, 4, 5, 6, 8].map((n) => (
          <Btn key={n} type="button" variant={cols === n ? 'active' : 'default'}
            onClick={() => setCols(n)} className="px-2.5 py-1 text-xs">{n}</Btn>
        ))}
      </div>
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {actions.map((a) => (
          <button key={a.id} type="button" onClick={() => fire(a.action)} title={a.action}
            className="flex flex-col items-center gap-1 rounded-xl border border-cyan-400/25 bg-cyan-500/8 px-2 py-3 text-center transition-colors hover:bg-cyan-500/18 active:scale-95">
            <span className="text-lg leading-none">{a.icon}</span>
            <span className="line-clamp-2 text-[10px] font-medium text-zinc-200 leading-tight">{a.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export function KeybindsPage() {
  const config = useAdminStore((s) => s.config)

  const actions = useMemo<ActionButton[]>(() => {
    const scenes = Object.values(config.scenes).map((s) => ({
      id: `scene:${s.id}`, label: s.label, icon: '🎬', action: `scene:${s.id}`,
    }))
    const widgets = config.applications.map((a) => ({
      id: `widget:${a.id}`, label: a.label, icon: typeof a.icon === 'string' ? a.icon : '🪟', action: `widget:${a.id}`,
    }))
    const events = (config.sourceEvents ?? []).map((e) => ({
      id: `event:${e.id}`, label: e.label, icon: (e as { icon?: string }).icon ?? '⚡', action: `event:${e.id}`,
    }))
    return [
      ...scenes,
      ...widgets,
      ...events,
    ]
  }, [config.scenes, config.applications, config.sourceEvents])

  return (
    <div className="w-full max-w-none space-y-0 pt-1">
      <ConfigPageIntro title="Input Engine">
        Configure keyboard shortcuts, then test any action directly from the virtual stream keyboard — useful when no physical controller is available.
      </ConfigPageIntro>

      <KeybindEditor />

      <ConfigSectionPanel label="Virtual Stream Keyboard">
        <ConfigNotice>
          All configured scenes, widgets, and events are available as buttons. Click to fire immediately.
        </ConfigNotice>
        <div className="mt-4">
          <VirtualKeyboard actions={actions} />
        </div>
      </ConfigSectionPanel>
    </div>
  )
}
