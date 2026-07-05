import type { Application, WidgetSimulationIntentPayload } from '@ieomlabs/shared'

export interface WidgetInteractionStep {
  selectors: string[]
  intentKind?: WidgetSimulationIntentPayload['kind']
  weight?: number
  moveMinMs?: number
  moveMaxMs?: number
  postDelayMinMs?: number
  postDelayMaxMs?: number
}

export interface WidgetSimulationRecipe {
  menuPath: (app: Application) => string[]
  interactionPlan: WidgetInteractionStep[]
  interactionChance: number
}

const DEFAULT_RECIPE: WidgetSimulationRecipe = {
  menuPath: (app) => ['Programs', app.label],
  interactionPlan: [],
  interactionChance: 0.65,
}

const RECIPES: Partial<Record<string, Partial<WidgetSimulationRecipe>>> = {
  browser: {
    menuPath: () => ['Programs', 'GALLERY.exe'],
    interactionPlan: [
      { selectors: ['button[data-sim-action="gallery-play"]'], intentKind: 'gallery:next', weight: 0.4 },
      { selectors: ['button[data-sim-action="gallery-next"]'], intentKind: 'gallery:next', weight: 0.4 },
      { selectors: ['button[data-sim-action="gallery-prev"]'], intentKind: 'gallery:previous', weight: 0.2 },
    ],
    interactionChance: 0.85,
  },
  gallery: {
    menuPath: (app) => ['Programs', app.label],
    interactionPlan: [
      { selectors: ['button[data-sim-action="gallery-play"]'], intentKind: 'gallery:next', weight: 0.4 },
      { selectors: ['button[data-sim-action="gallery-next"]'], intentKind: 'gallery:next', weight: 0.4 },
      { selectors: ['button[data-sim-action="gallery-prev"]'], intentKind: 'gallery:previous', weight: 0.2 },
    ],
    interactionChance: 0.85,
  },
  music: {
    menuPath: (app) => ['Programs', app.label],
    interactionPlan: [
      { selectors: ['button[data-sim-action="music-play"]'], intentKind: 'music:play-pause', weight: 0.45 },
      { selectors: ['button[data-sim-action="music-next"]'], intentKind: 'music:next', weight: 0.35 },
      { selectors: ['button[data-sim-action="music-prev"]'], intentKind: 'music:prev', weight: 0.2 },
    ],
    interactionChance: 0.8,
  },
  spotify: {
    menuPath: (app) => ['Programs', app.label],
    interactionPlan: [
      { selectors: ['button[data-sim-action="music-play"]'], intentKind: 'music:play-pause', weight: 0.55 },
      { selectors: ['button[data-sim-action="music-next"]'], intentKind: 'music:next', weight: 0.45 },
    ],
    interactionChance: 0.8,
  },
  chat: {
    menuPath: (app) => ['Programs', app.label],
    interactionPlan: [
      { selectors: ['button[data-sim-action="chat-send"]'], intentKind: 'chat:add-message', weight: 1 },
    ],
    interactionChance: 0.6,
  },
  'sticky-notes': {
    menuPath: (app) => ['Programs', app.label],
    interactionPlan: [
      {
        selectors: [
          'button[data-sim-action="sticky-color-fff2a8"]',
          'button[data-sim-action="sticky-color-ffd3e0"]',
          'button[data-sim-action="sticky-color-d8f8d0"]',
          'button[data-sim-action="sticky-color-cde8ff"]',
        ],
        intentKind: 'sticky:set-color',
        weight: 1,
      },
    ],
    interactionChance: 0.55,
  },
}

export function getWidgetSimulationRecipe(app: Application): WidgetSimulationRecipe {
  const override = RECIPES[app.id]
  return {
    menuPath: override?.menuPath ?? DEFAULT_RECIPE.menuPath,
    interactionPlan: override?.interactionPlan ?? DEFAULT_RECIPE.interactionPlan,
    interactionChance: override?.interactionChance ?? DEFAULT_RECIPE.interactionChance,
  }
}

export function pickWidgetInteractionStep(recipe: WidgetSimulationRecipe): WidgetInteractionStep | null {
  const steps = recipe.interactionPlan
  if (!steps.length) return null
  const weights = steps.map((step) => Math.max(0.01, step.weight ?? 1))
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0)
  let target = Math.random() * totalWeight
  for (let i = 0; i < steps.length; i++) {
    target -= weights[i]
    if (target <= 0) return steps[i]
  }
  return steps[steps.length - 1]
}

export function getWidgetInteractionStepForIntent(
  app: Application,
  intent: WidgetSimulationIntentPayload,
): WidgetInteractionStep | null {
  const recipe = getWidgetSimulationRecipe(app)

  // Param-carrying intents can target the exact control (e.g. the matching
  // color swatch) so cursor theater and widget state agree.
  const color = typeof intent.params?.color === 'string' ? intent.params.color : null
  if (intent.kind === 'sticky:set-color' && color) {
    return {
      selectors: [`button[data-sim-action="sticky-color-${color.replace('#', '')}"]`],
      intentKind: intent.kind,
    }
  }

  const step = recipe.interactionPlan.find((candidate) => candidate.intentKind === intent.kind)
  return step ?? null
}
