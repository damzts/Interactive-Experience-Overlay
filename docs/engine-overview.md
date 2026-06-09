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
Built-in components: `music`, `chat`, `camera`, `gallery`, `source`, `sticky-notes`, etc.
User-created widgets have `widgetSource: 'user'`.

### Scenes

A **scene** is a named visual state for the overlay compositor. It defines what
the overlay renders — background, particle effects, plugin sources, post-processing,
and whether the desktop layer is visible (`showDesktop`).

```
Scene = background + particles + sources[] + effects + showDesktop + transitions
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
Sources and visual config can still be edited like any other scene.

**The mental model:**
- Switch to `LOBBY` → viewers see the 3D lobby room
- Switch to `DESKTOP` → viewers see the desktop OS with widgets
- Switch to any user scene → viewers see that scene's compositor output

Runtimes are listed separately from user scenes in the admin nav to make this
distinction clear.

---

The kernel is the platform. The Desktop OS, the widgets, the source/scene plugins, and the ambiance behaviors are all first-party contributions built on top of it — the same way any collaborator can build and contribute new managers, source plugins, or widget packs.

The engine is presentation-agnostic. It manages state, schedules events, runs ambiance, fires effects, handles transitions, and bridges real-time state. It knows nothing about windows, taskbars, icons, or visual metaphors. Those are concerns of the overlay — which is one possible interpretation of engine primitives, not the only one.

## What the engine does

The engine has seven distinct responsibilities:

**State machine** — owns the current scene and valid transitions between scenes. Nothing outside the engine decides what the current visual state is.

**Effect pipeline** — a registry of named visual effects (glitch, death, static burst, etc.) that any event or trigger can fire without knowing how they're rendered.

**Transition system** — animated state changes with configurable exit and intro pipelines. Transitions are data — a list of steps — not code.

**Scheduler** — fires configured events on time-based or idle-based triggers. The overlay doesn't poll; the engine pushes.

**Ambiance manager** — autonomous behavior that makes the stream feel alive between human interactions. Selects widgets to "interact with" based on cooldown scoring, then orchestrates the full simulation lifecycle.

**Config persistence** — stores everything that should survive a restart in SQLite. Admin saves write here. The engine never reads SQLite on the real-time rendering path.

**Real-time bridge** — Socket.IO handlers that sync engine state to all connected clients and accept commands from them. This is the only surface the overlay touches.

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
│   ├── bus.ts              # Internal event bus (KernelBus, KernelEvents, emitCustom)
│   ├── SafeManagerProxy.ts # Quarantine wrapper for untrusted managers
│   └── managers/           # All kernel managers — the engine brain
│       ├── scene.ts        # SceneMachine — state machine
│       ├── ambiance.ts     # AmbianceManager — widget simulation (2-phase)
│       ├── scheduler.ts    # EventScheduler — time/idle triggers
│       ├── config.ts       # DesktopConfigService — SQLite persistence + reactive chains
│       ├── runtime.ts      # RuntimeStateStore — in-memory session state
│       ├── obs.ts          # ObsBridge — OBS WebSocket bridge
│       └── pov.ts          # POVOrchestrator — video switching
├── transport/
│   ├── http/               # Fastify routes (config, media, archive, room)
│   ├── socket/             # Socket.IO handlers (all domain modules)
│   └── webrtc/             # werift hub + overlay relay + cloud signaling
├── db/
│   ├── desktop-db.ts       # SQLite init + migrations
│   └── repositories/       # Focused CRUD: SceneRepository, WidgetRepository,
│                           #   EventRepository, ThemeRepository, UserRepository
├── lib/
│   └── defaults.ts         # loadDefaultConfig() — loads data/fixtures/default-config.json
├── online/                 # Online room feature (composes kernel + transport)
└── desktop-entry.ts        # Thin bootstrap — creates Kernel, registers managers
```

**Navigating by intent:**
- "Change how ambiance works" → `kernel/managers/ambiance.ts`
- "Add an API endpoint" → `transport/http/`
- "Add a socket event handler" → `transport/socket/handlers/`
- "Change how scenes transition" → `kernel/managers/scene.ts`
- "Add a new manager" → see `docs/manager-authoring.md`

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

## Adding a second presentation

No server changes are needed. The second presentation only needs to implement three contracts: subscribe to the Socket.IO event map, read config from the config API, and handle the WebRTC handshake if it needs camera feeds. Everything else — visual metaphor, layout, interaction model — is entirely its own.

The engine drives both presentations identically. They are distinguished only by which socket namespace they connect on.
