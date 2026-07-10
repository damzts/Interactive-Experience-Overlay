import type { OverlayStyle } from '@ieomlabs/shared'
import type { SchedulerTab } from '../scheduler/SchedulerHost'

export type ThemeAppearance = Pick<OverlayStyle, 'fontFamily' | 'accentColor' | 'textColor'>

export type SelectedItem =
  | { kind: 'scene'; sceneState: string }
  | { kind: 'app';   appId: string }
  | { kind: 'widget-create' }
  | { kind: 'widget-layout'; layoutId: string }
  | { kind: 'keybinds' }
  | { kind: 'settings' }
  | { kind: 'scheduler'; tab: SchedulerTab }
  | { kind: 'obs' }
  | { kind: 'pov-online' }
  | { kind: 'graphics'; tab?: 'sources' | 'events' | 'catalog' | 'avatar' }
  | { kind: 'ai' }
  | { kind: 'tts' }
  | { kind: 'shows' }
  | { kind: 'twitch' }
  | { kind: 'developer' }
  | { kind: 'sequence'; sequenceId: string }

export function itemKey(item: SelectedItem): string {
  if (item.kind === 'scene') return 'scene-' + item.sceneState
  if (item.kind === 'app')   return 'app-' + item.appId
  if (item.kind === 'widget-create') return 'widget-create'
  if (item.kind === 'widget-layout') return 'widget-layout-' + item.layoutId
  if (item.kind === 'pov-online') return 'pov-online'
  if (item.kind === 'sequence') return 'sequence-' + item.sequenceId
  if (item.kind === 'scheduler') return 'scheduler-' + item.tab
  if (item.kind === 'graphics') return 'graphics-' + (item.tab ?? 'sources')
  return item.kind
}
