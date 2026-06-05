# Project Architecture

## AI Agent Notes

- This file describes the **conceptual system model** — packages, their roles, and how they communicate.
- Keep it high-level and stable. Implementation details belong in code; protocol specifics belong in [FEATURES.md](FEATURES.md).
- An agent reading only this file should understand: what the system does, what each package is responsible for, and how data flows between them.
- Do NOT add file paths, function names, or code structure here — those change too often.
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
| **Filesystem** | SQLite (`DesktopConfigService`) | Persistent storage that survives reboot (restart). The kernel reads/writes it; userspace gets a projected view. Each table has a single owning panel in the admin. |
| **RAM** | `RuntimeStateStore` + Zustand slices | Session-only state. Lost on restart. Fast access, no I/O. |
| **Shell / terminal** | `@ieom/admin` | Optional operator interface. Sends commands to the kernel, reads diagnostics. System works without it. |
| **Hardware** | `@ieom/desktop` (Electron) | The physical machine. Wraps the kernel, provides OS-level access (filesystem, OAuth, window management). |

---

## System Overview

A self-hosted stream overlay engine, structured as a pnpm monorepo with five packages. The core loop is simple:

> **Kernel decides → emits signal → Userspace renders.**

The system is fully functional offline with no external dependencies. The admin panel is optional. The engine is presentation-agnostic — the Desktop OS (Win98 aesthetic) is one overlay implementation. Any client that speaks the signal contract works.

**The engine is the product. The Desktop OS is a demo built on top of it.**

---

## The Kernel: `@ieom/server`

**Port 3000** — Fastify HTTP + Socket.IO + werift WebRTC + SQLite.

The kernel is the brain of the system. It holds the single source of truth and directs all behavior. It never renders anything itself — it tells the overlay *what* to render and *when*.

### Responsibilities

The kernel handles multiple concerns through specialized **managers**. Each manager is an independent unit responsible for one domain:

| Manager | Domain | What it does |
|---------|--------|-------------|
| **SceneMachine** | State machine | Tracks the current scene, validates transitions, emits state change signals. The backbone of the system. |
| **AmbianceManager** | Autonomous simulation | Drives "alive" behavior — opens/closes widgets, triggers interactions on a timer. Makes the overlay feel inhabited. |
| **EventScheduler** | Time & idle triggers | Fires events on intervals or after idle periods. Supports priority, cooldown, chance-based firing. |
| **DesktopConfigService** | Persistence (filesystem) | SQLite CRUD for all configuration. The only thing that survives a restart. |
| **RuntimeStateStore** | Runtime state (RAM) | In-memory state for the live session: current scene, open widgets, overlay connection status. Zero I/O on hot path. |
| **OBSBridge** | Hardware bridge | WebSocket connection to OBS Studio. Mirrors scene state, reacts to OBS events. |
| **POVOrchestrator** | Video switching | Picks which camera feed to show on stream. Audio-reactive scoring + manual override. |
| **HubConnection** | WebRTC SFU | werift-based hub that receives participant video tracks and relays them. |

### Kernel Rules

1. **The kernel never breaks userspace.** A bad widget, a disconnection, or a malformed event from the overlay must never crash the server. The kernel validates, ignores invalid input, and continues.
2. **The kernel is the single source of truth.** If server state and overlay state disagree, the server wins. The overlay can always request a full resync.
3. **Hot paths never touch disk.** Runtime decisions read from memory only. SQLite is for persistence on config changes and startup hydration.
4. **Managers are independent.** They communicate through an internal event bus, not by importing each other. A manager can be disabled without breaking the rest.
5. **One overlay at a time.** The slot system ensures deterministic state — only one overlay connects, and it gets the full state on connect.

### How the Kernel Emits Signals

The kernel communicates outward through **signals** — Socket.IO events pushed to connected clients:

```
Kernel action                          Signal emitted
─────────────────────────────────────────────────────────
SceneMachine transitions            →  state:update
Admin triggers a scene event        →  overlay:show (effects, SFX)
Widget toggled                      →  widget:toggle
Config changed                      →  config:update, config:patch
Runtime override applied            →  runtime:config:override
Ambiance picks a widget             →  simulation:intent (to leader)
Transition fired                    →  transition:play
Panic button                        →  state:update (immediate reset)
```

---

## Userspace: `@ieom/overlay`

**Served by the kernel at port 3000** (dev mode: 3001).

The overlay is the **GPU of the system** — its entire job is to draw things on screen. It is what viewers see on the stream (rendered inside an OBS browser source). It reacts to kernel signals and paints accordingly.

But userspace is **alive**. Widgets are autonomous apps that can:
- Manage their own internal state (animations, scroll position, timers)
- Connect to external APIs (weather, Twitch chat, RSS feeds)
- Communicate with other widgets via IPC (DOM CustomEvent bus)
- Respond to kernel simulation events (ambiance interactions)

### Layer Stack (rendering order, bottom → top)

The overlay composites multiple layers to produce the final frame:

| Layer | What it renders | Driven by |
|-------|----------------|-----------|
| **BackgroundLayer** | Scene background (gradient, image, video) | Kernel config |
| **ParticlesLayer** | Particle effects (tsParticles) | Kernel config |
| **LayerStack** | Plugin sources (slideshow, CRT, video, map) | Kernel config |
| **LobbyScene** | 3D environment (Three.js) — only in LOBBY state | Kernel state |
| **Desktop** | Windows, taskbar, icons, widgets | Kernel signals + local state |
| **CSSEffectsLayer** | Post-processing (CRT, vignette, noise, grain) | Kernel config |
| **TransitionLayer** | GSAP-animated transition elements | Kernel signals |

### State in Userspace

The overlay maintains its own state via Zustand, split into domain slices:

| Slice | Owns | Updated by |
|-------|------|-----------|
| `sceneSlice` | Current visual state, pending transitions | Kernel signals (`state:update`, `transition:play`) |
| `configSlice` | Persisted config + runtime overrides → merged view | Kernel signals (`config:update`, `runtime:config:override`) |
| `desktopSlice` | Open/closing/minimized widgets, notifications | Kernel signals (`widget:toggle`) + local interactions |
| `connectionSlice` | OBS status, camera, socket activity | Observation (no kernel signal needed) |

**The golden rule:** if state survives a page reload, it belongs in the kernel. If it doesn't (animation progress, scroll position, hover states), it belongs in userspace.

### Widget Apps

Widgets are **isolated applications** running inside userspace. They are:
- **Lazy-loaded** — dynamic import on first open, cached after
- **Autonomous** — manage their own internal state, lifecycle, and side effects
- **Kernel-unaware** — they never import the socket directly; they receive events through the DOM CustomEvent bus
- **Composable** — a widget can be as simple as a static React component or as complex as a full app with its own API connections

**To add a new widget (app):**
1. Create the component in `packages/overlay/src/desktop/`
2. Add one line to the manifest in `widgetRegistry.ts`
3. Add the `WidgetComponentType` string to `packages/shared/src/domain/application.ts`

No other files need to change. This is the "install an app" experience.

### Widget Communication (IPC)

Widgets talk to each other via two channels:

| Channel | How | When to use |
|---------|-----|-------------|
| **DOM intent bus** | `CustomEvent` on `document` | Widget-to-widget, in-process, no kernel involvement. Fast. |
| **Server-mediated** | Widget → kernel → broadcast → DOM bus | When the interaction needs to be coordinated, persisted, or visible to admin. |

Widgets never import each other directly. The bus is fire-and-forget — if the target widget isn't mounted, the event is silently dropped.

---

## The Shell: `@ieom/admin`

**Port 3002** — React control panel.

The admin is an **optional operator interface** — like a terminal or shell that gives the operator direct access to kernel commands. The system runs perfectly without it.

- Reads/writes configuration via HTTP (`/api/config`)
- Sends commands to the kernel via Socket.IO (scene changes, keybinds, widget toggles)
- Displays live diagnostics from kernel managers
- Manages online rooms via the `/online` namespace
- **Engine pages**: one sidebar page per kernel subsystem. Each page shows live state and exposes config — no new kernel code required to add admin UI for an existing manager.

---

## Shared Types: `@ieom/shared`

The **ABI** of the system — the contract between kernel and userspace. No runtime code, only TypeScript types and constants consumed at build time.

| Directory | Contents |
|-----------|----------|
| `domain/` | Data shape definitions — scenes, applications, widgets, transitions, effects, ambiance, desktop |
| `contracts/socket.ts` | Typed Socket.IO event maps: `ServerToClientEvents` (signals) and `ClientToServerEvents` (syscalls) |
| `contracts/widget.ts` | Widget lifecycle interface (opt-in: `onMount`, `onUnmount`, `onConfigUpdate`, `serialize`/`deserialize`) |
| `contracts/effects.ts` | Effect type registry |
| `constants/` | Config normalization, merge utilities, ambiance defaults |

**Rule:** if both kernel and userspace need to agree on a shape, it lives here. If only one side uses it, it stays local.

### Type Boundaries

- `domain/application.ts` — **engine-level types**: widgets, transitions, effects. Both kernel and userspace import this.
- `domain/desktop.ts` — **presentation-layer types**: themes, icons, screen saver. Only userspace imports this.
- Kernel code must **never** import from `domain/desktop.ts`. It doesn't know or care how things look.

---

## Hardware: `@ieom/desktop`

Electron shell. The **physical machine** that wraps everything:

- Embeds `@ieom/server` as a child process
- Manages OAuth flow via system browser, persists JWT
- Exposes `window.ieom` preload API for feature detection and native capabilities
- Handles app lifecycle (startup, shutdown, tray icon)

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

### Kernel ↔ Userspace (Server ↔ Overlay)

| Channel | Direction | Purpose |
|---------|-----------|---------|
| Socket.IO signals | Kernel → Overlay | Push directives: scene changed, widget toggled, effect fired, config updated |
| Socket.IO syscalls | Overlay → Kernel | Request actions: report status, send simulation completions, drag/resize events |
| HTTP | Overlay → Kernel | Initial config fetch (`GET /api/config`), slot status (`GET /api/overlay/status`) |
| WebRTC | Kernel → Overlay | Video relay — participant camera feeds routed through the werift SFU hub |

**Single-instance rule:** only one overlay connects at a time (slot system). This guarantees deterministic state.

### Kernel ↔ Admin (Server ↔ Shell)

| Channel | Direction | Purpose |
|---------|-----------|---------|
| HTTP | Admin → Kernel | CRUD configuration, media uploads, archive management |
| Socket.IO | Both | Admin sends commands, kernel pushes real-time state & diagnostics |
| `/online` namespace | Both | Online room management, participant events, POV scores |

### Kernel ↔ LAN Guests (`/join`)

LAN guests (same network, no cloud) connect via the `/join` Socket.IO namespace for WebRTC signaling. No STUN/TURN required. They enter the same POV pipeline as cloud participants.

```
GET /join  →  join.html (camera/mic + WebRTC client)
WS  /join  →  Socket.IO signaling (offer/answer/ICE)
             ↓
         HubConnection (werift) → POVOrchestrator → OverlayRelay
```

### Kernel → Cloud (optional, external)

A separate cloud service that provides:
- **Google OAuth** — optional login to unlock multi-participant features
- **Room management** — creates/manages online rooms
- **WebSocket signaling** — relay for WebRTC between hub and remote participants (no media processing)

---

## State Architecture

### The Two Memories

Like a real computer, the system has two kinds of memory:

| Analogy | Implementation | Characteristics |
|---------|---------------|-----------------|
| **Disk / filesystem** | SQLite via `DesktopConfigService` | Survives restart. Scenes, applications, events, themes, keybinds, schedules. Written on config change, read on startup. |
| **RAM** | `RuntimeStateStore` + `HandlerContext` | Session-only. Current scene, open widgets, overlay slot, simulation metrics. Lost on restart. Never touches disk on hot path. |

### Kernel-side State

| Store | What lives here | Persists? |
|-------|----------------|-----------|
| `DesktopConfigService` (SQLite) | Scenes (`scenes`), applications with widget geometry (`applications`), events (`source_events`), media (`source_media`), source presets (`source_presets`), transitions (`source_transitions`), themes (`desktop_config`), keybinds (`keybinds`), widget layouts (`widget_layouts`) | ✅ Yes |
| `RuntimeStateStore` (in-memory) | Current scene, open widgets, overlay connected, ambiance leader | ❌ No |
| `HandlerContext` (socket closure) | Runtime config overrides, simulation metrics, overlay slot | ❌ No |

### Userspace-side State (Overlay)

| Zustand Slice | What lives here |
|---------------|----------------|
| `sceneSlice` | Visual state, pending transitions |
| `configSlice` | Persisted config + runtime overrides → merged view. Supports admin preview mode. |
| `desktopSlice` | Open/closing/minimized widgets, notifications, recycle bin, reconnect snapshot |
| `connectionSlice` | OBS status, camera permission, overlay owner socket, socket activity |

---

## Signal Protocol (Socket Handler Architecture)

The kernel handles Socket.IO events through **domain-scoped handler modules**. Each module is a focused unit that handles one area of concern:

| Module | Domain | Key events handled |
|--------|--------|--------------------|
| **scene** | State transitions | `scene:change`, `overlay:trigger`, `event:preview`, `transition:preview`, `panic` |
| **widget** | App management | `widget:toggle`, `widget:simulate`, `widget:layout:apply`, simulation intent |
| **ambiance** | Autonomous behavior | `ambiance:simulate:*`, `cursor:mirror`, leader management |
| **desktop** | Window management | `desktop:widget:drag/resize`, `desktop:notify`, `desktop:recycle-bin` |
| **config** | Runtime overrides | Override clear operations, `keybind:execute` |
| **diagnostics** | System health | `overlay:runtime:status`, throttled diagnostics broadcasting |
| **runtimeOverride** | Temporary mutations | Deep merge, scoped reset, auto-revert timers |

These modules are composed by a single **orchestrator** that wires them on socket connection. The orchestrator also manages the overlay slot gate and initial state push.

---

## How to Contribute

### Adding a New Widget (App in Userspace)

Lowest friction. Three files, no kernel changes:

1. Create your React component in `packages/overlay/src/desktop/`
2. Add one entry to the widget manifest (`widgetRegistry.ts`)
3. Add the type string to `packages/shared/src/domain/application.ts`

Your widget can use local state, connect to APIs, animate with GSAP, render 3D — whatever you want. It just can't corrupt other widgets or the kernel.

### Adding a New Effect

1. Create the effect component/function in `packages/overlay/src/effects/`
2. Register it in the effect registry
3. Add the effect name to `@ieom/shared/contracts/effects.ts`

The kernel can now fire your effect via `overlay:show` signals.

### Adding a New Kernel Manager

When you need the kernel to handle a new autonomous concern:

1. Implement the manager (state + timer logic + event emission)
2. Wire it into the server factory (`desktop-entry.ts`)
3. Add signal types to `@ieom/shared/contracts/socket.ts`
4. Add diagnostic reporting if the manager has observable state

### Adding Admin UI for a Manager

No kernel changes needed:

1. Create a page in `packages/admin/src/features/`
2. Listen to existing diagnostic socket events for live data
3. Use the HTTP config API to expose settings

---

## Architectural Invariants

These rules apply everywhere. Break them and things fall apart:

1. **Kernel never imports from overlay.** The signal contract in `@ieom/shared` is the only coupling.
2. **Widgets never import socket directly.** Communication goes through the DOM event bus or Zustand store.
3. **Engine types never depend on presentation types.** `domain/application.ts` ≠ `domain/desktop.ts`.
4. **Config never read from SQLite on hot path.** Always from the in-memory store.
5. **Unidirectional data flow for rendering.** Kernel → signal → store → React render. No upward data flow for display.
6. **Single overlay instance.** Deterministic state requires one consumer.
7. **Shared package has zero runtime.** Types and constants only. No side effects, no instantiation.
8. **Each admin panel owns exactly one DB table.** A panel that writes to multiple tables indicates a schema or abstraction problem. Widget geometry lives on `applications`; scene transitions live on `scenes`; layout presets live on `widget_layouts`. No cross-table saves from the client.

---

## Contract for Any Overlay Client

The Desktop OS overlay is **one implementation**. Any presentation that implements these three things works with the kernel unchanged:

1. **Socket.IO event contract** — typed in `@ieom/shared/contracts/socket.ts`
2. **Config API** — `GET /api/config` for initial hydration
3. **WebRTC handshake** — `pov:subscribe` for video stream relay

You could build a terminal overlay, a 3D world, a pure CSS art piece — as long as it speaks the protocol.

---

## Key Scripts

```bash
pnpm dev              # Run kernel + overlay + admin in dev mode
pnpm dev:desktop      # Build all then run Electron (hardware) app
```

---

## Key Libraries

| Library | Package | Role in the analogy |
|---------|---------|---------------------|
| `fastify` | server (kernel) | HTTP syscall interface |
| `socket.io` | server (kernel) | Signal bus to userspace (40+ typed event types) |
| `werift` | server (kernel) | WebRTC SFU — video hardware driver |
| `better-sqlite3` | server (kernel) | Filesystem (persistent config) |
| `ws` | server (kernel) | Cloud signaling relay (external network driver) |
| `zustand` | overlay (userspace) | Process memory management (domain slices) |
| `gsap` | overlay (userspace) | GPU shader pipeline (animations, transitions) |
| `@react-three/fiber` | overlay (userspace) | 3D rendering engine (lobby scene) |
| `tsparticles` | overlay (userspace) | Particle system (background effects) |
| `98.css` | overlay (userspace) | Desktop presentation theme |

---

## Environment Variables

No env required for offline use. Runs on `localhost:3000` by default.

Optional: `IEOM_CLOUD_URL` — cloud API URL for online room connections (only needed for multi-participant features over the internet).
