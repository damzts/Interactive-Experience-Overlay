# Reactive Chains

Reactive chains let you wire a **signal** from one widget to an **action** on another widget — persistently, without writing code. When Widget A does something, Widget B automatically reacts.

Examples of what you can configure:
- Weather detects a storm → open the particles widget
- Music track changes → sticky note updates its color
- Clock hits midnight → gallery advances to the next slide
- Chat receives a message → open the broadcast scheduler

---

## Concepts

**Signal** — something a widget emits when its internal state changes. Declared statically in the widget's `WidgetIntentManifest`. Examples: `music:track-changed`, `weather:storm`, `clock:hour`.

**Action** — something a widget can receive and act on. Also declared in its manifest. Examples: `gallery:next`, `sticky:set-color`, `music:play-pause`. The built-in actions `open`, `close`, and `toggle` are available on every widget without being declared in the manifest.

**Reactive chain** — a persisted row in the `reactive_chains` SQLite table connecting one signal to one action. Evaluated by the kernel every time a matching signal arrives.

**Wire** — the admin panel name for a reactive chain. Same thing.

---

## How it works

```
1. Widget emits a DOM signal:
   dispatchWidgetSignal({ source: 'weather-console', event: 'weather:storm' })

2. useSocket forwards it to the kernel:
   socket.emit('widget:signal', { source, event, payload })

3. Kernel looks up matching chains:
   SELECT * FROM reactive_chains
   WHERE trigger_widget_id = 'weather-console'
     AND trigger_event     = 'weather:storm'
     AND enabled           = 1

4. For each match:
   - If targetAction is 'open', 'close', or 'toggle':
       kernel changes widget open state directly and emits widget:toggle
   - If targetAction is a custom action (e.g. 'gallery:next'):
       kernel emits widget:chain:action to the overlay

5. Overlay receives widget:chain:action:
   dispatchWidgetSimulationIntent({ widgetId: targetWidgetId, kind: targetAction, ... })

6. Target widget's listener fires and handles the action.
```

The entire path — DOM signal → kernel DB lookup → action back to overlay — takes one socket round-trip. The DOM-only leg (steps 1–2) is synchronous and fires immediately even without a chain configured.

---

## Setting up a wire

Open the admin panel → **System → Wires**.

1. Click a source widget in the left column — its available signals appear below it (green).
2. Click a target widget in the right column — its available actions appear below it (purple).
3. Click **Add Wire**.

The wire activates immediately. No restart needed.

Wires persist in SQLite and survive server restarts. You can enable/disable individual wires without deleting them, using the toggle next to each wire in the list.

---

## Declaring signals and actions in a widget

Every widget type declares its pub/sub vocabulary as a `WidgetIntentManifest`. This is static — it describes what the widget *can* do, not what wires exist. Manifests live in `packages/overlay/src/desktop/widgetIntentManifests.ts`.

```ts
registerWidgetIntentManifest({
  componentType: 'weather-console',
  emits: [
    { event: 'weather:storm',  label: 'Storm detected' },
    { event: 'weather:clear',  label: 'Clear sky' },
    { event: 'weather:update', label: 'Weather updated' },
  ],
  accepts: [],
})
```

The admin Wires panel reads all registered manifests to populate the source and target pickers. If a widget has no manifest, it won't appear in the picker.

**To emit a signal from a widget**, call `dispatchWidgetSignal` at the moment the relevant state change happens:

```ts
import { dispatchWidgetSignal } from './widgetSimulationEvents'

// Inside your widget, at the state change site:
dispatchWidgetSignal({ source: appId, event: 'weather:storm' })
```

**To receive an action**, use the existing simulation intent listener (reactive chain actions arrive through the same bus):

```ts
import { addWidgetSimulationIntentListener } from './widgetSimulationEvents'

useEffect(() => {
  return addWidgetSimulationIntentListener((payload) => {
    if (payload.widgetId !== appId) return
    if (payload.kind === 'my-widget:do-thing') {
      // handle it
    }
  })
}, [appId])
```

---

## Who manages reactive chains

**`DesktopConfigService`** owns the `reactive_chains` table via `ReactiveChainRepository`. It is the wire router: every `widget:signal` socket event calls `routeWidgetSignal(source, event)`, which queries the DB and returns the matching target actions. The socket handler in `widget.ts` then executes them.

The REST API (`/api/wires`) is a thin CRUD layer over `ReactiveChainRepository`. No other manager is involved.

---

## Reactive chains vs the DOM intent bus

| | DOM intent bus | Reactive chain |
|---|---|---|
| Configured by | developer (code) | operator (admin Wires panel) |
| Persists across restarts | no | yes |
| Requires server round-trip | no | yes (one trip) |
| Works without kernel running | yes | no |
| Visible in admin | no | yes |
| Latency | synchronous | ~1 socket RTT |

Use the DOM bus when the connection is hardcoded and always makes sense (e.g. a "reset all" button in one widget that always clears another). Use reactive chains when the connection is configurable — something the operator decides, not the developer.

---

## Reactive chains vs ambiance

Ambiance is the kernel autonomously *choosing* which widget to open and interact with on a timer to make the desktop feel alive. It's scripted behavior.

Reactive chains are triggered by *real widget state changes* and execute *operator-configured* responses. The kernel doesn't decide anything — it only routes what the widget reported.

They use the same delivery path (both end up calling `dispatchWidgetSimulationIntent` on the overlay) but are conceptually and architecturally distinct.

---

## Adding a new signal to an existing widget

1. Add the event to the widget's `registerWidgetIntentManifest` entry in `widgetIntentManifests.ts`.
2. Call `dispatchWidgetSignal({ source: appId, event: 'your:event' })` at the right moment inside the widget.
3. That's it. The admin panel will immediately show the new signal in the source picker.

No schema changes, no server changes, no socket contract changes needed.
