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

```
index.ts          — entry: registers routes, socket, starts Fastify
db/db.ts          — SQLite via better-sqlite3; WAL mode
state/machine.ts  — SceneMachine: event emitter for scene state
routes/
  config.ts       — AppConfig CRUD + per-section DB persistence
  archive.ts      — event log routes
  media.ts        — media library routes
  machine.ts      — scene transition routes
socket/handlers.ts — Socket.IO real-time bridge (config:update, config:patch, …)
obs/              — OBS WebSocket integration
ambiance/         — desktop ambiance manager
events/           — scheduled event system
```

## Database (`ieom.db`, better-sqlite3)

Single table: `config_store` — `key/value TEXT`, JSON config sections stored as `config:<section>` rows (e.g. `config:audio`, `config:scenes`). Reads use a `WHERE key IN (...)` batch query; writes touch only changed sections.

## Config (`AppConfig` in `@ieom/shared`)

```
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
```

Flow: `loadPersistedConfig()` → `withConfigDefaults()` → in-memory `config` → `persistConfig(next, machine?, updates?)` writes only changed sections.

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
- `DesktopConfig`: desktop runtime settings
- `DesktopAmbianceConfig`: automated desktop/widget behavior rules
- `EventConfig`: scheduler-driven automation records with overlay effects plus runtime actions
- `OverlayStyle`: per-scene background/effects/particles/typography

Application roles:

- `scene`: changes machine state through `targetSceneId`
- `widget`: opens a floating desktop window without changing machine state
- `decoration`: non-launchable desktop icon

Widget-specific persisted state lives across application records plus desktop config:

- widget identity and behavior live on `Application`
- widget window position/size/z-order defaults live in `DesktopConfig`
- widget per-app theme override lives in `Application.themeOverride` (persisted); runtime event overrides use `DesktopConfig.widgetThemeOverrides` (ephemeral, never written to DB)
- widget layouts live in `DesktopConfig.widgetLayouts`

Default snapshot model:

- scenes use `Scene.defaultConfig`
- applications/widgets use `Application.defaultConfig`
- active theme and widget theme live in `DesktopConfig.globalThemeDefault` (theme + widgetTheme + appearance)
- widget layouts use `WidgetLayoutDefinition.defaultConfig`
- admin editors support `Save Current as Default` and `Restore Defaults`

### Layer Order

Render order:

1. `BackgroundLayer`
2. `ParticlesLayer`
3. `LayerStack`
4. `LobbyScene` or `DesktoScene`
5. `CSSEffectsLayer`
6. `TransitionLayer`


## Admin UI (`packages/admin/src/`)

```
App.tsx / pages/    — routing
components/dashboard/ — main dashboard panels
store/useAdminStore.ts — Zustand store
socket/             — Socket.IO client, syncs config:patch
```

## Overlay UI (`packages/overlay/src/`)

```
App.tsx / machine.ts — local state machine mirrors server state
engine/              — render engine
layers/              — scene layer composition
desktop/ lobby/      — scene-specific rendering
transitions/         — intro/exit transition system
socket/              — receives config:update, scene changes
plugins/             — extensible overlay plugins
```






