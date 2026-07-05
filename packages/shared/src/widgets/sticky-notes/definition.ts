import type { WidgetDefinition } from '../../contracts/widget.js'

const NOTE_COLORS = ['#fff2a8', '#ffd3e0', '#d8f8d0', '#cde8ff'] as const

export const stickyNotesDefinition = {
  id: 'sticky-notes',
  componentType: 'sticky-notes',
  defaultSize: { width: 260, height: 290 },
  zIndex: 30,
  system: true,
  emits: [],
  accepts: [{
    action: 'sticky:set-color',
    label: 'Set color',
    // Pre-generate the color so the ambiance cursor theater clicks the
    // matching swatch and the widget lands on the same value.
    simulate: { params: () => ({ color: NOTE_COLORS[Math.floor(Math.random() * NOTE_COLORS.length)] }) },
  }],
} as const satisfies WidgetDefinition
