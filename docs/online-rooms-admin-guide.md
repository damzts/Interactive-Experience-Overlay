# Online Rooms Admin Guide

## Overview

The **Online Rooms** admin panel provides centralized control over WebRTC-based multi-participant streaming. The system can operate in two modes:

- **Automatic Mode** — System automatically switches cameras based on audio activity and motion detection
- **Manual Mode** — Host manually selects which participant's camera is displayed

## Quick Start

1. Navigate to **Settings → Online Rooms** in the admin panel
2. Choose your switching mode (toggle button at the top)
3. Configure mode-specific settings
4. Create or manage active rooms
5. Click **Apply All Configuration** to save changes

---

## Switching Modes

### 🌐 Quick Toggle

At the top of the Online Rooms panel, prominently displayed buttons let you switch between:

- **⚡ Auto** — Activity-driven camera switching (glows blue when active)
- **✋ Manual** — Host-controlled camera selection (glows blue when active)

Buttons show clear visual feedback (highlight + shadow) when selected. When you toggle, all active rooms immediately switch to the new mode.

---

## Auto Mode Configuration

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

## Manual Mode Configuration

**Default Camera**
- **Auto-select First** — Display the first participant who joins (good for immediate streaming)
- **Start Blank** — Begin with blank screen; host selects first camera

**Transition Type**
- **Cut (instant)** — Switch immediately, no animation (best for breaking news, urgent content)
- **Fade** — Smooth fade animation between cameras (best for polished, professional streaming)
  - Duration: 100-5000ms (default 500ms)
  - Adjust to match your branding and content pacing

---

## Room Management

### Hub Connection & Rejoin

The hub manages cloud room connectivity. When the hub loses connection, it automatically tries to reconnect with exponential backoff.

**Automatic Reconnect** (background)
- Activates immediately on cloud disconnect
- Uses exponential backoff: 1s → 2s → 4s → 8s → 30s (max)
- Runs silently in the background
- Cloud participants cannot join while hub is disconnected, but LAN participants can still join

**Rejoin Button** (manual override)
- Appears only when **Hub is disconnected** (red dot in room card)
- Forces an **immediate** reconnection attempt
- Bypasses the auto-reconnect backoff timer
- Use this to recover quickly without waiting for exponential backoff
- Useful when you know the cloud service is back online

**Important:** LAN participants can join and stream directly without hub connection. The hub is only needed for cloud room participants and to relay the POV stream to the overlay.

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

### LAN Participants
- Connect via `/studio` page with 6-digit room code
- No cloud account required, fully local
- Visible in "LAN Participants" section

### Cloud Participants
- Connect via cloud-hosted join page with room code
- Requires paid cloud account
- Visible in "Active Rooms" section (requires feature flag)
- More latency than LAN but supports remote participants

Both LAN and cloud participants use the same POV pipeline and scoring system. They can coexist in the same room.

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
- `pov-online:scores` — Activity score update
- `pov-online:switch` — Camera switched
- `pov-online:status` — Room status update

See `packages/shared/src/contracts/online-socket.ts` for full type definitions.
