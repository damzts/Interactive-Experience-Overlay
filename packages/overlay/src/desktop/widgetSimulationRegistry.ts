import type { Application } from '@ieom/shared'

export interface WidgetSimulationRecipe {
  menuPath: (app: Application) => string[]
}

const DEFAULT_RECIPE: WidgetSimulationRecipe = {
  menuPath: (app) => ['Programs', app.label],
}

const RECIPES: Partial<Record<string, Partial<WidgetSimulationRecipe>>> = {
  browser: {
    menuPath: (app) => ['Programs', app.label],
  },
}

export function getWidgetSimulationRecipe(app: Application): WidgetSimulationRecipe {
  const override = RECIPES[app.id]
  return {
    menuPath: override?.menuPath ?? DEFAULT_RECIPE.menuPath,
  }
}
