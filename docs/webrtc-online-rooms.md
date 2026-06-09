> **AI Agent Notes**
> WebRTC constraints change rarely but are painful when they bite. The werift-specific gotchas at the bottom are load-bearing — don't remove them.
> The LAN flow and cloud flow share the same hub and POV pipeline. Any change to one affects the other.
> ICE candidate ordering is the most common source of connection failures during development.

---

# WebRTC & Online Rooms

## Architecture overview

The server acts as a Selective Forwarding Unit (SFU) hub. Participants send their video and audio to the hub. The hub selects one active participant at any time (based on audio scoring) and relays only that participant's tracks to the overlay. The overlay renders a single video stream that changes seamlessly when the active participant switches.

This means the overlay never does peer-to-peer WebRTC with participants. It only has one WebRTC connection — with the local server. The server handles all the complexity of managing N participant connections.

## Cloud rooms

Cloud rooms require a paid cloud account. The local server coordinates with the cloud API for signaling — the cloud acts as a relay for WebRTC offer/answer exchange between participants and the hub.

The flow at a high level: the admin panel asks the server to create a room, the server registers with the cloud, the cloud issues a room code, participants open the cloud-hosted join page and enter the room code, the cloud relays their WebRTC offers to the local server hub.

Once WebRTC establishes, the cloud is no longer in the media path. All video and audio travel directly between participant browsers and the local server.

## LAN join (no cloud required)

Participants on the same local network can connect without a cloud account. They navigate directly to the local server's join page (`/join`) on their browser and enter the host's room code.

The room code is a 6-character alphanumeric string generated at server start. The host retrieves it from `GET /api/room/code` and can regenerate it via `POST /api/room/code/regenerate`. Set `JOIN_CODE_DISABLED=true` to skip code validation in fully trusted local environments.

The signaling happens entirely over the local Socket.IO connection — no cloud relay involved. WebRTC then connects using host candidates (local IP addresses), which work directly on a LAN without STUN or TURN servers.

LAN participants and cloud participants are interchangeable from the hub's perspective. Both enter the same POV scoring and switching pipeline. Both can be active simultaneously.

### Why LAN join was added

Every multi-participant scenario previously required the cloud service — even a simple two-person setup at the same desk. This was an unnecessary barrier for local streaming setups. The cloud adds cost and latency for something a direct connection handles better.

## POV pipeline

Once a participant's tracks arrive at the hub, three things happen:

**Audio scoring** — incoming RTP audio packets are analyzed continuously. Each participant gets a rolling audio score representing how recently and how actively they've been speaking.

**POV switching** — the switcher evaluates scores periodically and selects the participant who should be the active camera. The decision logic can be extended but defaults to most-recently-active speaker.

**Overlay relay** — when the active participant changes, the server does a `replaceTrack()` on the overlay's WebRTC sender. The overlay's video element continues playing without interruption — it doesn't know a track swap happened.

## Overlay relay detail

The overlay subscribes to the hub by emitting a subscribe signal over its Socket.IO connection. The server then creates a dedicated send-only WebRTC peer connection for the overlay and begins relaying the active participant's tracks.

The overlay builds its `MediaStream` manually from the incoming track event rather than relying on the stream provided by the WebRTC API. This is a werift-specific requirement — werift does not implement the `msid` attribute in its SDP, so the browser-standard stream attachment doesn't work.

## ICE candidate ordering constraint

When the hub generates ICE candidates during offer handling, those candidates must not be sent to the remote peer until after the answer SDP has been sent. If candidates arrive at a peer that hasn't set the remote description yet, they are silently rejected and the connection either fails or degrades.

The fix: buffer all hub-generated ICE candidates during offer processing, send the answer first, then flush the buffer. This ordering must be preserved in any signaling path — both the cloud relay path and the LAN direct path.

## Re-offer handling

If a participant's browser reconnects and sends a new offer (e.g. after a camera switch), the hub silently closes the previous peer connection and accepts the new one. The new tracks automatically trigger a relay update on the overlay connection. No special handling is needed on the overlay side.

## werift-specific gotchas

- `addTrack()` with a received track works by forwarding RTP packets through the sender. The track must come from a live peer connection — you cannot construct a synthetic track and add it.
- The `MediaStream` parameter in `addTrack(track, stream?)` is not implemented. Always build `MediaStream` manually from the track event.
- werift does not emit `a=msid` in its SDP. Do not rely on `event.streams` in `ontrack` — use `event.track` directly.
