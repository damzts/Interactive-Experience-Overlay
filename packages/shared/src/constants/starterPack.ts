import type { EventConfig } from '../domain/event.js'
import type { WidgetLayoutDefinition } from '../domain/application.js'
import type { ChatReactionRule } from '../domain/config.js'
import type { EffectConfig } from '../contracts/effects.js'

/**
 * Starter content pack — a small set of clearly-named ("Example: …"),
 * deletable example rows for events, a widget layout, and a chat reaction,
 * offered via a "Load starter pack" action on empty states rather than
 * seeded into DEFAULT_CONFIG. This way it never pollutes existing installs
 * (loading is opt-in and additive — call sites merge these onto whatever
 * the operator already has) while still making a fresh install feel alive
 * instead of a blank slate.
 *
 * One saved ConfigPreset snapshotting this content is created by the admin
 * caller (see loadStarterPack in @ieom/admin) after these sections are
 * merged in — the preset itself has no config shape of its own to build
 * here, just a label.
 */

export const STARTER_PACK_PRESET_LABEL = 'Example: Starter Snapshot'

function friendJoinEffect(): EffectConfig {
  return {
    type: 'friend-join',
    delay: 0,
    cfg: { username: 'Player_001', tagline: 'just followed!', durationMs: 3500 },
  } as EffectConfig
}

function starfallEffect(): EffectConfig {
  return {
    type: 'starfall',
    delay: 0,
    cfg: { count: 12, colors: ['#ffffff', '#8df6ff', '#ffe14a', '#ff88ff'], duration: 4 },
  } as EffectConfig
}

export function buildStarterEvents(): EventConfig[] {
  return [
    {
      id: 'example-follow-celebration',
      label: 'Example: Follow Celebration',
      icon: '🎉',
      color: 'text-cyan-400',
      desc: 'A friend-join slide-in for new followers. Wire this to your Twitch follow reaction, or fire it manually to test.',
      effects: [friendJoinEffect()],
      auto: { enabled: false, mode: 'interval', intervalMin: 15, idleMin: 5, chance: 1, cooldownMin: 0 },
    },
    {
      id: 'example-ambient-sparkle',
      label: 'Example: Ambient Sparkle',
      icon: '✨',
      color: 'text-fuchsia-400',
      desc: 'A quiet shooting-star drift meant to auto-fire occasionally and keep the desktop feeling alive between bigger moments.',
      effects: [starfallEffect()],
      auto: { enabled: true, mode: 'idle', intervalMin: 15, idleMin: 4, chance: 0.5, cooldownMin: 6 },
    },
  ]
}

export function buildStarterWidgetLayouts(): WidgetLayoutDefinition[] {
  return [
    {
      id: 'example-stream-essentials',
      label: 'Example: Stream Essentials',
      icon: '🗂️',
      source: 'user',
      description: 'Chat + music side by side — a starting point for your own layout presets.',
      items: [
        { widgetId: 'chat', enabled: true, focusPriority: 1, x: 1440, y: 80, width: 440, height: 640 },
        { widgetId: 'music', enabled: true, focusPriority: 0, x: 1440, y: 760, width: 440, height: 220 },
      ],
    },
  ]
}

export function buildStarterChatReactions(): ChatReactionRule[] {
  return [
    {
      id: 'example-hype-command',
      label: 'Example: !hype command',
      enabled: false,
      match: { type: 'command', value: 'hype' },
      effects: [starfallEffect()],
      cooldownMs: 15000,
    },
  ]
}

export interface StarterPackSections {
  sourceEvents: EventConfig[]
  widgetLayouts: WidgetLayoutDefinition[]
  chatReactions: ChatReactionRule[]
}

/** Builds the full set of starter-pack AppConfig sections. Callers merge
 *  these onto the existing config (additive — never replaces existing rows)
 *  and typically also save a ConfigPreset snapshot under
 *  STARTER_PACK_PRESET_LABEL covering the same section keys. */
export function buildStarterPackSections(): StarterPackSections {
  return {
    sourceEvents: buildStarterEvents(),
    widgetLayouts: buildStarterWidgetLayouts(),
    chatReactions: buildStarterChatReactions(),
  }
}
