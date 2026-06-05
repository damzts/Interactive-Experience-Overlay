> **AI Agent Notes**
> This file documents design decisions and boundaries — things hard to rediscover from code alone.
> Do not document what is obvious from reading the source. Document **why**.
> If a section becomes stale, delete it rather than leaving incorrect info.

---

# Engine Overview

## The core assertion

The engine is the product. The Desktop OS is a demo built on top of it.

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
│   ├── index.ts          # Kernel class — register(), boot(), shutdown()
│   ├── bus.ts            # Internal event bus (KernelBus, KernelEvents)
│   └── managers/         # All kernel managers — the engine brain
│       ├── scene.ts      # SceneMachine — state machine
│       ├── ambiance.ts   # AmbianceManager — widget simulation
│       ├── scheduler.ts  # EventScheduler — time/idle triggers
│       ├── config.ts     # DesktopConfigService — SQLite persistence
│       ├── runtime.ts    # RuntimeStateStore — in-memory session state
│       ├── obs.ts        # ObsBridge — OBS WebSocket bridge
│       └── pov.ts        # POVOrchestrator — video switching
├── transport/
│   ├── http/             # Fastify routes (config, media, archive, room)
│   ├── socket/           # Socket.IO handlers (all domain modules)
│   └── webrtc/           # werift hub + overlay relay + cloud signaling
├── db/                   # SQLite init, migrations, repositories
├── online/               # Online room feature (composes kernel + transport)
└── desktop-entry.ts      # Thin bootstrap — creates Kernel, registers managers
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
| Scene state | A desktop environment with icons, or a 3D lobby room |
| Ambiance action | A simulated user clicking around the OS |
| Theme tokens | Win98 chrome, Frutiger Aero glass, Y2K candy colors |

The Desktop OS lives entirely in the overlay package. The engine has no knowledge of it.

## Adding a second presentation

No server changes are needed. The second presentation only needs to implement three contracts: subscribe to the Socket.IO event map, read config from the config API, and handle the WebRTC handshake if it needs camera feeds. Everything else — visual metaphor, layout, interaction model — is entirely its own.

The engine drives both presentations identically. They are distinguished only by which socket namespace they connect on.
