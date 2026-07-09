import { describe, it, expect } from 'vitest'
import {
  DEFAULT_CONFIG,
  DEFAULT_DESKTOP_AMBIANCE_CONFIG,
  mergeAppConfig,
  applyRuntimeConfig,
  withDesktopConfigDefaults,
  withDesktopAmbianceDefaults,
  withPersonaDefaults,
} from '../defaults.js'
import type { AppConfig } from '../../domain/config.js'

function clone<T>(value: T): T {
  return structuredClone(value)
}

describe('withDesktopConfigDefaults', () => {
  it('returns a fully-populated DesktopConfig from nothing', () => {
    const result = withDesktopConfigDefaults(undefined)
    expect(result.globalThemeDefault).toBeDefined()
    expect(result.recycleBin).toBeDefined()
    expect(result.systemSounds).toBeDefined()
  })

  it('preserves provided values while filling gaps', () => {
    const base = withDesktopConfigDefaults(undefined)
    const result = withDesktopConfigDefaults({ recycleBin: { ...base.recycleBin, fullOnStart: !base.recycleBin.fullOnStart } })
    expect(result.recycleBin.fullOnStart).toBe(!base.recycleBin.fullOnStart)
  })

  it('is idempotent', () => {
    const once = withDesktopConfigDefaults(undefined)
    const twice = withDesktopConfigDefaults(once)
    expect(twice).toEqual(once)
  })
})

describe('withDesktopAmbianceDefaults', () => {
  it('fills widgetSimulation from defaults', () => {
    const result = withDesktopAmbianceDefaults(null)
    expect(result.widgetSimulation).toEqual(DEFAULT_DESKTOP_AMBIANCE_CONFIG.widgetSimulation)
  })

  it('deep-merges partial widgetSimulation', () => {
    const result = withDesktopAmbianceDefaults({ widgetSimulation: { enabled: true } as never })
    expect(result.widgetSimulation.enabled).toBe(true)
    expect(result.widgetSimulation.intervalSeconds).toBe(DEFAULT_DESKTOP_AMBIANCE_CONFIG.widgetSimulation.intervalSeconds)
  })

  it('is idempotent', () => {
    const once = withDesktopAmbianceDefaults(undefined)
    expect(withDesktopAmbianceDefaults(once)).toEqual(once)
  })
})

describe('mergeAppConfig', () => {
  it('with empty updates keeps every section of the base config', () => {
    const base = clone(DEFAULT_CONFIG)
    const merged = mergeAppConfig(base, {})
    expect(merged.scenes).toEqual(base.scenes)
    expect(merged.applications).toEqual(base.applications)
    expect(merged.keybinds).toEqual(base.keybinds)
    expect(merged.obs).toEqual(base.obs)
    expect(merged.audio).toEqual(base.audio)
    expect(merged.widgetLayouts).toEqual(base.widgetLayouts)
    expect(merged.sourceMedia).toEqual(base.sourceMedia)
  })

  it('is idempotent over empty merges', () => {
    const once = mergeAppConfig(clone(DEFAULT_CONFIG), {})
    const twice = mergeAppConfig(clone(once), {})
    expect(twice).toEqual(once)
  })

  it('replaces list sections wholesale but deep-merges nested config sections', () => {
    const base = mergeAppConfig(clone(DEFAULT_CONFIG), {})
    const merged = mergeAppConfig(base, {
      applications: [],
      obs: { ...base.obs, enabled: !base.obs?.enabled } as AppConfig['obs'],
    })
    expect(merged.applications).toEqual([])
    expect(merged.obs?.enabled).toBe(!base.obs?.enabled)
    expect(merged.scenes).toEqual(base.scenes)
  })

  it('injects desktopConfig defaults even when base has none', () => {
    const base = clone(DEFAULT_CONFIG)
    delete (base as Partial<AppConfig>).desktopConfig
    const merged = mergeAppConfig(base as AppConfig, {})
    expect(merged.desktopConfig?.recycleBin).toBeDefined()
    expect(merged.desktopConfig?.globalThemeDefault).toBeDefined()
  })

  it('deep-merges a partial desktopConfig update without dropping siblings', () => {
    const base = mergeAppConfig(clone(DEFAULT_CONFIG), {})
    const globalThemeDefault = base.desktopConfig!.globalThemeDefault
    const merged = mergeAppConfig(base, {
      desktopConfig: { recycleBin: { ...base.desktopConfig!.recycleBin, fullOnStart: true } } as never,
    })
    expect(merged.desktopConfig?.recycleBin.fullOnStart).toBe(true)
    expect(merged.desktopConfig?.globalThemeDefault).toEqual(globalThemeDefault)
  })

  it('preserves unknown/passthrough sections from base via spread', () => {
    const base = { ...mergeAppConfig(clone(DEFAULT_CONFIG), {}), automationRules: [{ id: 'r1' }] } as AppConfig
    const merged = mergeAppConfig(base, {})
    expect((merged as Record<string, unknown>).automationRules).toEqual([{ id: 'r1' }])
  })
})

describe('applyRuntimeConfig', () => {
  it('returns base untouched for an empty runtime config', () => {
    const base = mergeAppConfig(clone(DEFAULT_CONFIG), {})
    expect(applyRuntimeConfig(base, {})).toBe(base)
  })

  it('applies widget position overrides without mutating other apps', () => {
    const base = mergeAppConfig(clone(DEFAULT_CONFIG), {})
    if (base.applications.length === 0) return
    const target = base.applications[0]!
    const result = applyRuntimeConfig(base, { widgetPositions: { [target.id]: { x: 42, y: 24 } } })
    const moved = result.applications.find((a) => a.id === target.id)
    expect(moved?.windowPosition).toEqual({ x: 42, y: 24 })
    for (const app of result.applications.filter((a) => a.id !== target.id)) {
      const original = base.applications.find((a) => a.id === app.id)
      expect(app.windowPosition).toEqual(original?.windowPosition)
    }
  })
})

describe('withPersonaDefaults profiles', () => {
  it('synthesizes a default profile from legacy flat fields', () => {
    const result = withPersonaDefaults({
      voice: { pitchSemitones: 7, roboticIntensity: 0.2, rate: 1, ttsVoice: 'Zira' },
    })
    expect(result.profiles).toHaveLength(1)
    expect(result.profiles[0].id).toBe('default')
    expect(result.profiles[0].voice.pitchSemitones).toBe(7)
    expect(result.activeProfileId).toBe('default')
    expect(result.voice.ttsVoice).toBe('Zira')
  })

  it('flattens the active profile onto voice/avatar/ttsProvider', () => {
    const result = withPersonaDefaults({
      voice: { pitchSemitones: 0, roboticIntensity: 0, rate: 0 },
      profiles: [
        { id: 'a', name: 'A', voice: { pitchSemitones: 1, roboticIntensity: 0.1, rate: 0 }, avatar: { enabled: true, mode: 'pop-in', images: ['/assets/persona/a.webp'], corner: 'bottom-left', widthPx: 200, lingerMs: 1000 } },
        { id: 'b', name: 'B', ttsProvider: 'piper', voice: { pitchSemitones: -2, roboticIntensity: 0.9, rate: 3, ttsVoice: 'David' }, avatar: { enabled: false, mode: 'persistent', images: [], corner: 'top-right', widthPx: 300, lingerMs: 0 } },
      ],
      activeProfileId: 'b',
    })
    expect(result.voice.pitchSemitones).toBe(-2)
    expect(result.voice.ttsVoice).toBe('David')
    expect(result.ttsProvider).toBe('piper')
    expect(result.avatar.mode).toBe('persistent')
    expect(result.avatar.corner).toBe('top-right')
  })

  it('falls back to the first profile when activeProfileId is stale', () => {
    const result = withPersonaDefaults({
      profiles: [
        { id: 'only', name: 'Only', voice: { pitchSemitones: 5, roboticIntensity: 0.5, rate: 0 }, avatar: { enabled: true, mode: 'pop-in', images: [], corner: 'bottom-right', widthPx: 260, lingerMs: 4000 } },
      ],
      activeProfileId: 'deleted-profile',
    })
    expect(result.activeProfileId).toBe('only')
    expect(result.voice.pitchSemitones).toBe(5)
  })

  it('is idempotent', () => {
    const once = withPersonaDefaults({ activeProfileId: 'default' })
    const twice = withPersonaDefaults(once)
    expect(twice).toEqual(once)
  })
})
