# Admin — Engine Configuration Pages

Each server subsystem has a dedicated configuration page in the admin sidebar. The goal is one page per engine concern: configuration and live diagnostics in the same place, clearly separated from scene/widget editing.

---

## Pages

| Sidebar label | `SelectedItem.kind` | Panel component | Server subsystem | Config section |
|---|---|---|---|---|
| Ambiance | `ambiance` | `AmbiancePanel` | `AmbianceManager` | `desktopAmbiance.widgetSimulation` |
| Scheduler | `scheduler` | `SchedulerPanel` | `EventScheduler` | `events[].auto` |
| Scene Machine | `scene-machine` | `SceneMachinePanel` | `SceneMachine` | — (read-only diagnostics + control) |
| OBS | `obs` | `ObsPanel` | `ObsBridge` | `obs.url`, `obs.password` |
| Online / POV | `pov-online` | `OnlineRoomsPanel` | `POVOrchestrator`, `HubConnection`, `OnlineRoomManager` | cloud rooms + WebRTC |

All five live in the **Utilities** section of the left sidebar.

---

## Data flow

All panels are purely client-side React. No new server code was added for this feature.

**Live state** arrives via existing socket events that `useSocketEvents` already subscribes to:

| Socket event | Store field | Used by |
|---|---|---|
| `runtime:diagnostics` | `runtimeDiagnostics.scheduler` | `SchedulerPanel` |
| `runtime:diagnostics` | `runtimeDiagnostics.ambiance` | `AmbiancePanel` |
| `obs:status` | `obsStatus` | `ObsPanel` |
| `state:update` | `currentState` | `SceneMachinePanel` |

**Config edits** go through `saveConfig(updates)` → `PATCH /api/config` → server applies → `config:update` broadcast → all clients update.

The `SchedulerPanel` and `ObsPanel` save into their respective config sections. Changes take effect on the server immediately via `configService.onConfigUpdate`.

---

## SchedulerPanel

Shows the `EventScheduler` engine state and lets the user edit the `auto` field of every event config.

**What it shows:**
- Tick rate, active event count, last evaluated timestamp, last triggered event
- Per-event row: mode (interval / idle), timing, chance, cooldown, allowed scenes, next-fire countdown

**Next-fire countdown** is computed client-side from `nextRunAt` in the scheduler diagnostic payload. The panel runs a 1-second local interval to refresh display — no extra server traffic.

**Editing:** clicking a row expands inline controls. Each change calls `saveConfig({ events: [...] })` with the full array. The server immediately re-reads config and the scheduler adjusts on the next tick.

**Empty state:** if no events are configured, the panel tells the user to create events in the Asset Library. The Scheduler panel only configures when and how often events fire — not what they do.

---

## SceneMachinePanel

Read-only diagnostics + imperative controls for `SceneMachine`.

**Current state** is read from `useAdminStore(s => s.currentState)` which is kept in sync by `state:update` socket events.

**Transition history** is built client-side: the panel subscribes to `state:update` in a `useEffect` and prepends entries to local state (capped at 10). History resets when the panel unmounts — it is not persisted anywhere.

**Controls:**
- Force transition to Lobby or Desktop: `socket.emit('scene:change', target)`
- Panic reset: `socket.emit('panic')` — calls `machine.forceState(STATE.DESKTOP)`, bypassing transition animations

There is no config to save here. The panel is pure diagnostics + emergency control.

---

## ObsPanel

Configuration for `ObsBridge` and live connection status.

**Status** arrives via `obs:status` socket event (emitted by `ObsBridge` on every state change). Fields used: `connected`, `reconnecting`, `reconnectAttempt`, `nextRetryAt`, `retryDelayMs`, `lastError`.

**Retry countdown** is computed client-side from `nextRetryAt` using a 1-second interval, same pattern as SchedulerPanel.

**Reconnect button:** saves the current values back via `saveConfig({ obs: { url, password } })`. This triggers `configService.onConfigUpdate` on the server → `obsBridge.updateConnection(url, password)`. The bridge resets its retry state and opens a new connection. There is intentionally no separate "reconnect" socket event — saving config is the trigger.

**Dirty state:** the form tracks dirty state locally. The save button only appears when URL or password has been changed. On save, dirty clears. If the server pushes a `config:update` with different values (e.g. another admin changed it), the local fields reset to match.

---

## Routing

All pages follow the same pattern as every other sidebar item:

1. `SelectedItem` union in `types.ts` — one new `kind` per page
2. `LeftSidebar.tsx` — one `<SidebarBtn>` per page under the Utilities section label
3. `RightPane.tsx`:
   - `RightPaneContent` — one `if (selected.kind === '...')` returning the panel component
   - Header block — one `else if` setting `headerIcon`, `headerLabel`, `headerMeta = 'Engine'`

Adding a new engine page in the future follows the same four-point checklist.
