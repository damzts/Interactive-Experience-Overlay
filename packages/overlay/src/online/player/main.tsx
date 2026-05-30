/**
 * Player Client page entry point.
 *
 * Served at /online/room/:roomCode — extracts the room code from the URL path
 * and renders the PlayerClient component.
 *
 * Requirements: 3.1
 */

import ReactDOM from 'react-dom/client'
import { PlayerClient } from './PlayerClient'

/**
 * Extract room code from the URL path.
 * Expected format: /online/room/:roomCode
 */
function getRoomCodeFromPath(): string | null {
  const segments = window.location.pathname.split('/')
  // Path: /online/room/:roomCode → segments = ['', 'online', 'room', ':roomCode']
  const roomIndex = segments.indexOf('room')
  if (roomIndex !== -1 && roomIndex + 1 < segments.length) {
    const code = segments[roomIndex + 1]
    if (code && code.length > 0) {
      return code.toUpperCase()
    }
  }
  return null
}

const roomCode = getRoomCodeFromPath()

const root = ReactDOM.createRoot(document.getElementById('root')!)

if (roomCode) {
  root.render(<PlayerClient roomCode={roomCode} />)
} else {
  // No room code found — display error
  root.render(
    <div style={{ minHeight: '100vh', backgroundColor: '#111', color: '#fff', fontFamily: 'system-ui, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Invalid Room Link</h1>
        <p style={{ opacity: 0.7 }}>Please use a valid room link in the format: /online/room/ABCDEF</p>
      </div>
    </div>
  )
}
