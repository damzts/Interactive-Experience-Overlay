> **AI Agent Notes**
> This is an operator/user guide, not an architecture doc — see `webrtc-online-rooms.md` for the conceptual model and constraints. Keep tuning numbers in sync with `RoomConfig` defaults in code.

---

# Online Rooms Admin Guide

## Overview

The **Online Rooms** admin panel provides centralized control over WebRTC-based multi-participant streaming. The system can operate in two modes:

- **Automatic Mode** — System automatically switches cameras based on audio activity and motion detection
- **Manual Mode** — Host manually selects which participant's camera is displayed

## Quick Start

1. Navigate to **Settings → Online Rooms** in the admin panel
2. Create or manage active rooms
3. For each room, configure:
   - **Auto Mode settings** (activity detection, thresholds)
   - **Transitions** (cut vs fade, duration)
   - **Participant effects** (select transition for each participant)
4. LAN Room has the same config sections (used as defaults for new cloud rooms)
5. Changes apply immediately to each room

---

## Per-Room Configuration

Each room has independent configuration for auto-mode behavior and transitions. Configuration is scoped to that room and doesn't affect other rooms.

### Mode Switching

Each room card shows a **mode toggle button**:
- **⚡ Auto** — Activity-driven camera switching (glows blue when active)
- **✋ Manual** — Host-controlled camera selection (glows blue when active)

Toggle to switch that specific room's mode immediately.

---

## Auto Mode Configuration

**Per-Room Setting:** Each room has its own auto-mode configuration section.

When a room becomes the active POV source, its auto-mode settings are applied to the POV orchestrator. When switching to a different room, that room's settings take over.

**Activity Threshold** (0.01-1.0, default 0.15)
- Score difference required to trigger an automatic switch
- **Higher (0.20+)** = more stable, less flickering
- **Lower (0.10-)** = quicker to switch, more responsive
- Recommended: 0.15 for balanced, 0.10 for high-energy, 0.20 for very stable

**Silence Threshold** (0.0-1.0, default 0.05)
- Activity score below which a participant is considered "silent"
- Participants below this threshold won't trigger a switch
- Filters out background noise and hesitation pauses

**Motion Weight** (0.0-1.0, default 0.3)
- Blends audio (speaking) with video motion (gestures)
- **0.0** = Audio-only (pure speaker detection)
- **0.3** = Balanced (default, reacts to speech + movement)
- **0.5+** = Motion-dominant (gesture-driven switching)
- Recommended: 0.3 for balanced, 0.1 for talk shows, 0.5 for dynamic performances

**Response Window** (500-10000ms, default 2000ms)
- Time period over which activity scores are calculated
- **Longer** = smoother, more stable (reacts slower)
- **Shorter** = more responsive, more reactive
- Recommended: 2000ms for typical use, 1000ms for fast-paced, 3000ms for very stable

**Switch Cooldown** (1-30 seconds, default 3s)
- Minimum time between automatic switches to prevent flickering
- **Short (1-2s):** Good for fast-paced discussions
- **Long (5-10s):** Stability for slower-paced content
- Recommended: 3s as baseline, adjust based on your content

### Tuning Guide

| Use Case | Activity Threshold | Silence Threshold | Motion Weight | Cooldown |
|----------|-------------------|------------------|---------------|----------|
| Talk Show | 0.15 | 0.05 | 0.1 | 3-5s |
| Panel Discussion | 0.10 | 0.03 | 0.2 | 2-3s |
| Performant/Musical | 0.12 | 0.08 | 0.5 | 1.5-2s |
| Interview | 0.20 | 0.05 | 0.05 | 5-10s |
| Very Stable (Text Focus) | 0.25 | 0.02 | 0.0 | 10s |

---

## Transitions Configuration

**Per-Room Setting:** Each room has its own transitions configuration section.

**Default Camera**
- **Auto-select First** — Display the first participant who joins (good for immediate streaming)
- **Start Blank** — Begin with blank screen; host selects first camera

**Transition Type**
- **Cut (instant)** — Switch immediately, no animation (best for breaking news, urgent content)
- **Fade** — Smooth fade animation between cameras (best for polished, professional streaming)
  - Duration: 100-5000ms (default 500ms)
  - Adjust to match your branding and content pacing

### Per-Participant Transition Effects

Each participant in a room can have a custom transition effect. When you expand a room to view participants:

- **⚡ Transition Selector Button** — Click the lightning bolt icon next to each participant
- **Choose Effect** — Select "Cut" or "Fade" for that participant
- **Apply Immediately** — Effect is saved and used when that participant is selected

When a participant is selected (manually or automatically by auto-mode):
1. The system emits the participant's name (useful for text overlay)
2. The system applies that participant's chosen transition effect
3. Camera switches with the selected transition

This allows creating custom switching experiences: e.g., "smooth fade for speakers, sharp cuts for reactions."

---

## Room Management

### Hub Connection & Online Participants

**If hub is disconnected from cloud:**
- ❌ Online (cloud) participants **cannot join** — the cloud service cannot relay their WebRTC handshake to the hub
- ❌ The POV stream **cannot relay** to the overlay
- ✅ LAN participants **can still join** — they connect directly to local server, no cloud relay needed

Think of it this way: The cloud service is a **signaling relay**. Without the hub connected to it, there's no path to complete the WebRTC handshake with online participants.

**Automatic Reconnect** (background)
- Activates immediately when hub loses cloud connection
- Uses exponential backoff: 1s → 2s → 4s → 8s → 30s (max)
- Runs silently in the background
- Keeps trying until reconnected

**Rejoin Button** (manual override)
- Appears when **Hub is disconnected** (red dot in room card)
- Forces an **immediate** reconnection attempt
- Bypasses the exponential backoff wait
- Click this when you know the cloud service is back online, to reconnect faster than auto-reconnect would

**Summary:**
| Scenario | Cloud Participants | LAN Participants | POV Relay |
|----------|-------------------|------------------|-----------|
| **Hub connected** | ✅ Join | ✅ Join | ✅ Active |
| **Hub disconnected** | ❌ Cannot handshake | ✅ Join | ❌ Disabled |
| **No cloud account** | N/A | ✅ Join | ✅ Active (local only) |

### Active Rooms Panel

Shows all currently active rooms with:

- **Room Code** — 6-character code for participants to join
- **Status** — Active or Idle
- **Hub Status** — Connected or disconnected from cloud
- **Participant Count** — Current/max participants
- **Mode Toggle** — Switch individual room between Auto/Manual

### Participant Controls

For each room, you can:

- **Expand room** — View all connected participants
- **View Activity Scores** — Real-time score bars for each participant
- **Select Participant** — In manual mode, click "Select" to make them the active camera
- **Kick Participant** — Remove a participant from the room
- **Close Room** — End the room session

### Activity Scores

Each participant shows:
- **Real-time bar graph** showing current activity score (0-100%)
- **Color-coded bars:**
  - **Blue/Primary** — Currently active camera
  - **Green** — High activity (>60%)
  - **Amber** — Moderate activity (30-60%)
  - **Gray** — Low/silent activity (<5%)

---

## Room Limits

**Max Players Per Room** (2-20, default 10)
- Maximum participants allowed in a single room
- Cloud API limits are lower; check your plan

**Max Simultaneous Rooms** (1-10, default 5)
- Maximum rooms active at the same time
- Set lower to conserve server resources
- Rooms persist indefinitely; close them manually when done

---

## LAN vs. Cloud Rooms

### LAN Room (Local)
- Join URL: `https://{host-ip}:3000/studio`
- Room code: 6-character code (CURRENT_ROOM_CODE), shown in admin panel
- No cloud account required, fully local network
- Visible in "LAN Participants" section of admin panel

### Cloud Rooms (Online)
- Join URL: Cloud-hosted page (e.g., https://ieom.danhub.dev/room/{code})
- Room codes: Issued by cloud service when room created
- Requires paid cloud account
- Visible in "Active Rooms" section (requires feature flag)
- Participants can be remote

### How They're Connected

**Important architectural detail:**
- LAN participants are **automatically added to the first active cloud room**
- If a cloud room is active, LAN and cloud participants stream to the same POV pipeline
- If no cloud room exists, LAN participants stream only locally
- All participants (LAN + cloud) use the same RoomHub and activity scoring

This means:
- LAN participant → Cloud Room 1 (if exists) → Admin can see them in cloud room
- They contribute to the same activity scores
- POV switching affects both LAN and cloud streams

**Note:** This design causes LAN and cloud participants to mix in the same room. Consider creating isolated LAN-only rooms if you need separate audiences.

---

## Monitoring & Debugging

### Activity Log

The panel shows a real-time log of:
- Room creations and closures
- Participant joins and disconnects
- POV switches (with reason: automatic, manual, or fallback)
- Hub connection status
- Network issues

Use this to:
- Verify your audio sensitivity settings are working
- Identify connection instability
- Diagnose why switches aren't happening

### Admin Stream Preview

Enable **Admin preview** (checkbox) to see the actual WebRTC stream being broadcast:
- Shows all connected participants in a grid
- Displays ICE connection state for each stream
- Useful for verifying video/audio quality

⚠️ **Note:** Preview disables the overlay widget stream relay. Turn off before going live.

---

## Best Practices

1. **Test before going live**
   - Create a test room with 2-3 people
   - Tune activity thresholds with your content type
   - Watch the activity scores in real-time
   - Adjust cooldown and sensitivity based on behavior

2. **Auto mode tuning**
   - Start with defaults (0.15 activity, 3s cooldown)
   - If camera flickers too much: increase cooldown or threshold
   - If camera doesn't switch to new speakers: decrease threshold
   - If motion affects switches too much: lower motion weight

3. **Manual mode setup**
   - Assign a dedicated host/producer to manage camera selection
   - Use fade transitions for professional appearance
   - Monitor activity scores to assist switching decisions

4. **Monitoring**
   - Keep Activity Log visible during streams to spot issues
   - Watch for repeated connection drops in Log
   - If Hub disconnects, participants can't join

5. **Performance**
   - Max 5 simultaneous rooms and 10 players per room are conservative defaults
   - Adjust upward if your server has capacity, downward if CPU/memory spikes
   - One room with 10 participants = ~10 WebRTC connections on the hub

---

## Troubleshooting

### Switching not happening in Auto mode

**Problem:** Camera stays on one participant even when others speak.

**Solutions:**
1. Lower **Activity Threshold** (try 0.10 instead of 0.15)
2. Lower **Silence Threshold** (reduce background noise cutoff)
3. Check **Activity Scores** — are other speakers' scores rising?
4. If scores aren't rising, audio quality/volume is the issue (not config)

### Flickering between cameras

**Problem:** Camera keeps switching rapidly between participants.

**Solutions:**
1. Increase **Switch Cooldown** (try 5-10s)
2. Increase **Activity Threshold** (try 0.20-0.25)
3. Check **Rolling Window** — try increasing to 3000ms
4. Lower **Motion Weight** to reduce gesture-triggered switches

### No one can join rooms

**Problem:** Participants get "room not found" or can't enter.

**Solutions:**
1. Check **Hub status** in the Active Rooms card
   - If disconnected, cloud service may be down
   - Restart server: `npm run dev`
2. If cloud room, verify room code is correct
3. If LAN room, verify participants are on same network
4. Check **Activity Log** for connection errors

### Audio quality issues

**Problem:** Audio is cutting out or seems delayed.

**Solutions:**
1. Lower **Report Interval** to get more frequent updates (try 50ms)
2. Check network latency between hub and participants
3. Reduce **Rolling Window** for faster response to speech changes
4. Enable Admin preview to verify video/audio are flowing to server

### Connection drops frequently

**Problem:** Participants disconnect and reconnect often.

**Solutions:**
1. Check server logs: `tail -f logs/server.log`
2. Verify network stability (check for packet loss)
3. For cloud rooms, verify cloud service is responding
4. Try LAN-only mode to eliminate cloud relay as variable

---

## Configuration Presets

### Quick Start: Stable Talk Show
```
Activity Threshold: 0.15
Silence Threshold: 0.05
Motion Weight: 0.1
Switch Cooldown: 5s
Rolling Window: 2000ms
```

### Quick Start: Dynamic Panel
```
Activity Threshold: 0.10
Silence Threshold: 0.03
Motion Weight: 0.25
Switch Cooldown: 2s
Rolling Window: 1500ms
```

### Quick Start: Gesture-Driven (Performance)
```
Activity Threshold: 0.12
Silence Threshold: 0.08
Motion Weight: 0.6
Switch Cooldown: 1.5s
Rolling Window: 1000ms
```

---

## Socket Events (Advanced)

The room management system uses these Socket.IO events:

**Admin → Server:**
- `pov-online:room:create` — Create new room
- `pov-online:room:close` — Close room
- `pov-online:select` — Manual camera select
- `pov-online:kick` — Remove participant
- `pov-online:mode:set` — Switch room mode (auto/manual)

**Server → Admin:**
- `pov-online:room:created` — Room created
- `pov-online:participant:joined` — User joined
- `pov-online:participant:left` — User left
- `pov-online:participant:selected` — **NEW** Participant selected (manual or automatic)
  - Payload: `{ roomCode, participantId, displayName, transition, timestamp }`
  - Fired before `pov-online:switch` event
  - Useful for rendering participant name on overlay
- `pov-online:scores` — Activity score update
- `pov-online:switch` — Camera switched
- `pov-online:status` — Room status update

### Participant Selection Signal

When a participant is selected (either manually via admin or automatically via auto-mode):

1. **`pov-online:participant:selected`** event is emitted first with:
   - Participant's display name (for text overlays)
   - Their configured transition effect
   - Room code and timestamp

2. **`pov-online:switch`** event follows with camera switch details

This dual-event pattern allows overlays to:
- Show "Now talking: John Smith" while the transition plays
- Apply custom transition effects per participant
- Render smooth participant name animations in sync with camera switches

See `packages/shared/src/contracts/online-socket.ts` for full type definitions.
