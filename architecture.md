# IEOM Architecture

## AI Agent Notes

This file is effectively a project skill for AI agents.

Maintain it with these rules:

- Keep it compact enough to load as working context.
- Preserve the core runtime model, ownership boundaries, sync model, and extension rules.
- Prefer stable concepts over file-by-file implementation notes.
- Do not turn it into a backlog, changelog, or dump.
- When the project grows, summarize patterns here and move long detail to purpose-specific docs.
- Update this file when architecture or workflow changes in ways that affect how an agent should understand, use, or extend the project.

Target outcome:

- an AI should be able to read this file, understand the system model, navigate the project mentally, and safely expand functionality without needing excessive extra context.

## Overview

IEOM is a self-hosted streaming overlay platform. OBS loads one browser source, and IEOM owns scenes, transitions, effects, desktop simulation, lobby rendering, widget runtime, and supporting audio/runtime state.

Core model:

- OBS is a host, not the scene switcher.
- `AppConfig` is the persisted model.
- The server owns authoritative runtime state and config persistence.
- The admin edits config and drives runtime actions.
- The overlay renders config plus runtime state.
- The only supported runtime clients are the admin browser and overlay browser instances used for preview and OBS.
- The admin page can host an embedded overlay preview, which means one admin session may create both an `admin` socket and a separate `overlay` socket.

Tech stack: TypeScript, React, Fastify, Socket.IO, SQLite, OBS WebSocket, GSAP, React Three Fiber, Zustand, 98.css.

## Repo Shape

- `assets/`: shared runtime media library
- `packages/shared/`: shared types, defaults, socket contracts, merge helpers
- `packages/server/`: API, socket hub, config authority, OBS bridge, runtime state
- `packages/admin/`: authoring UI and embedded preview
- `packages/overlay/`: OBS/browser-source runtime renderer
- `recommendations.md`: backlog and polish notes

Dev ports:

- server: `3000`
- overlay: `3001`
- admin: `3002`

## Useful Interfaces

This is a practical reference, not the full contract.

Useful REST endpoints:

- `GET /api/config`: fetch full normalized config
- `PUT /api/config`: replace full config
- `PATCH /api/config`: merge partial config updates
- `PATCH /api/config/audio`: patch audio settings only
- `PATCH /api/config/desktop`: patch desktop settings only
- `PATCH /api/config/applications/:appId`: patch one application record
- `PATCH /api/config/obs`: patch OBS settings only
- `GET /api/assets/catalog`: fetch asset catalog
- `POST /api/assets/refresh`: rebuild asset catalog

Useful socket events:

- config sync: `config:update`, `config:patch`
- scene flow: `scene:change`, `state:update`, `transition:play`, `transition:preview`
- effects: `overlay:trigger`, `overlay:show`
- runtime recovery: `state:request`, `desktop:state:request`
- widgets/runtime shell: `widget:toggle`, `widget:layout:apply`, `desktop:notify`, `desktop:recycle-bin`
- live desktop motion: `desktop:icon:drag`, `desktop:widget:drag`, `desktop:widget:resize`
- Start menu sync: `desktop:start-menu:state`, `desktop:start-menu:phase`
- ambiance flow: `ambiance:leader`, `ambiance:leader:request`, `ambiance:leader:heartbeat`, `ambiance:simulate`, `ambiance:simulate:accepted`, `ambiance:simulate:started`, `ambiance:simulate:done`
- overlay readiness / recovery: `overlay:runtime:status`, `overlay:resync`, `overlay:force-resync`
- leader cursor sync: `cursor:mirror`, `cursor:mirror:menu-timeline`
- shared widget intents: `widget:simulate:intent`
- utility/runtime control: `desktop:screen-saver:test`, `keybind:execute`, `panic`, `obs:status`

Usage rules:

- use HTTP to persist config
- use sockets for runtime state, live motion, and incremental sync
- prefer partial writes plus `config:patch` over full config replacement when possible

## Core Data Model

Important persisted structures:

- `AppConfig`: root persisted object
- `Scene`: authored visual state
- `SourceInstance`: placed plugin instance inside a scene
- `Application`: desktop icon/app record
- `DesktopConfig`: desktop runtime settings
- `DesktopAmbianceConfig`: automated desktop/widget behavior rules
- `OverlayStyle`: per-scene background/effects/particles/typography

Application roles:

- `scene`: changes machine state through `targetSceneId`
- `widget`: opens a floating desktop window without changing machine state
- `decoration`: non-launchable desktop icon

Widget-specific persisted state lives across application records plus desktop config:

- widget identity and behavior live on `Application`
- widget window position/size/z-order defaults live in `DesktopConfig`
- widget theme overrides live in `DesktopConfig.widgetThemeOverrides`
- widget layouts live in `DesktopConfig.widgetLayouts`

Default snapshot model:

- scenes use `Scene.defaultConfig`
- applications/widgets use `Application.defaultConfig`
- global theme uses `DesktopConfig.globalThemeDefault`
- admin editors support `Save Current as Default` and `Restore Defaults`

## Runtime Ownership

Persisted config and runtime state are separate.

Persisted:

- scenes
- applications
- desktop config
- ambiance config
- events
- OBS settings

Runtime-only server state:

- current machine state
- open widget ids
- recycle-bin fullness
- Start menu shell state
- ambiance leader overlay socket id
- ambiance leader lease heartbeat / expiry timestamps
- ambiance lifecycle history ring buffer for diagnostics

Rule:

- if it must survive reload/restart, it belongs in persisted config
- if it reflects current shell/session state, it probably belongs in server runtime state

## Shared Contract Layer

`@ieom/shared` defines the cross-package contract.

Responsibilities:

- shared config shapes
- shared socket event shapes
- shared defaults and normalization
- partial-config merge behavior

If a field is persisted, broadcast, or consumed in more than one package, it should live in the shared layer.

## Server

`@ieom/server` is the system authority.

Responsibilities:

- persist config
- normalize config on load/write
- own runtime state
- host REST API
- host Socket.IO protocol
- bridge OBS
- serve built overlay/admin in production

### Config Authority

The server is the single source of truth for `AppConfig`.

Sync model:

- `config:update`: full snapshot path for bootstrap/full convergence
- `config:patch`: incremental path for partial writes

REST model:

- full config read
- full config replace
- generic partial config patch
- specialized patch routes for high-frequency areas like audio, desktop, applications, and OBS settings

### State Machine

Real environment states:

- `LOBBY`
- `DESKTOP`

`TRANSITIONING` exists as a guard/sentinel, not as a real destination.

Scene-change behavior:

1. server resolves intro/exit pipelines
2. server commits state immediately
3. server broadcasts `transition:play`
4. server broadcasts `state:update`

Transition resolution precedence:

1. app intro/exit arrays
2. app legacy single-transition fields
3. scene intro/exit arrays
4. scene legacy single-transition fields
5. empty array

### Desktop Runtime

Desktop runtime state is separate from scene config.

Key behaviors:

- manual widget actions use `widget:toggle`
- ambiance actions are server-selected
- only an overlay client can be elected as ambiance leader
- overlay sockets self-identify as `runtime`, `embedded-preview`, or `dev`; the server prefers the top-level runtime overlay before falling back to preview/dev overlays
- an overlay is not eligible to lead until it reports runtime readiness: desktop mounted, cursor controller available, and widget runtime ready
- ambiance leadership is a short renewable lease, not just a connected socket; the leader must heartbeat or the server expires it and elects a replacement
- disabling widget ambiance clears the current leader and suppresses re-election until ambiance is enabled again
- the elected overlay acknowledges `ambiance:simulate`, later reports `started` when the first real execution step begins, and finally reports completion
- higher-ranked overlays can replace a lower-ranked leader only when no ambiance action is in flight; if leadership is lost mid-flight the server requests an overlay resync before continuing
- the leader executes the actual ambiance choreography; other clients follow by consuming mirrored cursor/menu events and the shared widget state broadcasts emitted from the leader
- `open` and `close` actions are usually consistent across clients because the leader emits explicit widget state changes
- `interact` actions are classified server-side as `shared-safe`, `leader-only`, or `unsafe-requires-runtime-event`
- `shared-safe` interactions still use leader cursor choreography, but their real effect is broadcast as explicit shared widget intents so followers converge without replaying arbitrary DOM clicks
- `leader-only` interactions intentionally remain local to the leader runtime
- `unsafe-requires-runtime-event` interactions are not considered safely mirrored until a dedicated shared runtime event exists
- Start menu state is synchronized as runtime state
- reconnect snapshots include widget ids, recycle-bin state, and Start menu state

### OBS

The server maintains the OBS WebSocket connection from persisted settings and reconnects automatically.

Constraint:

- OBS hotkeys are not passively observed
- admin/OBS actions execute through server-authoritative `keybind:execute`

## Admin

`@ieom/admin` is the authoring and control surface.

Main responsibilities:

- edit scenes
- edit applications/widgets
- edit desktop/global theme
- edit ambiance and events
- manage assets/settings/keybinds/audio/archive
- show embedded preview
- send runtime control actions

### Preview Model

The embedded preview can target runtime or overlay-dev mode.

Important consequence:

- the embedded preview is a real overlay socket, not a cosmetic mirror
- previewing `3000` creates an embedded runtime overlay client alongside the admin socket
- diagnostics should distinguish overlay identity by kind and port so it is clear whether ambiance leadership belongs to OBS/runtime or the embedded preview
- diagnostics should also expose overlay readiness, leader lease expiry, last heartbeat, and a short ambiance lifecycle history so admin debugging does not depend on raw logs

Preview-only behavior:

- theme-oriented editors can send unsaved patches into the iframe
- preview patches are local to the iframe and do not persist immediately
- `Save` remains the persistence boundary

Current live-preview emphasis:

- Global Theme edits
- widget theme override edits

### Authoring Model

Scenes:

- own sources, style, music, and transition authoring
- support saved default snapshots

Applications/widgets:

- own icon identity and launch/widget behavior
- widgets also depend on desktop config for window defaults and overrides
- support saved default snapshots

Global Theme:

- controls desktop theme preset, appearance fields, and shared widget theme
- supports saved defaults and preview-only live iteration

## Overlay

`@ieom/overlay` is the runtime renderer captured by OBS.

Main responsibilities:

- render active scene
- render desktop or lobby environment
- play transitions
- render effects/plugins
- consume runtime sync events
- support iframe-only preview patches

### Layer Order

Render order:

1. `BackgroundLayer`
2. `ParticlesLayer`
3. `LayerStack`
4. `LobbyScene` or `Desktop`
5. `CSSEffectsLayer`
6. `TransitionLayer`

Rule:

- scene `style` overrides root `overlayStyle`
- desktop chrome consumes scene typography/accent fields
- desktop background remains transparent unless explicitly configured

### Preview Overlay

The overlay supports an iframe-only preview layer on top of normal config sync.

Behavior:

- admin sends `ieom:config-preview` messages to the iframe
- overlay stores a preview base config
- overlay merges the incoming patch ephemerally
- clearing preview restores the last normal config without persistence

### Desktop Runtime

Desktop runtime includes:

- icons
- taskbar and Start menu
- notifications
- floating widget windows
- drag/resize interactions

Sync model:

- motion is mirrored live over sockets
- final icon/window state persists through PATCH routes

### Transitions And Effects

Transitions:

- overlay executes `transition:play` locally
- applies buffered `state:update` mid-sequence
- named steps resolve through a transition map
- `media:*` steps render full-screen image/video overlays

Effects:

- independent from scene transitions
- triggered through `overlay:show`
- dispatched through a registry model

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

## Communication Flow

Scene changes:

- UI emits `scene:change`
- server resolves transitions and commits state immediately
- server emits `transition:play` plus `state:update`
- overlay plays transition locally

Desktop runtime:

- widget/menu/notification/recycle-bin state syncs outside the scene machine
- drag/resize motion is live over sockets
- ambiance choreography is leader-executed and follower-mirrored, not fully replayed on every client
- final state persists through PATCH routes

Config propagation:

- admin usually writes partial config
- server normalizes and persists
- server emits `config:patch` for changed sections
- clients merge patches locally
- reconnect/bootstrap still uses full config snapshots

Reconnect recovery:

- overlay re-requests machine state
- overlay re-requests full config
- overlay re-requests desktop runtime snapshot

## How To Extend

When adding features, follow this order:

1. decide persisted config vs runtime-only state
2. update shared contract/types/defaults
3. update server persistence and socket authority
4. update admin authoring/control flows
5. update overlay rendering/runtime behavior
6. prefer partial writes and `config:patch` when possible
7. keep preview-only edits ephemeral until save

Typical feature shapes:

- new scene plugin: config shape, admin editor, overlay renderer
- new widget: widget identity, admin creation/editing, overlay widget runtime, desktop sync if needed
- new runtime sync feature: socket contract, server authority, admin/overlay store handling
- new config section: persisted type/defaults, server patch behavior, admin editor, overlay consumption if applicable

## Scope Of This File

This file is intentionally compact. It is a working architecture guide for implementation and extension work, not a full backlog or exhaustive API manual.

Backlog and polish ideas live in `recommendations.md`.