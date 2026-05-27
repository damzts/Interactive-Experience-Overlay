
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

## Server (`packages/server/src/`)


index.ts          — entry: registers routes, socket, starts Fastify
db/db.ts          — SQLite via better-sqlite3; WAL mode; normalized schema
state/machine.ts  — SceneMachine: event emitter for scene state
routes/
config.ts       — AppConfig CRUD + table-aware DB persistence
archive.ts      — event log routes
media.ts        — media library routes
machine.ts      — scene transition routes
socket/handlers.ts — Socket.IO real-time bridge (config:update, config:patch, …)
obs/              — OBS WebSocket integration
ambiance/         — desktop ambiance manager
events/           — scheduled event system


## Database (`ieom.db`, better-sqlite3)

Normalized relational schema. Migration version tracked via `PRAGMA user_version`. Migration v1 runs on first boot: drops legacy `config_store`, creates all tables, seeds from `DEFAULT_CONFIG`.

| Table | Shape |
|---|---|
| `scenes` | `id PK, label, background_opaque, sources_json, style_json, lobby_config_json, transitions_json` |
| `applications` | `id PK` + flat scalar columns + `settings_json` for widget-specific fields |
| `desktop_config` | single-row (`id=1`) — icon settings, widget dicts as JSON columns |
| `widget_layouts` | `id PK, label, icon, source, items_json, default_config_json` — independent of desktop_config |
| `events` | `id PK, label, icon, color, desc, effects_json, actions_json, auto_json` |
| `keybinds` | `(scope, key) PK, action` — scopes: `obs`, `admin` |
| `obs_config` | single-row — `url, password` |
| `audio_config` | single-row — `master_volume, sfx_volume, music_volume` |
| `overlay_style` | single-row — background/effects/particles decomposed into JSON columns + flat typography fields |
| `desktop_ambiance` | single-row — `simulation_json` |
| `source_presets` | `id PK, label, plugin_type, config_json, default_position_json` |
| `media_library` | `id PK, name, type, url, duration` |

**Access layer** (`db.ts` exports): typed load/save functions per domain — `loadScenes()`, `saveScene()`, `saveScenes()`, `loadApplications()`, `saveApplication()`, `saveApplications()`, `loadDesktopConfig()`, `saveDesktopConfig()`,`loadEvents()`, `saveEvents()`, `loadKeybinds()`, `saveKeybinds()`, `loadObsConfig()`, `saveObsConfig()`, `loadAudioConfig()`, `saveAudioConfig()`, `loadOverlayStyle()`, `saveOverlayStyle()`, `loadDesktopAmbiance()`,`saveDesktopAmbiance()`, `loadSourcePresets()`, `saveSourcePresets()`, `loadMediaLibrary()`, `saveMediaLibrary()`, `loadAllConfig()`.

Multi-row bulk saves (`saveScenes`, `saveApplications`, etc.) DELETE-then-INSERT inside a transaction. Single-row tables use `INSERT OR REPLACE` with `id=1`.

`widget_layouts` is stored in its own table but loaded and attached to `DesktopConfig.widgetLayouts` at read time; split back out on write.

## Config (`AppConfig` in `@ieom/shared`)


scenes          Record<string, Scene>         — authored visual states
applications    Application[]                 — desktop icons/apps/widgets
desktopConfig   DesktopConfig?                — runtime layout, widget positions/themes
desktopAmbiance DesktopAmbianceConfig?        — automated desktop/widget behavior
overlayStyle    OverlayStyle                  — per-scene BG/effects/particles/typography
events          EventConfig[]?                — scheduler-driven automations
sourcePresets   SourcePreset[]?               — reusable source plugin presets
mediaLibrary    MediaEntry[]?                 — image/video asset library
keybinds        { obs, admin }                — hotkey maps
obs             { url, password }             — OBS WebSocket connection
audio           { masterVolume, sfxVolume, musicVolume }


Flow: `loadAllConfig()` (reads all tables) → `withConfigDefaults()` → in-memory `config` → `persistConfig(next, machine?, updates?)` dispatches to table-specific save functions for only the changed domains.

`withConfigDefaults()` applies runtime defaults, ensures required apps are present, and computes `defaultConfig` snapshots for scenes and applications. These snapshots are **not stored in the DB** — they are re-derived at load timefrom `DEFAULT_CONFIG`.

`DesktopConfig.widgetThemeOverrides` is runtime-only (event-driven) and is **never persisted**.

Real-time: `persistConfig` emits `config:update` (full) and `config:patch` (diff) via `SceneMachine` → Socket.IO to clients.

## REST endpoints

- `GET /api/config`: fetch full normalized config
- `PUT /api/config`: replace full config
- `PATCH /api/config`: merge partial config updates
- `PATCH /api/config/audio`: patch audio settings only
- `PATCH /api/config/desktop`: patch desktop settings only
- `PATCH /api/config/applications/:appId`: patch one application record
- `PATCH /api/config/obs`: patch OBS settings only
- `GET /api/assets/catalog`: fetch asset catalog
- `POST /api/assets/refresh`: rebuild asset catalog


## Socket Model

The app uses typed Socket.IO events.

High-value event groups:

- scene control: `scene:change`, `state:update`, `transition:play`, `transition:preview`
- config sync: `config:update`, `config:patch`
- overlay effects: `overlay:trigger`, `overlay:show`
- desktop runtime: `widget:toggle`, `desktop:state:request`, `desktop:notify`, `desktop:recycle-bin`
- live shell motion: `desktop:icon:drag`, `desktop:widget:drag`, `desktop:widget:resize`
- Start menu sync: `desktop:start-menu:state`, `desktop:start-menu:phase`
- ambiance sync: `ambiance:leader`, `ambiance:leader:request`, `ambiance:leader:heartbeat`, `ambiance:simulate`, `ambiance:simulate:accepted`, `ambiance:simulate:started`, `ambiance:simulate:done`
- overlay recovery: `overlay:runtime:status`, `overlay:resync`, `overlay:force-resync`
- cursor mirroring: `cursor:mirror`, `cursor:mirror:menu-timeline`
- mirrored widget intents: `widget:simulate:intent`
- widget layouts: `widget:layout:apply`
- utilities: `desktop:screen-saver:test`, `panic`, `obs:status`, `keybind:execute`

Rule of thumb:

- sockets carry runtime state and lightweight sync
- HTTP persists config
- `config:update` is the heavy/full path
- `config:patch` is the normal incremental path

## Core Data Model

Important persisted structures:

- `AppConfig`: root persisted object
- `Scene`: authored visual state
- `SourceInstance`: placed plugin instance inside a scene
- `Application`: desktop icon/app record
- `DesktopConfig`: desktop runtime settings (includes `widgetLayouts` assembled from DB at read time)
- `DesktopAmbianceConfig`: automated desktop/widget behavior rules
- `EventConfig`: scheduler-driven automation records with overlay effects plus runtime actions
- `OverlayStyle`: per-scene background/effects/particles/typography

Application roles:

- `scene`: changes machine state through `targetSceneId`
- `widget`: opens a floating desktop window without changing machine state
- `decoration`: non-launchable desktop icon

Widget-specific persisted state:

- widget identity and behavior live on `Application`
- widget window position/size/z-order defaults live in `DesktopConfig`
- widget per-app theme override lives in `Application.themeOverride` (persisted); runtime event overrides use `DesktopConfig.widgetThemeOverrides` (ephemeral, never written to DB)
- widget layouts live in their own `widget_layouts` table, surfaced via `DesktopConfig.widgetLayouts`

Default snapshot model:

- `Scene.defaultConfig` and `Application.defaultConfig` are computed at load time inside `withConfigDefaults()` from `DEFAULT_CONFIG` — they are never stored in the DB
- active theme and widget theme live in `DesktopConfig.globalThemeDefault` (theme + widgetTheme + appearance)
- widget layouts use `WidgetLayoutDefinition.defaultConfig`
- admin editors support `Save Current as Default` and `Restore Defaults`

### Layer Order

Render order:

1. `BackgroundLayer`
2. `ParticlesLayer`
3. `LayerStack`
4. `LobbyScene` or `DesktopScene`
5. `CSSEffectsLayer`
6. `TransitionLayer`


## Admin UI (`packages/admin/src/`)


App.tsx / pages/    — routing
components/dashboard/ — main dashboard panels
store/useAdminStore.ts — Zustand store
socket/             — Socket.IO client, syncs config:patch


## Overlay UI (`packages/overlay/src/`)


App.tsx / machine.ts — local state machine mirrors server state
engine/              — render engine
layers/              — scene layer composition
desktop/ lobby/      — scene-specific rendering
transitions/         — intro/exit transition system
socket/              — receives config:update, scene changes
plugins/             — extensible overlay plugins

---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

Key changes from the previous version:

- Database section fully replaced — documents the 12 normalized tables, PRAGMA user_version migration system, and the typed access layer API
- Added note that widget_layouts is its own table (no longer a JSON blob inside desktopConfig)
- Added explicit callout that defaultConfig snapshots and widgetThemeOverrides are never persisted
- Updated config flow description to reference loadAllConfig() and table-aware persistConfig
- Minor fix: DesktoScene → DesktopScene in the Layer Order section
