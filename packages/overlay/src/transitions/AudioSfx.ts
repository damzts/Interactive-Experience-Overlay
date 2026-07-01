import type { AudioSfxConfig } from '@ieomlabs/shared'

/** AUDIO-SFX — audio-only effect. Actual playback is handled upstream in
 *  signalMap.ts before the effect reaches the registry; this stub exists
 *  to satisfy the import/registration in effects/index.ts. */
export function runAudioSfx(_cfg: AudioSfxConfig) {}
