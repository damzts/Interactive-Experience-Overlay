import type { CaptureSource } from '@ieomlabs/shared'
import type { AppConfig } from '@ieomlabs/shared'
import { patchConfig } from './configApi'

/**
 * Persist the full captureSources list.
 * Requires the current persisted config to correctly compute the PATCH delta.
 * Prefer calling saveConfig({ captureSources }) via the admin store instead,
 * which manages the current config reference automatically.
 */
export async function saveCaptureSources(currentConfig: AppConfig, sources: CaptureSource[]): Promise<void> {
  await patchConfig(currentConfig, { captureSources: sources })
}
