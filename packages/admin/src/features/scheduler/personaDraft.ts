import type { PersonaConfig } from '@ieomlabs/shared'

/** Applies a patch to a persona draft. Identity edits (voice / avatar /
 *  ttsProvider) also land on the active profile — the flat fields are just
 *  its resolved view. Shared by PersonaPanel, AiPanel, and TtsPanel, which
 *  all draft `config.persona` (never mounted simultaneously; a clean draft
 *  re-syncs from the store on mount). */
export function patchPersonaDraft(prev: PersonaConfig, patch: Partial<PersonaConfig>): PersonaConfig {
  const next = { ...prev, ...patch }
  if (patch.voice || patch.avatar || 'ttsProvider' in patch) {
    next.profiles = next.profiles.map((p) =>
      p.id === next.activeProfileId
        ? {
            ...p,
            ...(patch.voice ? { voice: patch.voice } : null),
            ...(patch.avatar ? { avatar: patch.avatar } : null),
            ...('ttsProvider' in patch ? { ttsProvider: patch.ttsProvider } : null),
          }
        : p,
    )
  }
  return next
}
