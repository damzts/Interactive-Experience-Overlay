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

- **State**: `SceneMachine` manages scenes/transitions
- **Effects**: `effectRegistry` + `dispatchEffect()` fires visual effects
- **Ambiance**: `AmbianceManager` drives autonomous behavior
- **Scheduler**: `EventScheduler` for time/idle-based triggers
- **Online**: WebRTC hub (werift), POV switching, audio analysis
- **Persistence**: SQLite via sql.js, single-tenant config CRUD
- **OBS**: WebSocket bridge to OBS

### `@ieom/overlay` (served by server on port 3000; dev mode: 3001)

The rendering client displayed on stream (OBS browser source). The server serves the overlay's static build at its own port. Currently implements a Desktop OS metaphor (Win98 windows, taskbar, icons). Connects to server via Socket.IO and WebRTC.

- Receives commands: scene changes, widget toggles, transitions, effects
- Renders widgets as draggable windows
- Displays online participant video via local WebRTC relay

### `@ieom/admin` (port 3002)

React control panel. Optional — system runs without it.

- Reads/writes config via HTTP API
- Sends commands via Socket.IO (scene changes, keybinds, widget toggles)
- Manages online rooms via `/online` namespace
- Auth delegates to cloud (optional, unlocks online features)

### `@ieom/shared`

Shared TypeScript types, constants, and contracts. No runtime code.

- `domain/application.ts` — engine-level types (widgets, transitions, effects)
- `domain/desktop.ts` — presentation-layer types (themes, icons, screen saver)
- `contracts/` — Socket.IO event contracts, effect definitions, state shapes

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

### Server → Cloud (optional)

A separate cloud service (`ieom.danhub.dev`) that provides:

- **Google OAuth** — optional login to unlock features
- **Room management** — creates/manages online rooms
- **WebSocket**: — signaling relay for WebRTC (offers, answers, ICE candidates between hub and remote participants) (no media processing)

- The WebRTC hub runs locally and works on LAN without the cloud. The cloud service (paid feature) provides a room that allows signaling to discover and connect remote guests over the internet.

### Contract for Any Overlay Client

Any presentation that implements these works with the server unchanged:

1. **Socket.IO event contract** — defined in `@ieom/shared`
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
| `werift` | server | Pure TypeScript WebRTC (no native deps) |
| `socket.io` | server | Real-time bridge: server ↔ overlay/admin |
| `fastify` | server | HTTP framework |
| `sql.js` | server | SQLite in-memory/file DB |
| `ws` | server | WebSocket client for cloud signaling |


---

## Environment Variables

No env required for offline use. Runs on localhost:3000 by default.

Optional: `IEOM_CLOUD_URL` — ieom-api URL for online room connections (only needed for multi-participant features).
