import type { PersonaConfig } from '@ieomlabs/shared'

/** Flat PersonaConfig fields that are actually per-profile (Config +
 *  Brain) — a profile is Config + Avatar (by reference) + Brain, and these
 *  flat fields are just the active profile's resolved view. Keep in sync
 *  with PersonaProfile's own fields (see @ieomlabs/shared persona.ts). */
const PROFILE_CONFIG_KEYS = [
  'triggerMode', 'triggerValue', 'chance', 'cooldownMs', 'maxChars', 'duckAmount', 'eventLines',
] as const satisfies ReadonlyArray<keyof PersonaConfig>

/** Applies a patch to a persona draft. Identity/behavior edits (voice,
 *  ttsProvider, brain, and the per-profile Config fields: trigger mode,
 *  cooldown, maxChars, duckAmount, eventLines) also land on the active
 *  profile — the flat fields are just its resolved view. `avatar` is
 *  intentionally excluded: avatars are edited in Graphics → Avatar and
 *  referenced by `avatarPresetId`, never patched inline here. Shared by
 *  PersonaPanel, AiPanel, and TtsPanel, which all draft `config.persona`
 *  (never mounted simultaneously; a clean draft re-syncs from the store on
 *  mount). */
export function patchPersonaDraft(prev: PersonaConfig, patch: Partial<PersonaConfig>): PersonaConfig {
  const next = { ...prev, ...patch }
  const touchesProfile =
    patch.voice || patch.brain || 'ttsProvider' in patch || PROFILE_CONFIG_KEYS.some((k) => k in patch)
  if (touchesProfile) {
    next.profiles = next.profiles.map((p) =>
      p.id === next.activeProfileId
        ? {
            ...p,
            ...(patch.voice ? { voice: patch.voice } : null),
            ...(patch.brain ? { brain: patch.brain } : null),
            ...('ttsProvider' in patch ? { ttsProvider: patch.ttsProvider } : null),
            ...Object.fromEntries(
              PROFILE_CONFIG_KEYS.filter((k) => k in patch).map((k) => [k, patch[k]]),
            ),
          }
        : p,
    )
  }
  return next
}
