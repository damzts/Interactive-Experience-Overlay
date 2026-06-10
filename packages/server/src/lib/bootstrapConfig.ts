/**
 * Assembles the default AppConfig from TypeScript declarations.
 *
 * This replaces the data/fixtures/default-config.json artifact.
 * DEFAULT_CONFIG in @ieomlabs/shared is the authoritative source for all defaults.
 * The applications array is cross-checked against WIDGET_DEFINITIONS to ensure
 * every system widget definition has a corresponding Application entry.
 */
import { DEFAULT_CONFIG, WIDGET_DEFINITIONS } from '@ieomlabs/shared'
import type { AppConfig } from '@ieomlabs/shared'

export function bootstrapConfig(): AppConfig {
  return DEFAULT_CONFIG as unknown as AppConfig
}

/**
 * Returns the IDs of all system widgets declared in WIDGET_DEFINITIONS
 * that are missing from the DEFAULT_CONFIG applications array.
 * Used for integrity checks — should always return an empty array in a healthy codebase.
 */
export function findMissingDefaultApplications(): string[] {
  const existingIds = new Set(DEFAULT_CONFIG.applications.map((a) => a.id))
  return WIDGET_DEFINITIONS
    .filter((d) => d.system && !existingIds.has(d.id))
    .map((d) => d.id)
}
