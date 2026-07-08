import gsap from 'gsap'
import type { BootSequenceConfig } from '@ieomlabs/shared'

const BOOT_LINES = [
  'IEOM SYSTEM BIOS  v2.99.0',
  'Copyright (C) 1999  Interactive Experience Corp.',
  '',
  'CPU: Intel Pentium II  450MHz',
  'Base Memory: 640K OK',
  'Extended Memory: 65024K OK',
  '',
  'Loading drivers ........................ Done',
  'Mounting filesystem ................... Done',
  '',
  '> IEOM OS KERNEL LOADED',
  '> Running startup scripts...',
  '> Establishing stream connection...',
]

/** BOOT-SEQUENCE — BIOS POST text → progress bar → fade. Pure GSAP + DOM. */
export function runBootSequence(cfg: BootSequenceConfig): void {
  const screen  = document.getElementById('tl-boot-screen')
  const text    = document.getElementById('tl-boot-text')
  const barWrap = document.getElementById('tl-boot-bar')
  const barFill = document.getElementById('tl-boot-bar-fill')
  if (!screen || !text || !barWrap || !barFill) return

  gsap.set(screen, { display: 'flex', opacity: 1 })
  gsap.set(barWrap, { opacity: 0 })
  gsap.set(barFill, { width: '0%' })
  text.textContent = ''

  const tl = gsap.timeline().timeScale(Math.max(cfg?.speed ?? 1, 0.1))

  BOOT_LINES.forEach((line, i) => {
    tl.call(
      () => { text.textContent += (i > 0 ? '\n' : '') + line },
      undefined,
      i * 0.09,
    )
  })

  tl.to(barWrap, { opacity: 1, duration: 0.15 }, '+=0.4')
  tl.to(barFill, { width: '100%', duration: 1.4, ease: 'power1.inOut' })
  tl.to(screen, { opacity: 0, duration: 0.5, ease: 'power2.inOut' }, '+=0.3')
  tl.call(() => { gsap.set(screen, { display: 'none' }) })
}
