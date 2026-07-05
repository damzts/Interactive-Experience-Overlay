import { useEffect, useRef } from 'react'
import type { RendererProps } from '../registry'
import { audioEngine } from '../../engine/AudioEngine'

/**
 * MEDIA-VIZ — Windows Media Player-style visualizations, driven by the real
 * AudioEngine analyser (music/ambient/SFX all route through it). Falls back
 * to a synthesized signal when no audio is flowing so the window never dies.
 *
 * Presets riff on the WMP classics: Bars, Spikes (Plenoptic), Scope,
 * Ambience, Battery (kaleidoscope), Plasma (Psychedelia), Tunnel (Alchemy),
 * Particles. 'cycle' rotates through all of them.
 */

const PRESETS = ['bars', 'spikes', 'scope', 'ambience', 'battery', 'plasma', 'tunnel', 'particles'] as const
type VizPreset = typeof PRESETS[number]

interface VizState {
  t: number
  phase: number
  peaks: number[]
  bassAvg: number
  beat: boolean
  particles: Array<{ x: number; y: number; vx: number; vy: number; life: number; hue: number }>
  presetIndex: number
  lastCycleAt: number
  fakePhase: number
}

function readAudio(freq: Uint8Array, wave: Uint8Array, state: VizState, sensitivity: number): boolean {
  const analyser = audioEngine.getAnalyser()
  if (analyser) {
    analyser.getByteFrequencyData(freq as Uint8Array<ArrayBuffer>)
    analyser.getByteTimeDomainData(wave as Uint8Array<ArrayBuffer>)
    // If the graph is silent the arrays are all-zero / flat — fall through to synth
    let energy = 0
    for (let i = 0; i < 32; i += 1) energy += freq[i]
    if (energy > 40) {
      if (sensitivity !== 1) {
        for (let i = 0; i < freq.length; i += 1) freq[i] = Math.min(255, freq[i] * sensitivity)
      }
      return true
    }
  }
  // Synthesized fallback: smooth noise walk so the viz stays alive without audio
  state.fakePhase += 0.05
  const p = state.fakePhase
  for (let i = 0; i < freq.length; i += 1) {
    const f = i / freq.length
    const v = Math.abs(Math.sin(p * (0.7 + f * 2.1) + i * 0.7)) * (1 - f * 0.8)
    freq[i] = Math.round(v * 190 * (0.65 + 0.35 * Math.sin(p * 0.43 + i)))
  }
  for (let i = 0; i < wave.length; i += 1) {
    wave[i] = 128 + Math.round(
      Math.sin(i * 0.045 + p * 3.1) * 38 * (0.5 + 0.5 * Math.sin(p * 0.9))
      + Math.sin(i * 0.011 + p * 1.7) * 22,
    )
  }
  return false
}

function bandAverage(freq: Uint8Array, from: number, to: number): number {
  let sum = 0
  for (let i = from; i < to; i += 1) sum += freq[i]
  return sum / (to - from) / 255
}

export function MediaVizRenderer({ config, bounds }: RendererProps) {
  const presetConfig = String(config.preset ?? 'cycle')
  const colorA = String(config.colorA ?? '#2cf7ff')
  const colorB = String(config.colorB ?? '#ff6dff')
  const bgColor = String(config.bgColor ?? '#05060c')
  const sensitivity = Number(config.sensitivity ?? 1)
  const cycleSeconds = Math.max(3, Number(config.cycleSeconds ?? 12))

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = Math.max(1, Math.round(bounds.width))
    const H = Math.max(1, Math.round(bounds.height))
    canvas.width = W
    canvas.height = H

    // Feedback buffer for the zoom/rotate trail presets (tunnel/battery/ambience)
    const prev = document.createElement('canvas')
    prev.width = W
    prev.height = H
    const prevCtx = prev.getContext('2d')!

    const freq = new Uint8Array(1024)
    const wave = new Uint8Array(2048)
    const state: VizState = {
      t: 0, phase: 0, peaks: new Array(64).fill(0), bassAvg: 0.1, beat: false,
      particles: [], presetIndex: 0, lastCycleAt: performance.now(), fakePhase: Math.random() * 100,
    }
    const cx = W / 2
    const cy = H / 2

    const activePreset = (): VizPreset => {
      if (presetConfig !== 'cycle') {
        return (PRESETS as readonly string[]).includes(presetConfig) ? presetConfig as VizPreset : 'bars'
      }
      const now = performance.now()
      if (now - state.lastCycleAt > cycleSeconds * 1000) {
        state.presetIndex = (state.presetIndex + 1) % PRESETS.length
        state.lastCycleAt = now
        prevCtx.clearRect(0, 0, W, H)
      }
      return PRESETS[state.presetIndex]
    }

    const drawBars = (count: number) => {
      const barW = W / count
      const grad = ctx.createLinearGradient(0, H, 0, 0)
      grad.addColorStop(0, colorA)
      grad.addColorStop(1, colorB)
      for (let i = 0; i < count; i += 1) {
        const bin = Math.floor((i / count) ** 1.6 * 320)
        const v = freq[bin] / 255
        const h = v * H * 0.92
        state.peaks[i] = Math.max((state.peaks[i] ?? 0) - 0.008, v)
        ctx.fillStyle = grad
        ctx.fillRect(i * barW + 1, H - h, barW - 2, h)
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(i * barW + 1, H - state.peaks[i] * H * 0.92 - 3, barW - 2, 2)
      }
    }

    const drawScope = () => {
      ctx.lineWidth = 2
      ctx.shadowBlur = 12
      ctx.shadowColor = colorA
      ctx.strokeStyle = colorA
      ctx.beginPath()
      const n = wave.length
      for (let x = 0; x < W; x += 1) {
        const v = wave[Math.floor((x / W) * n)] / 255
        const y = v * H
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
      }
      ctx.stroke()
      ctx.shadowBlur = 0
    }

    const drawSpikes = () => {
      const spikes = 96
      const base = Math.min(W, H) * 0.12
      ctx.lineWidth = 2
      for (let i = 0; i < spikes; i += 1) {
        const a = (i / spikes) * Math.PI * 2 + state.phase * 0.4
        const v = freq[Math.floor((i / spikes) * 256)] / 255
        const r0 = base + v * 6
        const r1 = base + v * Math.min(W, H) * 0.42
        ctx.strokeStyle = i % 2 === 0 ? colorA : colorB
        ctx.globalAlpha = 0.35 + v * 0.65
        ctx.beginPath()
        ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0)
        ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1)
        ctx.stroke()
      }
      ctx.globalAlpha = 1
    }

    const drawAmbience = (bass: number, mid: number) => {
      for (let i = 0; i < 3; i += 1) {
        const a = state.phase * (0.3 + i * 0.17) + i * 2.1
        const bx = cx + Math.cos(a) * W * 0.22
        const by = cy + Math.sin(a * 1.3) * H * 0.22
        const r = Math.max(12, (0.18 + bass * 0.45) * Math.min(W, H) * (0.7 + i * 0.25))
        const grad = ctx.createRadialGradient(bx, by, 0, bx, by, r)
        grad.addColorStop(0, i % 2 === 0 ? colorA : colorB)
        grad.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.globalAlpha = 0.16 + mid * 0.2
        ctx.fillStyle = grad
        ctx.fillRect(bx - r, by - r, r * 2, r * 2)
      }
      ctx.globalAlpha = 1
    }

    const drawBattery = () => {
      // Kaleidoscope: one waveform wedge mirrored around the center
      const wedges = 8
      const n = wave.length
      for (let s = 0; s < wedges; s += 1) {
        ctx.save()
        ctx.translate(cx, cy)
        ctx.rotate((s / wedges) * Math.PI * 2 + state.phase * 0.25)
        if (s % 2 === 1) ctx.scale(1, -1)
        ctx.lineWidth = 2
        ctx.strokeStyle = s % 2 === 0 ? colorA : colorB
        ctx.globalAlpha = 0.8
        ctx.beginPath()
        const seg = Math.min(W, H) * 0.48
        for (let i = 0; i <= 60; i += 1) {
          const v = (wave[Math.floor((i / 60) * (n / 4))] - 128) / 128
          const x = (i / 60) * seg
          const y = v * seg * 0.3
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
        }
        ctx.stroke()
        ctx.restore()
      }
      ctx.globalAlpha = 1
    }

    const drawPlasma = (bass: number) => {
      const cell = Math.max(10, Math.round(Math.min(W, H) / 28))
      const p = state.phase
      for (let y = 0; y < H; y += cell) {
        for (let x = 0; x < W; x += cell) {
          const v =
            Math.sin(x * 0.02 + p * 1.6)
            + Math.sin(y * 0.024 - p * 1.1)
            + Math.sin((x + y) * 0.013 + p * 0.7)
            + Math.sin(Math.hypot(x - cx, y - cy) * 0.02 - p * (1.5 + bass * 2))
          const hue = (v * 45 + p * 30) % 360
          ctx.fillStyle = `hsl(${hue}, 85%, ${28 + bass * 30 + v * 6}%)`
          ctx.fillRect(x, y, cell, cell)
        }
      }
    }

    const drawTunnel = (bass: number) => {
      const ringBars = 48
      const r = Math.min(W, H) * (0.18 + bass * 0.1)
      for (let i = 0; i < ringBars; i += 1) {
        const a = (i / ringBars) * Math.PI * 2 + state.phase * 0.8
        const v = freq[Math.floor((i / ringBars) * 200)] / 255
        const len = 4 + v * Math.min(W, H) * 0.22
        ctx.strokeStyle = i % 2 === 0 ? colorA : colorB
        ctx.lineWidth = 3
        ctx.globalAlpha = 0.5 + v * 0.5
        ctx.beginPath()
        ctx.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r)
        ctx.lineTo(cx + Math.cos(a) * (r + len), cy + Math.sin(a) * (r + len))
        ctx.stroke()
      }
      ctx.globalAlpha = 1
    }

    const drawParticles = (bass: number) => {
      if (state.beat || (state.particles.length < 20 && Math.random() < 0.2)) {
        for (let i = 0; i < 14; i += 1) {
          const a = Math.random() * Math.PI * 2
          const speed = 1 + bass * 7 * Math.random()
          state.particles.push({
            x: cx, y: cy,
            vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
            life: 1, hue: (state.phase * 40 + Math.random() * 80) % 360,
          })
        }
      }
      const next: VizState['particles'] = []
      for (const pt of state.particles) {
        pt.x += pt.vx
        pt.y += pt.vy
        // Gentle swirl toward orbit
        const dx = pt.x - cx
        const dy = pt.y - cy
        pt.vx += -dy * 0.0016 - dx * 0.0004
        pt.vy += dx * 0.0016 - dy * 0.0004
        pt.life -= 0.008
        if (pt.life <= 0 || pt.x < -20 || pt.x > W + 20 || pt.y < -20 || pt.y > H + 20) continue
        ctx.fillStyle = `hsla(${pt.hue}, 90%, 65%, ${pt.life})`
        ctx.beginPath()
        ctx.arc(pt.x, pt.y, 1.5 + pt.life * 2.5, 0, Math.PI * 2)
        ctx.fill()
        next.push(pt)
      }
      state.particles = next.slice(-400)
    }

    const tick = () => {
      readAudio(freq, wave, state, sensitivity)
      const bass = bandAverage(freq, 0, 12)
      const mid = bandAverage(freq, 24, 96)
      state.bassAvg += (bass - state.bassAvg) * 0.04
      state.beat = bass > state.bassAvg * 1.4 && bass > 0.28
      state.t += 1
      state.phase += 0.016 * (1 + mid * 1.2)

      const preset = activePreset()
      const useFeedback = preset === 'tunnel' || preset === 'battery' || preset === 'ambience' || preset === 'particles'

      if (useFeedback) {
        // Recycle last frame: zoom + rotate slightly, then dim — the WMP trail
        ctx.fillStyle = bgColor
        ctx.fillRect(0, 0, W, H)
        ctx.save()
        ctx.translate(cx, cy)
        const zoom = preset === 'tunnel' ? 1.045 : preset === 'ambience' ? 1.012 : 1.025
        ctx.rotate(preset === 'battery' ? 0.012 : preset === 'tunnel' ? -0.008 : 0)
        ctx.scale(zoom, zoom)
        ctx.globalAlpha = 0.9
        ctx.drawImage(prev, -cx, -cy)
        ctx.restore()
        ctx.globalAlpha = 1
      } else {
        ctx.fillStyle = bgColor
        ctx.fillRect(0, 0, W, H)
      }

      switch (preset) {
        case 'bars': drawBars(Math.max(12, Math.min(64, Math.floor(W / 14)))); break
        case 'spikes': drawSpikes(); break
        case 'scope': drawScope(); break
        case 'ambience': drawAmbience(bass, mid); break
        case 'battery': drawBattery(); break
        case 'plasma': drawPlasma(bass); break
        case 'tunnel': drawTunnel(bass); break
        case 'particles': drawParticles(bass); break
      }

      if (useFeedback) prevCtx.drawImage(canvas, 0, 0)
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [bounds.width, bounds.height, presetConfig, colorA, colorB, bgColor, sensitivity, cycleSeconds])

  return (
    <div style={{ position: 'absolute', inset: 0, background: bgColor }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
    </div>
  )
}
