import type { WidgetDefinition } from '../../contracts/widget.js'

export const galleryDefinition: WidgetDefinition = {
  id: 'gallery',
  componentType: 'gallery',
  defaultSize: { width: 430, height: 320 },
  zIndex: 0,
  system: true,
  emits: [{ event: 'gallery:slide-changed', label: 'Slide changed' }],
  accepts: [
    { action: 'gallery:next',     label: 'Next slide' },
    { action: 'gallery:previous', label: 'Previous slide' },
  ],
}
