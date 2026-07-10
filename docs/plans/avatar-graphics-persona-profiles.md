# Plan: Move Avatar into Graphics, restructure Persona into Profile cards

Status: **plan only — not implemented**. Written per user request to scope
the work before touching code, since it changes the Persona data model
(Brain becomes per-profile) and moves ownership of Avatar config out of
Ambiance → Persona into Graphics.

## Current state (as of this session)

- `PersonaConfig` (packages/shared/src/domain/persona.ts) holds:
  - Shared/global fields: `enabled`, `triggerMode`, `cooldownMs`, `maxChars`,
    `duckAmount`, `eventLines` — behavior, not identity.
  - `profiles: PersonaProfile[]` — each profile is `{ id, name, ttsProvider,
    voice, avatar }`. Voice + Avatar are per-profile today; **Brain is not**.
  - `brain: PersonaBrainConfig` — a single global LLM config (provider,
    model, personality, replyToViewers, summaries, etc.), independent of
    which profile is active.
  - `activeProfileId` + flattened `voice`/`avatar`/`ttsProvider` fields,
    resolved by `withPersonaDefaults()` for convenience — consumers (overlay,
    effects) read the flat fields, never `profiles` directly.
- `PersonaPanel.tsx` (Ambiance → Persona) renders, top to bottom: Profiles
  (switch/rename/add/delete), Persona (trigger/cooldown/voice — the shared
  behavior fields), Avatar (images/mode/corner/size — now always-on per the
  previous fix), Brain (global), Console (chat with the persona).
- Avatar image picking (`AvatarSection`) lives inline in `PersonaPanel.tsx`,
  scanning `assets/persona/` via `getPersonaAvatarImages()`.
- Graphics (top nav) → `MediaLibraryPanel` with tabs `sources` (renderers),
  `events`, `catalog` (gallery), managed by `MediaLibraryContext` using a
  per-tab-state pattern (`SourcesTabState`, `EventsTabState`,
  `CatalogTabState`) composed into one context value.
- `SelectedItem` (`dashboard/types.ts`) has `{ kind: 'graphics' }` with no
  sub-tab param — `RightPane.tsx` always opens `MediaLibraryPanel
  tab="sources"` for it.

## Target end state

1. **Avatar creation/configuration lives in Graphics → Avatar**, a new tab
   alongside Renderers/Events/Gallery — this is where someone builds a
   reusable avatar (pick pose images, mode, corner, size, linger). Avatars
   become named, savable, reusable assets — not something edited inline
   per-persona-profile.
2. **A Persona Profile = Config + Avatar + Brain**, selected as a unit:
   - Config: the trigger/cooldown/maxChars/duckAmount/voice fields (today's
     "shared" fields, now scoped per profile instead of global).
   - Avatar: a *reference* to one of the Graphics → Avatar presets (not an
     inline editor — editing happens in Graphics).
   - Brain: becomes per-profile instead of global, so different profiles
     can have different personalities/providers.
3. **Ambiance → Persona shows Profile cards** — a grid of saved profiles
   (name + avatar thumbnail + brain provider badge), tap to activate,
   similar visual language to the Dashboard's tap-cards. Editing a profile's
   Config/Brain happens in an editor reached from the card; editing its
   Avatar redirects to Graphics → Avatar.

## Data model changes (packages/shared)

- **New `AvatarPreset` domain type** (packages/shared/src/domain/persona.ts
  or a new `avatar.ts`): `{ id, name, mode, images, corner, widthPx,
  lingerMs }` — this is today's `PersonaAvatarConfig` minus the "belongs to
  a persona profile" framing, plus `id`/`name` so it can be referenced and
  listed. Lives at `AppConfig.avatarPresets: AvatarPreset[]` (new top-level
  section, sibling to `widgetLayouts`/`windowPresets`), *not* nested under
  `persona`, since Graphics owns it and Persona only references it.
- **`PersonaProfile` gains `brain: PersonaBrainConfig` and drops the inline
  `avatar` object in favor of `avatarPresetId?: string`.** Resolution
  (`withPersonaDefaults`) flattens the referenced avatar preset the same way
  it already flattens voice — if `avatarPresetId` is unset or the preset was
  deleted, fall back to "no avatar" (empty images), consistent with the
  existing "empty images = avatar never shows" rule.
- **`PersonaConfig.brain` is removed** (moves fully into each profile).
  `PersonaConfig` keeps only the genuinely shared/global fields: `enabled`,
  `triggerMode`, `triggerValue`, `chance`, `cooldownMs`, `maxChars`,
  `duckAmount`, `eventLines`, `profiles`, `activeProfileId`. The flattened
  convenience fields (`voice`, `avatar`, `ttsProvider`, and now `brain`)
  stay flattened onto `PersonaConfig` by `withPersonaDefaults` for backward
  compatibility with existing consumers (overlay reads `persona.brain`,
  `persona.avatar`, etc. today) — only the *source of truth* moves to the
  active profile.
- **Migration**: `withPersonaDefaults` already synthesizes a `default`
  profile from legacy flat fields when `profiles` is empty. Extend that
  synthesis to (a) lift the current global `brain` onto that synthesized
  profile, and (b) convert the current inline `avatar` into an
  `AvatarPreset` entry seeded into `AppConfig.avatarPresets` (id `default`),
  referenced via `avatarPresetId: 'default'`. This keeps existing configs
  working with no manual migration step — done once, lazily, the first time
  `withPersonaDefaults` sees a pre-migration shape (detect via a version
  marker or absence of `avatarPresetId`/`brain` on profiles).
- Effect config (`PersonaAvatarEffectConfig`) and the overlay's
  `resolveConfig()` in `PersonaAvatar.ts` are unaffected — they already
  resolve against `persona.avatar` (the flattened field), which keeps
  working since resolution still produces that shape.

## UI changes

### Graphics → Avatar (new tab)

- Add `'avatar'` to `MediaLibraryTab` union and `LIBRARY_TABS` in
  `MediaLibraryPanel.tsx`.
- New `AvatarTabState` in `MediaLibraryContext.tsx` following the existing
  per-tab pattern: list of `avatarPresets`, selected preset, draft editing
  state, save/delete — mirroring `SourcesTabState`'s
  select/draft/save/delete shape (avatar presets are conceptually close to
  window presets: named, reusable, referenced elsewhere).
- New `AvatarTab.tsx` (sidebar list of saved avatar presets + a detail
  editor pane) reusing the existing `AvatarSection` UI body (pose picker,
  mode/corner/width/linger sliders) currently in `PersonaPanel.tsx` — move
  that component here essentially unchanged, just re-parented from
  "editing `PersonaConfig.avatar`" to "editing an `AvatarPreset` draft".
- Delete `AvatarSection` and its usage from `PersonaPanel.tsx`.

### Ambiance → Persona (profile cards)

- Replace `ProfilesSection`'s single active-profile switcher/renamer with a
  card grid (reuse the Dashboard's compact `Tile`-like pattern: name +
  avatar preset thumbnail + brain provider badge, tap-to-activate, an
  "Edit" affordance opens the profile editor, a separate small action opens
  Graphics → Avatar for the avatar piece specifically).
- Profile editor (opened from a card) shows: Config fields (today's
  `PersonaSection` body — trigger/cooldown/voice/eventLines, now scoped to
  this profile instead of global `draft` fields), an Avatar picker that is
  a **reference selector** (dropdown/grid of `avatarPresets` by name +
  thumbnail, with a link/button "Create/edit in Graphics → Avatar" instead
  of an inline image picker), and the Brain section (moved in mostly as-is,
  now reading/writing this profile's `brain` instead of the global one).
- `ConsoleSection` (chat with the persona) stays global/unscoped — it
  already just talks to whichever profile is currently active server-side,
  no change needed there.
- Top-level `PersonaPanel` intro copy updates to describe profiles as the
  unit of configuration.

### Routing

- `SelectedItem` kind `'graphics'` gains an optional `tab?: MediaLibraryTab`
  so Persona's "create/edit in Graphics → Avatar" link can deep-link
  straight to the Avatar tab (`{ kind: 'graphics', tab: 'avatar' }`) instead
  of always landing on Renderers. `RightPane.tsx`'s
  `<MediaLibraryPanel tab="sources" />` call becomes
  `tab={selected.tab ?? 'sources'}`.

## Server / persistence

- `AppConfig` (packages/shared/src/domain/config.ts) gains
  `avatarPresets?: AvatarPreset[]`. Server-side config manager
  (`packages/server/src/kernel/managers/config.ts`) needs no special
  handling beyond the existing generic patch/save path, same as
  `widgetLayouts`/`windowPresets` today — confirm during implementation
  that nothing there special-cases known section keys in a way that would
  silently drop an unrecognized new key.
- `PresetsPanel.tsx`'s `SECTION_OPTIONS` list (Settings → Presets) should
  gain an `avatarPresets` entry so avatar presets can be included in saved
  config presets/export bundles, consistent with how `widgetLayouts` is
  already listed there.

## Backward compatibility / risk

- Existing saved configs have `persona.avatar` (inline) and `persona.brain`
  (global) — the lazy migration in `withPersonaDefaults` must handle both
  the pre-profile legacy shape (no `profiles` at all, handled today) and
  the "has profiles but no per-profile brain/avatarPresetId" intermediate
  shape (today's actual production shape) without data loss.
- `getPersonaAvatarImages()` (scans `assets/persona/`) is unaffected — it
  still just lists files on disk; only who calls it moves (Graphics →
  Avatar tab instead of Ambiance → Persona).
- The `persona-avatar` effect type and its admin-side editor (wherever
  events/effects let an operator pick a `persona-avatar` effect config)
  should be checked for any place that assumes a single global avatar
  config shape — likely fine since it already resolves through
  `withPersonaDefaults(...).avatar`, but needs a pass during implementation.

## Suggested implementation order

1. Shared: add `AvatarPreset` type, `AppConfig.avatarPresets`, extend
   `PersonaProfile` with `brain` + `avatarPresetId`, update
   `withPersonaDefaults` migration logic + tests.
2. Graphics: add Avatar tab (context state, sidebar, editor UI reusing
   `AvatarSection`'s body).
3. Ambiance → Persona: profile cards UI, profile editor (Config + Brain +
   avatar-preset reference), remove old global Brain/Avatar sections.
4. Wire `SelectedItem.tab` deep link from Persona → Graphics → Avatar.
5. Add `avatarPresets` to Settings → Presets section list.
6. Regression pass: persona:speak flow, persistent-mode avatar, profile
   switch/add/delete, preset export/import including avatar presets.
