import { useState, useEffect } from 'react'

interface RoomInfo {
  roomId: string
  createdAt: number
  hubConnected: boolean
  participantCount: number
}

export function Dashboard() {
  const [rooms, setRooms] = useState<RoomInfo[]>([])
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchRooms = () => {
    fetch('/api/rooms', { credentials: 'include' })
      .then(r => r.json())
      .then(setRooms)
      .catch(() => {})
  }

  useEffect(() => {
    fetchRooms()
    const interval = setInterval(fetchRooms, 5000)
    return () => clearInterval(interval)
  }, [])

  const createRoom = async () => {
    setCreating(true)
    setError(null)
    try {
      const res = await fetch('/api/rooms', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' } })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error)
      fetchRooms()
    } catch (e: any) {
      setError(e.message)
    }
    setCreating(false)
  }

  const closeRoom = async (roomId: string) => {
    await fetch(`/api/rooms/${roomId}`, { method: 'DELETE', credentials: 'include' })
    fetchRooms()
  }

  const shareUrl = (roomId: string) => `${window.location.origin}/room/${roomId}`

  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Room Dashboard</h2>
        <button onClick={createRoom} disabled={creating} style={{ padding: '0.5rem 1.5rem', background: '#4285f4', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
          {creating ? 'Creating...' : 'Create Room'}
        </button>
      </div>

      {error && <p style={{ color: '#f44', marginTop: '0.5rem' }}>{error}</p>}

      {rooms.length === 0 && <p style={{ marginTop: '2rem', color: '#888' }}>No active rooms. Create one to get started.</p>}

      <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {rooms.map(room => (
          <div key={room.roomId} style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong style={{ fontSize: '1.2rem' }}>{room.roomId}</strong>
                <span style={{ marginLeft: '0.5rem', fontSize: '0.8rem', color: room.hubConnected ? '#4caf50' : '#ff9800' }}>
                  {room.hubConnected ? '🟢 Hub connected' : '🟡 Waiting for hub'}
                </span>
              </div>
              <button onClick={() => closeRoom(room.roomId)} style={{ padding: '0.25rem 0.75rem', background: '#f44336', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}>
                Close
              </button>
            </div>

            <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#666' }}>
              <span>Share: </span>
              <code style={{ background: '#f5f5f5', padding: '0.2rem 0.5rem', borderRadius: '3px' }}>{shareUrl(room.roomId)}</code>
            </div>

            <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#888' }}>
              Participants: {room.participantCount}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
