import type { MediaKind } from './plugin.js'

// ── Plugin manifest base ──────────────────────────────────────────
//
// Widgets, renderers, and effects are all "bricks": things with an
// identity, a config schema, signals they emit, and actions they accept.
// Their manifests share this base so generic tooling (SchemaForm editors,
// automation pickers, catalogs) can treat any brick uniformly.

export type PluginKind = 'widget' | 'renderer' | 'effect'

/** A signal a plugin can emit (publish) into the automation pipeline. */
export interface SignalDescriptor {
  event: string    // e.g. 'weather:storm', 'quest:complete'
  label: string    // human-readable, e.g. 'Storm detected'
}

/** An action a plugin can receive (subscribe/consume) from automation rules. */
export interface ActionDescriptor {
  action: string   // e.g. 'gallery:next'
  label: string    // human-readable, e.g. 'Next slide'
  /**
   * Opt this action into ambient simulation (AmbianceManager "interact"
   * picks). true = pickable with weight 1; an object can weight the pick
   * and generate per-fire params (e.g. a random sticky color) so the
   * cursor theater and the widget state agree on the same values.
   * The kernel never knows widget vocabulary — it picks from these.
   */
  simulate?: boolean | { weight?: number; params?: () => Record<string, unknown> }
}

export interface PluginManifestBase {
  label?: string
  icon?: string
  desc?: string
  /** Config schema driving the generated admin editor (SchemaForm) */
  fields?: readonly FieldDef[]
  /** Signals this plugin emits into the automation pipeline */
  emits?: readonly SignalDescriptor[]
  /** Actions this plugin accepts from automation rules */
  accepts?: readonly ActionDescriptor[]
}

/**
 * FieldDef — the unified config-field schema for every plugin kind
 * (effects, renderers, widgets). Admin UIs render settings forms from
 * these declaratively; no per-type editor code.
 *
 * Superset of the original RendererFieldDef — renderer catalog entries
 * migrate onto this type.
 */
export type FieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'slider'
  | 'color'
  | 'boolean'
  | 'select'
  | 'text-list'      // string[] — edited one entry per line
  | 'color-list'     // string[] of colors — edited one hex per line
  | 'media'          // asset path/URL with media library picker
  | 'ref'            // cross-entity reference id with admin entity picker
  | 'camera-device'  // video input device label — enumerates getUserMedia devices

/** Entity kinds a 'ref' field can point at. The admin resolves each to a
 *  live picker (scenes/widgets/layouts from config, presets/sequences via
 *  API) so operators never type raw ids. */
export type RefKind =
  | 'scene'
  | 'sequence'
  | 'preset'
  | 'widget-layout'
  | 'widget'
  | 'window-preset'
  | 'event'

export interface FieldDef {
  key: string
  label: string
  type: FieldType
  /** select: allowed values */
  options?: string[]
  /** number/slider bounds */
  min?: number
  max?: number
  step?: number
  /** slider unit suffix, e.g. 's', 'ms', 'px' */
  unit?: string
  /** media: which asset kinds the picker offers */
  mediaKinds?: MediaKind[]
  /** ref: which entity the picker lists */
  refKind?: RefKind
  placeholder?: string
  /** helper text under the input */
  hint?: string
  /** empty input stores undefined instead of '' / 0 */
  optional?: boolean
  /** only render when another key equals a value (e.g. customUrl when sfxId === 'custom') */
  showIf?: { key: string; equals: unknown }
}
