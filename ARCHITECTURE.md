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

## System Overview

Hub-and-spoke P2P architecture with two independent systems:

1. **Cloud** — deployed server for user registration, room management, and WebRTC signaling relay (no media processing).
2. **Self-Hosted Client** — offline-capable desktop app for stream overlay visual control. When connected to a cloud room, acts as the WebRTC hub receiving all participant streams, running POV switching locally, and rendering the active stream in the overlay.

---

## Monorepo Structure

pnpm workspaces. Seven packages:

| Package | Role | Port |
|---|---|---|
| `@ieom/cloud` | Fastify backend: PG, auth, rooms, signaling relay | 3100 |
| `@ieom/cloud-ui` | React SPA: landing, login, room dashboard, player join page | 3200 (dev) |
| `@ieom/server` | Self-hosted Fastify + Socket.IO + werift WebRTC hub (SQLite, no auth) | 3000 |
| `@ieom/admin` | React admin UI (config, scenes, assets) | 3002 |
| `@ieom/overlay` | React overlay UI (rendered on stream) + PovCameraWidget | 3001 |
| `@ieom/shared` | Shared TS types, constants, contracts | — |
| `@ieom/desktop` | Electron shell embedding @ieom/server | — |

---

## Key Scripts

```bash
# ─── Self-Hosted Client (offline, no cloud needed) ────────────────
pnpm dev              # Run server + overlay + admin in dev mode
pnpm dev:desktop      # Build all then run Electron app

# ─── Cloud (deployed server) ──────────────────────────────────────
pnpm dev:cloud        # Run cloud backend + cloud-ui in dev mode
pnpm build:cloud      # Production build: shared → cloud-ui → cloud
pnpm start:cloud      # Start production cloud server (serves UI + API)
```

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                    CLOUD (signaling relay only)                      │
│                                                                     │
│  Google OAuth → PostgreSQL (users, rooms)                           │
│  Socket.IO /rooms namespace                                         │
│    - Routes offers/answers/ICE between hub ↔ participants           │
│    - Tracks hub + participant presence                               │
│    - No media touches the server                                    │
└──────────────────────────────────┬──────────────────────────────────┘
                                   │ Socket.IO (signaling only)
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
             │ PovCameraWidget │
             │ <video> element │
             └──────────────┘
```

---

## Cloud (`packages/cloud/src/`)

Pure signaling relay — no media processing.

```
auth/               — Google OAuth, JWT, cookies, CSRF, middleware
db/
  pool.ts           — PostgreSQL connection pool
  migrationRunner.ts — sequential versioned migrations
  pgMigrations/     — DDL migration files
  repositories/     — UserRepository
online/
  session-manager.ts — RoomManager: room/participant/hub tracking
socket/
  onlineHandlers.ts — /rooms namespace: join-as-hub, join-as-participant, offer/answer/ICE relay
index.ts            — server entry: wires PG, auth, rooms, REST routes, starts Fastify
```

### Cloud Signaling Protocol

```
Desktop (hub)           Cloud (relay)           Browser (participant)
     │                        │                          │
     │── join-as-hub ────────►│                          │
     │                        │◄── join-as-participant ──│
     │◄── participant-joined ─│── hub-info ────────────►│
     │                        │◄────── offer ────────────│
     │◄────── offer ─────────│                          │
     │── answer ─────────────►│── answer ──────────────►│
     │◄── ice-candidate ──────│◄── ice-candidate ───────│
     │── ice-candidate ──────►│── ice-candidate ────────►│
     │                        │                          │
     │◄═══════════ WebRTC P2P (direct, no server) ═════►│
```

---

## Self-Hosted Server (`packages/server/src/`)

```
desktop-entry.ts    — primary entry: factory + dev-mode self-start (auto-starts on port 3000 when run directly)
room/
  hub-connection.ts — werift RTCPeerConnection manager (N participants)
  cloud-signaling.ts — Socket.IO client connecting to cloud as hub
  overlay-relay.ts  — werift sendonly connection to overlay, replaceTrack on switch
pov/
  switcher.ts       — POV decision engine (evaluates scores, enforces cooldown)
  audio-score-processor.ts — rolling-average activity scores from RTP audio
  participant-registry.ts — feed adapter for POV switcher
  index.ts          — POVOrchestrator: wires hub + switcher + audio processor
routes/
  room.ts           — POST /api/room/join, POST /api/room/leave, GET /api/room/status
  config.ts         — GET/PUT/PATCH /api/config
  media.ts          — asset catalog routes
  archive.ts        — event log routes
db/
  desktop-db.ts     — SQLite (sql.js) initialization
  desktop-config-service.ts — single-tenant config CRUD
state/machine.ts    — SceneMachine: scene state transitions
socket/handlers.ts  — admin ↔ overlay real-time bridge
obs/bridge.ts       — OBS WebSocket integration
ambiance/manager.ts — automated desktop behavior
events/scheduler.ts — event-driven automations
```

### Room Data Flow

```
Browser → getUserMedia → RTCPeerConnection
  → creates offer → cloud relay → server (hub)

Server (hub):
  werift RTCPeerConnection receives tracks
  AudioScoreProcessor analyzes RTP audio energy → rolling scores
  POVSwitcher evaluates scores → selects active participant
  OverlayRelay.switchTo(audioTrack, videoTrack) → replaceTrack()

Overlay (OBS browser source localhost:3001):
  PovCameraWidget receives WebRTC stream from server
  Renders single <video> element — track changes seamlessly on POV switch
```

---

## Overlay (`packages/overlay/src/`)

```
desktop/
  PovCameraWidget.tsx — receives WebRTC stream from server, renders in DesktopWindow
  CameraWidget.tsx    — local camera capture (host's own camera)
  widgetRegistry.ts   — widget type → component mapping
  DesktopWindow.tsx   — draggable/resizable window chrome
socket/               — config sync, scene events, desktop events
engine/               — render engine
layers/               — scene layer composition
```

Widget types: `'pov-camera'` (remote POV stream), `'camera'` (local camera), plus 20+ other widget types.

---

## Admin (`packages/admin/src/`)

Auth is **optional** — the app loads directly into the Dashboard without login. Authentication unlocks paid features (stream rooms) via `FeatureGate`.

```
auth/
  AuthContext.tsx   — unified provider (auto-detects desktop IPC vs web cookie auth)
  AuthBadge.tsx     — compact sign-in/user widget (placed in TopBar)
  AccountSection.tsx — account info panel (placed in Settings)
desktop/
  FeatureGate.tsx   — tier-based feature gating (wraps gated UI, shows UpgradePrompt)
  DesktopAuthContext.tsx — IPC-based auth for Electron mode
features/
  dashboard/        — main layout: TopBar, LeftSidebar, RightPane, LivePreview
  pov/              — OnlineRoomsPanel (gated behind 'stream-rooms' feature)
  settings/         — SettingsPage (includes AccountSection)
```

**Auth pattern:** `useAuth()` hook works in both web and desktop modes. Components that need auth-gating wrap content in `<FeatureGate feature="...">`. Login is triggered from TopBar badge or Settings panel — loosely coupled, easy to relocate.

---

## Desktop (`packages/desktop/src/`)

Electron shell. Delegates room management to the local server.

```
main/
  room-service.ts   — calls server HTTP API to join/leave rooms
  ipc-handlers.ts   — room:join, room:leave, room:status IPC channels
  server.ts         — starts/stops embedded @ieom/server
  oauth-flow.ts     — Google OAuth in system browser
  token-storage.ts  — persists JWT for cloud auth
preload/
  index.ts          — window.ieom API (license, auth, room, settings, etc.)
```

---

## Key Libraries

| Library | Package | Purpose |
|---|---|---|
| `werift` | server | Pure TypeScript WebRTC (no native deps, no compilation) |
| `socket.io-client` | server | Connects to cloud as hub |
| `socket.io` | server, cloud | Real-time signaling |
| `fastify` | server, cloud | HTTP framework |
| `sql.js` | server | SQLite in-memory/file DB |
| `pg` | cloud | PostgreSQL client |

---

## Environment Variables

### Cloud (.env)

```
PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD
GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI
JWT_SECRET
PORT=3100
```

### Self-Hosted

No env required. Runs on localhost:3000 by default.
Optional: `IEOM_SIGNALING_URL` (cloud URL for room connections).
