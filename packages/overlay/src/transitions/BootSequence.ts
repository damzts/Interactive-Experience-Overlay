import gsap from 'gsap'

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

/** One-time boot animation: BIOS POST text → progress bar → fade to desktop.
 *  Pure GSAP + DOM. No Three.js. No 3D. */
export function playBootSequence(onComplete: () => void): gsap.core.Timeline {
  const tl = gsap.timeline()
  const screen  = document.getElementById('tl-boot-screen')
  const text    = document.getElementById('tl-boot-text')
  const barWrap = document.getElementById('tl-boot-bar')
  const barFill = document.getElementById('tl-boot-bar-fill')

  if (!screen || !text || !barWrap || !barFill) {
    onComplete()
    return tl
  }

  // Boot screen starts opaque (CSS), make sure content is clean
  gsap.set(screen, { opacity: 1 })
  text.textContent = ''

  // Type out BIOS lines
  BOOT_LINES.forEach((line, i) => {
    tl.call(
      () => { text.textContent += (i > 0 ? '\n' : '') + line },
      undefined,
      i * 0.09,
    )
  })

  // Brief pause then show progress bar
  tl.to(barWrap, { opacity: 1, duration: 0.15 }, '+=0.4')
  tl.to(barFill, { width: '100%', duration: 1.4, ease: 'power1.inOut' })

  // Fade boot screen out → desktop (or current state) revealed
  tl.to(screen, { opacity: 0, duration: 0.5, ease: 'power2.inOut' }, '+=0.3')
  tl.call(onComplete)
  // Remove from paint after fade
  const s = screen
  tl.call(() => { gsap.set(s, { display: 'none' }) })

  return tl
}
