# Project Architecture

## AI Agent Notes

- This file describes the **conceptual system model** — packages, their roles, and how they communicate.
- Keep it high-level and stable. Implementation details belong in code or in [docs/](docs/), referenced via [FEATURES.md](FEATURES.md).
- An agent reading only this file should understand: what the system does, what each package is responsible for, and how data flows between them.
- Do NOT add file paths, function names, or code structure here — those change too often. If a section starts describing *how* something works internally rather than *what* it does and *why*, that content belongs in a linked doc, not here.
- Update when: a new package is added, communication patterns change, or a package's responsibility shifts.
- If something here contradicts the code, the code wins — fix the doc.

---

## System Mental Model

Think of IEOM as a **small computer**:

```
┌─────────────────────────────────────────────────────────────┐
│                     Hardware (Electron shell)                │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                 Kernel  (@ieom/server)                 │  │
│  │                                                       │  │
│  │   ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────┐  │  │
│  │   │  Scene   │ │ Ambiance │ │Scheduler │ │  OBS  │  │  │
│  │   │ Manager  │ │ Manager  │ │ Manager  │ │Bridge │  │  │
│  │   └────┬─────┘ └────┬─────┘ └────┬─────┘ └───┬───┘  │  │
│  │        │             │            │            │      │  │
│  │   ─────┴─────────────┴────────────┴────────────┴──   │  │
│  │                    Signal Bus                         │  │
│  │   ────────────────────────────────────────────────    │  │
│  │        │                                              │  │
│  └────────┼──────────────────────────────────────────────┘  │
│           │  Signals (Socket.IO)                             │
│  ┌────────▼──────────────────────────────────────────────┐  │
│  │             Userspace  (@ieom/overlay)                 │  │
│  │                                                       │  │
│  │   ┌──────────┐ ┌──────────┐ ┌──────────┐             │  │
│  │   │ Widget A │ │ Widget B │ │ Widget C │  ...        │  │
│  │   └──────────┘ └──────────┘ └──────────┘             │  │
│  │                                                       │  │
│  │   Layers: Background → Particles → Desktop → Effects │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │          Control Panel  (@ieom/admin)                  │  │
│  │          (optional terminal / shell access)            │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

| Computer Concept | IEOM Equivalent | Role |
|-----------------|-----------------|------|
| **Kernel** | `@ieom/server` | Orchestrates everything. Manages state, schedules work, owns hardware bridges (OBS, WebRTC). Emits signals downward. Never crashes userspace. |
| **Userspace** | `@ieom/overlay` | Renders to the display (OBS browser source). Contains apps (widgets). Each app manages its own internal state but cannot corrupt the kernel. |
| **Apps** | Widgets | User-facing programs running inside the overlay. Isolated, lazy-loaded, communicate through defined channels — never directly with kernel internals. |
| **System calls** | Socket.IO events (client → server) | How userspace requests things from the kernel. Typed contract, validated on arrival. |
| **Signals / interrupts** | Socket.IO events (server → client) | How the kernel tells userspace to update: scene changed, widget toggled, effect fired. Userspace reacts but doesn't block the kernel. |
| **IPC** | DOM CustomEvent bus | How apps (widgets) talk to each other inside userspace without going through the kernel. |
| **Filesystem** | SQLite (config persistence) | Persistent storage that survives reboot (restart). The kernel reads/writes it; userspace gets a projected view. |
| **RAM** | In-memory runtime store | Session-only state. Lost on restart. Fast access, no I/O. |
| **Shell / terminal** | `@ieom/admin` | Optional operator interface. Sends commands to the kernel, reads diagnostics. System works without it. |
| **Hardware** | `@ieom/desktop` (Electron) | The physical machine. Wraps the kernel, provides OS-level access (filesystem, OAuth, window management). |

---

## System Overview

A self-hosted stream overlay engine, structured as a pnpm monorepo with five packages. The core loop is simple:

> **Kernel decides → emits signal → Userspace renders.**

The system is fully functional offline with no external dependencies. The admin panel is optional. The engine is presentation-agnostic — the Desktop OS (Win98 aesthetic) is one overlay implementation. Any client that speaks the signal contract works.

**The kernel is the platform.** The Desktop OS, the widgets, the source/scene plugins, and the ambiance behaviors are all first-party contributions built on top of it — the same way any collaborator can build and contribute new managers, source plugins, or widget packs.

---

## The Kernel: `@ieom/server`

**Port 3000** — the brain of the system. It holds the single source of truth and directs all behavior. It never renders anything itself — it tells the overlay *what* to render and *when*.

### Responsibilities

The kernel handles multiple concerns through specialized **managers**. Each manager is an independent unit responsible for one domain:

| Manager | Domain | What it does |
|---------|--------|-------------|
| **Config persistence** | Persistence (filesystem) | CRUD for all configuration. Boots first, before anything depends on it. |
| **Scene state machine** | State machine | Tracks the current scene, validates transitions, emits state change signals. The backbone of the system. |
| **Ambiance** | Autonomous simulation | Drives "alive" behavior — opens/closes widgets, triggers interactions on a timer. |
| **Event scheduler** | Time & idle triggers | Fires events on intervals or after idle periods. Supports priority, cooldown, chance-based firing. |
| **Runtime state** | Runtime state (RAM) | In-memory state for the live session: current scene, open widgets, overlay connection, simulation metrics. Zero I/O on hot path. |
| **OBS bridge** | Hardware bridge | Connection to OBS Studio. Mirrors scene state, reacts to OBS events. |
| **POV orchestrator** | Video switching | Picks which camera feed to show on stream. Audio-reactive scoring + manual override. |
| **Room hub** | WebRTC SFU | Receives participant video tracks and relays them. |
| **Automation** | Rules engine | Evaluates persisted "when event X → do Y" rules against any signal. Field-match conditions only; no scripting. Boots last, once every other manager's events exist. |
| **Twitch integration** | Twitch bridge | Chat + channel events onto the shared event bus. |
| **Chat reactions** | Chat reactions | Keyword/command/regex rules over chat → configured effects/actions. |
| **Show sequencer** | Scripted shows | Ordered, multi-step show pipelines fired on demand or on a trigger. |
| **Effect ambiance** | Ambient effects | Fires configured effects on a jittered random loop. |
| **Theme drift** | Art-style drift | Ambiently varies desktop theme/colors/motion as runtime overrides. |
| **Persona** | Voiced companion | Speaks chat/event lines via a TTS service; with the LLM brain enabled it also summarizes chat for the streamer, converses through the admin console, and writes in-character replies to viewers. Identity (voice + avatar art + TTS backend) is a switchable persona profile. |

Every manager follows the same lifecycle contract and can be added, removed, or disabled independently, without touching the others. See [manager-authoring.md](docs/manager-authoring.md) for how to add one, [automation-rules.md](docs/automation-rules.md) for the rules engine, and [state-management.md](docs/state-management.md) for the persistence/runtime state split.

---

## Userspace: `@ieom/overlay`

**Served by the kernel** (port 3000, or 3001 in dev mode). The overlay is the **GPU of the system** — its entire job is to draw things on screen. It is what viewers see on the stream (rendered inside an OBS browser source). It reacts to kernel signals and paints accordingly.

But userspace is **alive**. Widgets are autonomous apps that can manage their own internal state, connect to external APIs, communicate with other widgets, and respond to kernel simulation events — all without the kernel needing to know their internals.

Rendering is composited in ordered layers (background, particles, desktop content, post-effects, transitions), with the Desktop OS as one interpretation living in the content layer. See [engine-overview.md](docs/engine-overview.md) for the engine/presentation boundary and how a second overlay implementation could be added.

All applications in IEOM are **widgets** — draggable windows on the desktop layer, lazy-loaded, autonomous, and kernel-unaware (they never talk to the socket directly). See [widget-authoring.md](docs/widget-authoring.md) for how to add one, and [widget-communication.md](docs/widget-communication.md) for how widgets talk to each other and to automation rules.

The overlay keeps its own mirror of kernel state plus session-only UI state (open windows, animations, connection status). See [state-management.md](docs/state-management.md) for the full split and the reconnect recovery pattern.

---

## The Shell: `@ieom/admin`

**Port 3002** — an **optional operator interface**, like a terminal or shell that gives the operator direct access to kernel commands. The system runs perfectly without it.

It reads and writes configuration, sends commands to the kernel, displays live diagnostics, and manages online rooms. Each engine subsystem gets its own admin page with no new kernel code required. See [admin-engine-pages.md](docs/admin-engine-pages.md) and [online-rooms-admin-guide.md](docs/online-rooms-admin-guide.md).

---

## Shared Types: `@ieom/shared`

The **ABI** of the system — the contract between kernel and userspace. No runtime code, only types and constants consumed at build time: data shapes, the source plugin catalog, widget descriptors, typed signal/command maps, the automation rule schema, and the effect registry.

**Rule:** if both kernel and userspace need to agree on a shape, it lives here. If only one side uses it, it stays local. Engine-level types (widgets, transitions, effects) may be imported by both kernel and userspace; presentation-layer types (themes, icons, screen saver) are userspace-only — the kernel never imports them.

---

## Hardware: `@ieom/desktop`

Electron shell — the **physical machine** that wraps everything: embeds the kernel as a child process, manages the OAuth flow via the system browser, and provides native OS-level access (filesystem, window management, tray icon, app lifecycle). See [auth-flow.md](docs/auth-flow.md) for the OAuth flow across web and desktop.

---

## Communication Topology

```
┌──────────────┐       syscalls (Socket.IO + HTTP)       ┌──────────────┐
│    Admin     │◄───────────────────────────────────────►│    Kernel    │
│   (shell)    │     commands, config reads/writes       │  (server)    │
└──────────────┘                                         └──────┬───────┘
                                                                │
                                                   signals (Socket.IO)
                                                     + video (WebRTC)
                                                                │
                                                         ┌──────▼───────┐
                                                         │  Userspace   │
                                                         │  (overlay)   │
                                                         └──────────────┘
```

- **Kernel ↔ Userspace** — the kernel pushes signals (state changed, effects, config updates) and relays video over WebRTC; the overlay pushes back status and interaction events. Only one overlay connects at a time, guaranteeing deterministic state. See [signal-catalog.md](docs/signal-catalog.md) and [socket-handlers.md](docs/socket-handlers.md).
- **Kernel ↔ Admin** — the admin reads/writes configuration over HTTP and exchanges commands/diagnostics over Socket.IO.
- **Kernel ↔ Remote participants** — LAN guests connect directly for WebRTC signaling; cloud participants are brokered through an optional external cloud service that only handles signaling, never media. See [webrtc-online-rooms.md](docs/webrtc-online-rooms.md).

Internally, the kernel's managers talk to each other over a private event bus that never crosses the network. A small, explicitly-allowlisted subset of that bus is forwarded to clients over Socket.IO — the only externally visible contract. See [manager-authoring.md](docs/manager-authoring.md) and [signal-catalog.md](docs/signal-catalog.md).

In development, each package runs as its own process on its own port (kernel, overlay dev server, admin dev server). In the packaged Electron app, the kernel is the only running process — it serves the admin and overlay UIs itself as static assets.

---

## Architectural Invariants

These rules apply everywhere. Break them and things fall apart:

1. **Kernel never imports from overlay.** The signal contract in `@ieom/shared` is the only coupling.
2. **Widgets never import socket directly.** Communication goes through the DOM event bus or the overlay's own state store.
3. **Engine types never depend on presentation types.** Engine-level types (widgets, transitions, effects) never import presentation-layer types (themes, icons, screen saver).
4. **Config is never read from disk on the hot path.** Runtime decisions read from memory only; disk is for persistence on change and startup hydration.
5. **Unidirectional data flow for rendering.** Kernel → signal → store → render. No upward data flow for display.
6. **Single overlay instance.** Deterministic state requires exactly one connected overlay at a time.
7. **Shared package has zero runtime.** Types and constants only. No side effects, no instantiation.
8. **Each admin panel owns exactly one area of persisted config.** A panel that writes across ownership boundaries indicates a schema or abstraction problem.
9. **The kernel never breaks userspace.** A bad widget, a disconnection, or a malformed event from the overlay must never crash the kernel. It validates, ignores invalid input, and continues.
10. **The kernel is the single source of truth.** If server state and overlay state disagree, the server wins. The overlay can always request a full resync.
11. **Managers are independent.** They communicate through the internal event bus, not by importing each other. Any manager can be disabled without breaking the rest.

---

## Contract for Any Overlay Client

The Desktop OS overlay is **one implementation**. Any presentation that implements these three things works with the kernel unchanged:

1. **The signal/command contract** — the typed Socket.IO event map.
2. **Config API** — for initial hydration.
3. **WebRTC handshake** — for video stream relay.

You could build a terminal overlay, a 3D world, a pure CSS art piece — as long as it speaks the protocol.

---

For setup, running, and environment configuration, see [SETUP.md](SETUP.md). For feature-specific implementation detail, see the [docs/](docs/) index in [FEATURES.md](FEATURES.md).
