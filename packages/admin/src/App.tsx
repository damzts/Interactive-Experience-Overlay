import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import { STATE, OVERLAY_EVENT } from '@ieom/shared'
import { socket } from './socket/client'
import { useAdminStore } from './store/useAdminStore'
import { Dashboard } from './components/Dashboard'
import { SceneEditor } from './pages/SceneEditor'
import { SourceLibrary } from './pages/SourceLibrary'
import { AudioPanel } from './pages/AudioPanel'
import { EventsPanel } from './pages/EventsPanel'
import { KeybindEditor } from './pages/KeybindEditor'
import { ArchivePanel } from './pages/ArchivePanel'
import { SettingsPage } from './pages/SettingsPage'

const NAV_ITEMS = [
  { to: '/',         icon: '⬡', label: 'Dashboard' },
  { to: '/scenes',   icon: '▦', label: 'Scene Editor' },
  { to: '/media',    icon: '◫', label: 'Source Library' },
  { to: '/audio',    icon: '♪', label: 'Audio' },
  { to: '/events',   icon: '⚡', label: 'Events' },
  { to: '/keybinds', icon: '⌨', label: 'Keybinds' },
  { to: '/archive',  icon: '◈', label: 'Archive' },
  { to: '/settings', icon: '⚙', label: 'Settings' },
]

function Sidebar() {
  const obsConnected = useAdminStore((s) => s.obsConnected)
  const currentState = useAdminStore((s) => s.currentState)

  return (
    <div className="flex flex-col w-48 shrink-0 bg-zinc-900 border-r border-zinc-800 h-full">
      {/* Logo */}
      <div className="px-4 py-3 border-b border-zinc-800">
        <div className="text-cyan-400 font-bold text-sm tracking-widest font-mono">IEOM</div>
        <div className="text-zinc-500 text-xs mt-0.5">Overlay Manager</div>
      </div>

      {/* Status */}
      <div className="flex items-center gap-3 px-3 py-2 border-b border-zinc-800 bg-zinc-950/50">
        <span className={`text-xs font-mono ${obsConnected ? 'text-emerald-400' : 'text-red-500'}`}>
          {obsConnected ? '● OBS' : '○ OBS'}
        </span>
        <span className="text-xs text-cyan-400 font-mono truncate">{currentState}</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-1">
        {NAV_ITEMS.map(({ to, icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 mx-1 my-0.5 rounded text-sm transition-colors ${
                isActive
                  ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/25'
                  : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 border border-transparent'
              }`
            }
          >
            <span className="text-base leading-none">{icon}</span>
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Panic */}
      <button
        onClick={() => socket.emit('panic')}
        className="m-2 py-2 rounded bg-red-900 hover:bg-red-700 border border-red-800 text-white text-xs font-bold tracking-widest transition-colors glow-red"
      >
        ⚠ PANIC
      </button>
    </div>
  )
}

export default function App() {
  const setCurrentState = useAdminStore((s) => s.setCurrentState)
  const setObsConnected = useAdminStore((s) => s.setObsConnected)
  const fetchConfig = useAdminStore((s) => s.fetchConfig)
  const setConfig = useAdminStore((s) => s.setConfig)

  useEffect(() => {
    fetchConfig()

    socket.emit('state:request', (state: STATE) => {
      if (state && state !== STATE.TRANSITIONING) setCurrentState(state)
    })

    socket.on('state:update', ({ state }: { state: STATE }) => {
      if (state !== STATE.TRANSITIONING) setCurrentState(state)
    })

    socket.on('obs:status', ({ connected }: { connected: boolean }) => {
      setObsConnected(connected)
    })

    socket.on('config:update', (config) => {
      setConfig(config)
    })

    const KEYBINDS: Record<string, STATE> = {
      F1: STATE.LOBBY,
      F2: STATE.GAMEPLAY,
      F3: STATE.TV,
      F4: STATE.MUSIC,
      F5: STATE.ARCHIVE,
    }

    const handleKey = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as Element)?.tagName)) return
      if (e.key === 'Escape') { socket.emit('panic'); return }
      const target = KEYBINDS[e.key]
      if (target) { e.preventDefault(); socket.emit('scene:change', target) }
      if (e.key === 'd') socket.emit('overlay:trigger', OVERLAY_EVENT.DEATH)
      if (e.key === 'v') socket.emit('overlay:trigger', OVERLAY_EVENT.VICTORY)
      if (e.key === 'r') socket.emit('overlay:trigger', OVERLAY_EVENT.REVIVE)
    }

    window.addEventListener('keydown', handleKey)
    return () => {
      socket.off('state:update')
      socket.off('obs:status')
      socket.off('config:update')
      window.removeEventListener('keydown', handleKey)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <BrowserRouter>
      <div className="flex h-screen overflow-hidden bg-zinc-950 text-zinc-100">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-4">
          <Routes>
            <Route path="/"         element={<Dashboard />} />
            <Route path="/scenes"   element={<SceneEditor />} />
            <Route path="/media"    element={<SourceLibrary />} />
            <Route path="/audio"    element={<AudioPanel />} />
            <Route path="/events"   element={<EventsPanel />} />
            <Route path="/keybinds" element={<KeybindEditor />} />
            <Route path="/archive"  element={<ArchivePanel />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}

