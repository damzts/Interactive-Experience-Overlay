import type { AudioBandLevels } from '@ieomlabs/shared'

/**
 * Frequency-band averaging shared by the reactivity monitor (discrete
 * audio:* kernel events) and useAudioBands (continuous renderer binding),
 * so both report the same numbers for the same frame.
 *
 * Band edges as bin fractions: bass = first 12 bins (matches the beat
 * detector's historical range), mid = bass..1/4, treble = 1/4..1/2
 * (the upper half of FFT bins is near-empty for music content).
 */
export function bandAverage(freq: Uint8Array, from: number, to: number): number {
  const end = Math.min(to, freq.length)
  const start = Math.min(from, end)
  if (end <= start) return 0
  let sum = 0
  for (let i = start; i < end; i += 1) sum += freq[i]
  return sum / (end - start) / 255
}

export function computeBandLevels(freq: Uint8Array): AudioBandLevels {
  const bins = freq.length
  const bassEnd = Math.min(12, bins)
  const midEnd = Math.max(bassEnd + 1, Math.floor(bins / 4))
  const trebleEnd = Math.max(midEnd + 1, Math.floor(bins / 2))
  return {
    bass: bandAverage(freq, 0, bassEnd),
    mid: bandAverage(freq, bassEnd, midEnd),
    treble: bandAverage(freq, midEnd, trebleEnd),
  }
}
