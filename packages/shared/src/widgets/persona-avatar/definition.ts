import type { WidgetDefinition } from '../../contracts/widget.js'

export const AVATAR_EMOTIONS = ['neutral', 'happy', 'excited', 'sleepy'] as const
export type AvatarEmotion = (typeof AVATAR_EMOTIONS)[number]

export const personaAvatarDefinition = {
  id: 'persona-avatar',
  componentType: 'persona-avatar',
  defaultSize: { width: 240, height: 280 },
  zIndex: 70,
  system: true,
  emits: [
    { event: 'avatar:emotion-changed', label: 'Emotion changed' },
  ],
  accepts: [{
    action: 'avatar:set-emotion',
    label: 'Set emotion',
    // Pre-generate the emotion so ambiance cursor theater and the widget
    // land on the same face.
    simulate: { params: () => ({ emotion: AVATAR_EMOTIONS[Math.floor(Math.random() * AVATAR_EMOTIONS.length)] }) },
  }],
} as const satisfies WidgetDefinition
