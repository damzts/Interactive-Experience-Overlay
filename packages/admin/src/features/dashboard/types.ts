import type { OverlayStyle } from '@ieom/shared'
import type { STATE } from '@ieom/shared'

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
  | { kind: 'archive' }
  | { kind: 'settings' }
  | { kind: 'ambiance' }
  | { kind: 'scheduler' }
  | { kind: 'scene-machine' }
  | { kind: 'obs' }
  | { kind: 'pov-online' }
  | { kind: 'asset-library' }
  | { kind: 'asset-catalog' }
  | { kind: 'asset-events' }
  | { kind: 'asset-sources' }
  | { kind: 'asset-transitions' }
  | { kind: 'kernel-health' }

export function itemKey(item: SelectedItem): string {
  if (item.kind === 'env')   return 'env-' + item.envState
  if (item.kind === 'scene') return 'scene-' + item.sceneState
  if (item.kind === 'app')   return 'app-' + item.appId
  if (item.kind === 'widget-create') return 'widget-create'
  if (item.kind === 'widget-layout') return 'widget-layout-' + item.layoutId
  if (item.kind === 'ambiance') return 'ambiance'
  if (item.kind === 'pov-online') return 'pov-online'
  return item.kind
}
