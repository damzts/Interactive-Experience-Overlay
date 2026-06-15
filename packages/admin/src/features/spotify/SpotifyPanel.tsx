import { useState, useEffect, useCallback } from 'react'
import type { SpotifyPlaylist } from '@ieomlabs/shared'
import { ConfigSectionPanel } from '../../shared/ui'
import { Button } from '../../components/atoms'
import { socket } from '../../socket/client'

const INPUT_CLS = 'w-full rounded-lg border border-zinc-700/60 bg-zinc-900/60 px-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 focus:border-cyan-500/50 focus:outline-none'

async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(path, options)
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json() as Promise<Record<string, unknown>>
}

export function SpotifyPanel() {
  const [playlists, setPlaylists]           = useState<SpotifyPlaylist[]>([])
  const [activePlaylistId, setActivePlaylistId] = useState<string | undefined>()
  const [newUrl, setNewUrl]                 = useState('')
  const [newName, setNewName]               = useState('')
  const [adding, setAdding]                 = useState(false)
  const [error, setError]                   = useState('')
  const [settingActive, setSettingActive]   = useState<string | null>(null)
  const [controlStatus, setControlStatus]   = useState('')

  const load = useCallback(async () => {
    try {
      const data = await apiFetch('/api/spotify')
      setPlaylists((data.playlists as SpotifyPlaylist[]) ?? [])
      setActivePlaylistId((data.activePlaylistId as string | undefined) ?? undefined)
    } catch { /* server may not be connected yet */ }
  }, [])

  useEffect(() => { void load() }, [load])

  const handleAdd = async () => {
    setError('')
    if (!newUrl.trim()) { setError('Paste a Spotify playlist URL or ID.'); return }
    if (!newName.trim()) { setError('Enter a name for the playlist.'); return }
    setAdding(true)
    try {
      await apiFetch('/api/spotify/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: newUrl.trim(), name: newName.trim() }),
      })
      setNewUrl(''); setNewName('')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add playlist')
    } finally {
      setAdding(false)
    }
  }

  const handleRemove = async (id: string) => {
    try {
      await apiFetch(`/api/spotify/playlists/${id}`, { method: 'DELETE' })
      await load()
    } catch { /* ignore */ }
  }

  const handleSetActive = async (id: string) => {
    setSettingActive(id)
    try {
      await apiFetch('/api/spotify/active', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playlistId: id }),
      })
      setActivePlaylistId(id)
    } catch { /* ignore */ } finally {
      setSettingActive(null)
    }
  }

  const sendControl = async (command: string) => {
    try {
      await apiFetch('/api/spotify/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command }),
      })
      setControlStatus(`Sent: ${command}`)
      setTimeout(() => setControlStatus(''), 2000)
    } catch (e) {
      setControlStatus(e instanceof Error ? e.message : 'Failed')
      setTimeout(() => setControlStatus(''), 3000)
    }
  }

  const toggleWidget = () => socket.emit('widget:toggle', 'music')

  return (
    <div className="space-y-5 px-1 py-2">
      <div>
        <div className="text-xs font-semibold text-zinc-200 mb-0.5">Spotify Playlists</div>
        <div className="text-[10px] text-zinc-500 leading-relaxed">
          Add Spotify playlists by URL or ID. The active playlist plays in the MUSIC.exe widget — no login required.
        </div>
      </div>

      {/* ─── Add playlist ─── */}
      <ConfigSectionPanel label="Add Playlist">
        <div className="space-y-2">
          <input
            type="text"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            placeholder="https://open.spotify.com/playlist/… or playlist ID"
            className={INPUT_CLS}
          />
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Playlist name (e.g. Lo-fi Chill)"
            className={INPUT_CLS}
            onKeyDown={(e) => e.key === 'Enter' && void handleAdd()}
          />
          {error && <p className="text-[10px] text-red-400">{error}</p>}
          <Button variant="primary" size="sm" onClick={handleAdd} disabled={adding}>
            {adding ? 'Adding…' : 'Add Playlist'}
          </Button>
        </div>
      </ConfigSectionPanel>

      {/* ─── Playlist list ─── */}
      <ConfigSectionPanel label="My Playlists">
        {playlists.length === 0 ? (
          <div className="text-[10px] text-zinc-600 italic">No playlists added yet.</div>
        ) : (
          <div className="space-y-1.5">
            {playlists.map((pl) => {
              const isActive = pl.id === activePlaylistId
              return (
                <div
                  key={pl.id}
                  className={`flex items-center gap-3 rounded-xl border px-3 py-2 transition-colors ${
                    isActive
                      ? 'border-emerald-500/40 bg-emerald-500/8'
                      : 'border-white/6 bg-white/[0.02]'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className={`text-xs font-medium truncate ${isActive ? 'text-emerald-300' : 'text-zinc-300'}`}>
                      {pl.name}
                    </div>
                    <div className="text-[9px] text-zinc-600 font-mono mt-0.5 truncate">{pl.id}</div>
                  </div>

                  {isActive ? (
                    <span className="text-[9px] text-emerald-400 shrink-0 font-semibold">▶ ACTIVE</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void handleSetActive(pl.id)}
                      disabled={settingActive === pl.id}
                      className="text-[10px] text-cyan-400 hover:text-cyan-300 shrink-0 disabled:opacity-50"
                    >
                      {settingActive === pl.id ? '…' : 'Play'}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => void handleRemove(pl.id)}
                    className="text-[10px] text-zinc-600 hover:text-red-400 shrink-0 transition-colors"
                    title="Remove"
                  >
                    ✕
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </ConfigSectionPanel>

      {/* ─── Test controls ─── */}
      <ConfigSectionPanel label="Test Controls">
        <div className="space-y-3">
          <div className="text-[10px] text-zinc-500">
            Send playback commands to the MUSIC.exe widget via socket.
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => void sendControl('play-pause')}
              className="rounded-lg border border-zinc-700/60 bg-zinc-800/60 px-3 py-1.5 text-xs text-zinc-200 hover:border-cyan-500/50 hover:text-cyan-300 transition-colors"
            >
              ▶/⏸ Play-Pause
            </button>
            <button
              type="button"
              onClick={() => void sendControl('prev')}
              className="rounded-lg border border-zinc-700/60 bg-zinc-800/60 px-3 py-1.5 text-xs text-zinc-200 hover:border-cyan-500/50 hover:text-cyan-300 transition-colors"
            >
              |◀ Prev
            </button>
            <button
              type="button"
              onClick={() => void sendControl('next')}
              className="rounded-lg border border-zinc-700/60 bg-zinc-800/60 px-3 py-1.5 text-xs text-zinc-200 hover:border-cyan-500/50 hover:text-cyan-300 transition-colors"
            >
              ▶| Next
            </button>
            <button
              type="button"
              onClick={() => void sendControl('stop')}
              className="rounded-lg border border-zinc-700/60 bg-zinc-800/60 px-3 py-1.5 text-xs text-zinc-200 hover:border-cyan-500/50 hover:text-cyan-300 transition-colors"
            >
              ■ Stop
            </button>
          </div>
          {controlStatus && (
            <p className="text-[10px] text-cyan-400">{controlStatus}</p>
          )}
          <div className="pt-1 border-t border-zinc-800">
            <button
              type="button"
              onClick={toggleWidget}
              className="rounded-lg border border-zinc-700/60 bg-zinc-800/60 px-3 py-1.5 text-xs text-zinc-200 hover:border-purple-500/50 hover:text-purple-300 transition-colors"
            >
              🎵 Toggle Music Widget
            </button>
          </div>
        </div>
      </ConfigSectionPanel>
    </div>
  )
}
