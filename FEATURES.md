# Features & Implementation Details

> **AI Agent Notes**
> This file is an index. The actual documentation lives in `docs/`.
> When modifying a feature's implementation, find the relevant doc and check whether the flow or constraint described still holds. Update or delete stale sections — incorrect docs are worse than no docs.
> Signaling protocols and WebRTC constraints change rarely. Auth flows and engine capabilities change often. Weight your trust accordingly.

---

## docs/

| File | Covers |
|---|---|
| [engine-overview.md](docs/engine-overview.md) | What the engine does, the engine/presentation boundary, the Desktop OS as one interpretation, adding a second overlay |
| [state-management.md](docs/state-management.md) | Config persistence vs runtime state, the ownership rule, client-side Zustand slice split, reconnect recovery |
| [socket-handlers.md](docs/socket-handlers.md) | Domain module split rationale, HandlerContext pattern, overlay slot gate, domain boundary rules |
| [auth-flow.md](docs/auth-flow.md) | Web and desktop OAuth flows, why auth delegates to the cloud, Vite proxy split, key config |
| [webrtc-online-rooms.md](docs/webrtc-online-rooms.md) | SFU architecture, cloud rooms, LAN join, POV pipeline, overlay relay, ICE ordering constraint, werift gotchas |
| [widget-authoring.md](docs/widget-authoring.md) | How to write a new widget, local state vs server config, simulation intents, the four-file checklist |
| [widget-communication.md](docs/widget-communication.md) | Widget-to-widget pub/sub, the DOM intent bus, the server-mediated signal path, the full ambiance reactive loop |
| [widget-wires.md](docs/widget-wires.md) | Operator-configured persistent wires between widgets, signal/action manifests, Wires admin panel, DesktopConfigService as owner |
| [admin-engine-pages.md](docs/admin-engine-pages.md) | Panel-to-table ownership map, DB table inventory, why geometry moved to `applications`, why transitions are named assets, routing checklist. |

## Known constraints & gotchas

- **LAN WebRTC requires HTTPS** — `getUserMedia` is blocked by browsers on non-localhost origins over plain HTTP. Generate a self-signed cert with `node scripts/generate-cert.js`; the server auto-detects and enables HTTPS on restart. Guest devices accept the cert warning once.
- **Admin preview vs overlay widget** — `AdminRelay` has one WebRTC PC per participant; only one consumer (admin panel preview OR overlay `participant-stream` widget) can answer a given offer. Admin preview is off by default so the overlay widget gets priority.
- **OverlayRelay uses no STUN** — server and overlay are both localhost; empty `iceServers` gives immediate ICE. STUN caused ~12s delays before removal.
- **werift `addTrack` with received tracks** — track must come from a live peer connection. Synthetic tracks don't work.
- **werift `MediaStream` parameter** — `addTrack(track, stream?)` stream param is unimplemented. Build `MediaStream` manually from `event.track`.
- **werift `a=msid`** — not emitted in SDP. Do not rely on `event.streams` in `ontrack`.
- **ICE candidate ordering** — hub candidates must arrive at the remote peer after the answer SDP. Buffer during offer handling, flush after sending answer.
- **Re-offers from participants** — hub silently closes old peer connection and accepts the new one. Overlay relay updates automatically.
- **Widget lazy loading one-frame flash** — if a widget opens before its dynamic import resolves, the overlay shows a generic fallback for one frame then replaces it. Intentional — the forceUpdate after load triggers the re-render.
- **`config:update` / `config:patch` machine listeners** — these events are emitted by the config service directly on the socket, not via the state machine. Any `machine.on('config:update')` listener is dead code.
