/**
 * ThemeDriftManager — ambient art-style variation.
 *
 * Sibling of EffectAmbianceManager (same tick/timer shape) but instead of
 * firing effects, each tick independently rolls each enabled field group's
 * chance and, on success, dispatches a 'desktop-config' action with
 * `persistent: true` so the patch sticks as the new runtime baseline (no
 * scheduleRuntimeConfigReset) — undone only by the next drift or an
 * explicit runtime:config:reset. Fires via the same 'scheduler:fired' bus
 * path used by EventScheduler/EffectAmbianceManager, so
 * executeConfiguredEvent (packages/server/src/transport/socket/handlers/scene.ts)
 * dispatches it exactly like any other configured event.
 *
 * Field groups draw from curated widget theme presets rather than raw
 * random numeric ranges, so a drifted look stays internally coherent
 * (see DEFAULT_WIDGET_THEME_PRESETS) — except colors, which vary
 * continuously via HSL so accents don't snap between only ~19 combos.
 */

import {
  DEFAULT_WIDGET_THEME_PRESETS,
  DESKTOP_THEME_IDS,
  DESKTOP_ICON_ANIMATION_IDS,
  DESKTOP_ICON_ARRANGEMENT_IDS,
  withDesktopThemeDriftDefaults,
  type Manager,
  type ManagerStatus,
  type AppConfig,
  type DesktopTheme,
  type WidgetSkinTheme,
  type DesktopIconAnimation,
  type DesktopIconArrangement,
  type EventDesktopConfigAction,
} from '@ieomlabs/shared'
import type { KernelBus } from '../bus.js'
import logger from '../../lib/logger.js'

const WIDGET_SKIN_IDS = Object.keys(DEFAULT_WIDGET_THEME_PRESETS) as WidgetSkinTheme[]

function pickOtherThan<T>(pool: T[], exclude: T | null): T | null {
  const candidates = exclude !== null ? pool.filter((entry) => entry !== exclude) : pool
  if (!candidates.length) return null
  return candidates[Math.floor(Math.random() * candidates.length)]
}

/** Vivid, evenly-distributed random color via HSL — avoids the muddy
 *  results of uniform-random RGB while still varying continuously. */
function randomVividHexColor(): string {
  const hue = Math.floor(Math.random() * 360)
  const saturation = 65 + Math.random() * 30
  const lightness = 45 + Math.random() * 30
  const h = hue / 360, s = saturation / 100, l = lightness / 100
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => {
    const k = (n + h * 12) % 12
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
    return Math.round(255 * color).toString(16).padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

function randBetween(min: number, max: number) {
  return min + Math.random() * (max - min)
}

function jitterMs(seconds: number, jitterFactor: number) {
  const base = Math.max(1, seconds) * 1000
  const jitter = Math.min(Math.max(jitterFactor, 0), 1)
  return Math.round(randBetween(base * (1 - jitter), base * (1 + jitter)))
}

export class ThemeDriftManager implements Manager {
  readonly name = 'ThemeDriftManager'
  readonly bootPriority = 40

  private _status: ManagerStatus = 'idle'
  private timer: ReturnType<typeof setTimeout> | null = null
  private tickCount = 0

  // Last-picked memory per group — avoids immediate repeats. The manager
  // only sees the persisted config (not live runtime overrides), so this
  // is a best-effort "don't repeat last pick", not "don't repeat current".
  private lastTheme: DesktopTheme | null = null
  private lastSkin: WidgetSkinTheme | null = null
  private lastAtmosphereSkin: WidgetSkinTheme | null = null
  private lastIconAnimation: DesktopIconAnimation | null = null
  private lastIconArrangement: DesktopIconArrangement | null = null

  constructor(
    private getConfig: () => AppConfig,
    private bus: KernelBus,
  ) {}

  init(): void { this._status = 'idle' }

  start(): void {
    this._status = 'running'
    this.armTimer()
  }

  stop(): void {
    if (this.timer) { clearTimeout(this.timer); this.timer = null }
    this._status = 'stopped'
  }

  dispose(): void { this.stop() }
  status(): ManagerStatus { return this._status }

  onConfigChange(): void {
    if (this._status !== 'running') return
    this.armTimer()
  }

  private armTimer() {
    if (this.timer) { clearTimeout(this.timer); this.timer = null }
    const config = withDesktopThemeDriftDefaults(this.getConfig().desktopThemeDrift)
    if (!config.enabled) return
    const delay = jitterMs(config.intervalSeconds, config.tickJitterFactor ?? 0.2)
    this.timer = setTimeout(() => this.tick(), delay)
  }

  private tick() {
    this.timer = null
    const config = withDesktopThemeDriftDefaults(this.getConfig().desktopThemeDrift)
    if (!config.enabled) return

    const patch: EventDesktopConfigAction['patch'] = {}
    let widgetTheme: EventDesktopConfigAction['patch']['widgetTheme'] = undefined
    const fired: string[] = []

    if (config.groups.theme.enabled && Math.random() < config.groups.theme.chance) {
      const theme = pickOtherThan(DESKTOP_THEME_IDS, this.lastTheme)
      const skin = pickOtherThan(WIDGET_SKIN_IDS, this.lastSkin)
      if (theme) { patch.theme = theme; this.lastTheme = theme }
      if (skin) {
        widgetTheme = { ...(widgetTheme ?? {}), skin, shape: DEFAULT_WIDGET_THEME_PRESETS[skin].shape }
        this.lastSkin = skin
      }
      fired.push('theme')
    }

    if (config.groups.colors.enabled && Math.random() < config.groups.colors.chance) {
      widgetTheme = { ...(widgetTheme ?? {}), accentColor: randomVividHexColor(), textColor: randomVividHexColor() }
      fired.push('colors')
    }

    if (config.groups.motion.enabled && Math.random() < config.groups.motion.chance) {
      const iconAnimation = pickOtherThan(DESKTOP_ICON_ANIMATION_IDS, this.lastIconAnimation)
      const iconArrangement = pickOtherThan(DESKTOP_ICON_ARRANGEMENT_IDS, this.lastIconArrangement)
      if (iconAnimation) { patch.iconAnimation = iconAnimation; this.lastIconAnimation = iconAnimation }
      if (iconArrangement) { patch.iconArrangement = iconArrangement; this.lastIconArrangement = iconArrangement }
      patch.iconMotion = randBetween(0, 3)
      patch.iconArrangementMotion = randBetween(0, 3)
      fired.push('motion')
    }

    if (config.groups.atmosphere.enabled && Math.random() < config.groups.atmosphere.chance) {
      const sourceSkin = pickOtherThan(WIDGET_SKIN_IDS, this.lastAtmosphereSkin)
      if (sourceSkin) {
        const preset = DEFAULT_WIDGET_THEME_PRESETS[sourceSkin]
        widgetTheme = {
          ...(widgetTheme ?? {}),
          animation: preset.animation,
          atmosphere: preset.atmosphere,
          motionIntensity: preset.motionIntensity,
          glowIntensity: preset.glowIntensity,
          shellOpacity: preset.shellOpacity,
          shadowIntensity: preset.shadowIntensity,
        }
        this.lastAtmosphereSkin = sourceSkin
      }
      fired.push('atmosphere')
    }

    if (widgetTheme) patch.widgetTheme = widgetTheme

    if (fired.length === 0) {
      this.armTimer()
      return
    }

    this.tickCount += 1
    const tickId = `theme-drift-${this.tickCount}`
    logger.info(`[theme-drift] drifting group(s): ${fired.join(', ')}`)

    this.bus.emit('scheduler:fired', {
      eventId: tickId,
      event: {
        id: tickId,
        label: 'Theme Drift',
        icon: '',
        color: '',
        desc: '',
        effects: [],
        actions: [{ kind: 'desktop-config', patch, persistent: true }],
        auto: {
          enabled: false,
          mode: 'interval' as const,
          intervalMin: 0,
          idleMin: 0,
          chance: 1,
          cooldownMin: 0,
        },
      },
    })

    this.armTimer()
  }
}
