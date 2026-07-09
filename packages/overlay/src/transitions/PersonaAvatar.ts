import gsap from 'gsap'
import { withPersonaDefaults, type PersonaAvatarEffectConfig } from '@ieomlabs/shared'
import { audioEngine } from '../engine/AudioEngine'
import { useAppStore } from '../store/useAppStore'

/**
 * PERSONA-AVATAR — the persona's character art (transparent png/webp) on the
 * overlay, moving with the live filtered voice amplitude from the persona
 * analyser tap. Two modes:
 *   pop-in     — glitches in when she speaks, sways while talking, lingers,
 *                slides away (default; wired to persona:speak in App.tsx)
 *   persistent — always on screen with a slow idle float; speaking
 *                intensifies the motion (managed via ensurePersonaAvatar)
 *
 * Module-singleton DOM: one avatar at a time, self-managed container
 * (no static TransitionLayer div), like other registry-era effects.
 */

type Corner = 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right'

interface ResolvedAvatarConfig {
  images: string[]
  mode: 'pop-in' | 'persistent'
  corner: Corner
  widthPx: number
  lingerMs: number
}

/** Voice below this smoothed RMS counts as silence… */
const SILENCE_RMS = 0.02
/** …after holding for this long (bridges natural pauses between words). */
const SILENCE_HOLD_MS = 600

interface AvatarInstance {
  root: HTMLDivElement
  img: HTMLImageElement
  cfg: ResolvedAvatarConfig
  raf: number
  smoothed: number
  /** Last time the voice was above the silence threshold (seeded at spawn
   *  so TTS fetch latency doesn't read as "already done talking"). */
  lastActiveAt: number
  persistent: boolean
  exiting: boolean
  data: Uint8Array<ArrayBuffer> | null
}

let inst: AvatarInstance | null = null

function resolveConfig(cfg: PersonaAvatarEffectConfig): ResolvedAvatarConfig {
  const persona = withPersonaDefaults(useAppStore.getState().config.persona)
  return {
    images: cfg.images?.length ? cfg.images : persona.avatar.images,
    mode: cfg.mode ?? 'pop-in',
    corner: cfg.corner ?? persona.avatar.corner,
    widthPx: cfg.widthPx ?? persona.avatar.widthPx,
    lingerMs: cfg.lingerMs ?? persona.avatar.lingerMs,
  }
}

function applyCorner(root: HTMLDivElement, cfg: ResolvedAvatarConfig) {
  const [v, h] = cfg.corner.split('-') as ['top' | 'bottom', 'left' | 'right']
  root.style.top = v === 'top' ? '24px' : 'auto'
  // Bottom corners sit above the Win98 taskbar.
  root.style.bottom = v === 'bottom' ? '64px' : 'auto'
  root.style.left = h === 'left' ? '24px' : 'auto'
  root.style.right = h === 'right' ? '24px' : 'auto'
  root.style.width = `${cfg.widthPx}px`
}

function pickImage(images: string[], current?: string): string {
  if (images.length === 1) return images[0]
  const pool = current ? images.filter((url) => url !== current) : images
  return pool[Math.floor(Math.random() * pool.length)] ?? images[0]
}

function readVoiceRms(instance: AvatarInstance): number {
  const analyser = audioEngine.getPersonaAnalyser()
  if (!analyser) return 0
  if (!instance.data || instance.data.length !== analyser.fftSize) {
    instance.data = new Uint8Array(analyser.fftSize)
  }
  analyser.getByteTimeDomainData(instance.data)
  let sum = 0
  for (let i = 0; i < instance.data.length; i++) {
    const v = (instance.data[i] - 128) / 128
    sum += v * v
  }
  return Math.min(1, Math.sqrt(sum / instance.data.length) * 6)
}

function destroy() {
  if (!inst) return
  cancelAnimationFrame(inst.raf)
  gsap.killTweensOf(inst.root)
  inst.root.remove()
  inst = null
}

function beginExit() {
  if (!inst || inst.exiting) return
  inst.exiting = true
  const dir = inst.cfg.corner.endsWith('left') ? -1 : 1
  gsap.to(inst.root, {
    x: dir * inst.cfg.widthPx * 0.5,
    opacity: 0,
    duration: 0.35,
    ease: 'power2.in',
    onComplete: destroy,
  })
}

function tick(now: number) {
  if (!inst) return
  const instance = inst

  const target = readVoiceRms(instance)
  // Fast attack, slower release — reads as talking, not vibrating.
  const smoothing = target > instance.smoothed ? 0.4 : 0.82
  instance.smoothed = instance.smoothed * smoothing + target * (1 - smoothing)
  const rms = instance.smoothed < SILENCE_RMS ? 0 : instance.smoothed
  if (rms > 0) instance.lastActiveAt = now

  // One motion formula for both modes: with rms=0 it's a gentle idle float,
  // while speaking the voice amplitude drives bob, sway jitter, and scale.
  const t = now / 1000
  const bob = Math.sin(t * 2.1) * 3 + rms * 12
  const sway = Math.sin(t * 1.4) * 1.6 + rms * 2.2 * Math.sin(t * 9)
  const scale = 1 + rms * 0.06
  instance.img.style.transform = `translateY(${(-bob).toFixed(2)}px) rotate(${sway.toFixed(2)}deg) scale(${scale.toFixed(3)})`
  instance.img.style.filter = `drop-shadow(0 8px 20px rgba(68,136,255,${(0.25 + rms * 0.55).toFixed(2)}))`

  if (!instance.persistent && !instance.exiting &&
      now - instance.lastActiveAt > SILENCE_HOLD_MS + instance.cfg.lingerMs) {
    beginExit()
  }
  instance.raf = requestAnimationFrame(tick)
}

function create(cfg: ResolvedAvatarConfig, persistent: boolean) {
  const root = document.createElement('div')
  root.id = 'persona-avatar-root'
  root.style.cssText = 'position:fixed;z-index:210;pointer-events:none'
  applyCorner(root, cfg)

  const img = document.createElement('img')
  img.src = pickImage(cfg.images)
  img.alt = ''
  img.draggable = false
  img.style.cssText = 'width:100%;display:block;transform-origin:50% 90%;will-change:transform,filter'
  root.appendChild(img)
  document.body.appendChild(root)

  inst = {
    root, img, cfg,
    raf: 0,
    smoothed: 0,
    lastActiveAt: performance.now(),
    persistent,
    exiting: false,
    data: null,
  }

  // Entrance: slide from the nearest edge with a brief glitch flicker.
  const dir = cfg.corner.endsWith('left') ? -1 : 1
  gsap.timeline()
    .fromTo(root,
      { x: dir * cfg.widthPx * 0.7, opacity: 0 },
      { x: 0, opacity: 1, duration: 0.45, ease: 'back.out(1.5)' })
    .set(root, { clipPath: 'inset(8% 0 34% 0)' }, 0.06)
    .set(root, { clipPath: 'inset(42% 0 6% 0)' }, 0.12)
    .set(root, { clipPath: 'inset(0% 0 0% 0)' }, 0.18)

  inst.raf = requestAnimationFrame(tick)
}

/** Effect entry point — fired on persona:speak (App.tsx) and dispatchable
 *  from admin/automation/sequences via the 'persona-avatar' catalog entry. */
export function runPersonaAvatar(cfg: PersonaAvatarEffectConfig) {
  const resolved = resolveConfig(cfg)
  if (!resolved.images.length) return

  if (resolved.mode === 'persistent') {
    ensurePersonaAvatar(resolved)
    return
  }

  if (inst) {
    if (inst.exiting) {
      destroy() // mid-exit: restart fresh with a new pose
    } else {
      // Already on screen (pop-in or persistent) — just extend the cycle.
      inst.lastActiveAt = performance.now()
      return
    }
  }
  create(resolved, false)
}

/** Persistent-mode reconciler — call on config load/changes. Creates,
 *  restyles, or converts the singleton; never touches an active pop-in
 *  beyond upgrading it to persistent. */
export function ensurePersonaAvatar(cfg: Omit<PersonaAvatarEffectConfig, 'duration'>) {
  const resolved = resolveConfig({ duration: 0, ...cfg })
  if (!resolved.images.length) {
    retirePersistentAvatar()
    return
  }
  if (inst && !inst.exiting) {
    inst.persistent = true
    inst.cfg = resolved
    applyCorner(inst.root, resolved)
    if (!resolved.images.includes(inst.img.src.replace(window.location.origin, ''))) {
      inst.img.src = pickImage(resolved.images)
    }
    return
  }
  if (inst) destroy()
  create(resolved, true)
}

/** Exit a persistent avatar (config disabled / switched to pop-in).
 *  A pop-in currently on screen is left to finish its own cycle. */
export function retirePersistentAvatar() {
  if (inst?.persistent) beginExit()
}
