# Project Architecture

## AI Agent Notes

- This file describes the **conceptual system model** — packages, their roles, and how they communicate.
- Keep it high-level and stable. Implementation details belong in code; protocol specifics belong in [FEATURES.md](FEATURES.md).
- An agent reading only this file should understand: what the system does, what each package is responsible for, and how data flows between them.
- Do NOT add file paths, function names, or code structure here — those change too often.
- Update when: a new package is added, communication patterns change, or a package's responsibility shifts.
- If something here contradicts the code, the code wins — fix the doc.

---

## System Overview

A self-hosted stream overlay engine. The core system is the **server** driving an **overlay** client — everything else is optional.

The server is the single source of truth: it manages state, fires effects, runs ambiance, schedules events, and pushes commands to the overlay in real time. The overlay renders whatever the server tells it to. The admin panel is an optional control surface. The system is fully functional offline with no external dependencies.

**The engine is the product. The Desktop OS is a demo built on top of it.**

The engine is presentation-agnostic — it manages state, effects, transitions, ambiance, and real-time sync. The overlay is a swappable presentation layer.

---

## Packages

pnpm workspaces monorepo. Five packages:

### `@ieom/server` (port 3000)

The engine runtime. Fastify HTTP + Socket.IO + werift WebRTC hub + SQLite persistence.

- **State machine**: `SceneMachine` manages scenes and transitions
- **Runtime state**: `RuntimeStateStore` — in-memory, live-session state (current scene, open widgets, overlay connection). No SQLite reads for hot-path queries.
- **Config persistence**: `DesktopConfigService` + SQLite — only for config that survives a restart
- **Socket handlers**: domain-scoped modules (scene, widget, ambiance, desktop, config, diagnostics) composed by a single orchestrator
- **Effects**: `effectRegistry` + `dispatchEffect()` fires visual effects
- **Ambiance**: `AmbianceManager` drives autonomous behavior
- **Scheduler**: `EventScheduler` for time/idle-based triggers
- **Online**: WebRTC hub (werift), POV switching, audio analysis
- **OBS**: WebSocket bridge to OBS

### `@ieom/overlay` (served by server on port 3000; dev mode: 3001)

The rendering client displayed on stream (OBS browser source). The server serves the overlay's static build at its own port. Currently implements a Desktop OS metaphor (Win98 windows, taskbar, icons). Connects to server via Socket.IO and WebRTC.

- Receives commands: scene changes, widget toggles, transitions, effects
- Renders widgets as draggable windows — widget components are **lazy-loaded on demand** (dynamic import)
- Displays online participant video via local WebRTC relay
- State management: Zustand store split into domain slices (scene, config, desktop, connection)

**Overlay ↔ widget state rule**: if state survives a page reload, it belongs on the server. If it doesn't (animation position, scroll, hover), the overlay owns it.

### `@ieom/admin` (port 3002)

React control panel. Optional — system runs without it. Intentionally a separate package from the overlay: the overlay is experimental/artistic; the admin is a conventional config UI. Different codebases, different constraints.

- Reads/writes config via HTTP API
- Sends commands via Socket.IO (scene changes, keybinds, widget toggles)
- Manages online rooms via `/online` namespace
- Auth delegates to cloud (optional, unlocks online features)
- **Engine pages**: one dedicated sidebar page per server subsystem (Scheduler, Scene Machine, OBS, Ambiance, Online). Each page shows live diagnostics from existing socket events and exposes that subsystem's config section — no new server code required.

### `@ieom/shared`

Shared TypeScript types, contracts, and utilities. No separate runtime — used at build time by server and overlay.

- `domain/` — engine-level and presentation-layer types
- `contracts/socket.ts` — typed Socket.IO event maps (ServerToClientEvents / ClientToServerEvents)
- `contracts/widget.ts` — **widget lifecycle interface** (opt-in: `onMount`, `onUnmount`, `onConfigUpdate`, `serialize`/`deserialize`)
- `constants/defaults.ts` — config normalization and merge utilities

### `@ieom/desktop`

Electron shell. Embeds `@ieom/server`, manages OAuth flow via system browser, persists JWT, exposes `window.ieom` preload API.

---

## Communication

```
┌──────────────┐         Socket.IO + HTTP          ┌──────────────┐
│    Admin     │◄─────────────────────────────────►│    Server    │
│  (React UI)  │  commands, config, state updates   │   (Engine)   │
└──────────────┘                                    └──────┬───────┘
                                                           │
                                              Socket.IO + WebRTC
                                                           │
                                                    ┌──────▼───────┐
                                                    │   Overlay    │
                                                    │ (OBS source) │
                                                    └──────────────┘
```

### Server ↔ Overlay

- **Socket.IO**: server pushes commands (scene change, widget toggle, effects, ambiance actions)
- **HTTP**: overlay fetches initial config (`GET /api/config`) and slot status (`GET /api/overlay/status`)
- **WebRTC**: server relays online participant video to overlay via local werift→browser connection
- **Single-instance**: only one overlay can connect at a time (slot system)

### Server ↔ Admin

- **HTTP**: CRUD config (`GET/PUT/PATCH /api/config`), media catalog, archive
- **Socket.IO**: admin sends commands, receives real-time state updates and overlay status
- **`/online` namespace**: manages online rooms, receives participant events and POV scores

### Server ↔ LAN Guests (`/join`)

LAN guests (same network, no cloud) connect via the `/join` Socket.IO namespace for WebRTC signaling. No STUN/TURN required. Guests enter the same POV pipeline as cloud participants. The join page is served at `GET /join` — a standalone HTML file, no build step.

```
GET /join  →  join.html (camera/mic + WebRTC client)
WS  /join  →  Socket.IO signaling (offer/answer/ICE)
             ↓
         HubConnection (werift) → POVOrchestrator → OverlayRelay
```

### Server → Cloud (optional)

A separate cloud service (`ieom.danhub.dev`) that provides:

- **Google OAuth** — optional login to unlock features
- **Room management** — creates/manages online rooms
- **WebSocket signaling** — relay for WebRTC between hub and remote participants (no media processing)

---

## State Boundaries

### Server-side

| Store | What lives here | Survives restart? |
|-------|----------------|-------------------|
| `DesktopConfigService` (SQLite) | Scenes, applications, events, themes, keybinds, schedules | Yes |
| `RuntimeStateStore` (in-memory) | Current scene, open widgets, overlay connected, ambiance leader | No |
| `HandlerContext` (socket closure) | Runtime config overrides, simulation metrics, overlay slot | No |

### Client-side (overlay)

| Zustand slice | What lives here |
|---------------|----------------|
| `sceneSlice` | visualState, pending transitions |
| `configSlice` | persistedConfig, runtimeOverride, preview mode |
| `desktopSlice` | open/closing/minimized widgets, notifications, recycle bin |
| `connectionSlice` | OBS status, camera permission, overlay owner socket, socket activity |

---

## Socket Handler Architecture

The Socket.IO event protocol is handled by domain-scoped modules, not a monolithic file:

| Module | Handles |
|--------|---------|
| `scene` | `scene:change`, `overlay:trigger`, `event:preview`, `transition:preview`, `panic`, machine event listeners |
| `widget` | `widget:toggle`, `widget:simulate`, `widget:layout:apply`, simulation intent |
| `ambiance` | `ambiance:simulate:*`, `cursor:mirror`, leader management |
| `desktop` | `desktop:widget:drag/resize`, `desktop:notify`, `desktop:recycle-bin`, start-menu, screen-saver |
| `config` | Runtime override clear operations, `keybind:execute` |
| `diagnostics` | `overlay:runtime:status`, diagnostics throttle/emit |

---

## Widget System

Widgets are React components rendered by the overlay. The registry is a lazy manifest — components are dynamic-imported on first use and cached. Adding a widget is one line in the manifest.

Widgets optionally implement `WidgetLifecycle` (from `@ieom/shared`) to hook into mount/unmount/config-update/serialize cycles. This is opt-in — most widgets are plain React components.

**To add a new widget:**
1. Create the component in `packages/overlay/src/desktop/`
2. Add one line to the manifest in `widgetRegistry.ts`
3. Add the `WidgetComponentType` string to `packages/shared/src/domain/application.ts`

No other files need to change.

---

## Contract for Any Overlay Client

Any presentation that implements these works with the server unchanged:

1. **Socket.IO event contract** — typed in `@ieom/shared/contracts/socket.ts`
2. **Config API** — `GET /api/config`
3. **WebRTC handshake** — `pov:subscribe` for online stream relay

---

## Type Boundaries

- `packages/shared/src/domain/application.ts` — **engine-level**: widgets, transitions, effects
- `packages/shared/src/domain/desktop.ts` — **presentation-layer**: themes, icons, screen saver
- Engine code must NOT import from `domain/desktop.ts`

---

## Key Scripts

```bash
pnpm dev              # Run server + overlay + admin in dev mode
pnpm dev:desktop      # Build all then run Electron app
```

---

## Key Libraries

| Library | Package | Purpose |
|---|---|---|
| `werift` | server | Pure TypeScript WebRTC (no native deps) — SFU hub for participant video relay |
| `socket.io` | server | Real-time bridge: server ↔ overlay/admin. Used for typed protocol with 40+ event types, namespaces, and auto-reconnection |
| `fastify` | server | HTTP framework |
| `sql.js` | server | SQLite in-memory/file DB |
| `ws` | server | WebSocket client for cloud signaling |
| `zustand` | overlay | Client state management (domain slices) |

---

## Environment Variables

No env required for offline use. Runs on localhost:3000 by default.

Optional: `IEOM_CLOUD_URL` — ieom-api URL for online room connections (only needed for multi-participant features over the internet).
