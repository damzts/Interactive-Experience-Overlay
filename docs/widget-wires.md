# Widget Wires

Widget Wires let you connect a **signal** from one widget to an **action** on another widget — persistently, without writing code. When Widget A does something, Widget B automatically reacts.

Examples:
- Weather detects a storm → open the particles widget
- Music track changes → sticky note cycles to a new color
- Clock hits midnight → gallery advances to the next slide
- Gallery slide changes → music plays next track

---

## Concepts

**Signal** — something a widget emits when its internal state changes. Declared in the widget's `WidgetIntentManifest`. Examples: `music:track-changed`, `weather:storm`, `clock:hour`.

**Action** — something a widget can receive and act on. Also declared in its manifest. Examples: `gallery:next`, `sticky:set-color`, `music:play-pause`. The built-in actions `open`, `close`, and `toggle` work on every widget without being declared in the manifest.

**Widget Wire** — a persisted row in the `widget_wires` SQLite table connecting one signal to one action. Evaluated by the overlay every time a matching signal fires.

**Wire** — shorthand for Widget Wire. Same thing.

---

## How it works

Widget Wires are evaluated entirely **in the overlay process** — no kernel round-trip is needed for custom actions. The wires are delivered to the overlay as part of `AppConfig` and stay in memory.

```
1. Widget emits a DOM signal:
   dispatchWidgetSignal({ source: appId, event: 'weather:storm' })

2. useSocket's addWidgetSignalListener fires:
   - Looks up matching enabled wires from store.config.widgetWires
   - For each match:
       a. Custom action (e.g. 'gallery:next'):
            dispatchWidgetChainAction({ targetWidgetId, action })
            → target widget's addWidgetChainActionListener fires immediately
            → zero socket round-trip

       b. open / close / toggle:
            socket.emit('widget:signal', ...)
            → kernel mutates authoritative open state
            → kernel emits widget:toggle back to overlay
```

**Only `open`, `close`, and `toggle` involve the kernel** — because those change which widgets are actually open, which is authoritative server state. Everything else stays in the overlay.

When the operator adds, edits, or deletes a wire via the admin panel, the server emits `config:patch { reactiveChains: [...] }` and the overlay's store updates live — no restart needed.

---

## Setting up a wire

Open the admin panel → **System → Wires**.

1. Click a source widget (left column) — its signals appear below in green.
2. Click a target widget (right column) — its actions appear below in purple.
3. Optionally toggle **LOBBY** / **DESKTOP** chips to restrict the wire to specific scenes.
4. Click **Add Wire**.

Active immediately. Enable/disable individual wires with the toggle in the wire list. Wires survive server restarts. A scene condition badge (`[DESKTOP]`) is shown on the wire row when a condition is set.

---

## Scene conditions

A wire can be restricted to fire only in specific scenes by setting a `condition`:

```ts
// Only fires when the current scene is DESKTOP
wire.condition = { sceneIs: ['DESKTOP'] }
```

The condition is evaluated **client-side** in `useSocket.ts` — no server round-trip. If `condition.sceneIs` is set and the current `visualState` is not in the list, the wire is skipped silently.

The `condition` field is persisted in the `widget_wires` table as `condition_json` (JSON string, nullable). Pass it in `POST /api/wires` or `PATCH /api/wires/:id` bodies alongside the other wire fields.

```ts
// POST /api/wires
{
  "triggerWidgetId": "weather",
  "triggerEvent": "weather:storm",
  "targetWidgetId": "gallery",
  "targetAction": "gallery:next",
  "enabled": true,
  "condition": { "sceneIs": ["DESKTOP"] }
}
```

---

## Manifests — declaring signals and actions

Each built-in widget declares its manifest in its co-located definition file under
`packages/shared/src/widgets/{id}/definition.ts`. The `WIDGET_INTENT_MANIFESTS`
array is **derived** from these definitions automatically — you never edit
`widgetIntentManifests.ts` directly.

```ts
// packages/shared/src/widgets/weather/definition.ts
export const weatherDefinition: WidgetDefinition = {
  id: 'weather',
  componentType: 'weather-console',
  // ...
  emits: [
    { event: 'weather:storm',  label: 'Storm detected' },
    { event: 'weather:clear',  label: 'Clear sky' },
    { event: 'weather:update', label: 'Weather updated' },
  ],
  accepts: [],
}
```

`WIDGET_INTENT_MANIFESTS` in `widgetIntentManifests.ts` maps over `WIDGET_DEFINITIONS`:

```ts
export const WIDGET_INTENT_MANIFESTS = WIDGET_DEFINITIONS.map(d => ({
  componentType: d.componentType, emits: d.emits, accepts: d.accepts,
}))
```

The server serves these at `GET /api/wires/manifests`. The admin Wires panel fetches from there — it never needs the overlay to be running to populate the pickers.

The overlay imports the same array and registers each manifest via `registerWidgetIntentManifest` at startup (`widgetIntentManifests.ts`).

---

## Emitting a signal from a widget

```ts
import { dispatchWidgetSignal } from './widgetSimulationEvents'

// appId is required — always use the prop, never a hardcoded string
dispatchWidgetSignal({ source: appId, event: 'weather:storm' })
```

Call this at the exact moment the relevant state change happens. `appId` must be the prop passed from `WindowManager` — hardcoded fallbacks are wrong because a widget can have multiple instances with different IDs.

---

## Receiving an action in a widget

Chain-triggered actions arrive on `addWidgetChainActionListener` — a separate bus from the ambiance simulation intent bus:

```ts
import { addWidgetChainActionListener } from './widgetSimulationEvents'

useEffect(() => {
  return addWidgetChainActionListener(({ targetWidgetId, action }) => {
    if (targetWidgetId !== appId) return
    if (action === 'gallery:next') showNext()
  })
}, [appId, showNext])
```

Ambiance-triggered actions still arrive on `addWidgetSimulationIntentListener`. A widget that accepts actions should listen on both if it participates in both systems.

---

## Who manages widget wires

**`DesktopConfigService`** owns the `widget_wires` table via `WidgetWireRepository`. It loads wires into `AppConfig` on startup and on every wire mutation.

`GET/POST/PATCH/DELETE /api/wires` is a thin CRUD layer over `WidgetWireRepository`. After any mutation, the route calls `broadcastWires()` which emits `config:patch { widgetWires }` to all connected clients.

The overlay's `useSocket` evaluates chains. The kernel's `widget.ts` only handles the `open/close/toggle` subset.

---

## Comparison table

| | DOM intent bus | Widget Wire | Ambiance |
|---|---|---|---|
| Configured by | developer (code) | operator (Wires panel) | kernel (autonomous) |
| Persists | no | yes (SQLite) | no |
| Kernel involved | no | only for open/close/toggle | yes |
| Latency | synchronous | synchronous (in-process) | async (scheduled) |
| Visible in admin | no | yes | yes (diagnostics) |
| Triggered by | code | real widget state change | timer |

---

## Adding a new signal to a widget

1. Add the event to the widget's `emits` array in `packages/shared/src/widgets/{id}/definition.ts`.
2. Rebuild `@ieomlabs/shared` (`pnpm --filter @ieomlabs/shared build`) — `WIDGET_INTENT_MANIFESTS` re-derives automatically.
3. Call `dispatchWidgetSignal({ source: appId, event: 'your:event' })` inside the widget at the state change site.
4. Done — admin panel picks it up immediately on next manifest fetch.

No schema changes. No socket contract changes. No server restart.

## Adding a new action to a widget

1. Add the action to the widget's `accepts` array in its `definition.ts`.
2. Rebuild `@ieomlabs/shared`.
3. Add an `addWidgetChainActionListener` handler inside the widget.
4. Done.
