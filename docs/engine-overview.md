> **AI Agent Notes**
> This file documents design decisions and boundaries — things hard to rediscover from code alone.
> Do not document what is obvious from reading the source. Document **why**.
> If a section becomes stale, delete it rather than leaving incorrect info.

---

# Engine Overview

## Core concepts

Understanding these three things is enough to work on any part of the system.

### Widgets

A **widget** is a desktop window — a draggable, resizable application that runs
on the overlay's desktop layer. Every entry in the `widgets` table is a widget.
There is no other application type. Widgets can be toggled open/closed,
positioned, themed, and grouped into layouts.

```
Widget = window position + window size + component type + optional settings
```

The `widgetComponent` field determines which React component renders the window.
Built-in components: `music`, `chat`, `camera`, `gallery`, `window`, `sticky-notes`, etc.
User-created widgets have `widgetSource: 'user'`.

### Scenes

A **scene** is a named visual state for the overlay compositor. It defines what
the overlay renders — background, particle effects, renderer windows, post-processing,
and whether the desktop layer is visible (`showDesktop`).

```
Scene = background + particles + windows[] + effects + showDesktop + transitions
```

Scenes are standalone records. They have no linked application or widget.
Creating or deleting a scene does not affect any widget. Scenes can define an
entry/exit transition pipeline and a background music track.

### Runtimes

A **runtime** is a pre-configured scene that manages a lifecycle environment:

| Runtime | Scene key | What it is |
|---------|-----------|------------|
| **Lobby** | `LOBBY` | 3D room firmware — Three.js environment, managed by `LobbyScene` |
| **Desktop** | `DESKTOP` | OS kernel — the win98 desktop with taskbar, icons, and widgets |

Runtimes are system scenes. They cannot be deleted from the admin. Their
windows and visual config can still be edited like any other scene.

**The mental model:**
- Switch to `LOBBY` → viewers see the 3D lobby room
- Switch to `DESKTOP` → viewers see the desktop OS with widgets
- Switch to any user scene → viewers see that scene's compositor output

Runtimes are listed separately from user scenes in the admin nav to make this
distinction clear.

---

The kernel is the platform. The Desktop OS, the widgets, the scene renderers, and the ambiance behaviors are all first-party contributions built on top of it — the same way any collaborator can build and contribute new managers, source plugins, or widget packs.

The engine is presentation-agnostic. It manages state, schedules events, runs ambiance, fires effects, handles transitions, and bridges real-time state. It knows nothing about windows, taskbars, icons, or visual metaphors. Those are concerns of the overlay — which is one possible interpretation of engine primitives, not the only one.

## What the engine does

The engine has these distinct responsibilities:

**State machine** — owns the current scene and valid transitions between scenes. Nothing outside the engine decides what the current visual state is.

**Effect pipeline** — a registry of named visual effects (glitch, death, static burst, etc.) that any event or trigger can fire without knowing how they're rendered. Effects support an optional per-instance `sfx` override to play a custom sound URL instead of the built-in SFX map.

**Transition system** — animated state changes with configurable exit and intro pipelines. Transitions are data — a list of steps — not code.

**Scheduler** — fires configured events on time-based or idle-based triggers. The overlay doesn't poll; the engine pushes.

**Ambiance manager** — autonomous behavior that makes the stream feel alive between human interactions. Selects widgets to "interact with" based on cooldown scoring, then orchestrates the full simulation lifecycle.

**Automation layer** — persisted "when event X → do Y" rules evaluated against every KernelBus event. No scripting, no loops — field-match conditions only. Managed via `GET/POST/PATCH/DELETE /api/automation/rules`.

**Config persistence** — stores everything that should survive a restart in SQLite. Admin saves write here. The engine never reads SQLite on the real-time rendering path.

**Real-time bridge** — Socket.IO handlers that sync engine state to all connected clients and accept commands from them. This is the only surface the overlay touches.

**Show sequencer** — scripted show pipelines. A `ShowDefinition` is an ordered list of `ShowStep` records (each with a `delayMs` and an `EventAction`). POST `/api/shows/:id/run` starts the chain; POST `/api/shows/:id/cancel` aborts it. Each step fires via `scheduler:fired` so the existing action dispatch path handles it — the sequencer only needs to know about `obs-stream` actions, which it executes directly through `ObsBridge`.

**Twitch integration** — `TwitchIntegrationManager` connects to Twitch IRC over WebSocket (anonymous read-only via `justinfan` nick, or authenticated) for chat, and to EventSub over WebSocket for channel events (follow, subscribe, gift-sub, cheer, raid, points redemption, stream online/offline, hype train). Both emit onto the KernelBus (`chat:message`, `twitch:*`); since those events are declared in the shared `KernelSignalMap`, the generic `kernel:signal` bridge (see P1 in `docs/architecture-debt.md`) forwards them to clients automatically — no per-event transport code. `ChatReactionManager` sits on top of chat and fires configured effects/actions when messages match keyword, command, or regex rules.

**OBS bridge** — full bidirectional OBS WebSocket integration via `ObsBridgeManager`. Tracks streaming, recording, and virtual camera state; emits `obs:stream:started/stopped`, `obs:recording:started/stopped`, and `obs:virtualcam:changed` on the KernelBus, forwarded to clients the same generic way. Show sequencer and automation rules can start/stop streams via the `obs-stream` `EventAction` kind.

**Effect ambiance** — `EffectAmbianceManager` fires configured effects on a random ambient loop, independent of the scripted scheduler/show-sequencer paths.

**Theme drift** — `ThemeDriftManager` ambiently varies the desktop art style (theme/skin, colors, motion, atmosphere) over time as a non-reverting runtime override — see `desktopThemeDrift` in `AppConfig`.

**Persona** — `PersonaManager` picks a chat message (command/keyword/chance-triggered), synthesizes it to speech (Windows SAPI via `TtsService`), and emits `persona:speak` so the overlay can play it through a robotic voice filter with a caption bubble.

## What the engine exposes

Four things, in order of how often they change:

- **Signals** — things the engine broadcasts (state changed, transition started, effect triggered, widget toggled). See `docs/signal-catalog.md`.
- **Commands** — things clients send in (change scene, toggle widget, execute keybind, apply config override). See `docs/signal-catalog.md`.
- **Queries** — snapshot requests clients make on connect to hydrate without waiting for an event. See `docs/signal-catalog.md`.
- **Config** — the full application config, pushed on save and patchable at runtime.

## Server directory structure

```
packages/server/src/
├── kernel/
│   ├── index.ts            # Kernel class — register(), boot(), shutdown()
│   ├── bus.ts              # Internal event bus (KernelBus, KernelEvents, BusFrame, onAny, for())
│   ├── BusHistoryRecorder.ts # 500-entry ring buffer; HTTP snapshot + bus:trace live room
│   └── managers/           # All kernel managers — the engine brain
│       ├── scene.ts        # SceneMachine — state machine
│       ├── ambiance.ts     # AmbianceManager — widget simulation (2-phase)
│       ├── ambiance.signals.ts      # KernelEvents augmentation for ambiance:tick
│       ├── scheduler.ts    # EventScheduler — time/idle triggers
│       ├── scheduler.signals.ts     # KernelEvents augmentation for scheduler:fired
│       ├── config.ts       # DesktopConfigService — SQLite persistence
│       ├── config.signals.ts        # KernelEvents augmentation for config:changed
│       ├── automation.ts   # AutomationManager — persisted "when event X → do Y" rules
│       ├── runtime.ts      # RuntimeStateStore — in-memory session state (incl. overlaySocketId)
│       ├── obs.ts          # ObsBridgeManager — OBS WebSocket bridge (stream/record/vcam state + actions)
│       ├── showSequencer.ts         # ShowSequencer — scripted multi-step show pipelines
│       ├── twitch.ts                # TwitchIntegrationManager — IRC chat + EventSub (follow/sub/cheer/raid/...)
│       ├── chatReactions.ts         # ChatReactionManager — keyword/command/regex → effects/actions
│       ├── effectAmbiance.ts        # EffectAmbianceManager — ambient random effect loop
│       ├── themeDrift.ts            # ThemeDriftManager — ambient art-style drift
│       ├── persona.ts               # PersonaManager — chat-to-voice companion (TTS + robotic filter)
│       └── pov.ts          # POVOrchestrator — video switching
# All manager-private bus events (ambiance:tick, scheduler:fired, config:changed, ...) live in a
# co-located `<manager>.signals.ts` next to the manager that owns them — see manager-authoring.md.
# Events meant for clients don't need one of these files; they're declared directly in the
# shared KernelSignalMap (packages/shared/src/contracts/signals.ts) and reach overlay/admin
# automatically via the generic `kernel:signal` bridge (transport/socket/handlers/kernelSignal.ts).
├── transport/
│   ├── http/               # Fastify routes (config, media, archive, room, automation, shows)
│   ├── socket/             # Socket.IO handlers (all domain modules)
│   │   └── roomNamespace.ts  # /studio LAN namespace (registerStudioNamespace)
│   └── webrtc/             # werift hub + overlay relay + signaling
│       ├── room-hub.ts       # RoomHub — werift SFU, receives participant tracks
│       ├── room-relay.ts     # RoomRelay — server→overlay WebRTC relay
│       ├── room-signaling.ts # RoomSignaling — cloud WebSocket signaling
│       └── room-preview-relay.ts # RoomPreviewRelay — admin preview relay
├── db/
│   ├── desktop-db.ts       # SQLite init + migrations (addColumn helper, all table schemas)
│   └── repositories/       # Focused CRUD: SceneRepository, WidgetRepository,
│                           #   EventRepository, ThemeRepository, UserRepository,
│                           #   AutomationRuleRepository
├── lib/
│   ├── defaults.ts         # loadDefaultConfig() — returns bootstrapConfig()
│   └── bootstrapConfig.ts  # bootstrapConfig() — assembles AppConfig from WIDGET_DEFINITIONS
├── room/                   # Room management feature (RoomManager, /room namespace, REST routes)
│   ├── manager.ts          # RoomManager — in-memory room state, participant tracking
│   ├── namespace.ts        # /room Socket.IO namespace (registerRoomNamespace)
│   ├── routes.ts           # REST routes /api/config/online, /api/online/rooms
│   └── index.ts
├── online/                 # Deprecated re-exports → room/ (backward compat)
└── desktop-entry.ts        # Thin bootstrap — creates Kernel, registers managers
```

**Navigating by intent:**
- "Change how ambiance works" → `kernel/managers/ambiance.ts`
- "Add an API endpoint" → `transport/http/`
- "Add a socket event handler" → `transport/socket/handlers/`
- "Change how scenes transition" → `kernel/managers/scene.ts`
- "Add a new manager" → see `docs/manager-authoring.md`
- "Add an automation rule" → `POST /api/automation/rules` or see `kernel/managers/automation.ts`
- "Add a bus event for a manager" → create `kernel/managers/yourmanager.signals.ts`, see `docs/manager-authoring.md`
- "Change fresh-install defaults" → `lib/bootstrapConfig.ts`
- "Set up a scripted show pipeline" → `kernel/managers/showSequencer.ts`, `GET/POST /api/shows`
- "Connect Twitch chat / EventSub" → `kernel/managers/twitch.ts` (config: `AppConfig.twitch`)
- "React to chat messages" → `kernel/managers/chatReactions.ts` (config: `AppConfig.chatReactions`)
- "Speak a chat message aloud" → `kernel/managers/persona.ts`, `services/TtsService.ts` (config: `AppConfig.persona`)
- "React to OBS stream/record events" → `obs:*` entries in `shared/src/contracts/signals.ts` (`KernelSignalMap`) + automation rules
- "See OBS streaming/recording/vcam status in admin" → `features/obs/ObsPanel.tsx` (status badges shown when connected)
- "Make a manager event visible to clients" → add it to `KernelSignalMap` in `shared/src/contracts/signals.ts`, see `docs/manager-authoring.md`

## Manager lifecycle

Every kernel manager implements the `Manager` interface from `@ieom/shared/contracts/manager.ts`:

```
init() → start() → (running) → stop() → dispose()
```

The `Kernel` class calls these in order during `boot()` and `shutdown()`. The entry point registers managers and calls `kernel.boot()` — it does not call lifecycle methods directly.

## The Desktop OS presentation

The Desktop OS is one interpretation of engine primitives. It is not the engine.

| Engine primitive | Desktop OS interprets it as |
|---|---|
| Widget | A draggable window with title bar, close button, resize handles |
| Widget toggle | Window open/close animation |
| Scene state | A desktop environment with a taskbar and icons, or a 3D lobby room |
| Ambiance action | A simulated user clicking around the OS |
| Theme tokens | Win98 chrome, Frutiger Aero glass, Y2K candy colors |

**All applications are widgets.** There is no decoration type, no scene-app
type, no icon-only type. Every entry in the `widgets` table is a window that
can be opened, closed, moved, and resized. The Desktop OS renders desktop icons
for all widgets regardless of state — the icon is just the widget's closed face.

## Windows, Renderers, and Widgets

Three distinct things that are easy to confuse:

| | Window | Renderer | Widget |
|---|---|---|---|
| **What it is** | A slot in a scene's `windows[]` array | The React component that draws a window | A desktop window (application) |
| **Where it lives** | `WindowInstance` in `AppConfig.scenes[n].windows` | `RendererDefinition` in overlay `renderers/registry.ts` | `widgets` DB table |
| **What identifies it** | `rendererType` string (e.g. `'image-static'`) | Entry key in `renderers/registry.ts` | `widgetComponent` string |
| **Catalog** | `RENDERER_CATALOG` in `@ieomlabs/shared` | `RendererDefinition.catalog` (attached on resolve) | `WIDGET_DEFINITIONS` in `@ieomlabs/shared` |
| **Admin UI** | WindowsEditor in SceneConfig, SourcesTab presets | Fields driven by `RendererCatalogEntry.fields` | Widget panel, layout editor |

**`RENDERER_CATALOG`** is the single source of truth for both admin UI generation (field editors, catalog grid, preset creation) and overlay rendering (default tier, default config). It lives in `@ieomlabs/shared/domain/plugin.ts` so the server, admin, and overlay all import from the same definition.

**`WindowInstance.tier`** — optional field that overrides the compositor's default `'content'` bucket. Set automatically from `RendererCatalogEntry.defaultTier` when adding from the catalog. Builtin windows (`builtin:background`, `builtin:particles`, `builtin:effects`) always resolve to their tier.

**`RendererDefinition.catalog`** — populated by `resolveRenderer()` at load time. Overlay renderers can read their own metadata (label, icon, fields) without a separate import.

## Adding a second presentation

No server changes are needed. The second presentation only needs to implement three contracts: subscribe to the Socket.IO event map, read config from the config API, and handle the WebRTC handshake if it needs camera feeds. Everything else — visual metaphor, layout, interaction model — is entirely its own.

The engine drives both presentations identically. They are distinguished only by which socket namespace they connect on.
