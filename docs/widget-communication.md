# Widget-to-Widget Communication

## Naming note

`widget:simulate:intent` / `WidgetSimulationIntentPayload` / `dispatchWidgetSimulationIntent`
are historical names from when this channel was only used by the ambiance engine
to "simulate a human interacting with a widget." The name implies theatrical
fakery, but the widget state change is real — only the cursor animation is fake.

Read these names as: **widget action signal**. A named, typed command directed
at a widget. The cursor simulation is an optional side effect layered on top.

---

Widgets don't talk to each other directly. There is no widget bus, no
shared widget state, no cross-widget imports. Communication always routes
through one of three channels:

1. **The DOM intent bus** — in-process, ephemeral, developer-configured
2. **Reactive chains** — in-process, persistent, operator-configured (no kernel round-trip for custom actions)
3. **The server → overlay signal path** — for authoritative state changes (open/close/toggle)

---

## Channel 1: DOM intent bus (in-process)

The intent bus is a `window` CustomEvent. Any code in the overlay can fire
an intent and any widget can listen to it. No imports between widgets needed.

```
dispatchWidgetSimulationIntent(payload)
         ↓
window.dispatchEvent('ieom:widget-simulation-intent')
         ↓
addWidgetSimulationIntentListener callback in every open widget
         ↓
each widget checks widgetId and handles its own kinds
```

**Who can dispatch:**

- The ambiance simulation leader (Desktop.tsx, during `ambiance:simulate` handling)
- Any widget that wants to trigger a side effect in another widget

**Widget dispatching to another widget directly:**

```tsx
import { dispatchWidgetSimulationIntent } from './widgetSimulationEvents'

// Inside ScoreboardWidget, a "reset all" button that also clears the chat:
<button onClick={() => {
  dispatchWidgetSimulationIntent({
    actionId: `local-${Date.now()}`,
    widgetId: 'chat',
    kind: 'chat:add-message',
    message: { user: 'system', text: 'scores reset', color: '#aaa' },
  })
}}>
  Reset
</button>
```

This fires synchronously in the same render cycle. The chat widget's listener
runs before the next paint. The server never sees it — it's overlay-local.

**When to use this channel:**
- Cosmetic reactions between widgets (chat message on score event)
- State that is intentionally ephemeral and local to the overlay session
- Anything that would be absurd to round-trip through the server

---

## Channel 2: Server-mediated intent (authoritative)

When the server wants to trigger widget behavior — via ambiance, a scheduled
event, or the admin panel — it emits `widget:simulate:intent` on the Socket.IO
overlay namespace. The overlay receives it in `useDesktopEvents.ts` and
immediately calls `dispatchWidgetSimulationIntent`, joining the same DOM bus.

```
AmbianceManager (server)
  └─ io.to(leaderSocketId).emit('ambiance:simulate', payload)
       └─ Desktop.tsx: runs cursor simulation, then:
            └─ socket.emit('widget:simulate:intent', payload.sharedIntent)
                 └─ server: widget.ts handler
                      └─ io.emit('widget:simulate:intent', ...)    ← broadcast to all overlay clients
                           └─ useDesktopEvents.ts: onWidgetSimulationIntent
                                └─ dispatchWidgetSimulationIntent(payload)
                                     └─ widget listener fires
```

The extra round-trip through the server exists because the cursor simulation
leader (the single overlay) performs the animation first, then tells the server
what intent was executed, and the server re-broadcasts it — which is what
actually triggers the widget's state change. This ensures that if multiple
clients were watching, they'd all see the same result.

**`mirrorPolicy` on `AmbianceSimulationPayload`** controls which path is taken:

| Policy | Meaning |
|---|---|
| `'shared-safe'` | The interaction has a deterministic, side-effect-free intent. Server gets `widget:simulate:intent` and re-broadcasts. All watchers see it. |
| `'leader-only'` | Effect only makes sense on the leader (e.g. ArchiveWidget scroll). No intent emitted. |
| `'unsafe-requires-runtime-event'` | Widget doesn't have a simulation recipe. No intent emitted, no cursor interaction attempt. |

---

## The ambiance loop (reactive overlay interactions)

This is the full reactive cycle that makes the desktop "feel alive":

```
1. AmbianceManager (server) decides it's time to simulate activity
   - picks a widget by cooldown + recency scoring
   - picks an action: 'open', 'close', or 'interact'
   - for 'interact': picks an intent from pickAmbianceInteractionIntent()
   - builds AmbianceSimulationPayload { widgetId, action, sharedIntent, mirrorPolicy }
   - emits ambiance:simulate to the leader socket only

2. Desktop.tsx (overlay leader) receives ambiance:simulate
   - drives the cursor visually to the widget using cursorSimUtils
   - if action is 'interact' and mirrorPolicy is 'shared-safe':
       a. moves cursor to the button DOM element (visual only, no native click)
       b. socket.emit('widget:simulate:intent', payload.sharedIntent)
   - emits ambiance:simulate:started, then ambiance:simulate:done back to server

3. Server receives widget:simulate:intent from leader
   - widget.ts handler: io.emit('widget:simulate:intent', ...)  ← broadcast
   
4. useDesktopEvents.ts receives widget:simulate:intent
   - calls dispatchWidgetSimulationIntent(payload)
   
5. Widget's addWidgetSimulationIntentListener fires
   - updates local state (next track, new chat message, color change)
```

The cursor animation (step 2) and the state update (step 5) are decoupled.
The cursor is pure theatre — it moves to where a human would click, but it
never triggers the DOM click event. The widget state changes because of the
intent, not the cursor.

---

## Adding a new reactive interaction

**1. Add the intent kind to `socket.ts`** (both Seed and Payload unions):

```ts
| (WidgetSimulationIntentSeedBase & { kind: 'scoreboard:add-point'; player: string })
```

**2. Register the widget in `ambianceSimulation.ts`** — two functions:

```ts
// getAmbianceInteractMirrorPolicy: is this safe to broadcast?
if (widgetId === 'scoreboard') return 'shared-safe'

// pickAmbianceInteractionIntent: what intent to fire during ambiance?
if (widgetId === 'scoreboard') {
  const player = Math.random() < 0.5 ? 'Player 1' : 'Player 2'
  return { widgetId, kind: 'scoreboard:add-point', player }
}
```

**3. Register a cursor recipe in `widgetSimulationRegistry.ts`** — tells the
cursor where to move during ambiance simulation:

```ts
scoreboard: {
  menuPath: (app) => ['Programs', app.label],
  interactionPlan: [
    { selectors: ['[data-sim-action="score-p1"]'], intentKind: 'scoreboard:add-point', weight: 0.5 },
    { selectors: ['[data-sim-action="score-p2"]'], intentKind: 'scoreboard:add-point', weight: 0.5 },
  ],
  interactionChance: 0.7,
},
```

**4. Add `data-sim-action` to the widget's DOM elements** so the cursor has a
target to move toward:

```tsx
<button data-sim-action="score-p1" onClick={...}>+1 P1</button>
<button data-sim-action="score-p2" onClick={...}>+1 P2</button>
```

**5. Handle the intent in the widget:**

```tsx
useEffect(() => {
  return addWidgetSimulationIntentListener((payload) => {
    if (payload.widgetId !== appId) return
    if (payload.kind === 'scoreboard:add-point') {
      setScores((prev) => prev.map((s) =>
        s.player === payload.player ? { ...s, points: s.points + 1 } : s
      ))
    }
  })
}, [appId])
```

---

## What widget-to-widget communication cannot do

- **Persist across sessions.** Intent bus is in-memory. A widget that receives
  a `chat:add-message` via ambiance will lose those messages on reload. If
  messages need to survive, they must be in server config or a real backend.

- **Guarantee ordering with async operations.** Intents fire synchronously on
  the DOM event bus, but if a widget does async work (fetch, camera restart)
  inside its listener, other intents may arrive in between.

- **Reach a widget that isn't open.** Intents dispatch to all current listeners.
  If the target widget is closed, there's no listener and the intent is silently
  dropped — which is intentional. The ambiance engine already guards against
  simulating closed widgets.
