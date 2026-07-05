import type { WidgetDefinition } from '../../contracts/widget.js'

const AMBIENT_MESSAGES = [
  { user: 'nightbot', text: 'ambient desktop simulation engaged', color: '#74c0fc' },
  { user: 'system', text: 'widget activity synced across overlays', color: '#69db7c' },
  { user: 'streamfan42', text: 'chat widget woke up again', color: '#ffd43b' },
  { user: 'retroviewer', text: 'the desktop feels haunted in a good way', color: '#da77f2' },
] as const

export const chatDefinition = {
  id: 'chat',
  componentType: 'chat',
  defaultSize: { width: 280, height: 290 },
  zIndex: 40,
  system: true,
  emits: [{ event: 'chat:message', label: 'Message received' }],
  accepts: [{
    action: 'chat:add-message',
    label: 'Add message',
    simulate: { params: () => ({ message: { ...AMBIENT_MESSAGES[Math.floor(Math.random() * AMBIENT_MESSAGES.length)] } }) },
  }],
} as const satisfies WidgetDefinition
