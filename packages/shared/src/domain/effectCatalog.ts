/**
 * EFFECT_CATALOG — the single source of truth for every overlay effect.
 *
 * Mirrors the RENDERER_CATALOG pattern: each entry self-describes its
 * label, category, default config, field schema (drives the generated
 * admin editor), and default sound. Admin categories, draft defaults,
 * settings forms, and the overlay's effect→SFX mapping are ALL derived
 * from this record.
 *
 * Adding a new effect =
 *   1. one EffectConfigMap entry + config interface (contracts/effects.ts)
 *   2. one entry here (compiler enforces it — the record is total)
 *   3. the run function + registerEffect() call in the overlay
 * No admin code, no SFX map, no preset files.
 */
import type { EffectConfigMap, EffectType } from '../contracts/effects.js'
import type { FieldDef, PluginManifestBase } from './fields.js'
import { DEFAULT_DESKTOP_NOTIFICATION_DURATION_MS } from '../constants/defaults.js'

export const EFFECT_CATEGORY_ORDER = [
  'Notifications',
  'Screen Distortion',
  'Transitions',
  'Particles & Ambient',
  'Animations',
  'Media',
  'Audio',
  'Stream Personality',
  'Cinematic',
  '2000s Internet',
  'Anime',
  'MMORPG / Retro-Futurist',
] as const

export type EffectCategory = (typeof EFFECT_CATEGORY_ORDER)[number]

/** Effect manifest — extends the unified PluginManifestBase (label, icon,
 *  desc, fields) with effect-specific defaults and sound. */
export interface EffectManifest<K extends EffectType = EffectType> extends PluginManifestBase {
  label: string
  category: EffectCategory
  /** Draft config for a newly added instance of this effect */
  defaults: EffectConfigMap[K]
  /** Schema for the generated admin editor */
  fields: FieldDef[]
  /** Built-in sound played when the effect fires and no per-instance sfx is set */
  defaultSfx?: string
}

// ── Field shorthands ──────────────────────────────────────────────

const dur = (min = 0.5, max = 10, step = 0.25): FieldDef =>
  ({ key: 'duration', label: 'Duration', type: 'slider', min, max, step, unit: 's' })
const durMs = (min = 500, max = 10000, step = 250): FieldDef =>
  ({ key: 'durationMs', label: 'Duration', type: 'slider', min, max, step, unit: 'ms' })
const slider = (key: string, label: string, min: number, max: number, step: number, unit?: string): FieldDef =>
  ({ key, label, type: 'slider', min, max, step, unit })
const color = (key = 'color', label = 'Color'): FieldDef => ({ key, label, type: 'color' })
const colors = (key = 'colors', label = 'Colors'): FieldDef =>
  ({ key, label, type: 'color-list', hint: 'One color per line.' })
const text = (key: string, label: string, optional = false): FieldDef =>
  ({ key, label, type: 'text', optional })
const textarea = (key: string, label: string, optional = false): FieldDef =>
  ({ key, label, type: 'textarea', optional })
const sel = (key: string, label: string, options: string[]): FieldDef =>
  ({ key, label, type: 'select', options })
const bool = (key: string, label: string): FieldDef => ({ key, label, type: 'boolean' })
const num = (key: string, label: string, optional = true): FieldDef =>
  ({ key, label, type: 'number', optional })

// ── The catalog ───────────────────────────────────────────────────

export const EFFECT_CATALOG: { readonly [K in EffectType]: EffectManifest<K> } = {

  // ── Notifications ───────────────────────────────────────────────
  'desktop-notification': {
    label: 'Desktop Notification', category: 'Notifications',
    desc: 'OS-style taskbar/toast notification',
    defaults: { title: 'Desktop popup', body: 'This is a desktop notification event.', icon: '📣', durationMs: DEFAULT_DESKTOP_NOTIFICATION_DURATION_MS },
    fields: [text('title', 'Title'), textarea('body', 'Body'), text('icon', 'Icon', true), durMs(0, 10000)],
  },
  'notification-box': {
    label: 'Notification Box', category: 'Notifications',
    desc: 'Win98 dialog window(s), cascade via flex stack',
    defaults: { title: 'System Notice', body: 'A notification box has been triggered.', icon: 'ℹ️', autoDismiss: 4 },
    fields: [text('title', 'Title'), text('icon', 'Icon'), textarea('body', 'Body'), slider('autoDismiss', 'Dismiss', 0, 15, 0.5, 's')],
  },
  'terminal-toast': {
    label: 'Terminal Toast', category: 'Notifications',
    desc: '[SERVER]: message prints at chosen corner',
    defaults: { messages: ['[ SYSTEM ] Draft event test', '[ STATUS ] Preview path active'], duration: 3, position: 'bottom-right' },
    fields: [
      { key: 'messages', label: 'Messages', type: 'text-list', hint: 'One line per terminal message.' },
      dur(0.5, 10),
      sel('position', 'Position', ['bottom-left', 'bottom-right', 'top-left', 'top-right']),
    ],
  },
  'achievement-unlock': {
    label: 'Achievement Unlock', category: 'Notifications', defaultSfx: 'victory',
    desc: 'Xbox 360 toast from bottom-right',
    defaults: { title: 'Achievement Unlocked', description: 'You did something great.', points: 10, icon: '🏆', durationMs: 4000 },
    fields: [text('title', 'Title'), textarea('description', 'Description'), slider('points', 'Points', 0, 1000, 5), text('icon', 'Icon', true), durMs()],
  },
  'system-alert': {
    label: 'System Alert', category: 'Notifications',
    desc: 'Vista UAC-style center dialog',
    defaults: { title: 'Windows Security Alert', message: 'An unrecognized program is trying to access this computer.', durationMs: 4000 },
    fields: [text('title', 'Title'), textarea('message', 'Message'), durMs()],
  },
  'error-dialog': {
    label: 'Error Dialog', category: 'Notifications', defaultSfx: 'win98-error',
    desc: 'Win98/XP error box with phantom OK button',
    defaults: { title: 'Application Error', message: 'The application has encountered an unexpected error and needs to close.', durationMs: 3500 },
    fields: [text('title', 'Title'), textarea('message', 'Message'), durMs()],
  },
  'friend-join': {
    label: 'Friend Join', category: 'Notifications', defaultSfx: 'startup',
    desc: 'Xbox Live / Messenger friend-joined slide-in',
    defaults: { username: 'Player_001', tagline: 'has joined your session', durationMs: 3500 },
    fields: [text('username', 'Username'), text('tagline', 'Tagline', true), durMs()],
  },

  // ── Screen Distortion ───────────────────────────────────────────
  'screen-shake': {
    label: 'Screen Shake', category: 'Screen Distortion',
    desc: 'Camera shake only, no overlay',
    defaults: { intensity: 'medium', duration: 0.8 },
    fields: [sel('intensity', 'Intensity', ['light', 'medium', 'heavy']), dur(0.1, 5, 0.1)],
  },
  'vignette-pulse': {
    label: 'Vignette Pulse', category: 'Screen Distortion',
    desc: 'Color vignette floods screen, optional text',
    defaults: { color: '#ff3b3b', opacity: 0.85, duration: 1.8, text: '' },
    fields: [color(), slider('opacity', 'Opacity', 0, 1, 0.05), dur(0.2, 6, 0.1), text('text', 'Text', true)],
  },
  'static-burst': {
    label: 'Static Burst', category: 'Screen Distortion', defaultSfx: 'transition',
    desc: 'TV static noise flash',
    defaults: { opacity: 0.9, duration: 0.9 },
    fields: [slider('opacity', 'Opacity', 0, 1, 0.05), dur(0.1, 5, 0.1)],
  },
  'vhs-glitch': {
    label: 'VHS Glitch', category: 'Screen Distortion', defaultSfx: 'glitch',
    desc: 'VHS tape tracking artifacts + RGB displacement',
    defaults: { intensity: 'moderate', duration: 2 },
    fields: [sel('intensity', 'Intensity', ['subtle', 'moderate', 'extreme']), dur(0.5, 8)],
  },
  'scan-lines-sweep': {
    label: 'Scanline Sweep', category: 'Screen Distortion',
    desc: 'CRT scanline gradient sweeps top-to-bottom',
    defaults: { color: '#000000', opacity: 0.15, duration: 2 },
    fields: [color(), slider('opacity', 'Opacity', 0, 1, 0.01), dur(0.5, 8)],
  },
  'neon-glow': {
    label: 'Neon Glow', category: 'Screen Distortion',
    desc: 'Neon border pulse around screen edges',
    defaults: { color: '#00ccff', intensity: 'medium', rainbow: false, duration: 3 },
    fields: [color(), sel('intensity', 'Intensity', ['soft', 'medium', 'intense']), bool('rainbow', 'Rainbow'), dur(0.5, 10)],
  },
  'chromatic-aberration': {
    label: 'Chromatic Aberration', category: 'Screen Distortion',
    desc: 'RGB channel offset on overlapping clones',
    defaults: { intensity: 'moderate', duration: 1.5 },
    fields: [sel('intensity', 'Intensity', ['subtle', 'moderate', 'extreme']), dur(0.25, 6)],
  },
  'film-burn': {
    label: 'Film Burn', category: 'Screen Distortion',
    desc: 'Warm overexposure wash from screen corner',
    defaults: { corner: 'tr', duration: 2.5 },
    fields: [sel('corner', 'Corner', ['tl', 'tr', 'bl', 'br']), dur(0.5, 8)],
  },
  'corruption-burst': {
    label: 'Corruption Burst', category: 'Screen Distortion', defaultSfx: 'glitch',
    desc: 'Glitch rect burst + scanline sweep',
    defaults: { intensity: 'medium', duration: 1.4 },
    fields: [sel('intensity', 'Intensity', ['low', 'medium', 'high']), dur(0.2, 6, 0.1)],
  },

  // ── Transitions ─────────────────────────────────────────────────
  'network-glitch': {
    label: 'Network Glitch', category: 'Transitions', defaultSfx: 'glitch',
    desc: 'Screen shake + interruption banner',
    defaults: { message: '[ NETWORK INTERRUPTION ]', duration: 2 },
    fields: [text('message', 'Message'), dur(0.5, 6)],
  },
  'tv-off': {
    label: 'TV Off', category: 'Transitions', defaultSfx: 'transition',
    desc: 'CRT shutdown: scaleY collapse → dot → black',
    defaults: { duration: 1.2 },
    fields: [dur(0.3, 4, 0.1)],
  },
  'blue-screen': {
    label: 'Blue Screen', category: 'Transitions', defaultSfx: 'glitch',
    desc: 'BSOD blue flash with scrolling error text',
    defaults: { errorCode: '0x0000007E', message: '(0xC0000005, 0xF741B367, 0xF78DA208, 0xF78D9F08)', duration: 4 },
    fields: [text('errorCode', 'Error Code', true), textarea('message', 'Message', true), dur(1, 10, 0.5)],
  },
  'pixel-transition': {
    label: 'Pixel Transition', category: 'Transitions',
    desc: 'Grid of pixels scatter then reassemble',
    defaults: { pixelSize: 20, duration: 2 },
    fields: [slider('pixelSize', 'Pixel Size', 4, 80, 2, 'px'), dur(0.5, 6)],
  },
  'dial-up-connect': {
    label: 'Dial-Up Connect', category: 'Transitions', defaultSfx: 'dial-up-connect',
    desc: 'Modem handshake terminal animation',
    defaults: { isp: 'NetConnect ISP', speed: '56k', duration: 6 },
    fields: [text('isp', 'ISP Name', true), text('speed', 'Speed', true), dur(2, 15, 0.5)],
  },

  // ── Particles & Ambient ─────────────────────────────────────────
  'floaties': {
    label: 'Floaties', category: 'Particles & Ambient',
    desc: 'Glowing terminal symbols drift across screen',
    defaults: { count: 18, duration: 4, speed: 1 },
    fields: [slider('count', 'Count', 1, 100, 1), dur(0.5, 10), slider('speed', 'Speed', 0.1, 5, 0.1)],
  },
  'confetti-burst': {
    label: 'Confetti Burst', category: 'Particles & Ambient', defaultSfx: 'victory',
    desc: 'Colored paper confetti rains from top',
    defaults: { colors: ['#ff0055', '#ffcc00', '#00ff88', '#00aaff', '#cc00ff'], count: 80, duration: 4 },
    fields: [colors(), slider('count', 'Count', 10, 300, 10), dur(1, 10, 0.5)],
  },
  'xp-gain': {
    label: 'XP Gain', category: 'Particles & Ambient',
    desc: 'Floating "+XP" text bubbles drift upward',
    defaults: { text: '+XP', count: 5, color: '#f5c400', fontSize: 36, duration: 2.5 },
    fields: [text('text', 'Text'), slider('count', 'Count', 1, 20, 1), color(), slider('fontSize', 'Font Size', 12, 96, 2, 'px'), dur(0.5, 8)],
  },
  'fireworks': {
    label: 'Fireworks', category: 'Particles & Ambient', defaultSfx: 'victory',
    desc: 'Star particles arc outward from center',
    defaults: { count: 4, colors: ['#ff0055', '#ffcc00', '#00ffcc', '#ff6600', '#cc00ff'], duration: 3.5 },
    fields: [slider('count', 'Bursts', 1, 12, 1), colors(), dur(1, 10, 0.5)],
  },
  'aurora-wave': {
    label: 'Aurora Wave', category: 'Particles & Ambient',
    desc: 'Flowing aurora ribbons undulate across the screen',
    defaults: { colors: ['#00ffc8', '#4488ff', '#cc44ff', '#ff44aa'], intensity: 'medium', duration: 6 },
    fields: [colors(), sel('intensity', 'Intensity', ['soft', 'medium', 'intense']), dur(2, 15, 0.5)],
  },
  'starfall': {
    label: 'Starfall', category: 'Particles & Ambient',
    desc: 'Shooting stars streak down with glowing trails',
    defaults: { count: 12, colors: ['#ffffff', '#8df6ff', '#ffe14a', '#ff88ff'], duration: 4 },
    fields: [slider('count', 'Count', 2, 40, 1), colors(), dur(1, 10, 0.5)],
  },
  'bubble-pop': {
    label: 'Bubble Pop', category: 'Particles & Ambient',
    desc: 'Glossy iridescent bubbles rise, wobble, and pop',
    defaults: { count: 24, colors: ['#8df6ff', '#ff9ee7', '#b7ff9e', '#ffd88d', '#c49eff'], duration: 5 },
    fields: [slider('count', 'Count', 4, 80, 1), colors(), dur(1, 12, 0.5)],
  },
  'glitter-bomb': {
    label: 'Glitter Bomb', category: 'Particles & Ambient',
    desc: 'Twinkling glitter explosion from screen center',
    defaults: { count: 160, colors: ['#ffd700', '#ff77ff', '#77e6ff', '#b0ff77', '#ffffff'], duration: 3 },
    fields: [slider('count', 'Count', 20, 400, 10), colors(), dur(1, 8)],
  },
  'laser-sweep': {
    label: 'Laser Sweep', category: 'Particles & Ambient',
    desc: 'Synthwave laser beams sweep across the screen',
    defaults: { color: '#ff00cc', rainbow: true, beams: 5, duration: 3.5 },
    fields: [color(), bool('rainbow', 'Rainbow'), slider('beams', 'Beams', 1, 12, 1), dur(1, 8)],
  },
  'typewriter': {
    label: 'Typewriter', category: 'Particles & Ambient',
    desc: 'Text types itself on screen',
    defaults: { text: 'EVENT EXECUTED', position: 'center', color: '#8df6ff', fontSize: 48, duration: 2.6 },
    fields: [textarea('text', 'Text'), sel('position', 'Position', ['top', 'center', 'bottom']), color(), slider('fontSize', 'Font Size', 12, 96, 2, 'px'), dur(0.5, 10)],
  },

  // ── Animations ──────────────────────────────────────────────────
  'death-overlay': {
    label: 'You Died', category: 'Animations', defaultSfx: 'death',
    desc: 'Original YOU DIED red vignette animation',
    defaults: { speed: 1 },
    fields: [slider('speed', 'Speed', 0.25, 3, 0.05, 'x')],
  },
  'victory-overlay': {
    label: 'Mission Log', category: 'Animations', defaultSfx: 'victory',
    desc: 'Original Win98 MISSION.LOG dialog',
    defaults: { speed: 1 },
    fields: [slider('speed', 'Speed', 0.25, 3, 0.05, 'x')],
  },
  'revive-overlay': {
    label: 'Process Restart', category: 'Animations', defaultSfx: 'revive',
    desc: 'Original Restarting process terminal animation',
    defaults: { speed: 1 },
    fields: [slider('speed', 'Speed', 0.25, 3, 0.05, 'x')],
  },
  'dvd-bounce': {
    label: 'DVD Bounce', category: 'Animations',
    desc: 'Text bounces around screen like DVD screensaver',
    defaults: { text: 'DVD', duration: 8 },
    fields: [text('text', 'Text', true), dur(2, 20, 0.5)],
  },
  'level-up': {
    label: 'Level Up', category: 'Animations', defaultSfx: 'level-up-chime',
    desc: '"LEVEL UP" zoom + expanding ring shockwave',
    defaults: { text: 'LEVEL UP', color: '#f5c400', duration: 3 },
    fields: [text('text', 'Text', true), num('level', 'Level'), color(), dur(1, 8)],
  },

  // ── Media ───────────────────────────────────────────────────────
  'image-overlay': {
    label: 'Image Overlay', category: 'Media',
    desc: 'Transparent image/PNG/APNG on screen (alert graphics etc.)',
    defaults: { src: '', opacity: 1, duration: 3 },
    fields: [
      { key: 'src', label: 'Image asset', type: 'media', mediaKinds: ['image'], placeholder: '/assets/... or https://...', hint: 'Use a transparent PNG or APNG for alert-style graphics.' },
      num('width', 'Width (px)'), num('height', 'Height (px)'),
      slider('opacity', 'Opacity', 0, 1, 0.05),
      num('x', 'X (px)'), num('y', 'Y (px)'),
      dur(0.1, 15, 0.1),
    ],
  },
  'video-overlay': {
    label: 'Video Overlay', category: 'Media',
    desc: 'Transparent video/WebM on screen',
    defaults: { src: '', opacity: 1, duration: 0, loop: false },
    fields: [
      { key: 'src', label: 'Video asset', type: 'media', mediaKinds: ['video'], placeholder: '/assets/... or https://...', hint: 'WebM with alpha channel for transparency.' },
      num('width', 'Width (px)'), num('height', 'Height (px)'),
      slider('opacity', 'Opacity', 0, 1, 0.05),
      num('x', 'X (px)'), num('y', 'Y (px)'),
      { key: 'duration', label: 'Duration', type: 'slider', min: 0, max: 30, step: 0.5, unit: 's', hint: '0 = play to end once.' },
      bool('loop', 'Loop'),
    ],
  },

  // ── Audio ───────────────────────────────────────────────────────
  'audio-sfx': {
    label: 'Sound Effect', category: 'Audio',
    desc: 'No visual — plays a built-in or custom sound',
    defaults: { sfxId: 'transition', volume: 1 },
    fields: [
      sel('sfxId', 'Sound', ['startup', 'transition', 'death', 'victory', 'revive', 'glitch', 'dial-up-connect', 'win98-error', 'mmorpg-ding', 'loot', 'level-up-chime', 'custom']),
      slider('volume', 'Volume', 0, 1, 0.05),
      { key: 'customUrl', label: 'Custom URL', type: 'text', optional: true, placeholder: 'https://... or /assets/sfx/...', showIf: { key: 'sfxId', equals: 'custom' } },
    ],
  },

  // ── Stream Personality ──────────────────────────────────────────
  'cinema-moment': {
    label: 'Cinema Moment', category: 'Stream Personality',
    desc: 'Letterbox bars + vignette + dramatic text',
    defaults: { text: 'THE CLUTCH', color: '#ffffff', duration: 4 },
    fields: [text('text', 'Text', true), color(), dur(1, 10)],
  },
  'chapter-reveal': {
    label: 'Chapter Reveal', category: 'Stream Personality',
    desc: 'Full-screen elegant title card',
    defaults: { number: 'I', title: 'THE BEGINNING', subtitle: '', duration: 4 },
    fields: [text('number', 'Number', true), text('title', 'Title'), text('subtitle', 'Subtitle', true), dur(1, 10)],
  },
  'clip-that': {
    label: 'Clip That', category: 'Stream Personality',
    desc: '"✂ CLIP IT" badge pulses in corner',
    defaults: { color: '#ff4444', durationMs: 3000 },
    fields: [color(), durMs()],
  },
  'persona-shift': {
    label: 'Persona Shift', category: 'Stream Personality',
    desc: 'Color wash + bold mode-change text',
    defaults: { label: 'GRIND MODE: ON', color: '#00ff41', duration: 3 },
    fields: [text('label', 'Label'), color(), dur(1, 8)],
  },
  'moment-marker': {
    label: 'Moment Marker', category: 'Stream Personality',
    desc: '"★ MOMENT" badge stamps corner then fades',
    defaults: { label: '★ MOMENT', color: '#f5c400', durationMs: 3500 },
    fields: [text('label', 'Label', true), color(), durMs()],
  },
  'crowd-roar': {
    label: 'Crowd Roar', category: 'Stream Personality',
    desc: 'Screen shake + vignette flash + "CROWD GOES WILD"',
    defaults: { text: 'CROWD GOES WILD', duration: 3 },
    fields: [text('text', 'Text', true), dur(1, 8)],
  },
  'intermission': {
    label: 'Intermission', category: 'Stream Personality',
    desc: 'Full-screen BRB card with animated background',
    defaults: { message: 'Be Right Back', showTimer: true, duration: 30 },
    fields: [text('message', 'Message', true), bool('showTimer', 'Show Timer'), dur(5, 300, 5)],
  },

  // ── Cinematic ───────────────────────────────────────────────────
  'shockwave': {
    label: 'Shockwave', category: 'Cinematic',
    desc: 'Expanding ring from screen center',
    defaults: { color: '#ffffff', thickness: 4, duration: 1.2 },
    fields: [color(), slider('thickness', 'Thickness', 1, 16, 1, 'px'), dur(0.3, 4, 0.1)],
  },
  'hype-pulse': {
    label: 'Hype Pulse', category: 'Cinematic',
    desc: 'Rainbow border cycling for duration',
    defaults: { duration: 4, speed: 'normal' },
    fields: [dur(1, 12, 0.5), sel('speed', 'Speed', ['slow', 'normal', 'fast'])],
  },
  'countdown-burst': {
    label: 'Countdown Burst', category: 'Cinematic',
    desc: '3 → 2 → 1 number slams to screen',
    defaults: { from: 3, color: '#ffffff' },
    fields: [slider('from', 'Count From', 1, 10, 1), color()],
  },
  'spotlight': {
    label: 'Spotlight', category: 'Cinematic',
    desc: 'Dark radial mask with moving light circle',
    defaults: { duration: 5, radius: 280, color: 'rgba(255,255,220,0.15)' },
    fields: [dur(1, 15, 0.5), slider('radius', 'Radius', 80, 800, 10, 'px'), { key: 'color', label: 'Light Color', type: 'text', placeholder: 'rgba(255,255,220,0.15)' }],
  },
  'chat-bubble': {
    label: 'Chat Bubble', category: 'Cinematic',
    desc: 'Pinned speech bubble with text',
    defaults: { text: 'Hello chat!', author: '', duration: 4, position: 'bottom' },
    fields: [textarea('text', 'Text'), text('author', 'Author', true), dur(1, 10), sel('position', 'Position', ['top', 'center', 'bottom'])],
  },

  // ── 2000s Internet ──────────────────────────────────────────────
  'aim-message': {
    label: 'AIM Message', category: '2000s Internet',
    desc: 'AOL Instant Messenger window slides in',
    defaults: { username: 'NetBuddy420', message: 'yo that was insane lmaooo', durationMs: 4500 },
    fields: [text('username', 'Username', true), textarea('message', 'Message', true), durMs()],
  },
  'msn-nudge': {
    label: 'MSN Nudge', category: '2000s Internet',
    desc: 'Windows Live Messenger NUDGE + screen shake',
    defaults: { username: 'xX_LiveBuddy_Xx', durationMs: 3500 },
    fields: [text('username', 'Username', true), durMs()],
  },
  'xp-balloon': {
    label: 'XP Balloon', category: '2000s Internet',
    desc: 'Windows XP system tray balloon notification',
    defaults: { title: 'Windows has found new hardware', body: 'Click here to install the drivers for this device.', durationMs: 4000 },
    fields: [text('title', 'Title', true), textarea('body', 'Body', true), durMs()],
  },
  'geocities-alert': {
    label: 'GeoCities Alert', category: '2000s Internet',
    desc: 'Browser JS alert() dialog with blinking border',
    defaults: { message: 'Welcome to MY STREAM!! Please sign my GUESTBOOK!! ⭐🌟⭐ This site is best viewed in 800x600!!', durationMs: 5000 },
    fields: [textarea('message', 'Message', true), durMs()],
  },
  'buffering': {
    label: 'Buffering', category: '2000s Internet',
    desc: 'Early YouTube buffering progress bar',
    defaults: { quality: '360p', duration: 5 },
    fields: [sel('quality', 'Quality', ['240p', '360p', '480p']), dur(1, 15, 0.5)],
  },
  'winamp-skip': {
    label: 'Winamp Skip', category: '2000s Internet',
    desc: 'Winamp media player track skip widget',
    defaults: { track: 'In The End', artist: 'Linkin Park', durationMs: 4000 },
    fields: [text('track', 'Track', true), text('artist', 'Artist', true), durMs()],
  },
  'email-alert': {
    label: 'Email Alert', category: '2000s Internet',
    desc: 'Hotmail/AOL new-message notification card',
    defaults: { subject: 'You have won a FREE iPod!!', sender: 'noreply@hotmail.com', durationMs: 4000 },
    fields: [text('subject', 'Subject', true), text('sender', 'Sender', true), durMs()],
  },

  // ── Anime ───────────────────────────────────────────────────────
  'speed-lines': {
    label: 'Speed Lines', category: 'Anime',
    desc: 'Canvas radial speed lines from/to center',
    defaults: { direction: 'out', color: '#ffffff', density: 48, duration: 1.5 },
    fields: [sel('direction', 'Direction', ['out', 'in']), color(), slider('density', 'Density', 8, 120, 4), dur(0.5, 5)],
  },
  'impact-frame': {
    label: 'Impact Frame', category: 'Anime',
    desc: 'Flash + ink speed lines + bold impact text',
    defaults: { text: '衝撃', color: '#ffffff', duration: 1.8 },
    fields: [text('text', 'Text', true), color(), dur(0.5, 5)],
  },
  'power-up-aura': {
    label: 'Power-Up Aura', category: 'Anime',
    desc: 'DBZ-style expanding golden rings + aura column',
    defaults: { color: '#f5c400', text: 'POWER LEVEL RISING', duration: 3.5 },
    fields: [color(), text('text', 'Text', true), dur(1, 8)],
  },
  'to-be-continued': {
    label: 'To Be Continued', category: 'Anime',
    desc: 'JoJo sepia wipe + "→ To Be Continued..." text',
    defaults: { duration: 4 },
    fields: [dur(1, 10, 0.5)],
  },
  'screentone-wipe': {
    label: 'Screentone Wipe', category: 'Anime',
    desc: 'Manga halftone dot pattern wipes across screen',
    defaults: { duration: 2.5, opacity: 0.88 },
    fields: [dur(0.5, 6), slider('opacity', 'Opacity', 0, 1, 0.02)],
  },
  'sweat-drop': {
    label: 'Sweat Drop', category: 'Anime',
    desc: 'Giant anime sweat drop slides, wobbles, splashes',
    defaults: { durationMs: 3000, size: 'md' },
    fields: [durMs(), sel('size', 'Size', ['sm', 'md', 'lg'])],
  },
  'dramatic-zoom': {
    label: 'Dramatic Zoom', category: 'Anime',
    desc: 'Slow camera zoom in + speed lines, tension build',
    defaults: { zoomTo: 1.08, duration: 3, color: 'rgba(0,0,0,0.15)' },
    fields: [slider('zoomTo', 'Zoom To', 1, 1.5, 0.01, 'x'), dur(1, 8), { key: 'color', label: 'Tint', type: 'text', optional: true, placeholder: 'rgba(0,0,0,0.15)' }],
  },

  // ── MMORPG / Retro-Futurist ─────────────────────────────────────
  'item-pickup': {
    label: 'Item Pickup', category: 'MMORPG / Retro-Futurist', defaultSfx: 'loot',
    desc: 'Loot explosion with rarity-colored burst + item name',
    defaults: { itemName: 'Mystery Item', rarity: 'rare', durationMs: 2600 },
    fields: [text('itemName', 'Item Name', true), sel('rarity', 'Rarity', ['common', 'rare', 'epic', 'legendary']), durMs()],
  },
  'quest-complete': {
    label: 'Quest Complete', category: 'MMORPG / Retro-Futurist', defaultSfx: 'mmorpg-ding',
    desc: 'Quest banner fanfare slides in, holds, slides out',
    defaults: { title: 'Quest Complete!', reward: '', duration: 3.5 },
    fields: [text('title', 'Title', true), text('reward', 'Reward', true), dur(1, 8)],
  },
  'critical-hit': {
    label: 'Critical Hit', category: 'MMORPG / Retro-Futurist', defaultSfx: 'glitch',
    desc: 'Screen flash + big impact damage text',
    defaults: { text: 'CRITICAL HIT!', color: '#ff2222', durationMs: 900 },
    fields: [text('text', 'Text', true), color(), durMs(300, 4000, 100)],
  },
  'boss-warning': {
    label: 'Boss Warning', category: 'MMORPG / Retro-Futurist', defaultSfx: 'glitch',
    desc: 'Metal Gear "!" alert — red flash + warning banner',
    defaults: { text: 'WARNING', duration: 3 },
    fields: [text('text', 'Text', true), dur(1, 8)],
  },
  'combo-multiplier': {
    label: 'Combo Multiplier', category: 'MMORPG / Retro-Futurist', defaultSfx: 'mmorpg-ding',
    desc: 'Fighting-game combo counter increments and slams',
    defaults: { count: 8, durationMs: 2200 },
    fields: [slider('count', 'Combo Count', 2, 50, 1), durMs()],
  },
  'game-over-effect': {
    label: 'Game Over', category: 'MMORPG / Retro-Futurist', defaultSfx: 'death',
    desc: 'Retro pixel-art GAME OVER wipe',
    defaults: { text: 'GAME OVER', duration: 3.5 },
    fields: [text('text', 'Text', true), dur(1, 8)],
  },
  'matrix-glitch': {
    label: 'Matrix Glitch', category: 'MMORPG / Retro-Futurist', defaultSfx: 'glitch',
    desc: 'Matrix-rain dissolve transition',
    defaults: { color: '#00ff41', duration: 2.5 },
    fields: [color(), dur(1, 8)],
  },
}

// ── Derived helpers ───────────────────────────────────────────────

export const ALL_EFFECT_TYPES = Object.keys(EFFECT_CATALOG) as EffectType[]

/** Category → effect types, in EFFECT_CATEGORY_ORDER, catalog insertion order within a category. */
export function getEffectCategories(): { label: EffectCategory; effects: EffectType[] }[] {
  return EFFECT_CATEGORY_ORDER
    .map((label) => ({
      label,
      effects: ALL_EFFECT_TYPES.filter((type) => EFFECT_CATALOG[type].category === label),
    }))
    .filter((group) => group.effects.length > 0)
}

export function getEffectManifest(type: EffectType): EffectManifest {
  return EFFECT_CATALOG[type]
}

export function getEffectLabel(type: EffectType): string {
  return EFFECT_CATALOG[type]?.label ?? type
}
