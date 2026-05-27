
# Project Architecture

## AI Agent Notes

Maintain it with these rules:

- Keep it compact enough to load as working context.
- Prefer stable concepts over file-by-file implementation notes.
- Do not turn it into a backlog, changelog, or dump.
- When the project grows, summarize patterns here and move long detail to purpose-specific docs.
- Update this file when architecture or workflow changes in ways that affect how an agent should understand, use, or extend the project.

Target outcome:

- an AI should understand the system model by understanding behavior and patterns, do not force a solution or limit creativity problem solving.


## Monorepo Structure
pnpm workspaces. Four packages:

| Package | Role |
|---|---|
| `@ieom/server` | Fastify HTTP + Socket.IO backend |
| `@ieom/admin` | React admin UI (config, scenes, assets) |
| `@ieom/overlay` | React overlay UI (rendered on stream) |
| `@ieom/shared` | Shared TS types, constants, defaults |

---

## Shared (`packages/shared/src/`)

Types are organized in two layers:

- **`domain/`** — persistent data models (`AppConfig`, `Scene`, `Application`, `DesktopConfig`, `DesktopAmbianceConfig`, `EventConfig`, `OverlayStyle`, `SourcePreset`, `MediaEntry`, etc.)
- **`contracts/`** — Socket.IO payloads (`socket.ts`), diagnostic types (`diagnostics.ts`), effect types (`effects.ts`), machine state enums (`state.ts`)
- **`constants/`** — `DEFAULT_CONFIG`, ambiance simulation helpers
- `index.ts` re-exports everything; all consumers use `@ieom/shared` as the entry point — no sub-path imports.

Pattern: add a new domain entity → create `domain/myDomain.ts`, add it to `domain/config.ts` (`AppConfig`), re-export from `index.ts`.

---

## Server (`packages/server/src/`)

```
db/
  connection.ts       — opens SQLite (WAL mode), exports db instance
  migrations.ts       — schema DDL, seed from DEFAULT_CONFIG, PRAGMA user_version
  utils.ts            — parseJson, boolToInt, clone helpers
  repositories/       — one class per domain (SceneRepository, ApplicationRepository, …)
  db.ts               — thin backward-compat layer (bulk save/loadAllConfig) over repos
services/
  ConfigService.ts    — owns in-memory config; load, persist, patch, withDefaults
  MediaService.ts     — asset/game scanning, catalog cache, CRUD
routes/
  config.ts           — thin HTTP handlers → ConfigService
  media.ts            — thin HTTP handlers → MediaService
  archive.ts          — event log routes
state/
  machine.ts          — SceneMachine: event emitter for scene state transitions
socket/
  handlers.ts         — real-time bridge; calls configService/persistConfig
obs/                  — OBS WebSocket integration (ObsBridge class)
ambiance/             — AmbianceManager class (receives getConfig callback)
events/               — EventScheduler class (receives getConfig callback)
index.ts              — wires everything with DI, starts Fastify
```

### Layering rule
Routes → Services → Repositories → DB. Routes never touch `db.*` directly. Services never import routes.

### ConfigService
Singleton `configService` owns the live in-memory `AppConfig`. `configService.get()` returns current config. `configService.persist(next, machine?, updates?)` writes changed domains to DB and emits `config:update`/`config:patch` via `SceneMachine`. `withConfigDefaults()` is applied at load time and after every patch.

### Repository pattern
Each repo class takes `db: DatabaseType` in constructor; all SQL is inside the class. Bulk saves use DELETE-then-INSERT inside a transaction. Single-row tables use `INSERT OR REPLACE` with `id=1`.

---

## Database (`ieom.db`, better-sqlite3)

Normalized relational schema. Migration version tracked via `PRAGMA user_version`. Migration v1 runs on first boot.

| Table | Shape |
|---|---|
| `scenes` | `id PK, label, background_opaque, sources_json, style_json, lobby_config_json, transitions_json` |
| `applications` | `id PK` + flat scalar columns + `settings_json` |
| `desktop_config` | single-row (`id=1`) — icon settings, widget dicts as JSON columns |
| `widget_layouts` | `id PK, label, icon, source, items_json, default_config_json` |
| `events` | `id PK, label, icon, color, desc, effects_json, actions_json, auto_json` |
| `keybinds` | `(scope, key) PK, action` |
| `obs_config` | single-row — `url, password` |
| `audio_config` | single-row — `master_volume, sfx_volume, music_volume` |
| `overlay_style` | single-row — JSON columns per sub-section + flat typography fields |
| `desktop_ambiance` | single-row — `simulation_json` |
| `source_presets` | `id PK, label, plugin_type, config_json, default_position_json` |
| `media_library` | `id PK, name, type, url, duration` |

`widget_layouts` is loaded and attached to `DesktopConfig.widgetLayouts` at read time; split back on write.

---

## Config (`AppConfig` in `@ieom/shared`)

```
scenes          Record<string, Scene>
applications    Application[]
desktopConfig   DesktopConfig?
desktopAmbiance DesktopAmbianceConfig?
overlayStyle    OverlayStyle
events          EventConfig[]?
sourcePresets   SourcePreset[]?
mediaLibrary    MediaEntry[]?
keybinds        { obs, admin }
obs             { url, password }
audio           { masterVolume, sfxVolume, musicVolume }
```

Flow: `loadAllConfig()` → `withConfigDefaults()` → in-memory `configService` → `persist(next, machine?, updates?)` dispatches table-specific saves for only changed domains.

`withConfigDefaults()` ensures required apps are present and computes `defaultConfig` snapshots — never stored in DB, re-derived at load time. `DesktopConfig.widgetThemeOverrides` is runtime-only — never persisted.

---

## REST Endpoints

- `GET /api/config` — fetch full normalized config
- `PUT /api/config` — replace full config
- `PATCH /api/config` — merge partial updates
- `PATCH /api/config/audio` — patch audio only
- `PATCH /api/config/desktop` — patch desktop only
- `PATCH /api/config/applications/:appId` — patch one application
- `PATCH /api/config/obs` — patch OBS settings
- `GET /api/assets/catalog` — fetch asset catalog
- `POST /api/assets/refresh` — rebuild asset catalog

---

## Socket Model

Typed Socket.IO events (defined in `@ieom/shared/contracts/socket.ts`).

| Group | Events |
|---|---|
| Scene control | `scene:change`, `state:update`, `transition:play`, `transition:preview` |
| Config sync | `config:update` (full), `config:patch` (diff) |
| Overlay effects | `overlay:trigger`, `overlay:show` |
| Desktop runtime | `widget:toggle`, `desktop:state:request`, `desktop:notify`, `desktop:recycle-bin` |
| Live shell motion | `desktop:icon:drag`, `desktop:widget:drag`, `desktop:widget:resize` |
| Start menu | `desktop:start-menu:state`, `desktop:start-menu:phase` |
| Ambiance sync | `ambiance:leader`, `ambiance:simulate`, `ambiance:simulate:accepted/started/done` |
| Recovery | `overlay:runtime:status`, `overlay:resync`, `overlay:force-resync` |
| Cursor mirror | `cursor:mirror`, `cursor:mirror:menu-timeline` |
| Widget intent | `widget:simulate:intent`, `widget:layout:apply` |
| Utilities | `desktop:screen-saver:test`, `panic`, `obs:status`, `keybind:execute` |

Rules:
- Sockets carry runtime state and lightweight sync; HTTP persists config.
- `config:update` = full heavy sync; `config:patch` = normal incremental path.

---

## Admin UI (`packages/admin/src/`)

```
api/
  configApi.ts        — typed fetchConfig() / patchConfig(); all HTTP paths live here
store/
  slices/
    configSlice.ts    — AppConfig state + fetchConfig/saveConfig actions (calls configApi)
    runtimeSlice.ts   — OBS status, diagnostics, scene machine state, socket runtime data
    uiSlice.ts        — selected scene/app, open panels, last error
  useAdminStore.ts    — composes all 3 slices (Zustand); single store for all consumers
socket/
  client.ts           — Socket.IO client instance
  useSocketEvents.ts  — all socket.on handlers; writes into store slices
App.tsx               — mounts useSocketEvents, renders Dashboard
```

Pattern: every component reads from `useAdminStore`; all HTTP is via `configApi`; socket events are centralized in `useSocketEvents`.

---

## Overlay UI (`packages/overlay/src/`)

```
socket/
  useConfigSync.ts    — handles config:update / config:patch
  useSceneEvents.ts   — handles scene:change, transition:*, state:update, overlay:resync
  useDesktopEvents.ts — handles widget:*, desktop:*, ambiance:*, obs:status, cursor events
  useCursorMirror.ts  — cursor mirror + menu-timeline simulation
  useSocket.ts        — thin composition: calls all 4 sub-hooks
engine/               — render engine
layers/               — scene layer composition
desktop/ lobby/       — scene-specific rendering
transitions/          — intro/exit transition system
plugins/              — extensible overlay plugins
```

### Layer Order
1. `BackgroundLayer`
2. `ParticlesLayer`
3. `LayerStack`
4. `LobbyScene` or `DesktopScene`
5. `CSSEffectsLayer`
6. `TransitionLayer`

---

## Core Data Model

- `AppConfig` — root persisted object
- `Scene` — authored visual state
- `SourceInstance` — placed plugin instance inside a scene
- `Application` — desktop icon/app/widget record
- `DesktopConfig` — runtime layout (includes `widgetLayouts` assembled from DB at read time)
- `DesktopAmbianceConfig` — automated desktop/widget behavior rules
- `EventConfig` — scheduler-driven automations with overlay effects
- `OverlayStyle` — per-scene background/effects/particles/typography

Application roles: `scene` (changes machine state via `targetSceneId`), `widget` (opens floating window), `decoration` (non-launchable icon).

Widget state layers:
- identity + behavior → `Application`
- window position/size/z-order defaults → `DesktopConfig`
- per-app theme override → `Application.themeOverride` (persisted)
- runtime event overrides → `DesktopConfig.widgetThemeOverrides` (ephemeral, never written)
- widget layouts → `widget_layouts` table, surfaced via `DesktopConfig.widgetLayouts`

`Scene.defaultConfig` and `Application.defaultConfig` are computed by `withConfigDefaults()` from `DEFAULT_CONFIG` — never stored in DB.
