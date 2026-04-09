import type { OverlayStyle } from '@ieom/shared'
import type { STATE } from '@ieom/shared'

export type ThemeAppearance = Pick<OverlayStyle, 'fontFamily' | 'accentColor' | 'textColor'>

export type SelectedItem =
  | { kind: 'env';   envState: STATE }
  | { kind: 'scene'; sceneState: string }
  | { kind: 'app';   appId: string }
  | { kind: 'widget-create' }
  | { kind: 'widget-layout'; layoutId: string }
  | { kind: 'default-styling' }
  | { kind: 'audio' }
  | { kind: 'keybinds' }
  | { kind: 'archive' }
  | { kind: 'settings' }
  | { kind: 'ambiance' }

export function itemKey(item: SelectedItem): string {
  if (item.kind === 'env')   return 'env-' + item.envState
  if (item.kind === 'scene') return 'scene-' + item.sceneState
  if (item.kind === 'app')   return 'app-' + item.appId
  if (item.kind === 'widget-create') return 'widget-create'
  if (item.kind === 'widget-layout') return 'widget-layout-' + item.layoutId
  if (item.kind === 'ambiance') return 'ambiance'
  return item.kind
}
