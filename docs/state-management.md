> **AI Agent Notes**
> The server-side and client-side state splits mirror each other intentionally.
> The ownership rule below is the load-bearing constraint — violations cause stale reads on hot paths.
> If a new kind of state is added, the first question is always: does this survive a restart?

---

# State Management

## The two state systems (server)

There are exactly two places server-side state lives, and they must never be conflated.

**Config persistence** is everything that should survive a server restart — scenes, applications (including widget geometry), source events, source media, source presets, source transitions, widget layouts, desktop theme, keybinds, ambiance schedules. It lives in SQLite, managed by a dedicated service. Each table has a single owning admin panel. Reads and writes happen on the admin save path. The real-time rendering path never touches it.

**Runtime state** is live session data that has no meaning across restarts — the current scene, which widgets are open, whether the overlay is connected, who the active ambiance leader is. It lives in memory, reconstructed from socket events on reconnect. It is never written to disk.

## The ownership rule

> If state survives a server restart, it belongs in the database.
> If it's live-session state, it belongs in the in-memory store.

Any code that needs "which widgets are open right now" reads from the in-memory store. Reading the database for this would add unnecessary latency and give you the wrong answer — the database holds what was configured, not what is currently open.

## Why this split exists

Before this separation, runtime queries were either reading stale database values or reconstructing session state from scattered variables across the socket handler. The split gives each kind of state exactly one authoritative home, with a clear rule for which home to use.

## The client-side mirror

The overlay maintains the same split in its Zustand store, organized as four slices with distinct ownership:

**Config slice** — holds the server-pushed config and any runtime overrides. This is a mirror of server state, not locally owned. When the server pushes a config change, this slice updates. The overlay never mutates config directly.

**Desktop slice** — holds open/closed/minimizing widget state, desktop notifications, and recycle bin status. This is live session state owned by the overlay. Lost on reload, reconstructed from the server's runtime state snapshot on reconnect.

**Scene slice** — holds the current visual state and any pending transition. Updated by socket events from the server's state machine. Never mutated locally except during transition animations.

**Connection slice** — holds OBS connected status, camera permission state, overlay owner socket ID, and last socket activity timestamp. Purely observational — reflects what the server has told the overlay about connection state.

## The reconnect recovery pattern

On overlay reconnect, the server sends a full runtime state snapshot before any incremental events arrive. The desktop slice hydrates from this snapshot. This means the overlay is never in a partially-initialized state after a reconnect — it either has full state or it has nothing.

This is why widget close timers and animation state (things that are mid-flight when a disconnect happens) are intentionally not recovered. Recovering mid-animation state would require serializing frame-level UI state, which is not worth it. The overlay simply resets to the last clean server snapshot.
