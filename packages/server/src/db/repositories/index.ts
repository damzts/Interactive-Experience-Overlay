/**
 * Repository index — exports all repositories and provides a factory
 * to instantiate the full set of tenant-scoped repositories from a Pool.
 */

import type { Pool } from 'pg'

import { AmbianceRepository } from './AmbianceRepository.js'
import { ApplicationRepository } from './ApplicationRepository.js'
import { AudioConfigRepository } from './AudioConfigRepository.js'
import { DesktopRepository } from './DesktopRepository.js'
import { EventRepository } from './EventRepository.js'
import { KeybindRepository } from './KeybindRepository.js'
import { MediaRepository } from './MediaRepository.js'
import { ObsConfigRepository } from './ObsConfigRepository.js'
import { OnlineConfigRepository } from './onlineConfigRepo.js'
import { OverlayStyleRepository } from './OverlayStyleRepository.js'
import { PovConfigRepository } from './povConfigRepo.js'
import { PovFeedsRepository } from './povFeedsRepo.js'
import { SceneRepository } from './SceneRepository.js'
import { SourcePresetRepository } from './SourcePresetRepository.js'
import { UserRepository } from './UserRepository.js'

// Re-export all repository classes
export { AmbianceRepository } from './AmbianceRepository.js'
export { ApplicationRepository } from './ApplicationRepository.js'
export { AudioConfigRepository } from './AudioConfigRepository.js'
export { DesktopRepository } from './DesktopRepository.js'
export { EventRepository } from './EventRepository.js'
export { KeybindRepository } from './KeybindRepository.js'
export { MediaRepository } from './MediaRepository.js'
export { ObsConfigRepository } from './ObsConfigRepository.js'
export { OnlineConfigRepository } from './onlineConfigRepo.js'
export { OverlayStyleRepository } from './OverlayStyleRepository.js'
export { PovConfigRepository } from './povConfigRepo.js'
export { PovFeedsRepository } from './povFeedsRepo.js'
export { SceneRepository } from './SceneRepository.js'
export { SourcePresetRepository } from './SourcePresetRepository.js'
export { UserRepository } from './UserRepository.js'

/**
 * Bundles all tenant-scoped repositories (excludes UserRepository which is not tenant-scoped).
 * Each repository is instantiated with a shared Pool and scopes queries by user_id.
 */
export interface TenantRepositories {
  scene: SceneRepository
  application: ApplicationRepository
  desktop: DesktopRepository
  event: EventRepository
  keybind: KeybindRepository
  obsConfig: ObsConfigRepository
  audioConfig: AudioConfigRepository
  overlayStyle: OverlayStyleRepository
  ambiance: AmbianceRepository
  sourcePreset: SourcePresetRepository
  media: MediaRepository
  povConfig: PovConfigRepository
  povFeeds: PovFeedsRepository
  onlineConfig: OnlineConfigRepository
}

/**
 * Creates all tenant-scoped repository instances from a single Pool.
 * Use this at server startup to wire up the data layer.
 */
export function createTenantRepositories(pool: Pool): TenantRepositories {
  return {
    scene: new SceneRepository(pool),
    application: new ApplicationRepository(pool),
    desktop: new DesktopRepository(pool),
    event: new EventRepository(pool),
    keybind: new KeybindRepository(pool),
    obsConfig: new ObsConfigRepository(pool),
    audioConfig: new AudioConfigRepository(pool),
    overlayStyle: new OverlayStyleRepository(pool),
    ambiance: new AmbianceRepository(pool),
    sourcePreset: new SourcePresetRepository(pool),
    media: new MediaRepository(pool),
    povConfig: new PovConfigRepository(pool),
    povFeeds: new PovFeedsRepository(pool),
    onlineConfig: new OnlineConfigRepository(pool),
  }
}
