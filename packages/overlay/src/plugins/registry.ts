import type { ComponentType } from 'react'
import type { PluginCatalogEntry } from '@ieomlabs/shared'
import { findPluginCatalogEntry } from '@ieomlabs/shared'

export interface PluginProps {
  config: Record<string, unknown>
  bounds: { x: number; y: number; width: number; height: number }
  /** Fire a DOM-bus event for inter-source IPC */
  emit: (event: string, data: unknown) => void
  /** Subscribe to a DOM-bus event; returns unsubscribe fn */
  onSignal: (event: string, handler: (data: unknown) => void) => () => void
}

export interface PluginDefinition {
  Renderer: ComponentType<PluginProps>
  /** Catalog entry for this plugin — populated by resolvePlugin when available */
  catalog?: PluginCatalogEntry
  /** JSON Schema for admin UI generation */
  configSchema?: Record<string, unknown>
  /** Signal names this plugin subscribes to */
  signalSubscriptions?: string[]
  /** Requests animation-frame ticks via RAF */
  animated?: boolean
  /** Called on unmount for WebGL / audio cleanup */
  dispose?: () => void
}

/** Lazy manifest — each entry is an async factory resolved on first use */
export type PluginManifest = Record<string, () => Promise<PluginDefinition>>

export const pluginManifest: PluginManifest = {
  'image-slideshow': () => import('./ImageSlideshow').then((m) => ({ Renderer: m.ImageSlideshowRenderer })),
  'crt-effect':      () => import('./CRTEffect').then((m) => ({ Renderer: m.CRTEffectRenderer })),
  'text-widget':     () => import('./TextWidget').then((m) => ({ Renderer: m.TextWidgetRenderer })),
  'solid-color':     () => import('./SolidColor').then((m) => ({ Renderer: m.SolidColorRenderer })),
  'color-overlay':   () => import('./ColorOverlay').then((m) => ({ Renderer: m.ColorOverlayRenderer })),
  'image-static':    () => import('./ImageStatic').then((m) => ({ Renderer: m.ImageStaticRenderer })),
  'video-loop':      () => import('./VideoLoop').then((m) => ({ Renderer: m.VideoLoopRenderer })),
  'vignette':        () => import('./Vignette').then((m) => ({ Renderer: m.VignetteRenderer })),
  'noise-grain':     () => import('./NoiseGrain').then((m) => ({ Renderer: m.NoiseGrainRenderer })),
  'clock-widget':    () => import('./ClockWidget').then((m) => ({ Renderer: m.ClockWidgetRenderer })),
  'camera':          () => import('./Camera').then((m) => ({ Renderer: m.CameraRenderer })),
  'pov-stream':      () => import('./PovStream').then((m) => ({ Renderer: m.PovStreamRenderer })),
  // Builtin tier sources — wrap legacy layer components as plugins
  'builtin:background': () => import('./builtins/Background').then((m) => ({ Renderer: m.BuiltinBackgroundRenderer })),
  'builtin:particles':  () => import('./builtins/Particles').then((m) => ({ Renderer: m.BuiltinParticlesRenderer })),
  'builtin:effects':    () => import('./builtins/Effects').then((m) => ({ Renderer: m.BuiltinEffectsRenderer })),
}

/** Cache: resolved definitions keyed by plugin id */
const cache = new Map<string, PluginDefinition>()

export async function resolvePlugin(id: string): Promise<PluginDefinition | null> {
  if (cache.has(id)) return cache.get(id)!
  const factory = pluginManifest[id]
  if (!factory) return null
  const def = await factory()
  def.catalog = findPluginCatalogEntry(id)
  cache.set(id, def)
  return def
}

/** Register a new plugin at runtime (e.g. from a remote module) */
export function registerPlugin(id: string, factory: () => Promise<PluginDefinition>): void {
  pluginManifest[id] = factory
}
