import type { WidgetDefinition } from '../../contracts/widget.js'

export const playlistDeckDefinition = {
  id: 'playlist-deck',
  componentType: 'playlist-deck',
  defaultSize: { width: 300, height: 240 },
  zIndex: 10,
  system: false,
  label: 'Playlist Deck',
  emits: [],
  accepts: [],
} as const satisfies WidgetDefinition
