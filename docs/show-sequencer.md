> **AI Agent Notes**
> Document why this system exists and the key dispatch pattern. Don't repeat type signatures verbatim. If something here contradicts the code, the code wins — fix the doc.

---

# Show Sequencer

The Show Sequencer runs scripted multi-step show pipelines. It is the canonical way to automate a sequence of engine actions — scene transitions, OBS stream start, effect fire, widget open — on a single trigger.

---

## Concepts

**`ShowDefinition`** — a named list of steps. Stored in `AppConfig.shows[]` and persisted to the `shows` SQLite table.

**`ShowStep`** — one step: a `delayMs` offset from when the show started (not from the previous step), an optional `label`, and an `EventAction`. Because delays are absolute (not relative), steps fire predictably even if earlier steps are slow.

**`EventAction`** — the same union that the scheduler and automation already use: `scene-change`, `widget-toggle`, `overlay-trigger`, `ambiance-patch`, and the new `obs-stream` kind added alongside this feature.

---

## Dispatch path

The sequencer does **not** implement its own action executor. Instead it fires via the existing kernel dispatch path:

```
ShowSequencer.executeStep()
  ├── kind === 'obs-stream'  → obsBridge.startStreaming() / stopStreaming()   [direct]
  └── everything else        → bus.emit('scheduler:fired', { event: { ... } })
                               → SceneMachine registerMachineListeners
                               → executeConfiguredEvent()
```

This means any `EventAction` that works in an automation rule or scheduled event works identically in a show step.

---

## HTTP API

| Method | Path | Body | Description |
|--------|------|------|-------------|
| `GET` | `/api/shows` | — | List all shows from config |
| `GET` | `/api/shows/running` | — | IDs of currently running shows |
| `POST` | `/api/shows/:id/run` | — | Start a show by ID |
| `POST` | `/api/shows/:id/cancel` | — | Cancel a running show |

---

## Admin panel

**System → Show Sequencer** in the admin dashboard.

- The show list reads from `AppConfig.shows` (live via Socket.IO `config:update`).
- Each show row has a **Run** button (POST `/api/shows/:id/run`) and a **Cancel** button if the show is currently running. Running shows are polled every 3 seconds from `GET /api/shows/running` and highlighted with a cyan `RUNNING` badge.
- Clicking **Edit** opens the inline step editor. Each step has:
  - `delayMs` — time from show start (not relative to previous step)
  - Optional label
  - Action type selector: **OBS Stream** (start/stop), **Widget Command** (widget + open/close/toggle), **Widget Layout** (layout picker)
- **New Show** adds a blank show inline. Saving writes `AppConfig.shows` via the config API.

The admin panel covers the most common step kinds. For advanced action types (`overlay-trigger`, `ambiance-patch`, `desktop-config`) configure shows via the config API directly.

---

## Configuring a show

Shows live in `AppConfig.shows[]`. Edit via the admin panel (above) or the config API (`POST /api/config/section { section: 'shows', data: [...] }`).

```json
{
  "id": "go-live",
  "label": "Go Live",
  "steps": [
    { "delayMs": 0,     "label": "Lobby → Desktop",      "action": { "kind": "scene-change", "scene": "DESKTOP" } },
    { "delayMs": 3000,  "label": "Start OBS stream",      "action": { "kind": "obs-stream", "action": "start" } },
    { "delayMs": 5000,  "label": "Fire intro glitch",     "action": { "kind": "overlay-trigger", "effects": [{ "type": "glitch" }], "actions": [] } },
    { "delayMs": 8000,  "label": "Open chat widget",      "action": { "kind": "widget-toggle", "widgetId": "chat" } }
  ]
}
```

---

## `obs-stream` action

The `obs-stream` kind is exclusive to shows (and automation rules). It calls into `ObsBridge` directly:

```ts
{ kind: 'obs-stream', action: 'start', rtmpUrl?: string, streamKey?: string }
{ kind: 'obs-stream', action: 'stop' }
```

`rtmpUrl` / `streamKey` override OBS's currently configured stream settings. Omit them to use whatever OBS already has configured.

---

## Bus events

As each step fires, the sequencer emits `show:step` on the KernelBus (declared in the shared `KernelSignalMap`, so it's forwarded to overlay automatically via the generic `kernel:signal` bridge — see `docs/signal-catalog.md`):

```ts
{ event: 'show:step', payload: { showId: string, stepIndex: number, label: string } }
```

Useful for debugging in the overlay console or triggering side-effects in automation rules.

---

## Key files

| File | Role |
|------|------|
| `packages/server/src/kernel/managers/showSequencer.ts` | Manager implementation |
| `packages/server/src/kernel/managers/showSequencer.signals.ts` | `show:step` KernelEvents augmentation |
| `packages/server/src/transport/http/shows.ts` | HTTP routes |
| `packages/shared/src/domain/config.ts` | `ShowDefinition`, `ShowStep` types |
| `packages/shared/src/domain/event.ts` | `EventObsStreamAction`, `EventAction` union |
| `packages/admin/src/features/shows/ShowsPanel.tsx` | Admin panel (System → Show Sequencer) |
| `packages/admin/src/api/showsApi.ts` | Admin API client for shows endpoints |
