import type { WidgetDefinition } from '../../contracts/widget.js'

export const winampWindowDefinition = {
  id: 'winamp-window',
  componentType: 'winamp-window',
  defaultSize: { width: 275, height: 116 },
  zIndex: 0,
  system: true,
  emits: [{ event: 'winamp-window:slide-changed', label: 'Skin changed' }],
  accepts: [
    { action: 'winamp-window:next',     label: 'Next skin',     simulate: { weight: 2 } },
    { action: 'winamp-window:previous', label: 'Previous skin', simulate: true },
  ],
} as const satisfies WidgetDefinition
