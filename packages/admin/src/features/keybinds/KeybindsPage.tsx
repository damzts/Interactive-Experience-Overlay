import { useMemo } from 'react'
import { useAdminStore } from '../../store/useAdminStore'
import { Btn, ConfigNotice, ConfigPageIntro, ConfigSectionPanel } from '../../shared/ui'
import { socket } from '../../socket/client'
import { KeybindEditor } from './KeybindEditor'

// ── Steam Deck button layout ────────────────────────────────────────────────
// Fires keybind:execute with an inline action so no mapping is required.

type DeckButton = { id: string; label: string; icon?: string; action: string; title: string }

function VirtualKeyboard({ actions }: { actions: DeckButton[] }) {
  const fire = (action: string) => socket.emit('keybind:execute', { scope: 'admin', action })

  if (actions.length === 0) return (
    <ConfigNotice tone="info">No actions configured. Add events or scenes to populate the keyboard.</ConfigNotice>
  )

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-2">
      {actions.map((a) => (
        <button
          key={a.id}
          type="button"
          onClick={() => fire(a.action)}
          title={a.action}
          className="flex flex-col items-center gap-1 rounded-xl border border-cyan-400/25 bg-cyan-500/8 px-3 py-3 text-center transition-colors hover:bg-cyan-500/18 active:scale-95"
        >
          <span className="text-xl leading-none">{a.icon ?? '⚡'}</span>
          <span className="text-[11px] font-medium text-zinc-200 leading-tight">{a.label}</span>
        </button>
      ))}
    </div>
  )
}

// ── KeybindsPage ────────────────────────────────────────────────────────────

export function KeybindsPage() {
  const config = useAdminStore((s) => s.config)

  const deckActions = useMemo<DeckButton[]>(() => {
    const scenes = Object.values(config.scenes).map((scene) => ({
      id: `scene:${scene.id}`,
      label: scene.label,
      icon: '🎬',
      action: `scene:${scene.id}`,
      title: `Go to ${scene.label}`,
    }))
    const events = (config.events ?? []).map((e) => ({
      id: `event:${e.id}`,
      label: e.label,
      icon: e.icon ?? '⚡',
      action: `event:${e.id}`,
      title: `Fire ${e.label}`,
    }))
    return [...scenes, ...events]
  }, [config.scenes, config.events])

  return (
    <div className="w-full max-w-none space-y-0 pt-1">
      <ConfigPageIntro title="Input Engine">
        Configure keyboard and OBS shortcuts, then test any action directly from the virtual stream keyboard below — useful when no physical controller is available.
      </ConfigPageIntro>

      <KeybindEditor />

      <ConfigSectionPanel label="Virtual Stream Keyboard">
        <ConfigNotice>
          Buttons are populated from your configured scenes and events. Click any button to fire its action immediately via the admin socket.
        </ConfigNotice>
        <div className="mt-4">
          <VirtualKeyboard actions={deckActions} />
        </div>
      </ConfigSectionPanel>
    </div>
  )
}
