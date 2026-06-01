# Project Architecture

## AI Agent Notes

Maintain it with these rules:

- Keep it compact enough to load as working context.
- Prefer stable concepts over file-by-file implementation notes.
- Do not turn it into a backlog, changelog, or dump.
- When the project grows, summarize patterns here and move long detail to purpose-specific docs.
- Update this file when architecture or workflow changes in ways that affect how an agent should understand, use, or extend the project.

Target outcome:

- an AI should understand the system model by understanding behavior and patterns, do not force a solution or limit creativity problem solving.

---

## Engine / Presentation Boundary

**The engine is the product. The Desktop OS is a demo built on top of it.**

The engine is presentation-agnostic. It manages state, schedules events, runs ambiance, fires effects, handles transitions, and bridges real-time state over Socket.IO. It knows nothing about windows, taskbars, icons, or visual metaphors.

The Desktop OS is one interpretation of the engine — a creative presentation that proves the engine works. A different overlay client (broadcast deck, minimal HUD, etc.) could consume the same engine without any server changes.

### Engine (packages/server + packages/shared)

| Concept | Implementation | What it does |
|---|---|---|
| State Machine | `SceneMachine` | Manages visual states, transitions between them |
| Effect Pipeline | `effectRegistry` + `dispatchEffect()` | Fires visual effects (glitch, death, static, etc.) |
| Transition System | 27 transitions + `TransitionEngine` | Animated state changes |
| Scheduler | `EventScheduler` | Time-based and idle-based event triggers |
| Ambiance | `AmbianceManager` | Autonomous behavior — makes the stream feel alive |
| Source Renderer | `pluginRegistry` + `LayerStack` | Renders visual sources (images, video, camera, etc.) |
| Widget System | `widgetRegistry` + open/close/toggle | Composable UI units with state |
| Audio Engine | `AudioEngine` | SFX, music, volume control |
| Config Persistence | `DesktopConfigService` + SQLite | Stores and retrieves all state |
| Real-time Bridge | Socket.IO handlers | Syncs state between server and clients |
| Online Rooms | WebRTC hub + cloud signaling | Multi-participant streaming |

The engine exposes: **events, commands, state, config**.
The engine knows nothing about: windows, taskbars, icons, chrome, visual metaphors.

### Presentation (packages/overlay)

Currently: **Desktop OS** — a Win98-inspired desktop metaphor with draggable windows, taskbar, start menu, screen saver, and icon arrangement.

The overlay connects via Socket.IO and interprets engine primitives through its chosen metaphor:

| Engine Primitive | Desktop OS Interpretation |
|---|---|
| Widget | Draggable window with title bar, close button, resize handles |
| Widget toggle | Window open/close animation |
| State (scene) | A "desktop" with icons, or a "lobby" 3D room |
| Ambiance action | Simulated user clicking around the OS |
| Theme tokens | Win98 chrome, Frutiger Aero glass, Y2K candy colors |

### Contract Between Engine and Any Overlay Client

Any overlay client that implements these three things works with the server unchanged:

1. **Socket.IO event contract** — `@ieom/shared` contracts (`socket.ts`, `effects.ts`, `state.ts`)
2. **Config API** — reads from `GET /api/config`
3. **WebRTC handshake** — `pov:subscribe` for online stream relay

The server serves whatever static build is in `overlayDir`. It does not know or care what presentation is running.

### Adding a Second Presentation

No server changes needed. Create a new package (e.g. `packages/overlay-broadcast`), implement the three contracts above, point `overlayDir` at its `dist/`, and the engine drives it identically.

### Type Boundaries

- `packages/shared/src/domain/application.ts` — **engine-level** types: `Application`, `WidgetComponentType`, widget settings, transitions
- `packages/shared/src/domain/desktop.ts` — **presentation layer** types: `DesktopConfig`, `DesktopTheme`, icon arrangement, screen saver, system sounds
- `packages/overlay/src/desktop/` — **Desktop OS presentation**: all Desktop OS UI components, widget windows, taskbar, icons

New engine work (scheduler, ambiance, events, online rooms) must use neutral vocabulary and must not import from `domain/desktop.ts`.

---

## System Overview

Hub-and-spoke P2P architecture with two independent systems:

1. **ieom-api** (external, deployed) — Fastify server for user registration, room management, and WebRTC signaling relay (no media processing). Deployed on partner's infrastructure (Orange Pi via Cloudflare tunnel at ieom.danhub.dev).
2. **Self-Hosted Client** (this monorepo) — offline-capable desktop app for stream overlay visual control. When connected to a cloud room, acts as the WebRTC hub receiving all participant streams, running POV switching locally, and rendering the active stream in the overlay.

---

## Monorepo Structure

pnpm workspaces. Five packages:

| Package | Role | Port |
|---|---|---|
| `@ieom/server` | Self-hosted Fastify + Socket.IO + werift WebRTC hub (SQLite, no auth) | 3000 |
| `@ieom/admin` | React admin UI (config, scenes, assets, online rooms management) | 3002 |
| `@ieom/overlay` | React overlay UI (rendered on stream) + CameraWidget + OnlineStreamWidget | 3001 |
| `@ieom/shared` | Shared TS types, constants, contracts | — |
| `@ieom/desktop` | Electron shell embedding @ieom/server | — |

### External: ieom-api (separate repo)

| Feature | Details |
|---|---|
| Framework | Fastify 5 + Prisma + PostgreSQL |
| Auth | Google OAuth, JWT cookies, refresh tokens, CSRF |
| Rooms | In-memory live rooms + WebSocket signaling relay |
| Payments | Stripe subscriptions, license tiers |
| Signaling | `@fastify/websocket` at `/ws/rooms/:roomId` |
| Frontend | ieom-front (separate repo, partner maintains) |
| API prefix | Routes are `/auth/*`, `/rooms/*`, etc. in code; reverse proxy exposes them under `/api/*` externally |

---

## Auth Flow

Authentication is handled entirely by the cloud API (`ieom.danhub.dev`). The self-hosted client has no auth server — it delegates to the cloud.

### Web (admin on localhost:3002)

```
Admin (localhost:3002)          Cloud API (ieom.danhub.dev)         Google
       │                                │                            │
       │── GET /api/auth/google ───────►│                            │
       │   ?redirect=http://localhost:3002/admin                      │
       │                                │── redirect to Google ─────►│
       │                                │◄── callback with code ─────│
       │                                │                            │
       │◄── 302 to redirect?token=jwt ──│                            │
       │   http://localhost:3002/admin?token=jwt                      │
       │                                                             │
       │── GET /api/auth/me ───────────►│  (via Vite proxy, Bearer token)
       │◄── { user } ──────────────────│
```

- Login initiates with `?redirect=<origin>/admin` so the cloud knows where to send the user back.
- The `redirect` value is passed through Google's `state` param.
- Cloud validates redirect origin against `ALLOWED_REDIRECT_ORIGINS` env var.
- Token is captured from URL params and stored in sessionStorage.
- In dev mode, `getApiOrigin()` returns `window.location.origin` so all API calls go through the Vite proxy (avoids CORS).

### Desktop (Electron)

```
Desktop App                    System Browser              Cloud API
     │── open browser ────────►│                            │
     │   /api/auth/google      │── Google OAuth ───────────►│
     │   ?redirect=desktop     │◄── callback ──────────────│
     │◄── ieom://auth?token=jwt│                            │
     │                                                      │
     │── Bearer token for all API/WS calls ────────────────►│
```

### Key Config

| Variable | Where | Purpose |
|---|---|---|
| `VITE_API_ORIGIN` | `packages/admin/.env` | Frontend API base URL. Use `http://localhost:3100` in local dev or the production backend origin in deployed builds. |
| `GOOGLE_REDIRECT_URI` | `ieom/.env` | Must match the exact Google Console authorized redirect URI. For local dev: `http://localhost:3100/api/auth/google/callback`. |
| `FRONTEND_CALLBACK_URL` | `ieom-api/.env` | Fallback redirect after auth (when `isAllowedRedirect` fails). |
| `ALLOWED_REDIRECT_ORIGINS` | `ieom-api/.env` | Comma-separated origins allowed for redirect (e.g. `http://localhost:3002,https://ieom.danhub.dev`). |
| `IEOM_BACKEND_URL` | Desktop runtime | Backend origin for desktop OAuth + API calls. Use `http://localhost:3100` locally or the production backend origin when deployed. |

---

## Key Scripts

```bash
# ─── Self-Hosted Client (offline, no cloud needed) ────────────────
pnpm dev              # Run server + overlay + admin in dev mode
pnpm dev:desktop      # Build all then run Electron app
```

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│              ieom-api (external, deployed at ieom.danhub.dev)        │
│                                                                     │
│  Google OAuth → PostgreSQL (users, licenses)                        │
│  WebSocket /ws/rooms/:roomId                                        │
│    - Routes offers/answers/ICE between hub ↔ participants           │
│    - Tracks hub + participant presence (in-memory)                   │
│    - No media touches the server                                    │
└──────────────────────────────────┬──────────────────────────────────┘
                                   │ WebSocket (signaling only)
                    ┌──────────────┼──────────────────┐
                    │              │                  │
             ┌──────▼──────┐ ┌────▼────┐      ┌─────▼─────┐
             │  Server     │ │Browser 1│      │Browser 2  │
             │  (Hub)      │ │(friend) │      │(friend)   │
             │  werift     │ │         │      │           │
             │  WebRTC ←───┤ │WebRTC──►│      │WebRTC───►│
             │  N streams  │ │cam/mic  │      │cam/mic   │
             └──────┬──────┘ └─────────┘      └──────────┘
                    │
         POV Switcher + Audio Analysis (local)
         replaceTrack() on switch
                    │
                    ▼ (local WebRTC via Socket.IO signaling)
             ┌──────────────┐
             │   Overlay    │
             │OnlineStreamWidget│
             │ <video> element │
             └──────────────┘
```

---

## Self-Hosted Server (`packages/server/src/`)

```
desktop-entry.ts    — primary entry: factory + dev-mode self-start (auto-starts on port 3000 when run directly)
room/
  hub-connection.ts — werift RTCPeerConnection manager (N participants), sends ICE candidates back via callback
  cloud-signaling.ts — WebSocket (ws) client connecting to ieom-api as hub, buffers ICE candidates until after answer
  overlay-relay.ts  — werift sendonly connection to overlay, debounced negotiate + replaceTrack on switch
pov/
  switcher.ts       — POV decision engine (evaluates scores, enforces cooldown)
  audio-score-processor.ts — rolling-average activity scores from RTP audio
  participant-registry.ts — feed adapter for POV switcher
  index.ts          — POVOrchestrator: wires hub + switcher + audio processor
online/
  manager.ts        — OnlineRoomManager: room lifecycle, config, bridges POV events to admin
  namespace.ts      — /online Socket.IO namespace (admin creates/manages rooms here)
  routes.ts         — GET/PATCH /api/config/online, GET /api/online/rooms
routes/
  room.ts           — POST /api/room/join, POST /api/room/leave, GET /api/room/status
  config.ts         — GET/PUT/PATCH /api/config
  media.ts          — asset catalog routes
  archive.ts        — event log routes
db/
  desktop-db.ts     — SQLite (sql.js) initialization
  desktop-config-service.ts — single-tenant config CRUD
state/machine.ts    — SceneMachine: scene state transitions
socket/handlers.ts  — admin ↔ overlay real-time bridge (Socket.IO)
obs/bridge.ts       — OBS WebSocket integration
ambiance/manager.ts — automated desktop behavior
events/scheduler.ts — event-driven automations
```

### Online Rooms Flow

The admin panel manages rooms via the `/online` Socket.IO namespace on the local server. The local server coordinates with the cloud API for signaling.

```
Admin UI (/online namespace)     Local Server              Cloud API
     │                                │                        │
     │── pov-online:room:create ─────►│                        │
     │◄── ack { roomCode } ──────────│                        │
     │                                │── POST /rooms ────────►│ (creates cloud room)
     │                                │── WS join-as-hub ─────►│
     │                                │                        │
     │◄── pov-online:participant:joined│◄── participant-joined─│
     │◄── pov-online:scores ─────────│  (local audio analysis)│
     │◄── pov-online:switch ─────────│  (local POV decision)  │
```

### Camera Capture

Local camera capture is handled by the **overlay's CameraWidget** (`packages/overlay/src/desktop/CameraWidget.tsx`). It uses `getUserMedia` directly in the OBS browser source — no server-side camera management. The admin panel does not manage local cameras; it only manages online room participants.

### Cloud Signaling Protocol (WebSocket)

```
Desktop (hub)           ieom-api (relay)        Browser (participant)
     │                        │                          │
     │── join-as-hub ────────►│                          │
     │                        │◄── join-as-participant ──│
     │◄── participant-joined ─│── hub-info ────────────►│
     │                        │◄────── offer ────────────│
     │◄────── offer ─────────│                          │
     │── answer ─────────────►│── answer ──────────────►│
     │── ice-candidate ──────►│── ice-candidate ────────►│  (buffered until after answer)
     │◄── ice-candidate ──────│◄── ice-candidate ───────│
     │                        │                          │
     │◄═══════════ WebRTC P2P (direct, no server) ═════►│
```

Message format: `{ type, payload, senderId, timestamp, targetUserId? }`

Connection URL: `ws(s)://<host>/ws/rooms/<roomId>?token=<jwt>`

**Important**: Hub ICE candidates must be sent AFTER the answer. The participant's browser cannot process `addIceCandidate()` before `setRemoteDescription(answer)`. The hub buffers candidates during offer handling and flushes them after sending the answer.

---

## Overlay WebRTC Relay

The overlay receives the active participant's video via a local werift→browser WebRTC connection:

1. Overlay connects via Socket.IO, emits `pov:subscribe`
2. Server creates a werift sendonly PC, waits for video track (100ms debounce)
3. Sends `pov:offer` → overlay answers → ICE connects
4. On POV switch or participant re-offer: `replaceTrack()` swaps media without renegotiation
5. Overlay builds a `MediaStream` from `event.track` (werift doesn't implement `a=msid`)

Key constraint: werift doesn't support renegotiation on the same PC reliably with browsers. Use `replaceTrack()` for track changes; only create a new offer on initial connection.

---

## Room Data Flow

```
Browser → getUserMedia → RTCPeerConnection
  → creates offer → ieom-api relay → server (hub)

Server (hub):
  werift RTCPeerConnection receives tracks
  AudioScoreProcessor analyzes RTP audio energy → rolling scores
  POVSwitcher evaluates scores → selects active participant
  OverlayRelay.switchTo(audioTrack, videoTrack) → replaceTrack()

Overlay (OBS browser source localhost:3001):
  OnlineStreamWidget receives WebRTC stream from server
  Renders single <video> element — track changes seamlessly on POV switch
```

---

## Desktop (`packages/desktop/src/`)

Electron shell. Delegates room management to the local server.

```
main/
  room-service.ts   — calls server HTTP API to join/leave rooms
  ipc-handlers.ts   — room:join, room:leave, room:status IPC channels
  server.ts         — starts/stops embedded @ieom/server
  oauth-flow.ts     — Google OAuth in system browser (redirects to ieom://auth)
  token-storage.ts  — persists JWT for cloud auth
preload/
  index.ts          — window.ieom API (license, auth, room, settings, etc.)
```

---

## Key Libraries

| Library | Package | Purpose |
|---|---|---|
| `werift` | server | Pure TypeScript WebRTC (no native deps, no compilation) |
| `ws` | server | WebSocket client for cloud signaling |
| `socket.io` | server | Real-time bridge: server ↔ overlay/admin |
| `fastify` | server | HTTP framework |
| `sql.js` | server | SQLite in-memory/file DB |

---

## Known Constraints & Gotchas

- **werift `addTrack` with received tracks**: werift subscribes to `track.onReceiveRtp` and forwards packets via the sender. Works for relaying, but the track must be from a live (non-closed) PeerConnection.
- **Re-offers from participants**: When a participant sends a second offer (Firefox renegotiation), the hub silently closes the old PC without firing removal callbacks to preserve POV state. The new tracks trigger `replaceTrack()` on the overlay relay.
- **werift `MediaStream` parameter**: `addTrack(track, ms?)` — the `ms` param is "todo impl". Browser `ontrack` events will have empty `event.streams[]`. Build `MediaStream` manually from `event.track`.
- **ICE candidate ordering**: Hub ICE candidates must arrive at the participant AFTER the answer SDP. Buffer during `handleOffer`, flush after sending answer.

---

## Environment Variables

### Self-Hosted

No env required. Runs on localhost:3000 by default.
Optional: `IEOM_CLOUD_URL` (ieom-api URL for room connections, e.g. `https://ieom.danhub.dev`).
