# IEOM Architecture

## Overview

IEOM (Interactive Experience Overlay Manager) is a self-hosted, real-time streaming overlay system. A single HTML page is registered as a Browser Source in OBS. From that point, the entire visual layer of the stream — backgrounds, scenes, effects, transitions, the simulated operating system, the 3D lobby — is driven by this software, not by OBS scene switching.

The system is organized around a central idea: the stream is a continuous experience, not a collection of scenes. Transitions, audio, visual state, and idle behavior are all managed programmatically.

**Tech stack**: TypeScript, React, Node.js with Fastify, Socket.IO, SQLite, OBS WebSocket, GSAP, React Three Fiber, Zustand, 98.css.

---

## Monorepo Structure

The project is a pnpm workspace with four packages. Each package is an independent build target with its own dev server.

| Package | Port | Purpose |
|---|---|---|
| @ieom/server | 3000 | Backend API, state, OBS bridge, built app host |
| @ieom/overlay | 3001 | Overlay development server |
| @ieom/admin | 3002 | Streamer control panel |
| @ieom/shared | — | Types and constants only |

**@ieom/shared** is a pure type and constants library. It exports every TypeScript interface, enum, socket payload, and default config used across the project. The server, overlay, and admin all import from it. Nothing runs here — it is a contract.

**@ieom/server** is the backend. It owns state, persistence, OBS integration, the HTTP/Socket API, and serves the built overlay at `/` and built admin at `/admin`. It is the single source of truth for the entire system.

**@ieom/overlay** is the OBS Browser Source frontend. In development it runs as a standalone React/Vite SPA on port 3001; after build, the same bundle is served by the server on port 3000. OBS should point at **3000** for a stable browser source. Port **3001** exists for fast frontend iteration and HMR.

**@ieom/admin** is the streamer control panel. It is a React/Vite SPA served at port 3002. It no longer hosts or builds the overlay. The live preview in the admin dashboard can target either the canonical runtime URL (`http://localhost:3000`) or the direct overlay dev server (`http://localhost:3001`) via a persisted preview-target setting; the dashboard shows a badge on the preview so the operator can see which source is active.

`pnpm dev` starts all three servers in parallel. `pnpm build` builds overlay first, then admin.

---

## Shared Types

The type system is the backbone of the entire protocol. Key structures:

**AppConfig** is the root object. It holds all scene definitions, applications, keybinds, OBS credentials, audio volumes, the default overlay style, desktop config, and event schedules.

**Scene** defines a visual state: a list of plugin source instances, an optional overlay style, optional 3D room config (Lobby only), optional entry and exit transition names, and an optional `musicTrack` URL. When the overlay enters this scene, the AudioEngine crossfades to the specified track (or fades to silence if absent).

**SourceInstance** is a placed, sized, and z-indexed plugin instance with a freeform config object.

**Application** is a desktop icon. Its `appType` field determines behaviour:
- `'scene'` — launching transitions the overlay to a new scene. Carries a `targetSceneId`, transition overrides, and an optional `launchPipeline` (sequenced effects + delay before the scene change fires).
- `'widget'` — launching opens a floating desktop window on top of the current scene. No scene change, no GSAP scene transition. The app carries an icon and label only; `targetSceneId` is ignored at runtime.
- `'decoration'` — a non-launchable desktop icon used purely for environment dressing (for example, Recycle Bin).

`Application.icon` can be either an emoji glyph or an uploaded image path/URL from the asset library. The desktop, taskbar, start menu, and admin editor all understand both forms.

**DesktopConfig** is now a larger runtime contract rather than only icon/screen-saver settings. It includes theme preset, ambient icon animation mode, sticky notes defaults, recycle-bin icon state, widget positions, system sounds, and screen-saver configuration. Desktop notifications are runtime socket events, not persisted desktop-config fields.

**OverlayStyle** describes every visual property of a scene: background type, CSS effect flags, particle preset, desktop font, accent color, and text color. Desktop theme presets consume those typography/accent fields for chrome styling, but they do not paint a wallpaper/background on their own.

**EffectConfig** is a discriminated union of all triggerable overlay effects. Effects have an optional delay and can be chained in arrays, allowing a single event to compose multiple animations in sequence.

**TransitionStep** is the atomic unit of a transition pipeline: `{ id: string; duration?: number }`. The `id` is either a named GSAP key (e.g. `'fade'`, `'zoom-in'`) or a media string (`'media:video:/assets/…'`, `'media:image:/assets/…'`). An optional `duration` overrides the animation's default length.

**TransitionPlayPayload** is the full pipeline for one scene change: `{ from: STATE; to: STATE; exit: TransitionStep[]; intro: TransitionStep[] }`. The exit pipeline plays before the scene content swaps; the intro pipeline plays after.

**All Socket.IO events are strongly typed** — there are no magic strings in the protocol. Key events:

| Direction | Event | Payload |
|---|---|---|
| client → server | `scene:change` | target STATE |
| client → server | `desktop:state:request` | callback |
| client → server | `widget:toggle` | widget app id (string) |
| client → server | `desktop:notify` | `{ title, body, icon?, durationMs? }` |
| client → server | `desktop:recycle-bin` | `{ full }` |
| client → server | `keybind:execute` | `{ scope, key?, action? }` |
| client → server | `overlay:trigger` | OverlayTriggerPayload |
| client → server | `transition:preview` | `TransitionStep[]` |
| client → server | `state:request` | callback |
| client → server | `panic` | — |
| server → client | `state:update` | `{ state, previousState }` |
| server → client | `transition:play` | `TransitionPlayPayload` |
| server → client | `overlay:show` | OverlayTriggerPayload |
| server → client | `config:update` | AppConfig |
| server → client | `obs:status` | `{ connected }` |
| server → client | `widget:toggle` | widget app id (string) |
| server → client | `desktop:notify` | `{ title, body, icon?, durationMs? }` |
| server → client | `desktop:recycle-bin` | `{ full }` |

Desktop runtime state that is **not** part of the main scene machine still has a typed contract. On connect/reconnect, overlay clients request a `desktop:state:request` snapshot so late-joining clients (including OBS browser sources) recover the current set of open widgets and the recycle-bin state instead of waiting for the next toggle event.

---

## Server

### OBS Bridge

The server maintains a persistent WebSocket connection to OBS using obs-websocket-js. It boots from the persisted OBS URL/password in `AppConfig.obs`, reconnects automatically if OBS is closed and reopened, and reconnects again when the operator changes OBS credentials in Settings. Client OBS status is broadcast in real time.

obs-websocket does not expose a passive “raw hotkey pressed” event for arbitrary OBS keybindings, so the bridge cannot directly observe every keyboard shortcut the user presses inside OBS. Instead, IEOM now exposes a server-side `keybind:execute` socket path that executes configured actions authoritatively on the server (scene transitions, widget toggles, event triggers, panic). OBS-scoped bindings use that path and can be run/tested from the admin, but true passive OBS hotkey capture still requires an OBS-side forwarder or manual mirroring.

### Socket Reconnection

The overlay registers a `connect` handler on the Socket.IO client. On every connect — including reconnects after the server restarts or the network drops — it re-requests the current state, re-fetches the config, and requests a desktop runtime snapshot (`openWidgetIds`, `recycleBinFull`). The overlay continues rendering last-known state while disconnected and snaps back into sync automatically without a page reload.

### Desktop Runtime State

The scene machine does **not** own widget visibility or recycle-bin fullness. Those are server-side desktop runtime concerns that live alongside the machine. Desktop notifications are transient runtime events delivered directly over the socket path.

The server maintains:
- the set of currently open widget IDs
- the current recycle-bin fullness flag

When a client emits `widget:toggle`, the server updates its widget set and broadcasts the toggle. When a client emits `desktop:recycle-bin`, the server updates the recycle-bin flag and broadcasts it. When a new overlay client connects, it requests the current desktop runtime snapshot so it can render the same desktop state as already-connected clients.

### REST API

The server exposes a small REST API:

- `GET /api/config` — returns the full AppConfig object.
- `PUT /api/config` — replaces the entire AppConfig, persists to SQLite, and broadcasts `config:update` to all clients.
- `PATCH /api/config/audio` — updates only `audio.masterVolume`, `audio.sfxVolume`, `audio.musicVolume` and broadcasts without touching scenes or applications.
- `PATCH /api/config/desktop` — updates only `desktopConfig` fields such as widget positions, sticky notes, recycle-bin defaults, screen saver settings, and system sounds.
- `PATCH /api/config/obs` — updates only `obs.url` and `obs.password`.
- `GET /api/assets/catalog` — returns the indexed asset library from `assets/` plus scraped game images, flattened into typed image/video/audio records for the admin asset browser.
- `POST /api/assets/refresh` — invalidates the cached asset catalog and rescans the asset tree.
- Media: Scans the asset directories for game images and returns them as lists or random picks.
- Archive: CRUD for a stream stats table and an event log, backed by SQLite.

### Database

SQLite with WAL mode. Three tables: a key-value stats store for stream metrics, a timestamped event log, and a config store. The config store is used by the config route — `AppConfig` is loaded from it on startup and written back on every PUT request.

## Assets

Game images are scanned from `imagescrap/output/` or symlinked into `assets/images/games/`. The media API abstracts the source. Backgrounds, video loops, SFX, and music are served statically from the `assets/` directory.

The canonical audio layout is:
- `assets/audio/sfx/` — sound effects (loaded by AudioEngine)
- `assets/audio/music/` — background music tracks, organized by mood (ambient, broadcast, chill, suspense)

The flat `assets/sfx/` and `assets/music/` directories at the repo root are legacy paths and should not be used for new files.

### State Machine

The state machine is the core of the server. It manages two implemented states: **LOBBY** (3D room) and **DESKTOP** (Win98 OS layer). A `TRANSITIONING` sentinel value exists in the enum to block navigating to a transient state, but it is not a real destination.

When a scene change is requested, the server resolves `exit` and `intro` pipeline arrays before touching the machine. Resolution order (first match wins):
1. App-level `exitTransitions` / `introTransitions` arrays on the matching `Application` record
2. App-level deprecated single-string `exitTransition` / `introTransition` fields (wrapped into a one-element array)
3. Scene-level `exitTransitions` / `introTransitions` arrays on the `Scene` object
4. Scene-level deprecated single-string fields
5. Empty array (instant cut)

The machine then updates state immediately and emits `transition:start` (carrying the resolved arrays) and `state:change` simultaneously. The server broadcasts both `transition:play` (with the full `TransitionPlayPayload`) and `state:update` to all connected clients. There is no lock state, no safety timer, and no `transition:complete` round-trip. Transitions are fire-and-forget — the machine does not wait for the overlay to finish before considering the new state authoritative.

A `panic` action is available: it instantly forces the state to DESKTOP without any animation.

### Navigable Elements

Everything on the desktop is one of three kinds. Only scene apps can cause a state transition.

**Environments** (`STATE.LOBBY`, `STATE.DESKTOP`) are the two fixed machine states. They are hard-coded in the enum. Transitioning between them uses named GSAP timelines. Each environment is a `Scene` definition with its own full layer stack configuration (`style`, `sources`, `lobbyConfig`).

**Application scenes** (`appType: 'scene'`) are user-defined scenes reached by double-clicking a desktop icon. Launching one emits `scene:change` to the server and the machine transitions to the scene's string ID (e.g. `scene-battlefield6`). The overlay renders a completely independent layer stack driven by that scene's own `style` and `sources`. Each application scene can define its own `introTransition`, `exitTransition`, background music, and `launchPipeline`.

**Widgets** (`appType: 'widget'`) are floating desktop windows that open on top of the current state. Double-clicking a widget icon — on the desktop canvas **or** in the admin sidebar — does **not** emit `scene:change`, does not move the machine, and does not play any GSAP scene transition. The desktop and its active scene remain exactly as-is beneath the window. The source of truth for widget open/closed state is the **server-side desktop runtime set**; the overlay mirrors it into the Zustand store and also uses local UI state for minimize/restore and close animation.

**Decorations** (`appType: 'decoration'`) are desktop-only icons with no launch action. They exist to make the environment feel like a real OS without affecting state. The built-in example is `recycle-bin`, whose icon changes between empty/full states via desktop runtime events.

Registered widgets (`WIDGET_COMPONENTS` in `Desktop.tsx`):

| ID | Component | Notes |
|---|---|---|
| `music` | MusicWidget | Animated VU bars, track marquee, transport controls |
| `spotify` | MusicWidget | Alias — user config ID that maps to MusicWidget |
| `archive` | ArchiveWidget | Session timer, state-change log |
| `chat` | ChatWidget | Draggable chat window with message list |
| `sticky-notes` | StickyNotesWidget | Persistent note text and color saved in DesktopConfig |

Any `appType: 'widget'` app with an unregistered ID falls back to `GenericWidget` — a minimal draggable Win98 window that shows the app icon and label.

### Transition Engine

A Zustand-watching component that runs outside the render tree. When the server emits a `transition:play` event, the engine receives a `TransitionPlayPayload` containing two ordered `TransitionStep[]` pipelines and runs them sequentially:

1. **Exit pipeline** — each step runs to completion before the next begins.
2. **`applyState()`** — the buffered visual state (buffered from the simultaneous `state:update`) is applied here at the midpoint: scene content swaps while hidden by the exit animation.
3. **Intro pipeline** — each step runs to completion before the next begins.
4. **`complete()`** — clears the pending transition from the store.

For each step: if the ID resolves to a GSAP timeline in `TRANSITION_MAP`, the timeline is played (with optional `step.duration` override). If the ID starts with `media:`, a video or image overlay fills the screen for the step's duration before the next step starts. Unknown IDs are skipped silently. If both pipelines are empty, the state change is an instant cut.

The engine does not report back to the server — the server has already committed the new state.

All GSAP transition IDs are self-documenting. Available named transitions:

| ID | Description |
|---|---|
| `zoom-in` | Zoom into desktop from lobby |
| `zoom-out` | Zoom back out to lobby |
| `win98-loading` | Win98-style loading bar |
| `crt-wipe` | CRT power-off wipe |
| `channel-sweep` | TV channel static sweep |
| `boot-sequence` | Full PC boot sequence (assign as scene `introTransition`) |
| `fade` | Simple cross-fade |
| `glitch-burst` | Digital glitch flash |
| `static-burst` | Static noise burst |
| `wipe-left` | Horizontal wipe left |
| `wipe-right` | Horizontal wipe right |

### Event Scheduler

The scheduler is now config-driven. It evaluates saved `AppConfig.events` definitions on a short interval and executes any event whose `auto.enabled` flag is set.

- `mode: 'interval'` events fire on a jittered cadence around `intervalMin`.
- `mode: 'idle'` events fire after `idleMin` minutes without operator activity.
- Operator activity (`scene:change`, `panic`, widget toggles, notifications, recycle-bin changes, transition previews, manual overlay triggers) resets the idle timer.
- Auto events do not fire while the machine is in `TRANSITIONING`.

This means auto-event behaviour now comes from the same persisted event definitions the admin edits, rather than from a hardcoded network-glitch timer.

---

## Admin

A React SPA that connects to the server over Socket.IO on startup. It syncs state and config in real time. The live preview panel embeds an iframe pointed at either `http://localhost:3000` or `http://localhost:3001` depending on the persisted preview-target toggle, and the preview itself renders a badge indicating whether it is currently showing the runtime or direct dev source.

**Dashboard** — The main control view. Displays current state, OBS connection status, navigation, the live preview, an always-open socket console, widget OPEN/CLOSED badges sourced from the server-owned desktop runtime snapshot, and the right-pane editors for scenes, environments, apps, and events.

The admin now has a shared asset-library surface instead of separate per-form pickers. Scene background images/videos, application icons, recycle-bin icons, saved media entries, and image/video source URLs all use the same catalog-backed asset picker, which browses the indexed `assets/` tree, scraped game images, and saved media presets.

**DesktopConfigEditor** — The desktop-specific editor inside the dashboard. It controls theme presets, desktop font/accent/text appearance, icon size, auto-arrange, ambient icon motion, sticky notes defaults, recycle-bin icons/state, screensaver settings, and system sound paths. It also includes runtime test buttons for desktop notification and recycle-bin events. Wallpaper/background remains in the desktop scene Background editor so the overlay stays transparent unless operators explicitly configure a background.

**SceneEditor** — Create and edit scenes. Add, position, and configure plugin sources. Each scene has a **Background Music** field — a URL or `/assets/audio/music/` path that the overlay will loop while the scene is active, with a 1.5 s crossfade on entry. The config form is generated dynamically from the plugin type. Each scene's **Transitions** panel shows a `TransitionList` for both Intro and Exit — an ordered pipeline editor where each row is a full `TransitionPicker`. Steps can be added, removed, and reordered (↑↓) to compose multi-step transition sequences.

**LobbyConfigEditor** — The lobby editor inside the dashboard. It now owns the bright white “time chamber” baseline, per-lobby style settings, open-sky world controls (sky top color, horizon color, floor color, floor reflectivity), and the “Room Life” props: virtual pet, lava lamp, and fish tank.

**Event editor** — Events are now edited as persisted `config.events` records inside the dashboard rather than as disconnected panel-local state. Each event has an icon, label, description, auto-trigger settings, and an ordered effect stack.

**KeybindEditor** — Keybinds are now additive rows with a scope (`admin` or `obs`), captured key, mapped action, and a row-level Run button. The Run button uses the server-side `keybind:execute` path so bindings can be tested before saving.

**AudioPanel** — Master, SFX, and music volume sliders.

**SettingsPage** — OBS WebSocket URL and password, connection test, preview routing toggle, and integration guide.

**SettingsModal** — Audio and keybinds are no longer separate sidebar destinations. Settings now open in a modal with General, Audio, and Keybinds tabs.

**ArchivePanel** — View and manually increment stream stats. Browse the event log. Reset archive data.

Config changes are saved via PUT (or PATCH for audio/desktop/obs sub-routes) to the server, which rebroadcasts them to the overlay immediately.


### Communication Flow

The admin panel emits `scene:change` with a target state for environments and scene apps. For widget apps it emits `widget:toggle(id)` instead. The server validates scene transitions, updates state immediately, and broadcasts `transition:play` and `state:update` to all clients. The overlay runs its GSAP animation upon receiving `transition:play` — it does not acknowledge completion. Both admin and overlay update their local stores from `state:update`.

Widget toggles bypass the state machine entirely: admin → server desktop runtime state → all overlay clients → Zustand store → React render. Overlay clients also request the desktop runtime snapshot on connect so late-joining browser sources recover already-open widgets.

Desktop notifications and recycle-bin state also bypass the scene machine. They move through dedicated socket events (`desktop:notify`, `desktop:recycle-bin`) and are rendered entirely by the desktop layer. Notification duration and stack limits are runtime defaults rather than persisted desktop-config values.

Keybind execution is now server-authoritative. The admin forwards bindings through `keybind:execute`, and the server resolves the action into the same scene/widget/event/panic operations it would perform for direct UI interaction. OBS-scoped bindings share that path, but passive OBS hotkey capture is still limited by obs-websocket as described above.

Config changes propagate from admin to server to overlay in one round-trip. The overlay and admin are always in sync because both receive the same `config:update` broadcast.

`transition:preview` lets the admin fire a test pipeline to the overlay without triggering a real scene change. The admin passes a `TransitionStep[]`; the server emits a `transition:play` with `from === to` and `intro: []`, so the overlay plays it in place and then idles.

---

## Overlay

The overlay is a React application that renders entirely inside a 1920x1080 div captured by OBS. It receives all state and events from the server via WebSocket and renders accordingly. It never modifies state.

### Layer Stack

The visual output is built from a fixed set of layers rendered in z-order. **Each layer is wrapped in a `LayerErrorBoundary`** — if a layer throws a React error, it silently renders nothing and the rest of the overlay continues running. Nothing goes white mid-stream.

**BackgroundLayer** — CSS only. Renders the scene background: gradient, image URL, looping video, or one of several CSS pattern presets. Older solid-color configs are normalized to solid gradients.

**ParticlesLayer** — Canvas-based. Five particle presets: stars, snow, matrix, fireflies, and ash. Each has its own spawn and movement logic drawn per-frame.

**LayerStack** — Renders all SourceInstances for the current scene. Each plugin is mounted inside an absolutely-positioned div at its configured coordinates and z-index.

**LobbyScene** — A React Three Fiber scene, mounted only when the state is LOBBY. It now renders as an open, uncontained space rather than a closed room: a large reflective floor plane under a configurable sky gradient (top color + horizon color), plus the desk cluster, optional room-life props, dust motes, and fog. The old bookshelf and neon room-strip framing are gone so the scene reads as floor-and-sky void space rather than a contained room, and the camera/light rig now frames the desk cluster with a slower cinematic quarter-orbit instead of the older room-centered sway. It owns its own scene style instead of inheriting the purple CRT global fallback.

**Desktop** — The OS simulation shown in DESKTOP state. It now includes theme presets (Win98, Frutiger Aero, Y2K Candy, Midnight Chrome, Sunset Boulevard, Coastal Glass, Amber Terminal, custom), ambient icon animations, a taskbar with widget buttons, a system tray network pulse, notification badge, volume popup, balloon/toast notifications, context menus, and floating desktop windows with open/close animation. App icons can be emoji or uploaded images. Styled with 98.css plus desktop-specific CSS variables and overrides. Theme presets style only chrome; the desktop layer itself stays transparent unless the desktop scene Background config explicitly provides wallpaper/color through BackgroundLayer. Widget open/close state is mirrored from the server-owned desktop runtime snapshot into the global Zustand store; minimize/restore and close animations are local overlay concerns. When a scene-type application icon is double-clicked, the `launchPipeline` fires first — effects run, a delay elapses, then the scene change is emitted.

The built-in desktop widgets currently include Music, Archive, Chat, and Sticky Notes. The built-in decoration app is Recycle Bin.

**CSSEffectsLayer** — Overlays CSS effects across the entire frame: CRT scanlines, vignette, Perlin noise grain, opacity flicker, and chromatic aberration via mix-blend-mode.

**TransitionLayer** — A set of persistent invisible DOM elements that GSAP animations target during scene transitions. These divs stay in the DOM at all times; GSAP reads and writes them.

The full layer stack is **per-scene**. Each `Scene` definition carries an optional `style: OverlayStyle` that independently configures `BackgroundLayer`, `ParticlesLayer`, and `CSSEffectsLayer`. If a scene defines no `style`, `AppConfig.overlayStyle` is the global fallback. Environments and application scenes each have their own complete visual configuration.

### Effect System

Effects are fired independently of scene transitions. They are triggered by the server via `overlay:show` and dispatched through a flat **effect registry**. Each effect type is registered once with `registerEffect(type, handler)`. When an event arrives, `dispatchEffect(type, cfg)` looks up the handler and calls it directly — there is no switch statement. A `replaceEffect(type, handler)` function allows hot-swapping a handler at runtime from the browser console without a page reload. Registrations live in `effects/index.ts` and the registry itself in `effects/registry.ts`.

Each effect can have a delay and multiple effects can be stacked in one event payload.

Available effects: death overlay, victory overlay, revive overlay, network glitch, notification box (Win98 dialog), terminal toast, typewriter text, vignette pulse, floaties, screen shake, archive corruption, static burst, image overlay, video overlay.

### Audio Engine

A singleton Web Audio API class. It preloads SFX from `/assets/audio/sfx/` and plays them in response to overlay events. If a file is missing, it synthesizes a fallback sound using oscillators. Synthesis covers startup, transition, death, victory, revive, and glitch sounds. The engine handles AudioContext unlock (required for OBS Browser Sources) and fails gracefully if the context is unavailable.

`playMusic(url, crossfadeMs)` manages a looping `<audio>` element for background music. Calling it with a new URL fades the previous track out over 1.5 s while fading the new track in. Passing `null` fades to silence. `setMusicVolume(v)` adjusts the music gain independently of SFX. The overlay calls `playMusic` on every state change using the current scene's `musicTrack` field.

### Plugin System

Plugins are self-contained React components registered in a central registry. Each plugin receives a freeform config object and renders itself. Currently available plugins: image slideshow, CRT effect, solid color, text widget, static image, video loop, vignette, noise grain, and clock widget.

Plugins can be added to any scene via the admin panel and positioned anywhere on the canvas.

---

## Recommendations

### Things To Cut

The **EffectsLayer** file still exists as a reserved `null` render in `packages/overlay/src/layers/EffectsLayer.tsx`, but the runtime mounts `CSSEffectsLayer` instead. If there is no concrete plan to revive a separate post-processing layer, delete the unused file and any references to it so the architecture does not drift away from the real runtime.

### Things To Add

The **gallery-scroll screensaver** currently fades between full images every 4 seconds. A more interesting version would scroll inside each game's folder (multiple screenshots per game), display the game name more prominently, and support keyboard navigation to skip to the next game.

The **boot sequence transition** (`boot-sequence`) is a standard named GSAP transition that any scene can include in its `introTransitions` pipeline. No built-in default scene has it configured out of the box. To play the boot sequence on startup, add `{ id: 'boot-sequence' }` as the first step in `DESKTOP.introTransitions` (or whichever scene loads first). This should be surfaced in the admin transition-picker help text so it is discoverable without reading source.

The **media file upload** currently supports video and image files via `POST /api/upload/asset`, which saves to `assets/video/` or `assets/images/`. There is no delete endpoint. Once a file is uploaded it can only be removed by manual filesystem access. Adding `DELETE /api/asset?path=…` (with path validation to prevent directory traversal) would let the admin's media library clean up unused files without touching the server manually.

The **lobby sky system** now uses a nearer 3D sky hall with editable top and horizon colors, including 8-digit hex authoring. If image, video, or pattern backgrounds are expected to appear directly in the lobby itself rather than only in the CSS background layer behind the canvas, the overlay needs a dedicated 3D hall material path for those media types instead of the current color/gradient tint bridge.

### Things To Polish

The **launchPipeline UI** allows adding effects by type and setting delay, but does not expose per-effect config fields (e.g. the message for `terminal-toast`, the color for `vignette-pulse`). Currently those require JSON editing. Expanding the effect editor with per-type config forms is the next step.

The **TransitionList pipeline preview** still only previews individual steps — clicking the preview button inside a `TransitionPicker` row sends `[{ id }]` as a one-step pipe. There is no button to fire the entire exit or intro pipeline as configured. A panel-level "Preview pipeline" button that calls `socket.emit('transition:preview', steps)` with the full array would let the streamer verify a multi-step chain before going live.

The new shared **hex color editor** now supports live picker updates and `#RRGGBBAA`, but the admin UI still does not explain that alpha hex is supported or how alpha is resolved inside the 3D lobby. Inline validation, a short helper label, and a clearer preview swatch would make the new color workflow easier to discover.

The **widget system** works but `WIDGET_COMPONENTS` in `Desktop.tsx` is a hardcoded map. Adding a new widget requires editing source code. A cleaner model would be a plugin-style registry like the effect system — each widget self-registers with an ID, a display name, and a component. New widgets could then be dropped in without touching `Desktop.tsx`.

The **GenericWidget fallback** shows a placeholder window for any unregistered widget ID. This is a useful safety net but is not a real feature. Any widget ID that reaches `GenericWidget` in production is a bug (missing registration). The fallback should log a warning so it is not silently swallowed.

The **ChatWidget** currently only displays seeded demo messages — it has no live data source. It should connect to a Twitch EventSub or IRC feed via the server, which would broadcast incoming chat messages as a socket event. The widget renders the message list; the server owns the connection.

The **MusicWidget** (used by both `music` and `spotify` IDs) shows a simulated elapsed timer and static track name. It does not track real playback. To make it useful it needs a data source — either the server polling the Spotify Web API and broadcasting current track info, or the overlay reading from a local file written by a Spotify integration tool.


### Bugs

- obs-websocket still does not emit arbitrary OBS hotkey keypress events back to IEOM. OBS-scoped bindings are now executable and testable through the server-side `keybind:execute` path, but fully passive “press key inside OBS and let the bridge observe it” support still needs an OBS-side helper, plugin, or manual mirroring workflow.
- Lobby background handling is still split by renderer: color and gradient backgrounds can tint the 3D sky hall, but image/video/pattern backgrounds remain CSS-only behind the lobby canvas. If operators expect every background type to appear directly in the 3D lobby, that still needs dedicated implementation.