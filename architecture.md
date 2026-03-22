# IEOM Architecture

## Overview

IEOM (Interactive Experience Overlay Manager) is a self-hosted, real-time streaming overlay system. A single HTML page is registered as a Browser Source in OBS. From that point, the entire visual layer of the stream - backgrounds, scenes, effects, transitions, the simulated operating system, and the 3D lobby - is driven by this software, not by OBS scene switching.

The system is organized around a central idea: the stream is a continuous experience, not a collection of disconnected scenes. Transitions, audio, visual state, and idle behavior are all managed programmatically.

**Tech stack**: TypeScript, React, Node.js with Fastify, Socket.IO, SQLite, OBS WebSocket, GSAP, React Three Fiber, Zustand, 98.css.

---

## Monorepo Structure

IEOM is a pnpm workspace. This section is the physical map of the repo: where code lives, where media lives, and which package owns each responsibility.

### Root folders

| Path | Purpose |
|---|---|
| `assets/` | Shared runtime media library used by the server catalog, admin asset picker, and overlay runtime |
| `packages/` | All build targets in the monorepo |
| `packages/admin/` | React/Vite streamer control panel served on port 3002 in development |
| `packages/overlay/` | React/Vite OBS browser source frontend served on port 3001 in development |
| `packages/server/` | Fastify + Socket.IO backend, OBS bridge, config authority, and static host on port 3000 |
| `packages/shared/` | Cross-package contracts: types, enums, defaults, socket payloads, and constants |
| `package.json` | Workspace scripts such as `pnpm dev` and `pnpm build` |
| `pnpm-workspace.yaml` | pnpm workspace wiring |
| `tsconfig.base.json` | Shared TypeScript baseline used by all packages |

### assets/

`assets/` is the runtime media tree. The server indexes it, the admin browses it through the asset library, and the overlay consumes the selected paths at runtime.

| Path | Purpose |
|---|---|
| `assets/audio/sfx/` | Sound effects loaded by the AudioEngine |
| `assets/audio/music/` | Background music tracks organized by mood |
| `assets/backgrounds/` | Curated still backgrounds and wallpapers |
| `assets/images/` | Icons, UI art, thumbnails, gallery images, and other still media |
| `assets/images/games/` | Large screenshot library used by the gallery and asset browser |
| `assets/video/` | Looping background videos and scene media |
| `assets/overlays/`, `assets/particles/`, `assets/models/` | Supporting runtime assets for overlay visuals and future expansion |

Game images are scanned from `assets/images/games/`. The Gallery widget reads the asset catalog and filters entries with `kind: 'image'`, so images can remain grouped in nested folders without changing runtime behavior.

Recommended organization for large image collections:

- `assets/images/games/<game-name>/...` for game-specific screenshots
- `assets/images/gallery/<collection-name>/...` for non-game collections

The canonical audio layout is:

- `assets/audio/sfx/` for sound effects
- `assets/audio/music/` for looping background music

The legacy repo-root `assets/sfx/` and `assets/music/` paths should not be used for new files.

### Workspace behavior

`pnpm dev` starts three development servers in parallel:

| Package | Port | Purpose |
|---|---|---|
| `@ieom/server` | 3000 | Backend API, Socket.IO hub, OBS bridge, built app host |
| `@ieom/overlay` | 3001 | Overlay development server |
| `@ieom/admin` | 3002 | Admin/control panel development server |

`pnpm build` builds overlay first, then admin. After build, `@ieom/server` serves the overlay at `/` and the admin at `/admin`. OBS should point to port `3000` for the stable runtime browser source. Port `3001` exists only for direct overlay development and HMR.

---

## @ieom/shared

`@ieom/shared` is the contract package. Nothing runs here. If a field is persisted, broadcast over the socket, or imported by multiple packages, it belongs here.

Key structures:

**AppConfig** is the root persisted object. It holds scenes, applications, keybinds, OBS credentials, audio volumes, default overlay style, desktop config, desktop ambiance config, and saved event definitions.

**Scene** defines a visual state. A scene contains plugin `sources`, an optional `style`, optional `lobbyConfig`, optional `introTransitions` and `exitTransitions`, and an optional `musicTrack`. A scene can represent an environment (`LOBBY`, `DESKTOP`) or a user-created application scene.

**SourceInstance** is a placed, sized, and z-indexed plugin instance with a freeform config object. It is the atomic unit rendered by the overlay `LayerStack`.

**Application** is a desktop icon definition. `appType` determines behavior:

- `'scene'` launches a scene transition to `targetSceneId`
- `'widget'` opens a floating desktop window without changing machine state
- `'decoration'` renders a non-launchable desktop icon used for environmental dressing

Widget applications can also carry two secondary classifications:

- `widgetSource`: `'system'` for built-in desktop widgets that must exist, or `'user'` for operator-created widgets
- `widgetComponent`: the runtime base component used by the widget window, such as `camera`, `source`, `gallery`, `music`, `archive`, `chat`, or `sticky-notes`

`Application.icon` can be an emoji glyph or an uploaded image path/URL. `Application.iconPosition` is the persisted source of truth for manual icon placement when auto-arrange is off.

**DesktopConfig** holds desktop-runtime configuration: theme preset, default icon size, auto-arrange toggle, ambient icon animation mode, icon motion strength, sticky note defaults, recycle-bin defaults, widget positions/sizes, system sounds, and screen saver behavior.

**DesktopAmbianceConfig** holds automated desktop-simulation settings: master enable flag, evaluation interval, max-open-widget rules, open-while-one-open heuristics, and per-widget open/close/interact behavior tuning.

**LobbyConfig** holds the 3D lobby/room configuration: ambient light, fog, sky/floor colors, CRT glow, camera/star settings, and the room-life props such as the virtual pet, lava lamp, and fish tank.

**OverlayStyle** describes per-scene visual styling: background definition, CSS effect flags, particle preset, font family, accent color, and text color. Desktop theme presets consume the typography/accent fields for chrome styling, but they do not paint a wallpaper by themselves.

**EffectConfig** is a discriminated union for triggerable overlay effects. Effects can include delays and can be chained in arrays.

**TransitionStep** is the atomic unit of a transition pipeline: `{ id: string; duration?: number }`. The `id` can be a named GSAP key such as `'fade'` or `'zoom-in'`, or a media key such as `'media:video:/assets/...'`.

**TransitionPlayPayload** is the resolved transition payload for one scene change: `{ from: STATE; to: STATE; exit: TransitionStep[]; intro: TransitionStep[] }`.

All Socket.IO events are typed. Key events:

| Direction | Event | Payload |
|---|---|---|
| client -> server | `scene:change` | target `STATE` |
| client -> server | `desktop:state:request` | callback |
| client -> server | `widget:toggle` | widget app id |
| client -> server | `widget:simulate` | widget app id, leader-only |
| client -> server | `desktop:notify` | `{ title, body, icon?, durationMs? }` |
| client -> server | `desktop:recycle-bin` | `{ full }` |
| client -> server | `keybind:execute` | `{ scope, key?, action? }` |
| client -> server | `overlay:trigger` | `OverlayTriggerPayload` |
| client -> server | `transition:preview` | `TransitionStep[]` |
| client -> server | `state:request` | callback |
| client -> server | `panic` | none |
| server -> client | `state:update` | `{ state, previousState }` |
| server -> client | `transition:play` | `TransitionPlayPayload` |
| server -> client | `overlay:show` | `OverlayTriggerPayload` |
| server -> client | `config:update` | `AppConfig` |
| server -> client | `obs:status` | `{ connected }` |
| server -> client | `ambiance:leader` | `{ socketId: string | null }` |
| server -> client | `ambiance:metrics` | `{ accepted, rejected }` |
| server -> client | `widget:toggle` | widget app id |
| server -> client | `desktop:notify` | `{ title, body, icon?, durationMs? }` |
| server -> client | `desktop:recycle-bin` | `{ full }` |

Desktop runtime state that is not part of the main scene machine still has a typed contract. Overlay clients request a `desktop:state:request` snapshot on connect/reconnect so late-joining browser sources recover the current open-widget set and recycle-bin state.

---

## @ieom/server

`@ieom/server` is the system authority. It owns persisted config, desktop runtime state, the scene machine, the OBS bridge, the REST API, and the Socket.IO protocol. It also serves the built overlay and admin bundles in production.

### OBS Bridge

The server maintains a persistent WebSocket connection to OBS using `obs-websocket-js`. It boots from persisted `AppConfig.obs` credentials, reconnects automatically when OBS restarts, and reconnects again when the operator changes OBS settings.

`obs-websocket` does not expose a passive raw-hotkey event for arbitrary OBS bindings. IEOM therefore exposes a server-side `keybind:execute` path that runs configured actions authoritatively on the server. OBS-scoped bindings can be tested and executed through that path, but true passive OBS hotkey capture still requires an OBS-side forwarder or mirrored setup.

### Config Authority and REST API

The server is the single source of truth for `AppConfig`. The admin writes config here; the overlay reads from here; both clients stay in sync through `config:update` broadcasts.

REST API:

- `GET /api/config` returns the full `AppConfig`
- `PUT /api/config` replaces the full config, persists it, and broadcasts `config:update`
- `PATCH /api/config/audio` updates only `audio.masterVolume`, `audio.sfxVolume`, and `audio.musicVolume`
- `PATCH /api/config/desktop` updates only `desktopConfig`
- `PATCH /api/config/applications/:appId` updates one `Application` record
- `PATCH /api/config/obs` updates only OBS connection settings
- `GET /api/assets/catalog` returns the flattened asset catalog for the admin
- `POST /api/assets/refresh` invalidates and rebuilds the asset catalog

Media and archive endpoints sit beside the config routes. Media APIs expose scanned game images and other indexed assets. Archive APIs provide CRUD over the stats table and event log.

### Database

Persistence is SQLite with WAL mode. The database currently holds three logical stores:

- a key-value stats store for stream metrics
- a timestamped event log
- a config store containing persisted `AppConfig`

The config store is loaded on startup and rewritten on full config updates.

### Asset Catalog and Static Hosting

The server indexes the `assets/` tree and exposes them through `GET /api/assets/catalog`. The admin asset picker uses this catalog; the overlay uses the final selected paths at runtime. `POST /api/assets/refresh` forces a rescan after files are added or removed.

In production, the same server also hosts the built overlay at `/` and the built admin at `/admin`.

### Desktop Runtime State

The scene machine does not own widget visibility or recycle-bin fullness. Those are server-side desktop runtime concerns that live alongside the main machine. Desktop notifications are transient runtime socket events delivered directly to clients.

The server maintains:

- the set of currently open widget IDs
- the current recycle-bin fullness flag
- the current simulation leader socket ID for ambient cursor actions

Manual operator widget actions use `widget:toggle`. Automated ambient cursor actions use `widget:simulate`, but only the elected simulation leader is allowed to send it. The elected leader is broadcast via `ambiance:leader`.

### State Machine

The state machine manages the fixed environment states `LOBBY` and `DESKTOP`. A `TRANSITIONING` sentinel exists in the enum to block navigation to a transient state, but it is not a real destination.

These environment states switch renderer ownership, not just scene data. When the machine is settled in `DESKTOP`, the `LobbyScene` is not merely hidden, it is unmounted. That removes the active R3F canvas and the lobby render loop. The current implementation is not perfectly symmetrical because `Desktop` stays mounted and is CSS-hidden outside `DESKTOP`, so `LOBBY` still carries some background desktop React/UI overhead.

When a scene change is requested, the server resolves `exit` and `intro` pipelines before touching machine state. Resolution order:

1. app-level `exitTransitions` / `introTransitions`
2. app-level deprecated single-string `exitTransition` / `introTransition`
3. scene-level `exitTransitions` / `introTransitions`
4. scene-level deprecated single-string transition fields
5. empty array for an instant cut

The server then updates state immediately and broadcasts both `transition:play` and `state:update`. There is no round-trip completion ack. Transitions are fire-and-forget; the new state becomes authoritative immediately.

A `panic` action instantly forces the machine back to `DESKTOP` without animation.

### Scene and App Semantics

Only scene applications change machine state.

**Environments** are the fixed machine states `STATE.LOBBY` and `STATE.DESKTOP`. They are hard-coded and own their own `Scene` definitions, including `style`, `sources`, and `lobbyConfig` where relevant.

**Scene applications** (`appType: 'scene'`) are user-defined scenes launched from desktop icons. Launching one emits `scene:change` and the machine transitions to that scene id. Each application scene can define its own transition pipelines, background music, and optional launch pipeline.

**Widgets** (`appType: 'widget'`) open floating desktop windows on top of the current machine state. They do not emit `scene:change`, do not move the machine, and do not play scene transitions.

**Decorations** (`appType: 'decoration'`) are non-launchable desktop icons used only for environmental dressing. The built-in example is the recycle bin.

### Event Scheduler

The scheduler is config-driven. It evaluates persisted `AppConfig.events` on a short interval and executes any event whose `auto.enabled` flag is set.

- `mode: 'interval'` fires on a jittered cadence around `intervalMin`
- `mode: 'idle'` fires after `idleMin` minutes without operator activity
- operator activity resets the idle timer
- auto events do not fire while the machine is in `TRANSITIONING`

This means auto-event behavior now comes from the same persisted event definitions the admin edits, not from hardcoded timers.

---

## @ieom/admin

`@ieom/admin` is the authoring surface. This section is about what the operator can configure, not how the overlay renders it.

### Dashboard and Preview

The admin is a React SPA that connects to the server over Socket.IO on startup. The main dashboard shows current state, OBS connection status, left-side navigation, right-pane editors, an always-open socket console, and a live preview iframe.

The dashboard is intentionally split into taxonomy sections so operators can tell apart fixed environment states, scene definitions, scene-launching apps, desktop widgets, widget layouts, and decorative icons. The empty right pane also acts as a legend, explaining how these categories differ and what each one does at runtime.

The preview can target either `http://localhost:3000` (runtime) or `http://localhost:3001` (direct overlay dev server) through a persisted preview-target setting. The preview shows a badge so the operator can see which source is active. Lobby/Desktop editors can also show live-state notices when the preview/runtime is currently on the wrong environment.

### Shared Asset Library

The admin uses a shared catalog-backed asset library instead of separate per-form pickers. Scene backgrounds, scene media sources, application icons, recycle-bin icons, saved media entries, image/video URLs, and other media fields all browse the same server-indexed asset catalog.

### Scene and Application Configuration

The admin is where scene composition is authored.

**Scene configuration** includes:

- scene background/style values via `StyleEditor`
- plugin source creation, positioning, sizing, visibility, and z-index
- background music via `musicTrack`
- intro and exit transition pipelines via `TransitionList`

**Application configuration** includes:

- icon, label, and `appType`
- target scene for scene apps
- per-app transition overrides
- optional `launchPipeline` for scene apps
- icon artwork as emoji or uploaded image
- icon positions persisted back through the application PATCH route when manually dragged in the overlay

Application editors now include an explicit runtime-role summary so the operator can see whether the selected record is a scene app, a widget, or a decoration, and what signal it produces at runtime.

The widget-creation UX is now base-component driven. Operators create user widgets by choosing a runtime base such as `camera` or `source`, then configure the resulting widget record in the same editor used by built-in widgets. Widget configuration surfaces the persisted `widgetSource` (`system` vs `user`) and `widgetComponent` so the specialization stays visible.

### Desktop Configuration

The desktop editor owns desktop-specific runtime settings:

- theme preset
- desktop font, accent color, and text color
- default icon size
- auto-arrange toggle
- ambient icon animation mode
- icon motion strength
- sticky note defaults
- recycle-bin defaults and icon assets
- screen saver behavior
- system sound paths
- runtime test actions for desktop notifications and recycle-bin state

Wallpaper/background does not live in the theme panel. It remains in the desktop scene Background/Style editor so the overlay stays transparent unless the operator explicitly configures a background.

### Lobby Configuration

The lobby editor owns the 3D room configuration:

- ambient light and fog
- sky top / horizon / floor colors
- floor reflectivity
- CRT glow
- camera FOV and star density
- room-life props such as the virtual pet, lava lamp, and fish tank

This is the authoring surface for the bright white "time chamber" baseline and its variants.

### Ambiance Configuration

The ambiance editor owns the automated desktop/widget simulation settings:

- master enable/disable for widget simulation
- evaluation interval
- max open widgets
- open-while-one-open chance
- per-widget enable/disable
- per-widget open, close, and interact probabilities

This configuration does not describe a visual layer. It describes background desktop behavior authored by the operator and enforced through server-owned runtime state.

### Event Configuration

Events are edited as persisted `config.events` records inside the dashboard. Each event can configure:

- label, icon, and description
- ordered effect stack
- auto-trigger settings
- interval vs idle trigger mode

### Keybinds, Audio, Settings, and Archive

**Keybinds** are additive rows with a scope (`admin` or `obs`), a captured key, a mapped action, and a row-level Run button. The Run button executes through the server-side `keybind:execute` path so bindings can be tested before saving.

**Audio** exposes master, SFX, and music volume controls.

**Settings** exposes OBS WebSocket URL/password, connection testing, preview routing, and integration guidance. Settings now open in a modal with General, Audio, and Keybind tabs instead of living as separate sidebar destinations.

**Archive** exposes stream stats and the event log, and allows manual increments and resets.

Config changes are written through PUT or targeted PATCH routes on the server, which immediately rebroadcasts the resulting config to all clients.

---

## @ieom/overlay

`@ieom/overlay` is the runtime renderer captured by OBS. It is where admin-authored config becomes pixels, audio, DOM, canvas, and 3D scene state.

### Layer Priority

The overlay renders a fixed set of layers in z-order. Each layer is wrapped in a `LayerErrorBoundary`; if one layer throws, it renders nothing and the rest of the overlay keeps running.

| Order | Layer | What it contains | Admin-owned input |
|---|---|---|---|
| 1 | `BackgroundLayer` | CSS scene background: gradient, image, video, or pattern | `Scene.style.background` |
| 2 | `ParticlesLayer` | Canvas particle presets such as stars, snow, matrix, fireflies, and ash | `Scene.style.particles` |
| 3 | `LayerStack` | All `SourceInstance` plugins for the active scene | `Scene.sources` |
| 4 | `LobbyScene` or `Desktop` | The active environment owner: 3D room or desktop OS surface | `Scene.lobbyConfig`, `DesktopConfig`, `Application[]` |
| 5 | `CSSEffectsLayer` | Full-frame CRT, vignette, grain, flicker, chromatic aberration | `Scene.style.effects` |
| 6 | `TransitionLayer` | Persistent DOM targets used by GSAP/media transitions | resolved `TransitionPlayPayload` |

If a scene defines no `style`, the overlay falls back to `AppConfig.overlayStyle`.

### Desktop Surface

The `Desktop` runtime is the Win98-like OS layer shown in `DESKTOP` state. It contains:

- desktop icons
- taskbar and start/menu chrome
- widget buttons
- system tray elements
- volume popup
- balloon/toast notifications
- context menus
- floating desktop windows with open/close animation

The desktop consumes `DesktopConfig` for theme, icon behavior, sticky notes, recycle-bin defaults, screen saver behavior, and sound configuration. It consumes `Application[]` for icons. It consumes the server-owned desktop runtime snapshot for open widgets and recycle-bin fullness. It consumes the typography/accent fields from `OverlayStyle` for chrome styling.

Theme presets style only desktop chrome. The desktop remains transparent unless `BackgroundLayer` is given an explicit desktop background.

When auto-arrange is off, icons can be dragged directly on the desktop. Their positions persist through `Application.iconPosition` via a targeted PATCH request to the server.

Built-in desktop widgets are currently:

| ID | Component | Notes |
|---|---|---|
| `music` | `MusicWidget` | Animated VU bars, marquee, transport controls |
| `spotify` | `MusicWidget` | Alias id mapped to the same widget |
| `archive` | `ArchiveWidget` | Session timer and state-change log |
| `chat` | `ChatWidget` | Draggable chat window |
| `sticky-notes` | `StickyNotesWidget` | Persistent note text and color |
| `gallery` | `GalleryWidget` | Random image gallery with manual next and auto-rotate |
| `camera` | `CameraWidget` | Dedicated camera capture window with device defaults |

User-created widgets currently support at least two base runtimes:

| Widget Component | Runtime | Notes |
|---|---|---|
| `camera` | `CameraWidget` | Opens another camera-backed widget window using its own persisted defaults |
| `source` | `SourceWidget` | Renders a selected `SourceInstance` from a scene inside a desktop window |

Unknown widget ids fall back to `GenericWidget`, a minimal placeholder Win98 window.

### Transition Runtime

A Zustand-watching transition component runs outside the main render tree. When the server emits `transition:play`, the overlay receives a `TransitionPlayPayload` containing ordered `exit` and `intro` pipelines and executes them in sequence:

1. run the exit pipeline
2. apply the buffered state from `state:update`
3. run the intro pipeline
4. clear the pending transition

If a step id resolves to a GSAP timeline in `TRANSITION_MAP`, that timeline is played. If the step id starts with `media:`, a full-screen image or video overlay is shown for that step. Unknown ids are skipped. If both pipelines are empty, the state change becomes an instant cut.

The overlay does not ack completion back to the server. The server has already committed the new state.

Available named GSAP transitions include `zoom-in`, `zoom-out`, `win98-loading`, `crt-wipe`, `channel-sweep`, `boot-sequence`, `fade`, `glitch-burst`, `static-burst`, `wipe-left`, and `wipe-right`.

### Effect System

Effects are independent of scene transitions. The server triggers them via `overlay:show`. The overlay dispatches them through a flat registry:

- `registerEffect(type, handler)` registers a handler
- `dispatchEffect(type, cfg)` resolves and runs it
- `replaceEffect(type, handler)` allows hot-swapping from the browser console

Available effects include death overlay, victory overlay, revive overlay, network glitch, notification box, terminal toast, typewriter text, vignette pulse, floaties, screen shake, archive corruption, static burst, image overlay, and video overlay.

### Plugin System

Scene plugins are self-contained React components registered in a central registry. Each plugin receives a freeform config object and renders inside the `LayerStack`. Current plugin types include image slideshow, CRT effect, solid color, text widget, static image, video loop, vignette, noise grain, and clock widget.

### Audio Engine

The overlay owns a singleton Web Audio API engine. It preloads SFX from `assets/audio/sfx/` and plays them in response to overlay events. If a file is missing, it synthesizes a fallback sound with oscillators. The engine handles AudioContext unlock for OBS browser sources and fails gracefully if audio is unavailable.

`playMusic(url, crossfadeMs)` manages looping scene music. On scene change, the overlay reads the active scene's `musicTrack` and crossfades accordingly. `setMusicVolume(v)` adjusts music independently of SFX.

---

## Communication Flow

### Scene changes

The admin emits `scene:change` for environments and scene apps. The server resolves transition pipelines, commits the new state immediately, and broadcasts both `transition:play` and `state:update`. The overlay plays the transition locally and applies the buffered state at the midpoint of the sequence.

### Widget and desktop runtime events

Widgets do not go through the scene machine. Admin or runtime UI emits `widget:toggle`, the server updates desktop runtime state, and all overlay clients mirror the result into the global store. The same side-channel approach is used for `desktop:notify` and `desktop:recycle-bin`.

### Config propagation

Most config changes originate in the admin and are written to the server via PUT or targeted PATCH routes. The overlay also has one direct persistence path: manual desktop icon dragging PATCHes `/api/config/applications/:appId` with a new `iconPosition`. In all cases the server persists the change and rebroadcasts `config:update` so every client converges on the same config.

### Reconnect and state recovery

On every connect or reconnect, overlay clients re-request:

- current machine state
- current config
- desktop runtime snapshot (`openWidgetIds`, `recycleBinFull`)

This lets late-joining or recently reconnected browser sources recover the same runtime state without a manual page reload.

### Keybind execution and transition preview

Keybinds are server-authoritative. The admin forwards bindings through `keybind:execute`, and the server resolves them into the same scene/widget/event/panic operations used elsewhere.

`transition:preview` lets the admin test a `TransitionStep[]` pipeline without a real scene change. The server emits a synthetic `transition:play` where `from === to`, so the overlay plays the sequence in place and then idles.

---

## Recommendations

### Things To Cut

The **EffectsLayer** file still exists as a reserved `null` render in `packages/overlay/src/layers/EffectsLayer.tsx`, but the runtime mounts `CSSEffectsLayer` instead. If there is no concrete plan to revive a separate post-processing layer, delete the unused file and any references to it so the architecture does not drift away from the real runtime.

### Things To Add

The **gallery-scroll screensaver** currently fades between full images every 4 seconds. A more interesting version would scroll inside each game's folder (multiple screenshots per game), display the game name more prominently, and support keyboard navigation to skip to the next game.

The **desktop icon layout system** now supports manual dragging with persistence, but there is still no first-class layout management UX around it. Add `Snap to grid`, `Reset icon positions`, and `Auto-arrange once` actions so operators can recover from messy layouts without manually editing every `Application.iconPosition` field.

The **boot sequence transition** (`boot-sequence`) is a standard named GSAP transition that any scene can include in its `introTransitions` pipeline. No built-in default scene has it configured out of the box. To play the boot sequence on startup, add `{ id: 'boot-sequence' }` as the first step in `DESKTOP.introTransitions` (or whichever scene loads first). This should be surfaced in the admin transition-picker help text so it is discoverable without reading source.

The **media file upload** currently supports video and image files via `POST /api/upload/asset`, which saves to `assets/video/` or `assets/images/`. There is no delete endpoint. Once a file is uploaded it can only be removed by manual filesystem access. Adding `DELETE /api/asset?path=...` (with path validation to prevent directory traversal) would let the admin's media library clean up unused files without touching the server manually.

The **lobby sky system** now uses a nearer 3D sky hall with editable top and horizon colors, including 8-digit hex authoring. If image, video, or pattern backgrounds are expected to appear directly in the lobby itself rather than only in the CSS background layer behind the canvas, the overlay needs a dedicated 3D hall material path for those media types instead of the current color/gradient tint bridge.

### Things To Polish

The **launchPipeline UI** allows adding effects by type and setting delay, but does not expose per-effect config fields (e.g. the message for `terminal-toast`, the color for `vignette-pulse`). Currently those require JSON editing. Expanding the effect editor with per-type config forms is the next step.

The **TransitionList pipeline preview** still only previews individual steps - clicking the preview button inside a `TransitionPicker` row sends `[{ id }]` as a one-step pipe. There is no button to fire the entire exit or intro pipeline as configured. A panel-level "Preview pipeline" button that calls `socket.emit('transition:preview', steps)` with the full array would let the streamer verify a multi-step chain before going live.

The new shared **hex color editor** now supports live picker updates and `#RRGGBBAA`, but the admin UI still does not explain the desktop-specific alpha semantics. Desktop chrome can use the authored text color directly, while desktop icon labels and text-style glyph icons intentionally use the opaque RGB portion so non-image icons do not disappear when alpha is `00`. That rule should be documented inline in the desktop Theme editor, and ideally split into separate controls if operators need independent icon-label color behavior.

The **desktop icon drag UX** works, but the desktop context menu still shows disabled placeholder actions and does not expose the new layout capabilities. `Arrange Icons`, `Snap to Grid`, and `Reset to Saved Defaults` should be real commands instead of dead menu items so the runtime feels like a complete OS surface rather than a partially interactive mock.

The **desktop icon text readability** path has become a stack of CSS overrides after several iterations around transparency, alpha-aware text colors, and selection styling. That logic should be centralized into a small set of desktop label tokens or helper classes so future theme/text-color changes do not keep regressing icon readability.

The **widget system** works but `WIDGET_COMPONENTS` in `Desktop.tsx` is a hardcoded map. Adding a new widget requires editing source code. A cleaner model would be a plugin-style registry like the effect system - each widget self-registers with an ID, a display name, and a component. New widgets could then be dropped in without touching `Desktop.tsx`.

The **GenericWidget fallback** shows a placeholder window for any unregistered widget ID. This is a useful safety net but is not a real feature. Any widget ID that reaches `GenericWidget` in production is a bug (missing registration). The fallback should log a warning so it is not silently swallowed.

The **ChatWidget** currently only displays seeded demo messages - it has no live data source. It should connect to a Twitch EventSub or IRC feed via the server, which would broadcast incoming chat messages as a socket event. The widget renders the message list; the server owns the connection.

The **MusicWidget** (used by both `music` and `spotify` IDs) shows a simulated elapsed timer and static track name. It does not track real playback. To make it useful it needs a data source - either the server polling the Spotify Web API and broadcasting current track info, or the overlay reading from a local file written by a Spotify integration tool.

### Bugs

- obs-websocket still does not emit arbitrary OBS hotkey keypress events back to IEOM. OBS-scoped bindings are now executable and testable through the server-side `keybind:execute` path, but fully passive "press key inside OBS and let the bridge observe it" support still needs an OBS-side helper, plugin, or manual mirroring workflow.
- Lobby background handling is still split by renderer: color and gradient backgrounds can tint the 3D sky hall, but image/video/pattern backgrounds remain CSS-only behind the lobby canvas. If operators expect every background type to appear directly in the 3D lobby, that still needs dedicated implementation.