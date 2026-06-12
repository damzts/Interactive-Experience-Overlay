import type { ComponentType } from 'react'
import type { RendererCatalogEntry } from '@ieomlabs/shared'
import { findRendererCatalogEntry } from '@ieomlabs/shared'

export interface RendererProps {
  config: Record<string, unknown>
  bounds: { x: number; y: number; width: number; height: number }
  /** Fire a DOM-bus event for inter-window IPC */
  emit: (event: string, data: unknown) => void
  /** Subscribe to a DOM-bus event; returns unsubscribe fn */
  onSignal: (event: string, handler: (data: unknown) => void) => () => void
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
