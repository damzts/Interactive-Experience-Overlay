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

**The kernel is the platform.** The Desktop OS, the widgets, the source/scene plugins, and the ambiance behaviors are all first-party contributions built on top of it — the same way any collaborator can build and contribute new managers, source plugins, or widget packs.

---

## The Kernel: `@ieom/server`

**Port 3000** — Fastify HTTP + Socket.IO + werift WebRTC + SQLite.

The kernel is the brain of the system. It holds the single source of truth and directs all behavior. It never renders anything itself — it tells the overlay *what* to render and *when*.

### Responsibilities

The kernel handles multiple concerns through specialized **managers**. Each manager is an independent unit responsible for one domain:

| Manager | Domain | What it does |
|---------|--------|-------------|
| **DesktopConfigService** | Persistence (filesystem) | SQLite CRUD for all configuration. `bootPriority=0` — boots first. Delegates to focused repositories (`SceneRepository`, `WidgetRepository`, `EventRepository`, `ThemeRepository`). |
| **SceneMachine** | State machine | Tracks the current scene, validates transitions, emits state change signals. The backbone of the system. |
| **AmbianceManager** | Autonomous simulation | Drives "alive" behavior — opens/closes widgets, triggers interactions on a timer. 2-phase state machine (pending → running). |
| **EventScheduler** | Time & idle triggers | Fires events on intervals or after idle periods. Supports priority, cooldown, chance-based firing. |
| **RuntimeStateStore** | Runtime state (RAM) | In-memory state for the live session: current scene, open widgets, overlay socket ID, simulation metrics. Zero I/O on hot path. |
| **OBSBridge** | Hardware bridge | WebSocket connection to OBS Studio. Mirrors scene state, reacts to OBS events. |
| **POVOrchestrator** | Video switching | Picks which camera feed to show on stream. Audio-reactive scoring + manual override. |
| **RoomHub** | WebRTC SFU | werift-based hub that receives participant video tracks and relays them. |
| **AutomationManager** | Rules engine | Evaluates persisted "when event X → do Y" rules against every KernelBus event. Field-match conditions only; no scripting. `bootPriority=100` — boots last. |

### Manager Plugin Interface

Every manager implements the `Manager` interface from `@ieomlabs/shared/contracts/manager`:

```typescript
interface Manager {
  readonly name: string
  readonly bootPriority?: number    // Lower value = boots first. Default: 0
  readonly configNamespace?: string // For future plugin config injection
  init(): Promise<void> | void
  start(): Promise<void> | void
  stop(): Promise<void> | void
  dispose(): Promise<void> | void
  status(): ManagerStatus
  onConfigChange?(config: AppConfig, section: string): void  // optional — called on every config persist
}
```

Each manager declares its own KernelBus events in a co-located `*.signals.ts` file using TypeScript declaration merging (`declare module '../bus'`). The base `KernelEvents` interface in `bus.ts` contains only kernel orchestration events (`scene:changed`, `overlay:connected`, `overlay:disconnected`). Adding a new manager event never requires editing `bus.ts`.

### Repository Layer

`DesktopConfigService` delegates all SQLite I/O to focused repository classes:

| Repository | Tables owned |
|-----------|--------------|
| `SceneRepository` | `scenes` |
| `WidgetRepository` | `widgets`, `widget_layouts`, `widget_layout_items` |
| `EventRepository` | `source_events` |
| `ThemeRepository` | `desktop_config`, `desktop_ambiance` |
| `AutomationRuleRepository` | `automation_rules` |

Config service remains as thin coordinator: cache invalidation, socket broadcast, defaults injection.

### Automation Rules

The `automation_rules` SQLite table holds the unified any-signal → any-action rule engine (it absorbed the former `widget_wires`). Kernel-event triggers and widget-signal triggers share one shape; evaluation is split deterministically by action kind:

```
widget/renderer emits DOM signal (dispatchWidgetSignal)
  → useSocket (overlay-local):
       evaluateWidgetRules(config.automationRules)
       → custom widget:action → dispatchWidgetChainAction  ← DOM bus, zero latency
       → forwards the signal to the kernel (unless synthetic)
  → AutomationManager (server, on the KernelBus):
       kernel-source rules match bus events; widget-source rules match forwarded signals
       → open/close/toggle, widget:toggle, scene:change, overlay:show,
         desktop:notify, signal:emit (single-hop synthetic signals)
```

Rules are managed via `GET/POST/PATCH/DELETE /api/automation/rules`. After any mutation, the server emits `config:patch { automationRules }` so the overlay updates live without a restart. See [automation-rules.md](docs/automation-rules.md).

### Kernel Rules

1. **The kernel never breaks userspace.** A bad widget, a disconnection, or a malformed event from the overlay must never crash the server. The kernel validates, ignores invalid input, and continues.
2. **The kernel is the single source of truth.** If server state and overlay state disagree, the server wins. The overlay can always request a full resync.
3. **Hot paths never touch disk.** Runtime decisions read from memory only. SQLite is for persistence on config changes and startup hydration.
4. **Managers are independent.** They communicate through an internal event bus, not by importing each other. A manager can be disabled without breaking the rest.
5. **One overlay at a time.** The slot system ensures deterministic state — only one overlay connects, and it gets the full state on connect.

### Two Communication Planes

The system has two distinct communication planes that must not be confused:

```
@ieom/server
  └─ KernelBus (EventEmitter)
        │  internal bus — managers talk to each other
        │  never crosses a network boundary
        ▼
  transport/socket/handlers/managers.ts  ← explicit per-event bridge
        │  bus.on('chat:message', ...) → io.emit('chat:message', ...)
        ▼
  Socket.IO
        │  external ABI — contract between server and clients
        ▼
overlay / admin / future clients
```

**KernelBus** is internal plumbing. Managers emit and subscribe without knowing who's listening. Nothing outside `@ieom/server` ever sees a KernelBus event directly.

**Socket.IO** is the external ABI — the contract between server and clients. Every event in `@ieom/shared/contracts/` defines part of this contract.

The bridge between the two planes is **explicit and per-event**: `handlers/managers.ts` contains one `bus.on(X) → io.emit(X)` line per event that managers need to push to clients. Adding a signal requires adding a line there; nothing is forwarded automatically.

`KernelBus.onAny(handler)` fires for every typed bus event as a `BusFrame` envelope `{ event, payload, source?, t, seq }`. It is used by `AutomationManager` (rule evaluation against every event) and `BusHistoryRecorder` (diagnostics ring buffer, 500-entry capacity, exposed via `GET /api/diagnostics/bus-history` and the `bus:trace` Socket.IO room).

### How the Kernel Emits Signals

The kernel communicates outward through **signals** — Socket.IO events pushed to connected clients:

```
Kernel action                          Signal emitted
─────────────────────────────────────────────────────────
SceneMachine transitions            →  state:update
Admin triggers a scene event        →  overlay:show (effects, SFX)
Widget toggled                      →  widget:toggle
Config changed                      →  config:patch (delta) or config:update (full save)
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

The overlay composites multiple tiers via `SceneCompositor`. Each tier is a
`SceneLayer` that renders its sources through `SourceRenderer`:

| Tier | z-index | What it renders | Default plugin |
|------|---------|----------------|----------------|
| `background` | 0 | Scene background (gradient, image, video) | `builtin:background` |
| `particles` | 1 | Particle effects (tsParticles) | `builtin:particles` |
| `content` | 5 | Plugin sources (slideshow, CRT, video, map, widgets) | user-defined |
| `post` | 30 | Post-processing effects (CRT, vignette, noise) | `builtin:effects` |
| `transition` | 50 | GSAP-animated transition elements (ephemeral) | plugin-based |

Sources within a tier support: `blendMode`, `opacity`, `maskSourceId`,
`transition`, and `conditions` (afterSeconds, whenWidgetsOpen, whenOverride).

`showDesktop` on a `Scene` drives a `data-desktop` attribute on `#overlay-root`.
CSS gates the desktop layer on this attribute — no scene-level style override needed.

The `LobbyScene` (Three.js 3D room) is a special-case render for the LOBBY
runtime, rendered inside a content-tier source.

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

All applications in IEOM are **widgets** — there is no decoration or scene-app
concept. A widget is a draggable window rendered on the desktop layer.

Widgets are:
- **Lazy-loaded** — dynamic import on first open, cached after
- **Autonomous** — manage their own internal state, lifecycle, and side effects
- **Kernel-unaware** — they never import the socket directly; they receive events through the DOM CustomEvent bus
- **Composable** — a widget can be as simple as a static React component or as complex as a full app with its own API connections

Widgets can implement behaviors and freely communicate with any other system mechanism — emitting signals through the DOM bus (picked up by other widgets or the kernel), subscribing to first-class Socket.IO signals from managers, triggering automation rules, or calling external APIs. A widget built by one collaborator can react to events produced by a widget or manager built by another, with no coordination required beyond the shared signal contract.

**To add a new widget:**
1. Create `packages/shared/src/widgets/{id}/definition.ts` (ID, component type, size, z-index, intent manifest)
2. Create the React component in `packages/overlay/src/desktop/`
3. Add one line to `widgetRegistry.ts` for the dynamic import
4. Add the `WidgetComponentType` string to `packages/shared/src/domain/application.ts`

All derived lookup tables update automatically from the definition. No other files need to change.

### Desktop.tsx Facade Pattern

`Desktop.tsx` is the coordinator — it owns kernel signal reception and state, but delegates rendering to sub-components:

| Sub-component | Owns |
|--------------|------|
| `IconGrid` | Icon rendering, drag-and-drop, auto-arrange |
| `StartMenu` | Start menu, programs sub-list, widget layouts sub-menu |
| `ContextMenuSystem` | Desktop and icon right-click menus |
| `WindowManager` | Widget window rendering, GenericWidget fallback |
| `ThemeEngine.ts` | `buildDesktopThemeVars()` — pure CSS variable computation, no React |

### CSS Module Structure

CSS is split per domain. Each component imports its own styles. The build chunks CSS per component:

```
overlay.css          ← 24-line barrel (@import only)
layers/layers.css    ← base z-index stacking for all layers
desktop/styles/
  desktop.css        ← desktop chrome, icon grid
  start-menu.css     ← start menu
  windows.css        ← widget windows, themes (widget vars)
  context-menu.css   ← context menu
transitions/styles/transitions.css
effects/styles/effects.css, misc.css
```

### Default Config Loading

The server assembles the default `AppConfig` from TypeScript declarations at boot via `loadDefaultConfig()` → `bootstrapConfig()`. The source of truth is `DEFAULT_CONFIG` in `@ieomlabs/shared` — no JSON file is read. The overlay receives the real config from the server on socket connect; its initial Zustand state is a minimal empty stub.

### Widget Communication (IPC)

Widgets talk to each other via two channels:

| Channel | How | When to use |
|---------|-----|-------------|
| **DOM intent bus** | `CustomEvent` on `window` | Widget-to-widget, in-process, hardcoded by developer. Fast, ephemeral. |
| **Automation Rules** | `dispatchWidgetChainAction` on `window` | Operator-configured, persistent rules. Custom widget actions evaluated in-process from `config.automationRules`; every other action kind runs in the kernel. |
| **Server-mediated** | Widget → kernel → broadcast → DOM bus | When the interaction must change authoritative open state or be visible to all connected clients. |

Widgets never import each other directly. The bus is fire-and-forget — if the target widget isn't mounted, the event is silently dropped.

**Signal flow (pub/sub wiring):**

Widgets don't need to signal the kernel to communicate. The DOM bus is the primary IPC channel — widgets can react to each other's signals entirely in-process with no round-trip:

```
Widget A emits → dispatchWidgetSignal (DOM)
Widget B listens → addWidgetSignalListener (DOM)   ← zero kernel involvement
```

**Automation Rules** extend this: the overlay evaluates operator-configured widget-source rules from `config.automationRules` on every DOM signal. Custom widget actions dispatch via `dispatchWidgetChainAction` — still in-process, zero latency. The signal is also forwarded to the kernel, where every other action kind executes (open/close/toggle, scene changes, overlay effects, notifications, signal:emit):

```
dispatchWidgetSignal                          ← widget/renderer emits
  → useSocket: evaluateWidgetRules(config.automationRules)
      custom widget:action → dispatchWidgetChainAction → addWidgetChainActionListener in target widget
      all signals → socket.emit('widget:signal') → kernel AutomationManager → server-side actions
```

Each widget type declares its pub/sub vocabulary as a `WidgetIntentManifest` in `packages/shared/src/constants/widgetIntentManifests.ts` (static data, importable by both overlay and server). The Admin **Automation** panel fetches manifests from `GET /api/automation/manifests` and persists rules to `automation_rules`.

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
| `domain/plugin.ts` | `PLUGIN_CATALOG` — single source of truth for all source plugin definitions. Both admin (UI field generation) and overlay (plugin resolver) import from here. |
| `domain/scene.ts` | `SourceInstance` — includes `tier?: TierName` for explicit compositor tier assignment. |
| `widgets/` | Declaration-first widget descriptors (`WidgetDefinition`) — one `{id}/definition.ts` per system widget. All lookup tables (sizes, z-indices, component mappings, intent manifests) are derived from these. |
| `contracts/socket.ts` | Typed Socket.IO event maps: `ServerToClientEvents` (signals) and `ClientToServerEvents` (syscalls) |
| `contracts/widget.ts` | Widget lifecycle interface (opt-in: `onMount`, `onUnmount`, `onConfigUpdate`, `serialize`/`deserialize`). Also defines `WidgetDefinition`. |
| `contracts/automation.ts` | `AutomationRule` type — the schema for server-side event→action rules |
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
| Socket.IO query (`overlay:sync`) | Overlay → Kernel (ack) | Atomic connect sync — single round-trip returns `{ state, desktop, config }` |
| HTTP | Overlay → Kernel | Slot status (`GET /api/overlay/status`), diagnostics |
| WebRTC | Kernel → Overlay | Video relay — participant camera feeds routed through the werift SFU hub |

**Single-instance rule:** only one overlay connects at a time (slot system). This guarantees deterministic state.

### Kernel ↔ Admin (Server ↔ Shell)

| Channel | Direction | Purpose |
|---------|-----------|---------|
| HTTP | Admin → Kernel | CRUD configuration, media uploads, archive management |
| Socket.IO | Both | Admin sends commands, kernel pushes real-time state & diagnostics |
| `/room` namespace | Both | Online room management, participant events, POV scores |

### Kernel ↔ LAN Guests (`/studio`)

LAN guests (same network, no cloud) connect via the `/studio` Socket.IO namespace for WebRTC signaling. No STUN/TURN required. They enter the same POV pipeline as cloud participants.

```
GET /studio  →  studio.html (camera/mic + WebRTC client)
WS  /studio  →  Socket.IO signaling (offer/answer/ICE)
               ↓
           RoomHub (werift) → POVOrchestrator → RoomRelay
```

**Security:** `/studio` requires a 6-character room code (generated at server start, displayed in admin at `GET /api/room/code`, regenerable via `POST /api/room/code/regenerate`). Rate-limited to 10 attempts/IP/minute. Disable with `JOIN_CODE_DISABLED=true` env var.

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
| `DesktopConfigService` (SQLite) | Scenes (`scenes`), widgets (`widgets`), events (`source_events`), media (`source_media`), source presets (`source_presets`), transitions (`source_transitions`), themes (`desktop_config`), keybinds (`keybinds`), widget layouts (`widget_layouts`), automation rules (`automation_rules`) | ✅ Yes |
| `RuntimeStateStore` (in-memory) | Current scene, open widgets, overlay socket ID, overlay connected, ambiance leader | ❌ No |
| `HandlerContext` (socket closure) | Runtime config overrides, socket client type map | ❌ No |

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
| **ambiance** | Autonomous behavior | `ambiance:simulate:*`, leader management |
| **desktop** | Window management | `desktop:widget:drag/resize`, `desktop:notify`, `desktop:recycle-bin` |
| **config** | Runtime overrides | Override clear operations, `keybind:execute` |
| **diagnostics** | System health | `overlay:runtime:status`, throttled diagnostics broadcasting |
| **runtimeOverride** | Temporary mutations | Deep merge, scoped reset, auto-revert timers |

These modules are composed by a single **orchestrator** that wires them on socket connection. The orchestrator also manages the overlay slot gate and initial state push.

---

## How to Contribute

### Adding a New Widget (App in Userspace)

Lowest friction. Two files, no kernel changes:

1. Create `packages/shared/src/widgets/{id}/definition.ts` declaring the widget's ID, component type, default size, z-index, and intent manifest (what it emits and accepts)
2. Create the React component in `packages/overlay/src/desktop/`
3. Add one line to `packages/overlay/src/desktop/widgetRegistry.ts` for the dynamic import

All lookup tables (sizes, z-indices, component mappings, intent manifests, system widget list) are derived automatically from the definition. The `WidgetComponentType` union in `packages/shared/src/domain/application.ts` still needs the type string added for full TypeScript coverage.

Your widget can use local state, connect to APIs, animate with GSAP, render 3D — whatever you want. It just can't corrupt other widgets or the kernel.

### Adding a New Effect

1. Create the effect component/function in `packages/overlay/src/effects/`
2. Register it in the effect registry
3. Add the effect name to `@ieom/shared/contracts/effects.ts`

The kernel can now fire your effect via `overlay:show` signals.

### Adding a New Kernel Manager

When you need the kernel to handle a new autonomous concern:

1. Implement the manager (state + timer logic + event emission)
2. Create a co-located `*.signals.ts` file with `declare module '../bus'` to contribute any new KernelEvents — no changes to `bus.ts` needed
3. Wire the manager into the server factory (`desktop-entry.ts`) and import the signals file in `kernel/index.ts`
4. Add socket signal types to `@ieom/shared/contracts/socket.ts` if the manager emits to clients
5. Add diagnostic reporting if the manager has observable state

### Adding an Automation Rule

No code required for simple "when X → do Y" behaviors:

- `POST /api/automation/rules` with `{ condition: { event, match? }, action: { kind, params } }`
- Supported action kinds: `widget:toggle`, `scene:change`, `overlay:show`, `desktop:notify`
- Rules fire against every KernelBus event
- The admin panel CRUD lives at `GET/POST/PATCH/DELETE /api/automation/rules`

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
8. **Each admin panel owns exactly one DB table.** A panel that writes to multiple tables indicates a schema or abstraction problem. Widget geometry lives on `widgets`; scene transitions live on `scenes`; layout presets live on `widget_layouts`. No cross-table saves from the client.

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
pnpm build:desktop    # Build all packages for desktop distribution

# Package distributables (run from packages/desktop/)
# cd packages\desktop
pnpm package:win      # Windows NSIS installer (.exe)
pnpm package:mac      # macOS DMG (.dmg)
pnpm package:linux    # Linux AppImage
```

Output lands in `packages/desktop/release/`.

---

## Networking: Dev vs Packaged

In **dev mode** (`pnpm dev`), each package runs its own process:

| Port | Process | What it serves |
|------|---------|----------------|
| 3000 | `@ieom/server` | Kernel: HTTP API + Socket.IO + static overlay |
| 3001 | `@ieom/overlay` (Vite) | Overlay dev server (HMR) |
| 3002 | `@ieom/admin` (Vite) | Admin dev server (HMR) |

In the **Electron app** (packaged), there is only **one port**:

| Port | What it serves |
|------|----------------|
| 3000 | Everything — kernel API, Socket.IO, admin UI (`/admin`), overlay UI (`/`) |

The kernel serves admin and overlay as static files from `extraResources`. There is no Vite, no port 3001, no port 3002. The Electron window loads `http://localhost:3000/admin` directly from the embedded kernel.

This mirrors the computer analogy: in production, the kernel is the only running process. The "shell" (admin) and "userspace" (overlay) are just static assets it serves — not independent services.

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
