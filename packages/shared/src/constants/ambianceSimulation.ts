import type { AmbianceMirrorPolicy, WidgetSimulationIntentPayload, WidgetSimulationIntentSeed } from '../contracts/socket.js'

const STICKY_COLORS = ['#fff2a8', '#ffd3e0', '#d8f8d0', '#cde8ff'] as const
const CHAT_MESSAGES = [
  { user: 'nightbot', text: 'ambient desktop simulation engaged', color: '#74c0fc' },
  { user: 'system', text: 'widget activity synced across overlays', color: '#69db7c' },
  { user: 'streamfan42', text: 'chat widget woke up again', color: '#ffd43b' },
  { user: 'retroviewer', text: 'the desktop feels haunted in a good way', color: '#da77f2' },
] as const
const MUSIC_ACTIONS = ['music:prev', 'music:play-pause', 'music:next'] as const
const GALLERY_ACTIONS = ['gallery:previous', 'gallery:next', 'gallery:next'] as const

export function getAmbianceInteractMirrorPolicy(widgetId: string): AmbianceMirrorPolicy {
  if (widgetId === 'browser' || widgetId === 'gallery' || widgetId === 'music' || widgetId === 'chat' || widgetId === 'sticky-notes') {
    return 'shared-safe'
  }
  return 'unsafe-requires-runtime-event'
}

export function pickAmbianceInteractionIntent(widgetId: string): WidgetSimulationIntentSeed | null {
  if (widgetId === 'browser' || widgetId === 'gallery') {
    const kind = GALLERY_ACTIONS[Math.floor(Math.random() * GALLERY_ACTIONS.length)]
    return { widgetId, kind }
  }

  if (widgetId === 'music') {
    const kind = MUSIC_ACTIONS[Math.floor(Math.random() * MUSIC_ACTIONS.length)]
    return { widgetId, kind }
  }

  if (widgetId === 'sticky-notes') {
    const color = STICKY_COLORS[Math.floor(Math.random() * STICKY_COLORS.length)]
    return { widgetId, kind: 'sticky:set-color', color }
  }

  if (widgetId === 'chat') {
    const message = CHAT_MESSAGES[Math.floor(Math.random() * CHAT_MESSAGES.length)]
    return {
      widgetId,
      kind: 'chat:add-message',
      message: {
        user: message.user,
        text: message.text,
        color: message.color,
      },
    }
  }

  return null
}

export function buildWidgetSimulationIntent(actionId: string, seed: WidgetSimulationIntentSeed): WidgetSimulationIntentPayload {
  return {
    ...seed,
    actionId,
  } as WidgetSimulationIntentPayload
}