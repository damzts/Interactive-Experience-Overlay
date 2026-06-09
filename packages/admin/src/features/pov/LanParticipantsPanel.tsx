import { useEffect, useState } from 'react'
import { apiFetch } from '../../api/client'
import { ConfigPageIntro, ConfigCard } from '../../shared/ui'

interface LanParticipant {
  id: string
  iceState: string
  videoMuted: boolean
}

function iceColor(state: string) {
  if (state === 'connected' || state === 'completed') return 'text-[var(--color-success-400)]'
  if (state === 'checking') return 'text-[var(--color-accent-300)]'
  if (state === 'failed' || state === 'disconnected' || state === 'closed') return 'text-[var(--color-danger-400)]'
  return 'text-[var(--color-text-muted)]'
}

export function LanParticipantsPanel() {
  const [participants, setParticipants] = useState<LanParticipant[]>([])
  const [roomCode, setRoomCode] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function refresh() {
    try {
      const [{ participants }, { code }] = await Promise.all([
        apiFetch<{ participants: LanParticipant[] }>('/api/room/lan-participants'),
        apiFetch<{ code: string }>('/api/room/code'),
      ])
      setParticipants(participants)
      setRoomCode(code)
      setError(null)
    } catch (e: any) {
      setError(e.message ?? 'Failed to load')
    }
  }

  useEffect(() => {
    refresh()
    const t = setInterval(refresh, 3000)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="space-y-4">
      <ConfigPageIntro title="LAN Participants" eyebrow="Local Network">
        Devices connected directly on the local network via /join. No cloud required.
      </ConfigPageIntro>

      <ConfigCard>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider">Room Code</span>
          <button
            onClick={async () => {
              await apiFetch('/api/room/code/regenerate', { method: 'POST' })
              refresh()
            }}
            className="text-[10px] text-[var(--color-primary-300)] hover:text-[var(--color-primary-200)] transition-colors"
          >
            Regenerate
          </button>
        </div>
        <div className="font-mono text-2xl font-bold tracking-[0.25em] text-[var(--color-text-primary)]">
          {roomCode ?? '——'}
        </div>
        <div className="text-[10px] text-[var(--color-text-muted)] mt-1">
          Share with LAN guests → {window.location.origin.replace(':3002', ':3000')}/join
        </div>
      </ConfigCard>

      <ConfigCard>
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider">
            Connected ({participants.length})
          </span>
          <button onClick={refresh} className="text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors">
            ↻ Refresh
          </button>
        </div>

        {error && (
          <div className="text-[11px] text-[var(--color-danger-400)]">{error}</div>
        )}

        {!error && participants.length === 0 && (
          <div className="text-[11px] text-[var(--color-text-muted)] italic">No LAN participants connected.</div>
        )}

        {participants.map(p => (
          <div key={p.id} className="flex items-center justify-between py-2 border-b border-[var(--color-border-default)] last:border-0">
            <div>
              <div className="text-xs font-mono text-[var(--color-text-primary)]">{p.id}</div>
              <div className={`text-[10px] ${iceColor(p.iceState)}`}>{p.iceState}</div>
            </div>
            <div className="flex items-center gap-2 text-[10px]">
              {p.videoMuted
                ? <span className="text-[var(--color-danger-400)]">📵 Video muted</span>
                : <span className="text-[var(--color-success-400)]">📹 Video live</span>
              }
            </div>
          </div>
        ))}
      </ConfigCard>
    </div>
  )
}
