import type { ComponentType } from 'react'
import { ImageSlideshowRenderer } from './ImageSlideshow'
import { CRTEffectRenderer } from './CRTEffect'
import { TextWidgetRenderer } from './TextWidget'

export interface PluginDefinition {
  Renderer: ComponentType<{ config: Record<string, unknown> }>
}

export const pluginRegistry: Record<string, PluginDefinition> = {
  'image-slideshow': { Renderer: ImageSlideshowRenderer },
  'crt-effect': { Renderer: CRTEffectRenderer },
  'text-widget': { Renderer: TextWidgetRenderer },
}
