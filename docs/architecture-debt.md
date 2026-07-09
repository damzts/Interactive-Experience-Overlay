# Architecture Debt Assessment — Gap Analysis Against the Lego Vision

> **Purpose.** IEOM's goal is a solid core engine with lego-style composability: unique
> effects/interactions/automation cheap to create, easy feature expansion, easy art-style
> pivots, and features that couple/decouple freely. This doc is an honest retrospective of
> where the current architecture serves that goal and where it fights it, with a phased
> consolidation roadmap. It is the reference for future refactor sessions.
>
> **Written:** 2026-07-05. Line counts and file paths were verified on that date; treat them
> as evidence snapshots, not living facts. If this doc contradicts the code, the code wins.
>
> **Compat stance for the roadmap:** breaking changes to persisted data (SQLite rows, saved
> config) are acceptable. Solo operator; the DB can be reset or hand-fixed after a phase lands.

---

## The one-sentence diagnosis

The right idea — **a self-describing manifest plus a generic dispatcher** — already exists in
this repo several times (`RENDERER_CATALOG`, `AutomationRule`, the effect dispatch registry,
`BusFrame` + `onAny`), but the older subsystems were never retrofitted onto it. The debt is
**consolidation, not rewrite**. Nothing below proposes new architecture; every fix direction
points at a pattern that already ships in the codebase.

---

## 1. What is already right — keep these, and consolidate *onto* them

| Asset | Where | Why it's the lego pattern |
|---|---|---|
| Kernel/userspace split | `packages/server` / `packages/overlay` | Kernel decides, overlay renders. The split itself has held up. |
| `Manager` interface + `bootPriority` + declaration-merged `*.signals.ts` | `shared/src/contracts/manager.ts`, `server/src/kernel/managers/` | New kernel subsystems plug in without editing `bus.ts` or each other. |
| Repository layer + per-section config writes | `server/src/db/repositories/`, `config_store` | Persistence is already decoupled from orchestration. |
| **`RENDERER_CATALOG`** — the reference pattern | `shared/src/domain/plugin.ts` | Entries self-describe `fields` (schema → admin UI is *generated*), `defaults`, `emits`/`accepts` (→ automation vocabulary). Adding a renderer = 3 files, **zero admin code**. This is what every other extension point should look like. |
| Unified `AutomationRule` | `shared/src/contracts/automation.ts` | One shape for any signal → any action; deterministic overlay/server evaluation split; single-hop `signal:emit` loop guard. |
| Effect dispatch registry | `overlay/src/effects/registry.ts` | String-keyed, hot-swappable, concurrency-budgeted. The *dispatch* side of effects is already generic. |
| `BusFrame` envelope + `KernelBus.onAny` | `shared/src/contracts/signals.ts`, `server/src/kernel/bus.ts` | A generic `{event, payload, source, t, seq}` envelope already exists and is already consumed generically by `AutomationManager` and `BusHistoryRecorder`. |
| `KernelSignalMap` + `kernel:signal` bridge (P1, now shipped) | `shared/src/contracts/signals.ts`, `server/src/transport/socket/handlers/kernelSignal.ts` | Compiler-enforced map↔allowlist; one generic forwarder; `onKernelSignal` typed client helper. New public manager event = one map entry, zero transport code. |

---

## 2. The five structural problems

### P1 — The kernel→overlay ABI is a bag of bespoke events and doesn't scale — ✅ SHIPPED (verified 2026-07-07)

**Original evidence (2026-07-05):** `shared/src/contracts/signals.ts` hand-listed ~50 events in
`ServerToClientEvents`; `server/src/transport/socket/handlers/managers.ts` had 19 identical
`bus.on(X, p => io.emit(X, p))` lines; a new manager capability cost 4–5 file touches.

**Current state:** this phase is done. `KernelSignalMap` in `shared/src/contracts/signals.ts`
is the compiler-enforced (map ↔ allowlist) single source of truth for public domain events;
`transport/socket/handlers/kernelSignal.ts` is the one generic `bus.onAny` forwarder
(`registerKernelSignalBridge`); `managers.ts` no longer exists. Overlay consumes via the typed
`onKernelSignal` helper in `overlay/src/socket/kernelSignals.ts`. `ServerToClientEvents` now
holds only protocol/lifecycle events (config sync, `state:update`, overlay slot ownership,
resync, WebRTC signaling) plus the single `kernel:signal` passthrough — exactly the fix
direction below. A manager event (e.g. `persona:speak`, added 2026-07-07) now costs one line
in `KernelSignalMap` + one allowlist flag, zero transport code. See `docs/manager-authoring.md`
Step 4 and `docs/signal-catalog.md` for the current pattern.

<details>
<summary>Original fix direction (kept for history — now the shipped behavior)</summary>

One generic `kernel:signal` socket channel carrying `BusFrame` envelopes for all **domain**
events. Overlay gets a typed helper (`onKernelSignal('twitch:follow', cb)`) that narrows
payloads from the existing `KernelEvents` map. Bespoke socket events remain *only* for
protocol/lifecycle: config sync (`config:update`/`config:patch`), `state:update`, overlay slot
ownership, resync, and WebRTC signaling. The server side becomes one `bus.onAny` forwarder
with an allowlist (a manager marks events as `public` in its signals file) — `managers.ts` is
deleted. A new manager event then costs **zero** transport changes and is instantly consumable
by automation rules, widgets, and renderers.
</details>

### P2 — Effects are the least-lego subsystem — ✅ SHIPPED (verified 2026-07-08)

**Current state:** `EFFECT_CATALOG` in `shared/src/domain/effectCatalog.ts` is the single
source of truth (label, category, `defaults`, `fields` schema, `defaultSfx`). Derived from it:
admin `EFFECT_CATEGORIES` + draft defaults (`eventPresets.ts` is now derivations), the
generated schema editor in `EventForm.tsx`/`SequenceEditor.tsx` (via `EFFECT_CATALOG[type].fields`),
and the effect→sound default in the overlay's `signalMap.ts` (`SFX_MAP` is gone). A new effect =
**3 files**: `EffectConfigMap` entry + config interface in `contracts/effects.ts` (kept for
payload typing — accepted deviation from the "2 files" goal), catalog entry (compiler-enforced
total record), and the overlay run function + `registerEffect` call.

<details>
<summary>Original evidence (2026-07-05, kept for history)</summary>

**Evidence (2026-07-05):** a new effect touches **6 files** across 3 packages:

1. Config interface + map entry in `shared/src/contracts/effects.ts` (648 lines, ~75 types).
2. `run*` function in `overlay/src/transitions/`.
3. `registerEffect(...)` call in `overlay/src/effects/index.ts` (74 calls).
4. Container div in `overlay/src/layers/TransitionLayer.tsx` (canvas/DOM effects).
5. `EFFECT_CATEGORIES` group + `EFFECT_DRAFT_DEFAULTS` entry in
   `admin/src/features/media-library/eventPresets.ts` (total record — admin fails to compile
   until the entry exists).
6. Optional per-type editor block in `admin/src/features/media-library/EventForm.tsx`
   (1,646 lines).

Plus `SFX_MAP` — the effect→default-sound mapping — hardcoded in
`overlay/src/socket/signalMap.ts`, far from the effects it describes.

**Why it fights the vision:** effects are the highest-frequency creative act in this project,
and they have the highest per-unit cost. Compare renderers: 3 files, admin UI free.

**Fix direction:** apply the `RENDERER_CATALOG` pattern. An `EffectManifest` data entry —
`{ id, label, icon, category, fields (reuse RendererFieldDef), defaults, duration,
defaultSfx }` — in a shared `EFFECT_CATALOG`. Derived from it: admin categories, draft
defaults, the generic schema-driven editor (keep hand-written editor blocks only for the few
effects that genuinely need custom UI), and the SFX default. Per-effect TS config interfaces
in shared go away; a run function declares its own local cfg type. New effect = **2 files**
(catalog entry + run function). The dispatch registry and concurrency budget stay as-is.

</details>

### P3 — Three plugin systems, three shapes — ✅ SHIPPED (verified 2026-07-08)

**Current state:** one manifest shape exists — `PluginManifestBase` + unified `FieldDef` in
`shared/src/domain/fields.ts` (`label/icon/desc/fields/emits/accepts`), extended by
`RendererCatalogEntry` (`domain/plugin.ts`), `EffectManifest` (`domain/effectCatalog.ts`), and
`WidgetDefinition` (`contracts/widget.ts`). Admin has the shared `SchemaForm` component
(`admin/src/features/media-library/SchemaForm.tsx`) rendering any `fields` schema.
`WidgetComponentType` is **derived** from widget definitions
(`DefinedWidgetComponentType = (typeof WIDGET_DEFINITIONS)[number]['componentType']` in
`widgets/index.ts`; `application.ts` only appends the `'window' | 'generic'` fallbacks) —
adding a widget never edits `application.ts`.

<details>
<summary>Original evidence (2026-07-05, kept for history)</summary>

**Evidence:** the same concept — "a thing with an id, a config schema, signals it emits,
actions it accepts" — is expressed three ways:

- **Widgets:** `shared/src/widgets/{id}/definition.ts` + one `widgetRegistry.ts` line + a
  *manual* `WidgetComponentType` union edit in `shared/src/domain/application.ts` (a leak —
  the definition should be the single source).
- **Renderers:** `RENDERER_CATALOG` (the good one).
- **Effects:** the 6-file path (P2).

**Why it fights the vision:** nothing composes uniformly. Automation UI, admin forms, and
ambiance each need per-kind special cases; a new *kind* of lego brick (e.g. "audio behaviors",
"input devices") would invent a fourth shape.

**Fix direction:** one manifest shape — `{ id, kind: 'widget'|'renderer'|'effect', label,
icon, fields, defaults, emits, accepts, ...kind-specific extras }` — with per-kind registries
but a shared schema-form generator in admin (one `SchemaForm` component). Derive
`WidgetComponentType` from the definitions so adding a widget never edits
`application.ts`. Registration stays build-time (an `import.meta.glob` sweep is a nice-to-have,
not the point).

</details>

### P4 — Presentation leaked into the kernel ABI — ✅ SHIPPED (2026-07-08)

**Current state:** the shared ABI contains no Win98 skin concepts.

- **Mirroring question resolved:** the start-menu/recycle-bin rebroadcasts ARE consumed
  cross-client (admin mirrors recycle-bin state; kernel stores both for reconnect resync),
  so the capability was kept via the contingency path: a **generic presentation relay**.
  One `presentation:state { key, value, activity? }` client→server command; the kernel
  stores latest value per key opaquely (`RuntimeStateStore.presentationState`, a
  `Map<string, unknown>`) and rebroadcasts `presentation:state { key, value }`. The
  `activity` flag replaces the handler's hardcoded "menu open = scheduler activity" logic.
  `desktop:start-menu:state`, `desktop:recycle-bin`, `DesktopStartMenuStatePayload`,
  `DesktopRecycleBinPayload`, and `DesktopStartMenuRoot` are deleted from shared.
  Key/value shapes live in `overlay/src/desktop/presentationState.ts` (skin vocabulary).
- **`menuPath` removed from `AmbianceSimulationPayload`:** the kernel now sends only the
  abstract target (`targetKind` + id) for nav selects; `Desktop.tsx` resolves the start-menu
  path from its own config (labels for layouts/scenes). The kernel no longer knows menus exist.
- **`WidgetSimulationIntentSeed` union:** was already manifest-driven before this pass
  (`ambianceSimulation.ts` picks from widget `accepts` entries with `simulate` hints;
  `WidgetSimulationIntentPayload.kind` is an opaque string) — the original evidence below
  was stale on this point.
- **Globals killed:** `window.__cursorOverlayController`, `__cursorMirrorVisualOnly`,
  `__simulatingCursorClick`, `__simulatingWidgetFocus` replaced by the module-scoped
  `cursorSim` service (`overlay/src/desktop/cursorService.ts`).
- **`cursorReady` → `simulatorReady`** in `OverlayRuntimeStatusPayload` /
  `OverlayClientDiagnostics` (abstract "the skin's ambient performer is ready").
- **Side-effect fix:** `desktopConfig.recycleBin.fullOnStart` previously seeded server-side
  from compile-time `DEFAULT_CONFIG` (ignoring user config); the overlay now reports the
  configured initial state when the kernel has no recycle-bin fact yet.
- **Deliberately left:** presentation *config data* in shared (`domain/desktop.ts`,
  `recycleBinSettings` on `Application`, desktopConfig defaults in `constants/defaults.ts`) —
  the kernel persists/serves config opaquely; that's data, not behavior.
  `desktop:notify` stays (generic notification). `desktop:screen-saver:test` is an
  admin→overlay preview command tied to the desktop config section.

<details>
<summary>Original evidence (2026-07-05, kept for history)</summary>

**Evidence:**

- The *shared contract* contains Win98-desktop concepts: `desktop:start-menu:phase`,
  `desktop:start-menu:state`, `cursor:mirror:menu-timeline` (start-menu hover/timing
  choreography computed kernel-side), `desktop:recycle-bin`.
- `shared/src/constants/ambianceSimulation.ts` hardcodes specific widgets' verbs —
  `music:play-pause`, `gallery:next`, `sticky:set-color`, `chat:add-message` — as the
  `WidgetSimulationIntentSeed` union, **even though widget definitions already declare
  `accepts`** (e.g. `shared/src/widgets/music/definition.ts`). The vocabulary exists in the
  manifests; ambiance duplicates it by hand.
- Ad-hoc globals stitch the choreography together overlay-side
  (`window.__cursorOverlayController`, `__cursorMirrorApplying` in `signalMap.ts`).

**Why it fights the vision:** ARCHITECTURE.md promises "any client that speaks the signal
contract works" — but the contract itself speaks Win98. Swap the skin and the kernel's
AmbianceManager is directing start-menu theater that no longer exists. "Easy art style change
direction" dies exactly here.

**Fix direction:** the kernel emits *abstract* ambient intents — "ambiently open widget W",
"perform one of W's declared `accepts` actions" (picked from the manifest, optionally with
per-action simulation hints like weight or a param generator). The overlay — as the owner of
the skin — resolves the *performance*: cursor theater, menu paths, timing. Start-menu and
cursor-timeline signals move out of the shared ABI into overlay-internal concerns.
`ambianceSimulation.ts`'s hardcoded union is deleted in favor of manifest-driven picks.

> ⚠️ **Verify at execution time:** whether `cursor:mirror` / start-menu-state signals also
> serve multi-client mirroring in online rooms (leader/follower overlays). If so, keep a
> generic "presentation event relay" channel rather than deleting the capability.

> **Partial progress noted 2026-07-07:** `desktop:start-menu:phase` (the per-frame cursor
> choreography payload) is already gone from the shared ABI — `DesktopStartMenuSimulationPhasePayload`
> now lives entirely in `overlay/src/desktop/simulationTypes.ts` and is computed/consumed
> overlay-internally (`cursorSimUtils.ts`, `Desktop.tsx`, `StartMenu.tsx`). `desktop:start-menu:state`
> (open/closed + active root) is still a shared signal — that's the one to re-examine against
> the online-rooms mirroring question above, not the phase timeline.

</details>

### P5 — Two competing scene concepts — ✅ SHIPPED (verified 2026-07-08), scoped down

**Original evidence (2026-07-05):** a data-driven `scenes` table (with renderers, tiers,
transitions, ambient tracks) coexisted with a compile-time-privileged `STATE.LOBBY` (a
hand-built react-three-fiber 3D room, `overlay/src/lobby/LobbyScene.tsx`) and `STATE.DESKTOP`,
baked into `AutomationTrigger.sceneIs`, `SceneMachine`, `TransitionPlayPayload`, and the
overlay's visual-state store, plus a dual-path scene-target validation bug in
`server/src/transport/socket/handlers/scene.ts` (the `scene:` action prefix only accepted
LOBBY/DESKTOP; the `scene-change` action kind only accepted non-built-in scenes).

**Current state:** the LOBBY runtime is deleted outright (component, `LobbyConfig`, DB
column, admin panels, every `STATE.LOBBY` branch) rather than generalized — it was dev-only
and not worth preserving as a renderer plugin. DESKTOP is now an ordinary seeded `Scene` row:
it's edited through the same `ScenePanel` as any custom scene (windows, style, `showDesktop`,
and intro/exit Sequence pickers — previously only available to custom scenes), with a
Desktop-only "Desktop OS" tab for the Win98 chrome settings that don't belong on `Scene`.
`isNavigableState`/`NAVIGABLE_STATES` are deleted; both scene-target validation paths now
just check `target in config.scenes`. `Desktop.tsx` no longer re-resolves its own style via
a hardcoded `STATE.DESKTOP` lookup — it receives the actually-active scene's `overlayStyle`
as a prop from `App.tsx`, fixing a desync when a non-DESKTOP scene sets `showDesktop: true`.
`STATE` keeps `DESKTOP` (boot/fallback scene id) and `TRANSITIONING` (machine phase, not a
scene) as named string constants — full mechanical rename to a `SceneId`-only API was judged
not worth the churn since `type STATE = string` already.

---

## 3. Phased roadmap

> **Status 2026-07-08: all five phases are shipped.** This doc is now a record of the
> consolidation, not a work queue. Remaining opportunistic cleanups live in §4.

Each phase is independently shippable and leaves the system fully working. Order is by
leverage ÷ risk. Breaking persisted data is acceptable in every phase.

### Phase 1 — Signal fabric (P1) — ✅ DONE

All domain events flow kernel→overlay through the generic `kernel:signal` BusFrame channel;
`managers.ts` is deleted. See the P1 section above for the current shape.

### Phase 2 — Effect manifests (P2) — ✅ DONE (verified 2026-07-08)

`EFFECT_CATALOG` shipped; admin categories/drafts/editors and the SFX default all derive
from it. Accepted deviation: per-effect config interfaces remain in `contracts/effects.ts`
(payload typing), so a new effect is 3 files, not 2. See the P2 section above.

### Phase 3 — Unified plugin shape + SchemaForm (P3) — ✅ DONE (verified 2026-07-08)

`PluginManifestBase` + unified `FieldDef` shipped; `SchemaForm` renders any brick's fields;
`WidgetComponentType` is derived from widget definitions. See the P3 section above.

### Phase 4 — Kernel presentation purge (P4) — ✅ DONE (2026-07-08)

Shipped via the generic `presentation:state` relay (mirroring capability kept), abstract
nav-select intents (no kernel-computed `menuPath`), and the `cursorSim` overlay service.
See the P4 section above for what shipped and what was deliberately left as config data.

### Phase 5 — Data-driven scenes (P5) — ✅ DONE (scoped down, 2026-07-08)

LOBBY runtime deleted rather than generalized; DESKTOP normalized to an ordinary `Scene` row
edited via `ScenePanel`; scene-target validation unified against `config.scenes`. See the P5
section above for what shipped and what was deliberately left as-is (`STATE.DESKTOP`/
`STATE.TRANSITIONING` remain named string constants rather than a full `SceneId` rename).

---

## 4. Smaller irritants noticed along the way (fix opportunistically)

- `overlay/src/layers/TransitionLayer.tsx` pre-mounts a static div per legacy effect —
  effects created after the registry pattern self-manage containers; port the old ones when
  touched (folds into Phase 2).
- `EventForm.tsx` at 1,646 lines will mostly dissolve in Phase 2/3; don't refactor it before
  then.
- `signalMap.ts` mixes transport handling with effect firing/SFX policy (`fireEffect`,
  `scheduleEffect`) — the effect-firing pipeline belongs next to the effect registry (folds
  into Phase 1/2).
