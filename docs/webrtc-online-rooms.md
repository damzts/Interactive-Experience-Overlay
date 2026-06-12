> **AI Agent Notes**
> WebRTC constraints change rarely but are painful when they bite. The werift-specific gotchas at the bottom are load-bearing — don't remove them.
> The LAN flow and cloud flow share the same hub and POV pipeline. Any change to one affects the other.
> ICE candidate ordering is the most common source of connection failures during development.

---

# WebRTC & Online Rooms

> **Admin users:** See [Online Rooms Admin Guide](./online-rooms-admin-guide.md) for configuration details, tuning tips, and troubleshooting.

## Architecture overview

The server acts as a Selective Forwarding Unit (SFU) hub. Participants send their video and audio to the hub. The hub selects one active participant at any time (based on audio and motion scoring) and relays only that participant's tracks to the overlay. The overlay renders a single video stream that changes seamlessly when the active participant switches.

This means the overlay never does peer-to-peer WebRTC with participants. It only has one WebRTC connection — with the local server. The server handles all the complexity of managing N participant connections.

## Cloud rooms

Cloud rooms require a paid cloud account. The local server coordinates with the cloud API for signaling — the cloud acts as a relay for WebRTC offer/answer exchange between participants and the hub.

The flow at a high level: the admin panel asks the server to create a room, the server registers with the cloud, the cloud issues a room code, participants open the cloud-hosted join page and enter the room code, the cloud relays their WebRTC offers to the local server hub.

Once WebRTC establishes, the cloud is no longer in the media path. All video and audio travel directly between participant browsers and the local server.

## LAN join (no cloud required)

Participants on the same local network can connect without a cloud account. They navigate directly to the local server's studio page (`/studio`) on their browser and enter the host's room code.

The room code is a 6-character alphanumeric string generated at server start. The host retrieves it from `GET /api/room/code` and can regenerate it via `POST /api/room/code/regenerate`. Set `JOIN_CODE_DISABLED=true` to skip code validation in fully trusted local environments.

The signaling happens entirely over the local Socket.IO connection — no cloud relay involved. WebRTC then connects using host candidates (local IP addresses), which work directly on a LAN without STUN or TURN servers.

LAN participants and cloud participants are interchangeable from the hub's perspective. Both enter the same POV scoring and switching pipeline. Both can be active simultaneously.

### HTTPS requirement for LAN WebRTC

Browsers enforce that `getUserMedia` (camera/mic access) and other sensitive APIs are only available in [secure contexts](https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts). `localhost` is always a secure context, but any other origin (including a LAN IP like `192.168.x.x`) must be served over HTTPS.

**Setup:** Run `node scripts/generate-cert.js` once to generate a self-signed certificate at `scripts/certs/`. The server auto-detects the cert on startup and switches to HTTPS. Restart after generating.

**Guest devices:** Navigate to `https://<host-ip>:3000/studio`. The browser will show a security warning for the self-signed cert — click "Advanced → Proceed" once per device. After that, `getUserMedia` works normally.

The cert files are gitignored. Regenerate them at any time — the server picks up the new cert on next restart.

### Why LAN join was added

Every multi-participant scenario previously required the cloud service — even a simple two-person setup at the same desk. This was an unnecessary barrier for local streaming setups. The cloud adds cost and latency for something a direct connection handles better.

## POV pipeline

Once a participant's tracks arrive at the hub, three things happen:

**Audio scoring** — incoming RTP audio packets are analyzed continuously. Each participant gets a rolling audio score representing how recently and how actively they've been speaking. Configurable via `audioReportIntervalMs`, `rollingWindowMs`, `silenceThreshold`, and `activityThreshold`.

**Motion scoring** — RTP video packet sizes are sampled as a motion proxy. High motion produces larger packets, which increases the participant's motion score. The final activity score blends audio and motion:
```
compositeScore = audioScore + (motionScore × motionWeight)
```
Where `motionWeight` is configurable (0.0-1.0, default 0.3). Set to 0 for audio-only, 1.0 for motion-dominant switching.

**POV switching** — the switcher evaluates composite scores periodically and selects the participant who should be the active camera. Configured via `cooldownMs` (minimum time between switches) and automatic vs. manual mode in the admin panel.

**Overlay relay** — when the active participant changes, the server does a `replaceTrack()` on the overlay's WebRTC sender. The overlay's video element continues playing without interruption — it doesn't know a track swap happened. Transitions can be cut (instant) or faded (smooth).

## Overlay video consumption — RtcStreamContext

The overlay consumes the relay stream via a singleton React context provider (`RtcStreamContext`) mounted at the app root in `App.tsx`. It manages one `RTCPeerConnection` for the lifetime of the overlay session.

```
App
└── RtcStreamProvider          ← single PC, single MediaStream, mounts once
    ├── SceneCompositor
    │   └── PovStreamRenderer  ← reads stream via useRtcStream(), pure display
    └── Desktop
        └── WindowWidget       ← can bind to a pov-stream scene window, zero extra cost
```

**Why a singleton?** The server's `RoomRelay` manages exactly one downstream connection. Multiple overlay components each subscribing independently would race — each `relay:subscribe` call triggers `RoomRelay.createOffer()` which closes and recreates the server-side PC. The singleton ensures the connection is established once, survives scene transitions without renegotiation, and can be read by any number of consumers without side effects.

### Using WebRTC video in a scene

Add a scene window with `rendererType: 'pov-stream'`. Configure it via the admin panel (Scene editor → add window → POV Stream). The `PovStreamRenderer` reads from `RtcStreamContext` — no socket or peer connection owned by the renderer itself.

`WindowWidget` (desktop app widget bound to a scene window) can also render a `pov-stream` window as a preview. It reads from the same context — no second WebRTC connection is created.

### Connection lifecycle

1. Overlay connects to server socket with `clientType: 'overlay'`
2. `RtcStreamProvider` emits `pov-online:relay:subscribe`
3. Server `RoomRelay.createOffer()` creates a sendonly PC and sends the offer
4. Provider answers; ICE resolves via loopback host candidates; connection established
5. `MediaStream` is stored in context; all `PovStreamRenderer` instances receive it via `useRtcStream()`
6. On POV switch: `RoomRelay.switchTo()` calls `replaceTrack()` — the `MediaStream` reference is unchanged, new participant's frames flow immediately

On PC failure, the provider re-subscribes to trigger a fresh offer from the server. The server-side `RoomRelay` also detects its own PC failure and pushes a new offer independently. Both paths converge to a reconnect.

## Overlay relay wiring

`RoomRelay` is owned entirely by `desktop-entry.ts`. Two hooks drive it:

- `povOrchestrator.onSwitch(next => roomRelay.switchTo(...))` — fires on every POV switch, updates the relay's active track
- `roomHub.onTrack(userId => ...)` — auto-selects the first participant and calls `switchTo` on re-offer (new track objects after reconnect)

The relay socket handlers (`pov-online:relay:subscribe/answer/ice`) are registered only for sockets with `clientType: 'overlay'`. Admin sockets and studio participants cannot trigger relay operations.

`RoomSignaling` does not touch `RoomRelay`. This ensures LAN-only mode works without any cloud room active.

## ICE servers

`RoomRelay` and `RtcStreamProvider` use **no ICE servers** (empty `iceServers: []`). The server and overlay are both on localhost — ICE resolves immediately via host candidates. STUN is unnecessary and was causing ~12s delays before being removed.

`RoomHub` and `RoomPreviewRelay` still use `stun:stun.l.google.com:19302` because participants may connect from different network segments (LAN or cloud).

## ICE candidate ordering constraint

When the hub generates ICE candidates during offer handling, those candidates must not be sent to the remote peer until after the answer SDP has been sent. If candidates arrive at a peer that hasn't set the remote description yet, they are silently rejected and the connection either fails or degrades.

The fix: buffer all hub-generated ICE candidates during offer processing, send the answer first, then flush the buffer. This ordering must be preserved in any signaling path — both the cloud relay path and the LAN direct path.

## Re-offer handling

If a participant's browser reconnects and sends a new offer (e.g. after a camera switch), the hub silently closes the previous peer connection and accepts the new one. The new tracks automatically trigger a relay update on the overlay connection. No special handling is needed on the overlay side.

## Freeze detection

`RoomHub` runs a freeze monitor (polling every 500ms). If a participant's video track goes silent for 2000ms while ICE is healthy, the track is marked muted and `RoomSignaling` schedules an `ice-restart-request` after a 2000ms recovery delay. Total worst-case latency from freeze to recovery initiation: ~4.5s.

## werift-specific gotchas

- `addTrack()` with a received track works by forwarding RTP packets through the sender. The track must come from a live peer connection — you cannot construct a synthetic track and add it.
- The `MediaStream` parameter in `addTrack(track, stream?)` is not implemented. Always build `MediaStream` manually from the track event.
- werift does not emit `a=msid` in its SDP. Do not rely on `event.streams` in `ontrack` — use `event.track` directly.
- `RoomRelay` adds both audio and video tracks before creating the offer. Audio must be added first so the SDP m-line order is predictable.
