/**
 * Returns the default AppConfig for fresh installs.
 * Assembled from TypeScript declarations in @ieomlabs/shared — no JSON file read.
 *
 * @deprecated data/fixtures/default-config.json is no longer read or used.
 * Use DEFAULT_CONFIG from @ieomlabs/shared directly when you need the raw constant.
 */
import type { AppConfig } from '@ieomlabs/shared'
import { bootstrapConfig } from './bootstrapConfig.js'

let _cached: AppConfig | null = null

/** Returns the default AppConfig, assembled from TypeScript declarations. */
export function loadDefaultConfig(): AppConfig {
  if (_cached) return _cached
  _cached = bootstrapConfig()
  return _cached
}
