import type { TierName } from './scene.js'

export type MediaKind = 'image' | 'video' | 'audio'

export type RendererCategory = 'background' | 'media' | 'overlay' | 'text' | 'post' | 'builtin'

export type RendererFieldDef = {
  key: string
  label: string
  type: 'text' | 'number' | 'color' | 'boolean' | 'select'
  mediaKinds?: MediaKind[]
  options?: string[]
  min?: number
  max?: number
  step?: number
  placeholder?: string
}

export type RendererCatalogEntry = {
  id: string
  label: string
  icon: string
  desc: string
  category: RendererCategory
  defaultConfig: Record<string, unknown>
  fields: RendererFieldDef[]
  defaultPosition?: { x: number; y: number; width: number; height: number }
  defaultTier?: TierName
}

export const RENDERER_CATALOG: RendererCatalogEntry[] = [
  // ── Builtin tier renderers ───────────────────────────────────────
  {
    id: 'builtin:background', label: 'Background', icon: '🖼', category: 'builtin', defaultTier: 'background',
    desc: 'Solid color, gradient, image, video, or pattern background',
    defaultConfig: { type: 'color', color: '#0a0a0f', opacity: 1, blur: 0 },
    fields: [
      { key: 'type', label: 'Type', type: 'select', options: ['none', 'color', 'gradient', 'image-url', 'video-url', 'pattern'] },
      { key: 'color', label: 'Color', type: 'color' },
      { key: 'gradient', label: 'Gradient CSS', type: 'text' },
      { key: 'imageUrl', label: 'Image URL', type: 'text', mediaKinds: ['image'] },
      { key: 'videoUrl', label: 'Video URL', type: 'text', mediaKinds: ['video'] },
      { key: 'pattern', label: 'Pattern', type: 'select', options: ['none', 'grid', 'dots', 'diagonal', 'honeycomb', 'circuit', 'topography'] },
      { key: 'opacity', label: 'Opacity', type: 'number', min: 0, max: 1, step: 0.05 },
      { key: 'blur', label: 'Blur (px)', type: 'number', min: 0, max: 20, step: 0.5 },
    ],
  },
  {
    id: 'builtin:particles', label: 'Particles', icon: '✨', category: 'builtin', defaultTier: 'particles',
    desc: 'Animated particle system (stars, snow, matrix, fireflies, ash)',
    defaultConfig: { enabled: true, preset: 'stars', density: 0.5, speed: 0.5 },
    fields: [
      { key: 'preset', label: 'Preset', type: 'select', options: ['none', 'stars', 'snow', 'matrix', 'fireflies', 'ash'] },
      { key: 'density', label: 'Density', type: 'number', min: 0, max: 1, step: 0.05 },
      { key: 'speed', label: 'Speed', type: 'number', min: 0, max: 1, step: 0.05 },
    ],
  },
  {
    id: 'builtin:effects', label: 'Post Effects', icon: '📺', category: 'builtin', defaultTier: 'post',
    desc: 'CRT scanlines, vignette, film grain, flicker, chromatic aberration',
    defaultConfig: { crt: true, vignette: true, noise: false, flicker: false, chromatic: false, scanlineOpacity: 0.18, vignetteStrength: 0.65, noiseOpacity: 0.06 },
    fields: [
      { key: 'crt', label: 'CRT Scanlines', type: 'boolean' },
      { key: 'scanlineOpacity', label: 'Scanline Intensity', type: 'number', min: 0, max: 1, step: 0.01 },
      { key: 'vignette', label: 'Vignette', type: 'boolean' },
      { key: 'vignetteStrength', label: 'Vignette Strength', type: 'number', min: 0, max: 1, step: 0.05 },
      { key: 'noise', label: 'Film Grain', type: 'boolean' },
      { key: 'noiseOpacity', label: 'Grain Opacity', type: 'number', min: 0, max: 0.5, step: 0.01 },
      { key: 'flicker', label: 'Flicker', type: 'boolean' },
      { key: 'chromatic', label: 'Chromatic Aberration', type: 'boolean' },
    ],
  },
  // ── Renderer entries ─────────────────────────────────────────────
  {
    id: 'image-slideshow', label: 'Game Slideshow', icon: '🎞', category: 'media', defaultTier: 'content',
    desc: 'Auto-cycling scraped game screenshots',
    defaultConfig: { interval: 6, shuffle: true },
    fields: [
      { key: 'interval', label: 'Interval (s)', type: 'number', min: 1, max: 60, step: 1 },
      { key: 'shuffle', label: 'Shuffle', type: 'boolean' },
    ],
  },
  {
    id: 'image-static', label: 'Static Image', icon: '🖼', category: 'media', defaultTier: 'content',
    desc: 'Single image — local path or URL',
    defaultConfig: { url: '', objectFit: 'cover', opacity: 1 },
    fields: [
      { key: 'url', label: 'URL / Path', type: 'text', mediaKinds: ['image'], placeholder: '/assets/backgrounds/name.jpg' },
      { key: 'objectFit', label: 'Fit', type: 'select', options: ['cover', 'contain', 'fill'] },
      { key: 'opacity', label: 'Opacity', type: 'number', min: 0, max: 1, step: 0.05 },
    ],
  },
  {
    id: 'video-loop', label: 'Video Loop', icon: '🎬', category: 'media', defaultTier: 'content',
    desc: 'Muted looping video — local path or URL',
    defaultConfig: { url: '', opacity: 1 },
    fields: [
      { key: 'url', label: 'URL / Path', type: 'text', mediaKinds: ['video'], placeholder: '/assets/video/name.mp4' },
      { key: 'opacity', label: 'Opacity', type: 'number', min: 0, max: 1, step: 0.05 },
    ],
  },
  {
    id: 'solid-color', label: 'Solid Color', icon: '⬛', category: 'background', defaultTier: 'background',
    desc: 'Flat opaque color fill',
    defaultConfig: { color: '#000000' },
    fields: [
      { key: 'color', label: 'Color', type: 'color' },
    ],
  },
  {
    id: 'color-overlay', label: 'Color Overlay', icon: '🎨', category: 'overlay', defaultTier: 'post',
    desc: 'Semi-transparent color wash',
    defaultConfig: { color: '#000000', opacity: 0.5 },
    fields: [
      { key: 'color', label: 'Color', type: 'color' },
      { key: 'opacity', label: 'Opacity', type: 'number', min: 0, max: 1, step: 0.05 },
    ],
  },
  {
    id: 'crt-effect', label: 'CRT Scanlines', icon: '📺', category: 'post', defaultTier: 'post',
    desc: 'Retro scanline + vignette overlay',
    defaultConfig: { scanlineIntensity: 0.25, vignetteStrength: 0.5 },
    fields: [
      { key: 'scanlineIntensity', label: 'Scanlines', type: 'number', min: 0, max: 1, step: 0.05 },
      { key: 'vignetteStrength', label: 'Vignette', type: 'number', min: 0, max: 1, step: 0.05 },
    ],
  },
  {
    id: 'vignette', label: 'Vignette', icon: '◉', category: 'post', defaultTier: 'post',
    desc: 'Edge-darkening radial gradient',
    defaultConfig: { color: '#000000', strength: 0.6 },
    fields: [
      { key: 'color', label: 'Color', type: 'color' },
      { key: 'strength', label: 'Strength', type: 'number', min: 0, max: 1, step: 0.05 },
    ],
  },
  {
    id: 'noise-grain', label: 'Film Grain', icon: '📽', category: 'post', defaultTier: 'post',
    desc: 'Animated film grain noise (overlay blend)',
    defaultConfig: { opacity: 0.08, animated: true },
    fields: [
      { key: 'opacity', label: 'Opacity', type: 'number', min: 0, max: 0.5, step: 0.01 },
      { key: 'animated', label: 'Animated', type: 'boolean' },
    ],
  },
  {
    id: 'text-widget', label: 'Text Label', icon: '✍', category: 'text', defaultTier: 'content',
    desc: 'Static or typewriter text block',
    defaultConfig: { content: 'Label', font: 'vt323', fontSize: 28, color: '#ffffff', typewriterMode: false },
    fields: [
      { key: 'content', label: 'Content', type: 'text' },
      { key: 'font', label: 'Font', type: 'select', options: ['vt323', 'press-start', 'monospace', 'serif'] },
      { key: 'fontSize', label: 'Size', type: 'number', min: 8, max: 200, step: 2 },
      { key: 'color', label: 'Color', type: 'color' },
      { key: 'typewriterMode', label: 'Typewriter', type: 'boolean' },
    ],
  },
  {
    id: 'pov-stream', label: 'POV Stream', icon: '📹', category: 'media', defaultTier: 'content',
    desc: 'Live WebRTC stream from the active room participant',
    defaultConfig: { objectFit: 'cover', opacity: 1, muted: false },
    fields: [
      { key: 'objectFit', label: 'Fit', type: 'select', options: ['cover', 'contain'] },
      { key: 'opacity', label: 'Opacity', type: 'number', min: 0, max: 1, step: 0.05 },
      { key: 'muted', label: 'Muted', type: 'boolean' },
    ],
  },
  {
    id: 'clock-widget', label: 'Clock', icon: '🕐', category: 'text', defaultTier: 'content',
    desc: 'Live digital clock display',
    defaultConfig: { format: '24h', color: '#00ff41', fontSize: 36, font: 'vt323' },
    defaultPosition: { x: 1680, y: 20, width: 220, height: 60 },
    fields: [
      { key: 'format', label: 'Format', type: 'select', options: ['24h', '12h', '24h-sec', '12h-sec'] },
      { key: 'color', label: 'Color', type: 'color' },
      { key: 'fontSize', label: 'Size', type: 'number', min: 8, max: 200, step: 2 },
      { key: 'font', label: 'Font', type: 'select', options: ['vt323', 'press-start', 'monospace', 'serif'] },
    ],
  },
  // ── Stream personality / auto-run renderers ───────────────────────
  {
    id: 'letterbox', label: 'Letterbox', icon: '🎦', category: 'overlay', defaultTier: 'post',
    desc: 'Cinematic widescreen bars that slide in from top and bottom',
    defaultConfig: { height: 80, color: '#000000', animated: true },
    fields: [
      { key: 'height', label: 'Bar Height (px)', type: 'number', min: 10, max: 300, step: 5 },
      { key: 'color', label: 'Color', type: 'color' },
      { key: 'animated', label: 'Animate In', type: 'boolean' },
    ],
  },
  {
    id: 'ticker', label: 'Ticker', icon: '📰', category: 'text', defaultTier: 'content',
    desc: 'Scrolling bottom ticker with custom stream info items',
    defaultConfig: { items: ['Now streaming', 'Welcome to the session'], speed: 60, separator: '  ✦  ', color: '#00ff41', bgColor: 'rgba(0,0,0,0.7)', fontSize: 20 },
    fields: [
      { key: 'speed', label: 'Speed (px/s)', type: 'number', min: 10, max: 300, step: 5 },
      { key: 'separator', label: 'Separator', type: 'text' },
      { key: 'color', label: 'Text Color', type: 'color' },
      { key: 'bgColor', label: 'Background', type: 'color' },
      { key: 'fontSize', label: 'Size', type: 'number', min: 8, max: 60, step: 1 },
    ],
  },
  {
    id: 'chapter', label: 'Chapter Label', icon: '📖', category: 'text', defaultTier: 'content',
    desc: 'Persistent chapter/arc label for narrative stream structure',
    defaultConfig: { label: 'Chapter', color: '#ffffff', accent: '#888888', fontSize: 22, position: 'top-right' },
    fields: [
      { key: 'number', label: 'Number', type: 'text' },
      { key: 'label', label: 'Label', type: 'text' },
      { key: 'color', label: 'Color', type: 'color' },
      { key: 'accent', label: 'Accent Color', type: 'color' },
      { key: 'fontSize', label: 'Size', type: 'number', min: 8, max: 80, step: 1 },
      { key: 'position', label: 'Position', type: 'select', options: ['top-left', 'top-right', 'bottom-left', 'bottom-right'] },
    ],
  },
  {
    id: 'status-badge', label: 'Status Badge', icon: '🏷', category: 'overlay', defaultTier: 'content',
    desc: 'Corner badge showing stream mode (LIVE, GRINDING, AFK, etc.)',
    defaultConfig: { text: 'LIVE', color: '#00ff41', bgColor: 'rgba(0,0,0,0.75)', position: 'top-left', pulse: true, fontSize: 18 },
    fields: [
      { key: 'text', label: 'Text', type: 'text' },
      { key: 'icon', label: 'Icon', type: 'text' },
      { key: 'color', label: 'Color', type: 'color' },
      { key: 'bgColor', label: 'Background', type: 'color' },
      { key: 'position', label: 'Position', type: 'select', options: ['top-left', 'top-right', 'bottom-left', 'bottom-right'] },
      { key: 'pulse', label: 'Pulse Dot', type: 'boolean' },
      { key: 'fontSize', label: 'Size', type: 'number', min: 8, max: 60, step: 1 },
    ],
  },
  {
    id: 'session-goal', label: 'Session Goal', icon: '🎯', category: 'overlay', defaultTier: 'content',
    desc: 'Freeform goal bar with label and progress count',
    defaultConfig: { label: 'Session Goal', current: 0, target: 100, color: '#00ff41', bgColor: 'rgba(0,0,0,0.7)', showCount: true, fontSize: 18 },
    fields: [
      { key: 'label', label: 'Label', type: 'text' },
      { key: 'current', label: 'Current', type: 'number', min: 0, max: 1000000, step: 1 },
      { key: 'target', label: 'Target', type: 'number', min: 1, max: 1000000, step: 1 },
      { key: 'color', label: 'Color', type: 'color' },
      { key: 'bgColor', label: 'Background', type: 'color' },
      { key: 'showCount', label: 'Show Count', type: 'boolean' },
      { key: 'fontSize', label: 'Size', type: 'number', min: 8, max: 60, step: 1 },
    ],
  },
  {
    id: 'session-timer', label: 'Session Timer', icon: '⏱', category: 'text', defaultTier: 'content',
    desc: 'Stopwatch counting up since the overlay was mounted',
    defaultConfig: { label: '', color: '#00ff41', fontSize: 28, format: 'hms', position: 'top-left' },
    fields: [
      { key: 'label', label: 'Label', type: 'text' },
      { key: 'color', label: 'Color', type: 'color' },
      { key: 'fontSize', label: 'Size', type: 'number', min: 8, max: 100, step: 1 },
      { key: 'format', label: 'Format', type: 'select', options: ['hms', 'ms'] },
      { key: 'position', label: 'Position', type: 'select', options: ['top-left', 'top-right', 'bottom-left', 'bottom-right'] },
    ],
  },
  {
    id: 'countdown', label: 'Countdown', icon: '⏳', category: 'overlay', defaultTier: 'content',
    desc: 'Configurable countdown timer showing label + MM:SS remaining',
    defaultConfig: { label: 'BRB in', durationMs: 300000, color: '#ffffff', accent: '#ff4444', fontSize: 32, position: 'center' },
    fields: [
      { key: 'label', label: 'Label', type: 'text' },
      { key: 'durationMs', label: 'Duration (ms)', type: 'number', min: 1000, max: 3600000, step: 1000 },
      { key: 'color', label: 'Color', type: 'color' },
      { key: 'accent', label: 'Done Color', type: 'color' },
      { key: 'fontSize', label: 'Size', type: 'number', min: 8, max: 100, step: 1 },
      { key: 'position', label: 'Position', type: 'select', options: ['center', 'top', 'bottom'] },
    ],
  },
  {
    id: 'chat-simulator', label: 'Chat Simulator', icon: '💬', category: 'text', defaultTier: 'content',
    desc: 'Fake auto-scrolling chat feed for ambiance / vods',
    defaultConfig: { usernames: ['xX_Pro_Xx', 'gamer123', 'lurker99', 'StreamFan', 'NightOwl', 'Kappa', 'weirdChamp'], intervalMs: 2800, maxVisible: 8, bgColor: 'rgba(0,0,0,0.65)', fontSize: 14 },
    fields: [
      { key: 'intervalMs', label: 'Interval (ms)', type: 'number', min: 200, max: 10000, step: 100 },
      { key: 'maxVisible', label: 'Max Visible', type: 'number', min: 1, max: 30, step: 1 },
      { key: 'bgColor', label: 'Background', type: 'color' },
      { key: 'fontSize', label: 'Size', type: 'number', min: 8, max: 40, step: 1 },
    ],
  },
  {
    id: 'anime-quote', label: 'Anime Quote', icon: '🍥', category: 'text', defaultTier: 'content',
    desc: 'Auto-rotating anime quote carousel with fade transitions',
    defaultConfig: { intervalMs: 8000, color: '#ffffff', fontSize: 20 },
    fields: [
      { key: 'intervalMs', label: 'Interval (ms)', type: 'number', min: 1000, max: 60000, step: 500 },
      { key: 'color', label: 'Color', type: 'color' },
      { key: 'fontSize', label: 'Size', type: 'number', min: 8, max: 60, step: 1 },
    ],
  },
  {
    id: 'mood-meter', label: 'Mood Meter', icon: '🌡', category: 'overlay', defaultTier: 'content',
    desc: 'Fluctuating vertical power/mood level bar with tier labels',
    defaultConfig: { label: 'POWER LEVEL', color: '#f5c400', fluctuateMs: 1500, baseValue: 0.6, variance: 0.25 },
    fields: [
      { key: 'label', label: 'Label', type: 'text' },
      { key: 'color', label: 'Color', type: 'color' },
      { key: 'fluctuateMs', label: 'Fluctuate Interval (ms)', type: 'number', min: 200, max: 10000, step: 100 },
      { key: 'baseValue', label: 'Base Value', type: 'number', min: 0, max: 1, step: 0.05 },
      { key: 'variance', label: 'Variance', type: 'number', min: 0, max: 0.5, step: 0.05 },
    ],
  },
  {
    id: 'personality-rotator', label: 'Personality Rotator', icon: '🃏', category: 'overlay', defaultTier: 'content',
    desc: 'Auto-cycling card stack of stream mode / vibe callouts',
    defaultConfig: { durationMs: 6000, transition: 'fade', color: '#ffffff', accent: '#f5c400' },
    fields: [
      { key: 'durationMs', label: 'Duration (ms)', type: 'number', min: 1000, max: 60000, step: 500 },
      { key: 'transition', label: 'Transition', type: 'select', options: ['fade', 'slide'] },
      { key: 'color', label: 'Color', type: 'color' },
      { key: 'accent', label: 'Accent Color', type: 'color' },
    ],
  },
  {
    id: 'aesthetic-overlay', label: 'Aesthetic Filter', icon: '🌆', category: 'post', defaultTier: 'post',
    desc: 'CSS filter preset wash (sepia, retro, anime, gloom, bloom, vhs, pixelate, night)',
    defaultConfig: { preset: 'anime', opacity: 1 },
    fields: [
      { key: 'preset', label: 'Preset', type: 'select', options: ['sepia', 'retro', 'anime', 'gloom', 'bloom', 'vhs', 'pixelate', 'night'] },
      { key: 'opacity', label: 'Opacity', type: 'number', min: 0, max: 1, step: 0.05 },
    ],
  },
  // ── Retro-futurist / MMORPG renderers ─────────────────────────────
  {
    id: 'rpg-hud', label: 'RPG HUD', icon: '🛡', category: 'overlay', defaultTier: 'content',
    desc: 'RPG-style HP/MP/XP bars, level, name, hotbar, and minimap',
    defaultConfig: { hp: 82, mp: 54, xp: 30, level: 12, name: 'STREAMER', hotbarSlots: 8, showMinimap: true },
    fields: [
      { key: 'hp', label: 'HP', type: 'number', min: 0, max: 100, step: 1 },
      { key: 'mp', label: 'MP', type: 'number', min: 0, max: 100, step: 1 },
      { key: 'xp', label: 'XP', type: 'number', min: 0, max: 100, step: 1 },
      { key: 'level', label: 'Level', type: 'number', min: 1, max: 999, step: 1 },
      { key: 'name', label: 'Name', type: 'text' },
      { key: 'hotbarSlots', label: 'Hotbar Slots', type: 'number', min: 0, max: 12, step: 1 },
      { key: 'showMinimap', label: 'Show Minimap', type: 'boolean' },
    ],
  },
  {
    id: 'winamp-viz', label: 'Winamp Visualizer', icon: '📊', category: 'overlay', defaultTier: 'content',
    desc: 'Retro Winamp-style audio bar/scope visualizer',
    defaultConfig: { barColor: '#00ff41', peakColor: '#ffffff', bgColor: '#0a0a0a', barCount: 20, mode: 'bars' },
    fields: [
      { key: 'barColor', label: 'Bar Color', type: 'color' },
      { key: 'peakColor', label: 'Peak Color', type: 'color' },
      { key: 'bgColor', label: 'Background', type: 'color' },
      { key: 'barCount', label: 'Bar Count', type: 'number', min: 4, max: 64, step: 1 },
      { key: 'mode', label: 'Mode', type: 'select', options: ['bars', 'scope', 'both'] },
    ],
  },
  {
    id: 'matrix-rain', label: 'Matrix Rain', icon: '🟩', category: 'background', defaultTier: 'background',
    desc: 'Falling digital rain background, Matrix-style',
    defaultConfig: { color: '#00ff41', rainbow: false, fontSize: 18, bgOpacity: 0.08 },
    fields: [
      { key: 'color', label: 'Color', type: 'color' },
      { key: 'rainbow', label: 'Rainbow Mode', type: 'boolean' },
      { key: 'fontSize', label: 'Glyph Size', type: 'number', min: 8, max: 40, step: 1 },
      { key: 'bgOpacity', label: 'Trail Opacity', type: 'number', min: 0, max: 1, step: 0.01 },
    ],
  },
  {
    id: 'neon-border', label: 'Neon Border', icon: '🌈', category: 'post', defaultTier: 'post',
    desc: 'Animated glowing neon border frame around the scene',
    defaultConfig: { thickness: 4, rainbow: true, color: '#ff00ff', speed: 6, cornerRadius: 0 },
    fields: [
      { key: 'thickness', label: 'Thickness (px)', type: 'number', min: 1, max: 20, step: 1 },
      { key: 'rainbow', label: 'Rainbow Cycle', type: 'boolean' },
      { key: 'color', label: 'Color', type: 'color' },
      { key: 'speed', label: 'Cycle Speed', type: 'number', min: 1, max: 20, step: 1 },
      { key: 'cornerRadius', label: 'Corner Radius', type: 'number', min: 0, max: 60, step: 1 },
    ],
  },
  {
    id: 'combat-log', label: 'Combat Log', icon: '⚔', category: 'text', defaultTier: 'content',
    desc: 'MMO-style scrolling combat log of simulated chat/events',
    defaultConfig: { usernames: ['xX_Pro_Xx', 'gamer123', 'lurker99', 'StreamFan', 'NightOwl'], intervalMs: 3200, maxLines: 10, fontSize: 15 },
    fields: [
      { key: 'intervalMs', label: 'Interval (ms)', type: 'number', min: 500, max: 10000, step: 100 },
      { key: 'maxLines', label: 'Max Lines', type: 'number', min: 3, max: 30, step: 1 },
      { key: 'fontSize', label: 'Size', type: 'number', min: 8, max: 32, step: 1 },
    ],
  },
  {
    id: 'synthwave-grid', label: 'Synthwave Grid', icon: '🌅', category: 'background', defaultTier: 'background',
    desc: 'Retro-futurist perspective grid scrolling toward a horizon sun',
    defaultConfig: { gridColor: '#ff00cc', sunColor: '#ff6ec7', skyTop: '#0b0033', showSun: true, speed: 1 },
    fields: [
      { key: 'gridColor', label: 'Grid Color', type: 'color' },
      { key: 'sunColor', label: 'Sun Color', type: 'color' },
      { key: 'skyTop', label: 'Sky Color', type: 'color' },
      { key: 'showSun', label: 'Show Sun', type: 'boolean' },
      { key: 'speed', label: 'Scroll Speed', type: 'number', min: 0, max: 5, step: 0.25 },
    ],
  },
  {
    id: 'aurora-flow', label: 'Aurora Flow', icon: '🌌', category: 'background', defaultTier: 'background',
    desc: 'Slowly drifting northern-lights gradient ribbons',
    defaultConfig: { color1: '#00ffc8', color2: '#4488ff', color3: '#cc44ff', speed: 1, opacity: 0.5 },
    fields: [
      { key: 'color1', label: 'Color 1', type: 'color' },
      { key: 'color2', label: 'Color 2', type: 'color' },
      { key: 'color3', label: 'Color 3', type: 'color' },
      { key: 'speed', label: 'Drift Speed', type: 'number', min: 0, max: 5, step: 0.25 },
      { key: 'opacity', label: 'Opacity', type: 'number', min: 0, max: 1, step: 0.05 },
    ],
  },
  {
    id: 'lava-lamp', label: 'Lava Lamp', icon: '🫧', category: 'background', defaultTier: 'background',
    desc: 'Soft glowing blobs drift and merge like a lava lamp',
    defaultConfig: { color1: '#ff4488', color2: '#8844ff', bgColor: '#0a0018', blobCount: 6, speed: 1 },
    fields: [
      { key: 'color1', label: 'Blob Color 1', type: 'color' },
      { key: 'color2', label: 'Blob Color 2', type: 'color' },
      { key: 'bgColor', label: 'Background', type: 'color' },
      { key: 'blobCount', label: 'Blob Count', type: 'number', min: 2, max: 12, step: 1 },
      { key: 'speed', label: 'Drift Speed', type: 'number', min: 0, max: 5, step: 0.25 },
    ],
  },
  {
    id: 'starfield-warp', label: 'Starfield Warp', icon: '🚀', category: 'background', defaultTier: 'background',
    desc: 'Hyperspace star streaks radiating from screen center',
    defaultConfig: { color: '#ffffff', rainbow: false, density: 0.5, speed: 1 },
    fields: [
      { key: 'color', label: 'Star Color', type: 'color' },
      { key: 'rainbow', label: 'Rainbow Mode', type: 'boolean' },
      { key: 'density', label: 'Density', type: 'number', min: 0.1, max: 1, step: 0.05 },
      { key: 'speed', label: 'Warp Speed', type: 'number', min: 0.1, max: 5, step: 0.1 },
    ],
  },
  {
    id: 'retro-hud', label: 'Retro Arcade HUD', icon: '🕹', category: 'overlay', defaultTier: 'content',
    desc: '8-bit arcade-style score, level, lives, and ammo HUD',
    defaultConfig: { color: '#ffe14a', score: 128400, level: 1, lives: 3, ammo: 24, tickMs: 1400 },
    fields: [
      { key: 'color', label: 'Color', type: 'color' },
      { key: 'score', label: 'Score', type: 'number', min: 0, max: 99999999, step: 100 },
      { key: 'level', label: 'Level', type: 'number', min: 1, max: 999, step: 1 },
      { key: 'lives', label: 'Lives', type: 'number', min: 0, max: 99, step: 1 },
      { key: 'ammo', label: 'Ammo', type: 'number', min: 0, max: 999, step: 1 },
      { key: 'tickMs', label: 'Tick Interval (ms)', type: 'number', min: 200, max: 5000, step: 100 },
    ],
  },
]

export function findRendererCatalogEntry(rendererType: string | undefined): RendererCatalogEntry | undefined {
  return RENDERER_CATALOG.find((entry) => entry.id === rendererType)
}
