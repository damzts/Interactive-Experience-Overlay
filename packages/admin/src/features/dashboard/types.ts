import type { OverlayStyle } from '@ieomlabs/shared'
import type { STATE } from '@ieomlabs/shared'

export type ThemeAppearance = Pick<OverlayStyle, 'fontFamily' | 'accentColor' | 'textColor'>

export type SelectedItem =
  | { kind: 'env';   envState: STATE }
  | { kind: 'scene'; sceneState: string }
  | { kind: 'app';   appId: string }
  | { kind: 'widget-create' }
  | { kind: 'widget-layout'; layoutId: string }
  | { kind: 'lobby-theme' }
  | { kind: 'desktop-theme' }
  | { kind: 'audio' }
  | { kind: 'keybinds' }
  | { kind: 'settings' }
  | { kind: 'scheduler'; tab: 'events' | 'effect-ambiance' | 'theme-drift' | 'persona' | 'desktop-ambiance' }
  | { kind: 'obs' }
  | { kind: 'pov-online' }
  | { kind: 'media-gallery' }
  | { kind: 'media-effects' }
  | { kind: 'media-renders' }
  | { kind: 'kernel-health' }
  | { kind: 'automation' }
  | { kind: 'shows' }
  | { kind: 'twitch' }
  | { kind: 'presets' }
  | { kind: 'sequence'; sequenceId: string }

export function itemKey(item: SelectedItem): string {
  if (item.kind === 'env')   return 'env-' + item.envState
  if (item.kind === 'scene') return 'scene-' + item.sceneState
  if (item.kind === 'app')   return 'app-' + item.appId
  if (item.kind === 'widget-create') return 'widget-create'
  if (item.kind === 'widget-layout') return 'widget-layout-' + item.layoutId
  if (item.kind === 'pov-online') return 'pov-online'
  if (item.kind === 'sequence') return 'sequence-' + item.sequenceId
  if (item.kind === 'scheduler') return 'scheduler-' + item.tab
  return item.kind
}
