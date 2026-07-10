/**
 * ActionFields — the type selector + per-kind editor for a single EventAction,
 * shared between EventForm.tsx (Events' Runtime Actions, one per array row)
 * and AutomationPanel.tsx (a rule's single action). Same vocabulary either
 * way: the four hand-coded kinds get bespoke editors below; everything else
 * (see ACTION_CATALOG) is generated from its field schema via SchemaForm.
 * No per-screen duplicate forms.
 */
import { ACTION_CATALOG, DEFAULT_WIDGET_THEME_PRESETS } from '@ieomlabs/shared'
import type {
  DesktopConfig,
  EventAction,
  EventDesktopTheme,
  EventWidgetThemePatch,
  WidgetThemeConfig,
} from '@ieomlabs/shared'
import {
  DESKTOP_THEMES,
  GOOGLE_FONTS,
  ICON_ANIMATIONS,
  WIDGET_SKINS,
  WIDGET_THEME_ANIMATIONS,
  WIDGET_THEME_ATMOSPHERES,
  WIDGET_SHAPES,
} from './adminDesktopOptions'
import { ConfigChoiceButton, HexColorInput, Slider, Toggle } from './ui'
import { SchemaForm } from '../features/media-library/SchemaForm'
import {
  ACTION_CATEGORIES,
  createEventActionDraft,
  getEventActionLabel,
  isBlankAction,
  normalizeDraftEventAction,
  type DraftEventAction,
} from '../features/media-library/eventPresets'

type WidgetThemeRuntimeDraft = EventWidgetThemePatch
type WidgetThemeEditorView = Omit<WidgetThemeConfig, 'skin'> & { skin: WidgetThemeConfig['skin'] | 'random' }

function getThemeEditorView(themePatch?: WidgetThemeRuntimeDraft | null): WidgetThemeEditorView {
  const selectedSkin = themePatch?.skin
  const baseSkin = selectedSkin && selectedSkin !== 'random' ? selectedSkin : 'metalheart'
  const { skin: _skin, ...themePatchWithoutSkin } = themePatch ?? {}
  return {
    ...DEFAULT_WIDGET_THEME_PRESETS[baseSkin],
    ...themePatchWithoutSkin,
    skin: selectedSkin ?? baseSkin,
  } as WidgetThemeEditorView
}

function ThemeFields({ themePatch, onChange }: {
  themePatch: WidgetThemeRuntimeDraft | undefined
  onChange: (updater: (draft: WidgetThemeRuntimeDraft) => void) => void
}) {
  const theme = getThemeEditorView(themePatch)
  return (
    <div className="grid grid-cols-2 gap-2 pl-1">
      <div>
        <div className="mb-1 text-[10px] text-zinc-500">Skin</div>
        <select
          value={theme.skin}
          onChange={(event) => onChange((draft) => {
            const nextSkin = event.target.value as WidgetThemeConfig['skin'] | 'random'
            if (nextSkin === 'random') {
              delete draft.fontFamily
              delete draft.accentColor
              delete draft.textColor
              delete draft.animation
              delete draft.atmosphere
              delete draft.shape
              delete draft.motionIntensity
              delete draft.glowIntensity
              draft.skin = 'random'
              return
            }
            Object.assign(draft, structuredClone(DEFAULT_WIDGET_THEME_PRESETS[nextSkin]))
          })}
          className="w-full text-xs"
        >
          <option value="random">Random</option>
          {WIDGET_SKINS.map((skin) => (
            <option key={skin.id} value={skin.id}>{skin.label}</option>
          ))}
        </select>
      </div>
      <div>
        <div className="mb-1 text-[10px] text-zinc-500">Font</div>
        <select
          value={theme.fontFamily}
          onChange={(event) => onChange((draft) => { draft.fontFamily = event.target.value })}
          className="w-full text-xs"
        >
          {GOOGLE_FONTS.map((font) => (
            <option key={font.css} value={font.css}>{font.name}</option>
          ))}
        </select>
      </div>
      <div>
        <div className="mb-1 text-[10px] text-zinc-500">Accent</div>
        <HexColorInput value={theme.accentColor} onChange={(value) => onChange((draft) => { draft.accentColor = value })} />
      </div>
      <div>
        <div className="mb-1 text-[10px] text-zinc-500">Text</div>
        <HexColorInput value={theme.textColor} onChange={(value) => onChange((draft) => { draft.textColor = value })} />
      </div>
      <div>
        <div className="mb-1 text-[10px] text-zinc-500">Animation</div>
        <select
          value={theme.animation}
          onChange={(event) => onChange((draft) => { draft.animation = event.target.value as WidgetThemeConfig['animation'] })}
          className="w-full text-xs"
        >
          {WIDGET_THEME_ANIMATIONS.map((animation) => (
            <option key={animation.id} value={animation.id}>{animation.label}</option>
          ))}
        </select>
      </div>
      <div>
        <div className="mb-1 text-[10px] text-zinc-500">Atmosphere</div>
        <select
          value={theme.atmosphere}
          onChange={(event) => onChange((draft) => { draft.atmosphere = event.target.value as WidgetThemeConfig['atmosphere'] })}
          className="w-full text-xs"
        >
          {WIDGET_THEME_ATMOSPHERES.map((atmosphere) => (
            <option key={atmosphere.id} value={atmosphere.id}>{atmosphere.label}</option>
          ))}
        </select>
      </div>
      <div>
        <div className="mb-1 text-[10px] text-zinc-500">Shape</div>
        <select
          value={theme.shape}
          onChange={(event) => onChange((draft) => { draft.shape = event.target.value as WidgetThemeConfig['shape'] })}
          className="w-full text-xs"
        >
          {WIDGET_SHAPES.map((shape) => (
            <option key={shape.id} value={shape.id}>{shape.label}</option>
          ))}
        </select>
      </div>
      <Slider label="Motion" value={theme.motionIntensity} min={0} max={3} step={0.05} onChange={(value) => onChange((draft) => { draft.motionIntensity = value })} />
      <Slider label="Glow" value={theme.glowIntensity} min={0} max={3} step={0.05} onChange={(value) => onChange((draft) => { draft.glowIntensity = value })} />
    </div>
  )
}

export interface ActionFieldsProps {
  action: DraftEventAction
  onChange: (next: DraftEventAction) => void
  widgetApps: { id: string; label: string }[]
  /** Hide the type selector — used when the caller already renders its own (e.g. a card header). */
  hideTypeSelect?: boolean
}

/** Type selector + per-kind editor for one action. Renders nothing below the
 *  selector for a still-blank (no kind chosen) action. */
export function ActionFields({ action: rawAction, onChange, widgetApps, hideTypeSelect }: ActionFieldsProps) {
  // Pre-catalog persisted rows of migrated kinds store config flat — lift to
  // { kind, cfg } so the generated editor below can render them.
  const action = normalizeDraftEventAction(rawAction)

  const setKind = (kind: EventAction['kind'] | '') => {
    onChange(kind ? createEventActionDraft(kind) : { kind: '' })
  }

  return (
    <div className="space-y-3">
      {!hideTypeSelect && (
        <select
          value={action.kind}
          onChange={(event) => setKind(event.target.value as EventAction['kind'] | '')}
          className="w-full text-xs"
        >
          <option value="">— type —</option>
          {ACTION_CATEGORIES.map((cat) => (
            <optgroup key={cat.label} label={cat.label}>
              {cat.kinds.map((kind) => <option key={kind} value={kind}>{getEventActionLabel(kind)}</option>)}
            </optgroup>
          ))}
        </select>
      )}

      {action.kind === 'desktop-config' && (
        <div className="space-y-2">
          <div className="rounded border border-zinc-800/70 bg-zinc-900/45 px-5 py-4">
            <Slider label="Revert after" value={action.timeoutSeconds ?? 30} min={5} max={600} step={5} unit="s"
              onChange={(value) => onChange({ ...action, timeoutSeconds: value })} />
          </div>
          <div className="grid grid-cols-2 gap-2 pl-1">
            <div>
              <div className="mb-1 text-[10px] text-zinc-500">Desktop theme</div>
              <select value={action.patch.theme ?? 'win98'} onChange={(event) => onChange({
                ...action, patch: { ...action.patch, theme: event.target.value as EventDesktopTheme },
              })} className="w-full text-xs">
                <option value="random">Random</option>
                {DESKTOP_THEMES.map((theme) => <option key={theme.id} value={theme.id}>{theme.label}</option>)}
              </select>
            </div>
            <div>
              <div className="mb-1 text-[10px] text-zinc-500">Icon motion</div>
              <select value={action.patch.iconAnimation ?? 'none'} onChange={(event) => onChange({
                ...action, patch: { ...action.patch, iconAnimation: event.target.value as DesktopConfig['iconAnimation'] },
              })} className="w-full text-xs">
                {ICON_ANIMATIONS.map((mode) => <option key={mode.id} value={mode.id}>{mode.label}</option>)}
              </select>
            </div>
            <Slider label="Intensity" value={action.patch.iconMotion ?? 1} min={0} max={3} step={0.05}
              onChange={(value) => onChange({ ...action, patch: { ...action.patch, iconMotion: value } })} />
          </div>
          <div className="rounded border border-zinc-800/70 bg-zinc-900/45 py-2">
            <div className="px-3 pb-2 text-[10px] uppercase tracking-wider text-zinc-500">Global Widget Theme</div>
            <ThemeFields
              themePatch={action.patch.widgetTheme}
              onChange={(updater) => {
                const nextTheme: EventWidgetThemePatch = { ...(action.patch.widgetTheme ?? {}) }
                updater(nextTheme)
                onChange({ ...action, patch: { ...action.patch, widgetTheme: nextTheme } })
              }}
            />
          </div>
        </div>
      )}

      {action.kind === 'widget-themes' && (
        <div className="space-y-2">
          <div className="rounded border border-zinc-800/70 bg-zinc-900/45 px-5 py-4">
            <Slider label="Revert after" value={action.timeoutSeconds ?? 30} min={5} max={600} step={5} unit="s"
              onChange={(value) => onChange({ ...action, timeoutSeconds: value })} />
          </div>
          <div>
            <div className="mb-1 text-[10px] text-zinc-500">Target widgets</div>
            <div className="flex flex-wrap gap-1">
              {widgetApps.map((app) => {
                const selected = action.widgetIds.includes(app.id)
                return (
                  <ConfigChoiceButton key={app.id} type="button" selected={selected} onClick={() => {
                    const next = new Set(action.widgetIds)
                    if (next.has(app.id)) next.delete(app.id)
                    else next.add(app.id)
                    onChange({ ...action, widgetIds: [...next] })
                  }} className="text-[10px]">
                    {app.label}
                  </ConfigChoiceButton>
                )
              })}
            </div>
          </div>
          <Toggle checked={action.clearExisting ?? false} onChange={(value) => onChange({ ...action, clearExisting: value })} label="Reset existing themes first" />
          <div className="rounded border border-zinc-800/70 bg-zinc-900/45 py-2">
            <div className="px-3 pb-2 text-[10px] uppercase tracking-wider text-zinc-500">Theme</div>
            <ThemeFields
              themePatch={action.theme}
              onChange={(updater) => {
                const nextTheme: EventWidgetThemePatch = { ...(action.theme ?? {}) }
                updater(nextTheme)
                onChange({ ...action, theme: nextTheme })
              }}
            />
          </div>
        </div>
      )}

      {!isBlankAction(action) && 'cfg' in action && (() => {
        const fields = ACTION_CATALOG[action.kind]?.fields ?? []
        if (!fields.length) {
          return (
            <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/55 px-5 py-4 text-[11px] text-zinc-500">
              {ACTION_CATALOG[action.kind]?.desc ?? 'This action has no extra configuration.'}
            </div>
          )
        }
        return (
          <div className="pl-1">
            <SchemaForm
              fields={fields}
              values={action.cfg as Record<string, unknown>}
              onChange={(key, value) => onChange({ ...action, cfg: { ...(action.cfg as Record<string, unknown>), [key]: value } } as DraftEventAction)}
            />
          </div>
        )
      })()}
    </div>
  )
}
