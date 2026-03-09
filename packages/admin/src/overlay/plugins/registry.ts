import type { ComponentType } from 'react'
import { ImageSlideshowRenderer } from './ImageSlideshow'
import { CRTEffectRenderer }      from './CRTEffect'
import { TextWidgetRenderer }     from './TextWidget'
import { SolidColorRenderer }     from './SolidColor'
import { ColorOverlayRenderer }   from './ColorOverlay'
import { ImageStaticRenderer }    from './ImageStatic'
import { VideoLoopRenderer }      from './VideoLoop'
import { VignetteRenderer }       from './Vignette'
import { NoiseGrainRenderer }     from './NoiseGrain'
import { ClockWidgetRenderer }    from './ClockWidget'

export interface PluginDefinition {
  Renderer: ComponentType<{ config: Record<string, unknown> }>
}

export const pluginRegistry: Record<string, PluginDefinition> = {
  'image-slideshow': { Renderer: ImageSlideshowRenderer },
  'crt-effect':      { Renderer: CRTEffectRenderer      },
  'text-widget':     { Renderer: TextWidgetRenderer     },
  'solid-color':     { Renderer: SolidColorRenderer     },
  'color-overlay':   { Renderer: ColorOverlayRenderer   },
  'image-static':    { Renderer: ImageStaticRenderer    },
  'video-loop':      { Renderer: VideoLoopRenderer      },
  'vignette':        { Renderer: VignetteRenderer       },
  'noise-grain':     { Renderer: NoiseGrainRenderer     },
  'clock-widget':    { Renderer: ClockWidgetRenderer    },
}
