import type { ComponentType } from 'react'
import type { Application, WidgetComponentType } from '@ieomlabs/shared'
import { CameraConfigSection, type CameraConfigSectionContext } from './CameraConfigSection'
import { ScreenConfigSection } from './ScreenConfigSection'
import { SourceConfigSection } from './SourceConfigSection'

/**
 * Context passed to a widget type's config section — the pieces of AppForm
 * state that config sections might need beyond the current draft. Kept as a
 * single loosely-typed bag so adding a new widget type's section doesn't
 * require widening AppForm's own prop surface.
 */
export interface WidgetConfigSectionContext extends CameraConfigSectionContext {
  /** Full app config — source widgets need the scene list, etc. */
  config: import('@ieomlabs/shared').AppConfig
}

export interface WidgetConfigSectionProps {
  form: Application
  update: (updater: (draft: Application) => void) => void
  ctx: WidgetConfigSectionContext
}

/**
 * Descriptor for a user-creatable base widget type. This is the single
 * source of truth consumed by:
 *  - NewWidgetForm.tsx (creation options)
 *  - AppForm.tsx (which config section to render for a given widgetComponent)
 *
 * Adding a new user-creatable widget type means adding one entry here —
 * no new branches in NewWidgetForm or AppForm.
 */
export interface UserWidgetTypeDescriptor {
  /** Matches Application.widgetComponent for instances of this type. */
  componentType: WidgetComponentType
  label: string
  icon: string
  description: string
  /** Label used to prefill the "Label" field when creating a new instance. */
  defaultLabel: string
  /** Extra Application fields merged in at creation time (e.g. default settings block). */
  createDefaults: () => Partial<Application>
  /** Config panel rendered in AppForm's General tab for this widget type. Optional — some types have no extra config. */
  ConfigSection?: ComponentType<WidgetConfigSectionProps>
}

export const USER_WIDGET_TYPES: readonly UserWidgetTypeDescriptor[] = [
  {
    componentType: 'camera',
    label: 'Camera',
    icon: '📷',
    description: 'Opens a desktop camera window with per-widget camera defaults.',
    defaultLabel: 'Camera Widget',
    createDefaults: () => ({ cameraSettings: { mirror: false } }),
    ConfigSection: CameraConfigSection,
  },
  {
    componentType: 'screen',
    label: 'Screen Share',
    icon: '🖥️',
    description: 'Opens a desktop window sharing a screen, window, or browser tab.',
    defaultLabel: 'Screen Widget',
    createDefaults: () => ({ screenSettings: { audio: false, mirror: false, autoStart: false } }),
    ConfigSection: ScreenConfigSection,
  },
  {
    componentType: 'window',
    label: 'Source',
    icon: '🧩',
    description: 'Opens a desktop window rendering any renderer directly, or a whole scene scaled to fit.',
    defaultLabel: 'Source Widget',
    createDefaults: () => ({ windowWidgetSettings: { mode: 'renderer' as const, rendererType: 'media-viz' } }),
    ConfigSection: SourceConfigSection,
  },
] as const

export function getUserWidgetType(componentType: WidgetComponentType): UserWidgetTypeDescriptor | undefined {
  return USER_WIDGET_TYPES.find((entry) => entry.componentType === componentType)
}
