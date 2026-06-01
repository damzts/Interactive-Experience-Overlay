# Features & Implementation Details

## AI Agent Notes

- This file documents **protocols, flows, and constraints** — things that are hard to rediscover from code alone.
- Do NOT document implementation details that are obvious from reading the source (function names, file paths, etc.). Those change constantly.
- When modifying a feature's implementation, check if the flow or constraint described here still holds. If not, update or remove.
- Prefer documenting **why** (design decisions, gotchas, ordering requirements) over **what** (code structure).
- If a section becomes stale, delete it rather than leaving incorrect info — incorrect docs are worse than no docs.
- Signaling protocols and WebRTC constraints change rarely; auth flows and engine capabilities change often. Weight your trust accordingly.

---

## Engine / Presentation Boundary

**The engine is the product. The Desktop OS is a demo built on top of it.**

The engine is presentation-agnostic. It manages state, schedules events, runs ambiance, fires effects, handles transitions, and bridges real-time state over Socket.IO. It knows nothing about windows, taskbars, icons, or visual metaphors.

### Engine Capabilities (packages/server + packages/shared)

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

### Desktop OS Presentation (packages/overlay)

Currently: **Desktop OS** — a Win98-inspired desktop metaphor with draggable windows, taskbar, start menu, screen saver, and icon arrangement.

| Engine Primitive | Desktop OS Interpretation |
|---|---|
| Widget | Draggable window with title bar, close button, resize handles |
| Widget toggle | Window open/close animation |
| State (scene) | A "desktop" with icons, or a "lobby" 3D room |
| Ambiance action | Simulated user clicking around the OS |
| Theme tokens | Win98 chrome, Frutiger Aero glass, Y2K candy colors |

### Adding a Second Presentation

No server changes needed. Create a new package (e.g. `packages/overlay-broadcast`), implement the three contracts (Socket.IO events, Config API, WebRTC handshake), point `overlayDir` at its `dist/`, and the engine drives it identically.

---

## Auth Flow

Authentication is handled entirely by the cloud API (`ieom.danhub.dev`). The self-hosted client has no auth server — it delegates to the cloud. Auth is optional; the admin panel and overlay work fully without login. Sign-in unlocks cloud features (rooms, online).

### Web (admin on localhost:3002)

Same-window redirect flow. No popups.

```
Admin (localhost:3002)          Cloud API (ieom.danhub.dev)         Google
       │                                │                            │
       │── window.location.href ───────►│                            │
       │   /api/auth/google?redirect=http://localhost:3002/admin      │
       │                                │── 302 to Google ──────────►│
       │                                │◄── callback with code ─────│
       │                                │                            │
       │◄── 302 to redirect?auth=success│                            │
       │   http://localhost:3002/admin?auth=success                   │
       │                                                             │
       │── GET /api/auth/me ───────────►│  (via Vite proxy, cookies) │
       │◄── { user } ──────────────────│
```

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
| `VITE_API_ORIGIN` | `packages/admin/.env` | Frontend API base URL for production builds |
| `GOOGLE_REDIRECT_URI` | `ieom-api/.env` | Must match Google Console authorized redirect URI |
| `ALLOWED_REDIRECT_ORIGINS` | `ieom-api/.env` | Comma-separated origins allowed for redirect |
| `IEOM_BACKEND_URL` | Desktop runtime | Backend origin for desktop OAuth + API calls |

### Vite Dev Proxy

```
/api/auth  → https://ieom.danhub.dev  (cloud handles OAuth)
/api       → http://localhost:3000     (local server)
/socket.io → http://localhost:3000     (local server, WebSocket)
/assets    → http://localhost:3000
/media     → http://localhost:3000
```

---

## Online Rooms Flow

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
     │── ice-candidate ──────►│── ice-candidate ────────►│
     │◄── ice-candidate ──────│◄── ice-candidate ───────│
     │                        │                          │
     │◄═══════════ WebRTC P2P (direct, no server) ═════►│
```

### Overlay WebRTC Relay

1. Overlay connects via Socket.IO, emits `pov:subscribe`
2. Server creates a werift sendonly PC, waits for video track (100ms debounce)
3. Sends `pov:offer` → overlay answers → ICE connects
4. On POV switch: `replaceTrack()` swaps media without renegotiation
5. Overlay builds a `MediaStream` from `event.track` (werift doesn't implement `a=msid`)

### Room Data Flow

```
Browser → getUserMedia → RTCPeerConnection
  → creates offer → ieom-api relay → server (hub)

Server (hub):
  werift receives tracks
  AudioScoreProcessor analyzes RTP audio → rolling scores
  POVSwitcher evaluates scores → selects active participant
  OverlayRelay.switchTo() → replaceTrack()

Overlay (localhost:3001):
  OnlineStreamWidget receives WebRTC stream
  Renders single <video> — track changes seamlessly on POV switch
```

---

## Camera Capture

Local camera capture is handled by the **overlay's CameraWidget** (`packages/overlay/src/desktop/CameraWidget.tsx`). It uses `getUserMedia` directly in the OBS browser source — no server-side camera management.

---

## LAN WebRTC via `/join` (future)

**Status**: Not yet implemented. Design spec for future development.

### Problem

Currently, all multi-participant WebRTC requires the cloud service for signaling. On a LAN, guests can already reach the server directly — the cloud is unnecessary overhead and a paid gate for what should be a free local feature.

### Concept

The local server serves a `/join` page. A guest on the same network opens `http://<host-ip>:3000/join` in their browser, grants camera/mic, and connects directly to the WebRTC hub — no cloud, no room creation, no account needed.

### How It Works

1. Guest opens `http://<local-ip>:3000/join` in any browser
2. Server serves a lightweight join page (camera/mic permissions + WebRTC client)
3. Guest's browser creates an offer and sends it to the server via Socket.IO (same local server)
4. Server (werift hub) processes the offer, returns an answer, exchanges ICE candidates — all over the local Socket.IO connection
5. WebRTC P2P establishes (likely host candidates only — no STUN/TURN needed on LAN)
6. Guest's video/audio arrives at the hub, enters the same POV switching + overlay relay pipeline as cloud participants

### Key Differences from Cloud Flow

| Aspect | Cloud | LAN `/join` |
|---|---|---|
| Signaling relay | ieom-api WebSocket | Local server Socket.IO |
| Discovery | Room code shared out-of-band | Guest knows the IP/URL |
| Auth required | Yes (paid feature) | No |
| STUN/TURN | Needed (NAT traversal) | Not needed (same network) |
| Room creation | Cloud API | None — server accepts connections directly |

### Design Constraints

- The hub (werift) and POV pipeline are already presentation-agnostic — LAN guests feed into the same system
- The `/join` page is a separate lightweight client (not the overlay, not the admin)
- No changes to the overlay relay needed — it already receives tracks via `replaceTrack()`
- Must coexist with cloud rooms (a LAN guest and cloud guests could theoretically be active simultaneously)

### Signaling Flow (local)

```
Guest Browser (LAN)              Local Server (hub)
     │                                │
     │── Socket.IO connect ──────────►│  (http://<ip>:3000, /join namespace)
     │── getUserMedia ───────────────►│
     │── offer (SDP) ────────────────►│
     │◄── answer (SDP) ──────────────│  (werift creates PC, generates answer)
     │── ice-candidate ──────────────►│
     │◄── ice-candidate ─────────────│
     │                                │
     │◄═══════ WebRTC P2P (LAN) ════►│  (host candidates, no relay needed)
     │  video + audio tracks          │
     │                                ▼
     │                         POV pipeline → overlay
```

---

## Known Constraints & Gotchas

- **werift `addTrack` with received tracks**: werift forwards RTP packets via the sender. Track must be from a live PeerConnection.
- **Re-offers from participants**: Hub silently closes old PC, new tracks trigger `replaceTrack()` on overlay relay.
- **werift `MediaStream` parameter**: `addTrack(track, ms?)` — `ms` param is unimplemented. Build `MediaStream` manually from `event.track`.
- **ICE candidate ordering**: Hub ICE candidates must arrive at participant AFTER the answer SDP. Buffer during `handleOffer`, flush after sending answer.
