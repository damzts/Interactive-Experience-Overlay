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

1. **ieom-api** (external, deployed) — Fastify server for user registration, room management, and WebRTC signaling relay (no media processing). Deployed on partner's infrastructure (Orange Pi via Cloudflare tunnel at ieom.danhub.dev).
2. **Self-Hosted Client** (this monorepo) — offline-capable desktop app for stream overlay visual control. When connected to a cloud room, acts as the WebRTC hub receiving all participant streams, running POV switching locally, and rendering the active stream in the overlay.

---

## Monorepo Structure

pnpm workspaces. Five packages:

| Package | Role | Port |
|---|---|---|
| `@ieom/server` | Self-hosted Fastify + Socket.IO + werift WebRTC hub (SQLite, no auth) | 3000 |
| `@ieom/admin` | React admin UI (config, scenes, assets) | 3002 |
| `@ieom/overlay` | React overlay UI (rendered on stream) + PovCameraWidget | 3001 |
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
             │ PovCameraWidget │
             │ <video> element │
             └──────────────┘
```

---

## Self-Hosted Server (`packages/server/src/`)

```
desktop-entry.ts    — primary entry: factory + dev-mode self-start (auto-starts on port 3000 when run directly)
room/
  hub-connection.ts — werift RTCPeerConnection manager (N participants)
  cloud-signaling.ts — WebSocket (ws) client connecting to ieom-api as hub
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
socket/handlers.ts  — admin ↔ overlay real-time bridge (Socket.IO)
obs/bridge.ts       — OBS WebSocket integration
ambiance/manager.ts — automated desktop behavior
events/scheduler.ts — event-driven automations
```

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
     │◄── ice-candidate ──────│◄── ice-candidate ───────│
     │── ice-candidate ──────►│── ice-candidate ────────►│
     │                        │                          │
     │◄═══════════ WebRTC P2P (direct, no server) ═════►│
```

Message format: `{ type, payload, senderId, timestamp, targetUserId? }`

Connection URL: `ws(s)://<host>/ws/rooms/<roomId>?token=<jwt>`

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
  PovCameraWidget receives WebRTC stream from server
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

## Environment Variables

### Self-Hosted

No env required. Runs on localhost:3000 by default.
Optional: `IEOM_CLOUD_URL` (ieom-api URL for room connections, e.g. `https://ieom.danhub.dev`).
