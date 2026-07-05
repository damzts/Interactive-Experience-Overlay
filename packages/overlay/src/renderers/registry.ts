import type { ComponentType } from 'react'
import type { RendererCatalogEntry } from '@ieomlabs/shared'
import { findRendererCatalogEntry } from '@ieomlabs/shared'

export interface RendererProps {
  config: Record<string, unknown>
  bounds: { x: number; y: number; width: number; height: number }
  /** Fire a DOM-bus event for inter-window IPC.
   *  emit('signal', { source: instanceId, event, payload }) enters the widget-signal
   *  pipeline and can trigger automation rules — see rendererSignals.ts. */
  emit: (event: string, data: unknown) => void
  /** Subscribe to a DOM-bus event; returns unsubscribe fn.
   *  onSignal('action', handler) receives automation widget:action payloads
   *  ({ targetWidgetId, action }) — filter by instanceId. */
  onSignal: (event: string, handler: (data: unknown) => void) => () => void
  /** The WindowInstance id hosting this renderer — automation rules target it. */
  instanceId?: string
}

export interface RendererDefinition {
  component: ComponentType<RendererProps>
  /** Catalog entry for this renderer — populated by resolveRenderer when available */
  catalog?: RendererCatalogEntry
  /** JSON Schema for admin UI generation */
  configSchema?: Record<string, unknown>
  /** Signal names this renderer subscribes to */
  signalSubscriptions?: string[]
  /** Requests animation-frame ticks via RAF */
  animated?: boolean
  /** Called on unmount for WebGL / audio cleanup */
  dispose?: () => void
}

/** Lazy manifest — each entry is an async factory resolved on first use */
export type RendererManifest = Record<string, () => Promise<RendererDefinition>>

export const rendererManifest: RendererManifest = {
  'image-slideshow': () => import('./ImageSlideshow').then((m) => ({ component: m.ImageSlideshowRenderer })),
  'crt-effect':      () => import('./CRTEffect').then((m) => ({ component: m.CRTEffectRenderer })),
  'text-widget':     () => import('./TextWidget').then((m) => ({ component: m.TextWidgetRenderer })),
  'solid-color':     () => import('./SolidColor').then((m) => ({ component: m.SolidColorRenderer })),
  'color-overlay':   () => import('./ColorOverlay').then((m) => ({ component: m.ColorOverlayRenderer })),
  'image-static':    () => import('./ImageStatic').then((m) => ({ component: m.ImageStaticRenderer })),
  'video-loop':      () => import('./VideoLoop').then((m) => ({ component: m.VideoLoopRenderer })),
  'vignette':        () => import('./Vignette').then((m) => ({ component: m.VignetteRenderer })),
  'noise-grain':     () => import('./NoiseGrain').then((m) => ({ component: m.NoiseGrainRenderer })),
  'clock-widget':    () => import('./ClockWidget').then((m) => ({ component: m.ClockWidgetRenderer })),
  'camera':          () => import('./Camera').then((m) => ({ component: m.CameraRenderer })),
  'pov-stream':      () => import('./PovStream').then((m) => ({ component: m.PovStreamRenderer })),
  // Builtin tier renderers — wrap legacy layer components as renderers
  'builtin:background': () => import('./builtins/Background').then((m) => ({ component: m.BuiltinBackgroundRenderer })),
  'builtin:particles':  () => import('./builtins/Particles').then((m) => ({ component: m.BuiltinParticlesRenderer })),
  'builtin:effects':    () => import('./builtins/Effects').then((m) => ({ component: m.BuiltinEffectsRenderer })),
  // ── Stream personality renderers ───────────────────────────────
  'letterbox':       () => import('./LetterboxRenderer').then((m) => ({ component: m.LetterboxRenderer })),
  'ticker':          () => import('./TickerRenderer').then((m) => ({ component: m.TickerRenderer })),
  'chapter':         () => import('./ChapterRenderer').then((m) => ({ component: m.ChapterRenderer })),
  'status-badge':    () => import('./StatusBadgeRenderer').then((m) => ({ component: m.StatusBadgeRenderer })),
  'session-goal':    () => import('./SessionGoalRenderer').then((m) => ({ component: m.SessionGoalRenderer })),
  'session-timer':   () => import('./SessionTimerRenderer').then((m) => ({ component: m.SessionTimerRenderer })),
  'countdown':       () => import('./CountdownRenderer').then((m) => ({ component: m.CountdownRenderer })),
  // ── Auto-run / self-narrating renderers ───────────────────────
  'chat-simulator':       () => import('./ChatSimulatorRenderer').then((m) => ({ component: m.ChatSimulatorRenderer })),
  'anime-quote':          () => import('./AnimeQuoteRenderer').then((m) => ({ component: m.AnimeQuoteRenderer })),
  'mood-meter':           () => import('./MoodMeterRenderer').then((m) => ({ component: m.MoodMeterRenderer })),
  'personality-rotator':  () => import('./PersonalityRotatorRenderer').then((m) => ({ component: m.PersonalityRotatorRenderer })),
  // ── Aesthetic CSS overlay ──────────────────────────────────────
  'aesthetic-overlay':    () => import('./AestheticOverlayRenderer').then((m) => ({ component: m.AestheticOverlayRenderer })),
  // ── Retro-futurist / MMORPG renderers ───────────────────────────
  'rpg-hud':         () => import('./RpgHudRenderer').then((m) => ({ component: m.RpgHudRenderer })),
  'winamp-viz':      () => import('./WinampVizRenderer').then((m) => ({ component: m.WinampVizRenderer })),
  'media-viz':       () => import('./MediaVizRenderer').then((m) => ({ component: m.MediaVizRenderer })),
  'matrix-rain':     () => import('./MatrixRainRenderer').then((m) => ({ component: m.MatrixRainRenderer })),
  'neon-border':     () => import('./NeonBorderRenderer').then((m) => ({ component: m.NeonBorderRenderer })),
  'combat-log':      () => import('./CombatLogRenderer').then((m) => ({ component: m.CombatLogRenderer })),
  'retro-hud':       () => import('./RetroHudRenderer').then((m) => ({ component: m.RetroHudRenderer })),
  'stream-quest':    () => import('./StreamQuestRenderer').then((m) => ({ component: m.StreamQuestRenderer })),
  'retro-messenger': () => import('./RetroMessengerRenderer').then((m) => ({ component: m.RetroMessengerRenderer })),
  // ── Colorful animated backgrounds ───────────────────────────────
  'synthwave-grid':  () => import('./SynthwaveGridRenderer').then((m) => ({ component: m.SynthwaveGridRenderer })),
  'aurora-flow':     () => import('./AuroraFlowRenderer').then((m) => ({ component: m.AuroraFlowRenderer })),
  'lava-lamp':       () => import('./LavaLampRenderer').then((m) => ({ component: m.LavaLampRenderer })),
  'starfield-warp':  () => import('./StarfieldWarpRenderer').then((m) => ({ component: m.StarfieldWarpRenderer })),
}

/** Cache: resolved definitions keyed by renderer id */
const cache = new Map<string, RendererDefinition>()

export async function resolveRenderer(id: string): Promise<RendererDefinition | null> {
  if (cache.has(id)) return cache.get(id)!
  const factory = rendererManifest[id]
  if (!factory) return null
  const def = await factory()
  def.catalog = findRendererCatalogEntry(id)
  cache.set(id, def)
  return def
}

/** Register a new renderer at runtime (e.g. from a remote module) */
export function registerRenderer(id: string, factory: () => Promise<RendererDefinition>): void {
  rendererManifest[id] = factory
}
