import ReactDOM from 'react-dom/client'
import '98.css'
import './overlay.css'
import './desktop/widgetIntentManifests'
import App from './App'
import { socket } from './socket/client'

const RETRY_INTERVAL = 30_000
const root = document.getElementById('root')!

async function checkSlotTaken(): Promise<boolean> {
  try {
    const r = await fetch('/api/overlay/status')
    if (r.ok) { const d = await r.json(); return !!d.slotTaken }
  } catch {}
  return false
}

function showGate() {
  let seconds = 30
  root.innerHTML =
    '<div style="display:flex;align-items:center;justify-content:center;height:100vh;background:#0a0a0a;color:#e4e4e7;font-family:system-ui,sans-serif">' +
    '<div style="text-align:center;max-width:420px">' +
    '<p style="font-size:18px;margin-bottom:12px">Overlay is already open in another window.</p>' +
    '<p style="font-size:14px;color:#a1a1aa">Retrying in <span id="gate-countdown">30</span>s\u2026</p>' +
    '</div></div>'
  const span = document.getElementById('gate-countdown')!
  const tick = setInterval(() => { seconds--; if (seconds <= 0) seconds = 30; span.textContent = String(seconds) }, 1000)
  const poll = setInterval(async () => {
    if (!(await checkSlotTaken())) {
      clearInterval(poll)
      clearInterval(tick)
      root.innerHTML = ''
      mountApp()
    }
    seconds = 30
    span.textContent = '30'
  }, RETRY_INTERVAL)
}

function mountApp() {
  socket.connect()
  // No StrictMode — double-mounting breaks singleton socket and GSAP timelines
  ReactDOM.createRoot(root).render(<App />)
}

async function boot() {
  if (await checkSlotTaken()) {
    showGate()
  } else {
    mountApp()
  }
}

boot()
