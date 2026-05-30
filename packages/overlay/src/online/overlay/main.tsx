/**
 * Entry point for the Browser Source Overlay page.
 *
 * Served at /online/overlay/:roomCode — extracts the room code from the URL
 * path and renders the BrowserSourceOverlay component with no additional UI chrome.
 *
 * Requirements: 8.1
 */

import ReactDOM from 'react-dom/client'
import { BrowserSourceOverlay } from './BrowserSourceOverlay'

/**
 * Extract room code from the URL path.
 * Expected format: /online/overlay/:roomCode
 */
function getRoomCodeFromPath(): string | null {
  const segments = window.location.pathname.split('/')
  // Path: /online/overlay/:roomCode → segments = ['', 'online', 'overlay', ':roomCode']
  const overlayIndex = segments.indexOf('overlay')
  if (overlayIndex !== -1 && overlayIndex + 1 < segments.length) {
    const code = segments[overlayIndex + 1]
    if (code && code.length > 0) {
      return code
    }
  }
  return null
}

const roomCode = getRoomCodeFromPath()

const root = ReactDOM.createRoot(document.getElementById('root')!)

if (roomCode) {
  root.render(<BrowserSourceOverlay roomCode={roomCode} />)
} else {
  // No room code found — display error (should not happen in normal usage)
  root.render(
    <div style={{ color: '#f00', background: '#000', padding: '2rem', fontFamily: 'monospace' }}>
      <p>Error: No room code found in URL.</p>
      <p>Expected URL format: /online/overlay/ROOMCODE</p>
    </div>
  )
}
