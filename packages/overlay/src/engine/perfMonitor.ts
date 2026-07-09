import { socket } from '../socket/client'

/**
 * Render-performance monitor — the overlay runs inside an OBS browser
 * source with a hard GPU budget, and stacked effects/renderers are the
 * usual culprit when it starts dropping frames. This rAF loop samples
 * frame deltas and reports a rolling summary to the kernel every few
 * seconds ('overlay:perf'), where it lands in runtime diagnostics for
 * the admin to display and automation to react to.
 */

const REPORT_INTERVAL_MS = 5_000
/** A frame slower than this is a visible hitch at 30/60fps targets. */
const LONG_FRAME_MS = 50

let running = false

export function startPerfMonitor(): () => void {
  if (running) return () => {}
  running = true

  let raf = 0
  let last = performance.now()
  let windowStart = last
  let frames = 0
  let longFrames = 0
  let worstFrameMs = 0

  const tick = (now: number) => {
    if (!running) return
    const dt = now - last
    last = now
    frames += 1
    if (dt > LONG_FRAME_MS) longFrames += 1
    if (dt > worstFrameMs) worstFrameMs = dt

    const windowMs = now - windowStart
    if (windowMs >= REPORT_INTERVAL_MS) {
      if (socket.connected) {
        socket.emit('overlay:perf', {
          fps: Math.round((frames / windowMs) * 1000),
          longFrames,
          worstFrameMs: Math.round(worstFrameMs),
          windowMs: Math.round(windowMs),
        })
      }
      windowStart = now
      frames = 0
      longFrames = 0
      worstFrameMs = 0
    }
    raf = requestAnimationFrame(tick)
  }
  raf = requestAnimationFrame(tick)

  return () => {
    running = false
    cancelAnimationFrame(raf)
  }
}
