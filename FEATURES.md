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
| Config Persistence | `DesktopConfigService` + SQLite | Stores config that survives a restart |
| Runtime State | `RuntimeStateStore` (in-memory) | Live session state: scene, widgets, overlay connection |
| Real-time Bridge | Socket.IO domain handlers | Syncs state between server and clients |
| Online Rooms | WebRTC hub + cloud signaling | Multi-participant streaming |
| LAN Join | `/join` namespace + `join.html` | Local-network participants without cloud |

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

## Runtime State vs Config Persistence

These are two distinct systems that must not be conflated.

**Config persistence** (`DesktopConfigService` + SQLite): everything that should survive a server restart — scenes, applications, events, themes, keybinds, ambiance schedules. Reads/writes are on the admin save path, not the real-time rendering path.

**Runtime state** (`RuntimeStateStore`, in-memory): live session data that has no meaning across restarts — current scene, which widgets are open, whether the overlay is connected, the active ambiance leader. This is always reconstructed from incoming socket events on reconnect.

### Why this matters

Any code that needs to know "is the overlay currently connected" or "which widgets are open right now" must read from `RuntimeStateStore`, not SQLite. Reading SQLite for hot-path state queries would add unnecessary latency and complexity.

### State ownership rule

> If state survives a server restart, it belongs in SQLite.
> If it's live-session state, it belongs in `RuntimeStateStore`.

This same rule applies client-side in the overlay: persisted config is in `configSlice`, live widget open/close state is in `desktopSlice`.

---

## Socket Handler Architecture

The Socket.IO protocol is split into domain-scoped handler modules. Each module exports a `register(ctx, socket)` function. Shared mutable state (open widgets, overlay slot, simulation leader, runtime overrides) is passed via a `HandlerContext` object.

This separation means:
- A scene change handler can never accidentally touch the desktop state
- Runtime config override logic lives in one place (`runtimeOverride.ts`), used by multiple domains
- Adding a new socket event means touching one file, not a 1200-line monolith

The orchestrator (`handlers/index.ts`) owns the overlay slot gate, connection/disconnection logic, and initial state push on connect.

---

## Widget Lifecycle Contract

Widgets are React components — most need nothing beyond their props. For widgets that need to acquire/release resources (camera, audio context, WebRTC), an optional `WidgetLifecycle` interface is available in `@ieom/shared`.

### When to use it

- `onMount` / `onUnmount`: camera capture, audio context, WebRTC peer connection
- `onConfigUpdate`: widgets that need to react to config changes without a full re-render
- `serialize` / `deserialize`: save and restore widget state across overlay reconnects (e.g., playback position)
- `onClosing`: begin teardown before the close animation finishes (e.g., fade audio before window closes)

### When NOT to use it

Don't use lifecycle hooks for UI state that is naturally managed by React (hover, focus, open/close animation). Those belong in component-local state.

### Overlay reconnect recovery

`serialize()` is called on all live widgets before the overlay socket reconnects. On reconnect, the server pushes full state, and `deserialize()` is called on each widget with its saved state before `onMount`. This lets music players resume their track position, galleries restore their scroll index, etc.

---

## Widget Registry — Lazy Loading

Widget components are **not** imported at module load time. The registry is a manifest of dynamic import factories. On first use, the component is loaded and cached.

Implications:
- The initial overlay bundle does not contain any widget code
- Widget #30 costs one line in the manifest — no bundle impact on unrelated widgets
- Widgets that are never opened in a session are never downloaded

The overlay pre-warms the registry for all widgets the user has configured (derived from the loaded config), so visible widgets are ready before they open.

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

Local camera capture is handled by the overlay's CameraWidget. It uses `getUserMedia` directly in the OBS browser source — no server-side camera management.

---

## LAN WebRTC via `/join`

**Status**: Implemented.

### Problem

All multi-participant WebRTC previously required the cloud service for signaling. On a LAN, guests can reach the server directly — the cloud is unnecessary overhead and a paid gate for a free local feature.

### How It Works

1. Guest opens `http://<local-ip>:3000/join` in any browser on the same network
2. Server serves `join.html` — a lightweight standalone page (no build step, no framework)
3. Guest grants camera/mic, page creates a WebRTC offer
4. Offer is sent to the server via the `/join` Socket.IO namespace
5. Server (werift hub) processes the offer, sends back the answer, exchanges ICE candidates — all over the local Socket.IO connection
6. WebRTC P2P establishes using host candidates only (no STUN/TURN needed on LAN)
7. Guest's video/audio arrives at the hub, enters the same POV switching + overlay relay pipeline as cloud participants

### Key Differences from Cloud Flow

| Aspect | Cloud | LAN `/join` |
|---|---|---|
| Signaling relay | ieom-api WebSocket | Local server `/join` Socket.IO namespace |
| Discovery | Room code shared out-of-band | Guest knows the host IP |
| Auth required | Yes (paid feature) | No |
| STUN/TURN | Needed (NAT traversal) | Not needed (same network) |
| Room creation | Cloud API | None — server accepts directly |

### Signaling Flow

```
Guest Browser (LAN)              Local Server (hub)
     │                                │
     │── WS /join namespace ─────────►│
     │── offer (SDP) ────────────────►│
     │◄── answer (SDP) ──────────────│  (werift creates PC, generates answer)
     │── ice-candidate ──────────────►│
     │◄── ice-candidate ─────────────│  (buffered until after answer is sent)
     │                                │
     │◄═══════ WebRTC P2P (LAN) ════►│  (host candidates, no relay needed)
     │  video + audio tracks          │
     │                                ▼
     │                         POV pipeline → overlay
```

### ICE candidate buffering

Hub ICE candidates are buffered until after the answer SDP is sent to the guest, then flushed. This avoids the race condition where candidates arrive before the guest has set the remote description.

### Coexistence with cloud rooms

LAN participants and cloud participants feed into the same `HubConnection` and `POVOrchestrator`. They are distinguished by participant ID prefix (`lan-` vs cloud IDs). Both can be active simultaneously.

---

## Known Constraints & Gotchas

- **werift `addTrack` with received tracks**: werift forwards RTP packets via the sender. Track must be from a live PeerConnection.
- **Re-offers from participants**: Hub silently closes old PC, new tracks trigger `replaceTrack()` on overlay relay.
- **werift `MediaStream` parameter**: `addTrack(track, ms?)` — `ms` param is unimplemented. Build `MediaStream` manually from `event.track`.
- **ICE candidate ordering**: Hub ICE candidates must arrive at participant AFTER the answer SDP. Buffer during `handleOffer`, flush after sending answer.
- **Widget lazy loading race**: If a widget is toggled open before its dynamic import resolves, the overlay renders `GenericWidget` for one frame then replaces it once the component loads. This is intentional — the `forceUpdate` after load triggers the re-render.
