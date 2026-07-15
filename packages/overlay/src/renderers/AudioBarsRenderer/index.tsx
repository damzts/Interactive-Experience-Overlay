import { useEffect, useRef } from 'react'
import type { RendererProps } from '../registry'
import { audioEngine } from '../../engine/AudioEngine'

/**
 * AUDIO-BARS — Minimal reactive audio bar visualizer, driven by the real
 * AudioEngine analyser (music/ambient/SFX all route through it). Falls back
 * to a synthesized signal when no audio is flowing so the window never dies.
 *
 * This is a stripped-down sibling of MediaVizRenderer that only renders the
 * 'bars' preset — no scope/plasma/tunnel/etc — for a lighter-weight widget.
 */

interface BarsState {
  peaks: number[]
  fakePhase: number
}

function readAudio(freq: Uint8Array, state: BarsState, sensitivity: number): boolean {
  const analyser = audioEngine.getAnalyser()
  if (analyser) {
    analyser.getByteFrequencyData(freq as Uint8Array<ArrayBuffer>)
    // If the graph is silent the array is all-zero — fall through to synth
    let energy = 0
    for (let i = 0; i < 32; i += 1) energy += freq[i]
    if (energy > 40) {
      if (sensitivity !== 1) {
        for (let i = 0; i < freq.length; i += 1) freq[i] = Math.min(255, freq[i] * sensitivity)
      }
      return true
    }
  }
  // Synthesized fallback: smooth noise walk so the bars stay alive without audio
  state.fakePhase += 0.05
  const p = state.fakePhase
  for (let i = 0; i < freq.length; i += 1) {
    const f = i / freq.length
    const v = Math.abs(Math.sin(p * (0.7 + f * 2.1) + i * 0.7)) * (1 - f * 0.8)
    freq[i] = Math.round(v * 190 * (0.65 + 0.35 * Math.sin(p * 0.43 + i)))
  }
  return false
}

export function AudioBarsRenderer({ config, bounds }: RendererProps) {
  const colorA = String(config.colorA ?? '#2cf7ff')
  const colorB = String(config.colorB ?? '#ff6dff')
  const bgColor = String(config.bgColor ?? '#05060c')
  const sensitivity = Number(config.sensitivity ?? 1)
  const barCount = Number(config.barCount ?? 32)

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

    const freq = new Uint8Array(1024)
    const state: BarsState = { peaks: new Array(64).fill(0), fakePhase: Math.random() * 100 }
    const count = Math.max(4, Math.min(64, Math.floor(barCount)))

    const drawBars = () => {
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

    const tick = () => {
      readAudio(freq, state, sensitivity)
      ctx.fillStyle = bgColor
      ctx.fillRect(0, 0, W, H)
      drawBars()
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [bounds.width, bounds.height, colorA, colorB, bgColor, sensitivity, barCount])

  return (
    <div style={{ position: 'absolute', inset: 0, background: bgColor }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
    </div>
  )
}
