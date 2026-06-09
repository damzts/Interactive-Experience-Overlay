# Widget Authoring Guide

A widget is a React component rendered inside a `DesktopWindow`. It can own
local ephemeral state (timers, UI state, animation ticks) and respond to
server-issued signals (ambiance simulation intents). The two concerns are
independent — you use one, both, or neither.

---

## Anatomy of a widget

```
packages/overlay/src/desktop/YourWidget.tsx   ← your component
packages/shared/src/contracts/socket.ts        ← add intent kinds here (if signalable)
packages/overlay/src/desktop/widgetRegistry.ts ← register for lazy loading
packages/shared/src/domain/application.ts      ← add componentType value here
```

---

## Step 1 — Create the component

```tsx
// packages/overlay/src/desktop/ScoreboardWidget.tsx
import { useState, useEffect } from 'react'
import { useAppStore } from '../store/useAppStore'
import { DesktopWindow } from './DesktopWindow'
import { addWidgetSimulationIntentListener } from './widgetSimulationEvents'
import type { DesktopWidgetProps } from './widgetRegistry'

// ── Local state type ─────────────────────────────────────────────────────────

interface Score {
  player: string
  points: number
}

// ── Component ────────────────────────────────────────────────────────────────

export function ScoreboardWidget({
  appId,
  onClose,
  onMinimize,
  onFocus,
  windowState = 'open',
  zIndex,
}: DesktopWidgetProps) {
  // --- Local ephemeral state ---
  // Lives only in this component instance. Lost on widget close/reload.
  const [scores, setScores] = useState<Score[]>([
    { player: 'Player 1', points: 0 },
    { player: 'Player 2', points: 0 },
  ])

  // --- Server config state ---
  // Read from the Zustand store which is kept in sync with the server.
  // Use this for anything the admin panel can configure.
  const config = useAppStore((s) => s.config)
  const applications = config.applications
  const app = applications.find((a) => a.id === appId)
  const title = app?.label ?? 'Scoreboard.exe'

  // --- Server-signaled updates (simulation intents) ---
  // The server (or admin panel) can call widget:simulate:intent to push
  // a named action into this widget. The intent is broadcast via a DOM
  // CustomEvent so no prop drilling is needed.
  useEffect(() => {
    return addWidgetSimulationIntentListener((payload) => {
      // Guard: only handle intents for this widget instance
      if (payload.widgetId !== appId && payload.widgetId !== 'scoreboard') return

      if (payload.kind === 'scoreboard:add-point') {
        setScores((prev) =>
          prev.map((s) =>
            s.player === payload.player ? { ...s, points: s.points + 1 } : s,
          ),
        )
      }

      if (payload.kind === 'scoreboard:reset') {
        setScores((prev) => prev.map((s) => ({ ...s, points: 0 })))
      }
    })
    // addWidgetSimulationIntentListener returns an unsubscribe function —
    // returning it from useEffect cleans up the listener on unmount.
  }, [appId])

  return (
    <DesktopWindow
      id={appId ?? 'scoreboard'}
      title={`🏆 ${title}`}
      width={260}
      defaultPosition={{ x: 400, y: 200 }}
      zIndex={zIndex}
      state={windowState}
      onFocus={onFocus}
      onMinimize={onMinimize}
      onClose={onClose}
      bodyStyle={{ padding: '12px' }}
    >
      <div className="widget-stack">
        {scores.map((s) => (
          <div key={s.player} className="widget-panel">
            <span className="widget-label">{s.player}</span>
            <span className="widget-led-accent">{s.points}</span>
          </div>
        ))}
      </div>
    </DesktopWindow>
  )
}
```

**Props you always receive** (from `DesktopWidgetProps`):

| Prop | What it is |
|---|---|
| `appId` | The `Application.id` from config. Use it to look up config and to guard intent listeners. |
| `onClose` | Call when the widget's X button is clicked. Wired to `socket.emit('widget:toggle')`. |
| `onMinimize` | Call for the minimize button. Optional. |
| `onFocus` | Call on any mouse interaction that should bring the window to front. |
| `windowState` | `'open'` or `'closing'`. Drive exit animations off this. |
| `zIndex` | Managed by the desktop stack. Pass to `DesktopWindow`. |

---

## Step 2 — Register in the widget manifest

In `widgetRegistry.ts`, add one line to `widgetManifest`:

```ts
'scoreboard': () => import('./ScoreboardWidget').then((m) => m.ScoreboardWidget),
```

This is the only registration needed. The component loads lazily on first open
and caches for all subsequent opens.

---

## Step 3 — Add the componentType to shared

In `packages/shared/src/domain/application.ts`, add `'scoreboard'` to
`WidgetComponentType`. This is what links an `Application` config entry to your
component:

```ts
export type WidgetComponentType =
  | 'scoreboard'   // ← add here
  | 'music'
  | 'chat'
  // ...
```

The admin panel uses this type to let the user configure which component a
widget application uses.

---

## Step 4 — Add simulation intent kinds (if signalable)

If you want the server (via ambiance, events, or the admin panel) to signal your
widget, extend the two union types in `packages/shared/src/contracts/signals.ts`
(`WidgetSimulationIntentSeed`, `WidgetSimulationIntentPayload`) and `commands.ts`
(`ClientToServerEvents`):

```ts
export type WidgetSimulationIntentSeed =
  | (WidgetSimulationIntentSeedBase & { kind: 'scoreboard:add-point'; player: string })
  | (WidgetSimulationIntentSeedBase & { kind: 'scoreboard:reset' })
  // ... existing entries

export type WidgetSimulationIntentPayload =
  | (WidgetSimulationIntentBase & { kind: 'scoreboard:add-point'; player: string })
  | (WidgetSimulationIntentBase & { kind: 'scoreboard:reset' })
  // ... existing entries
```

`WidgetSimulationIntentSeed` is what the admin panel sends (no `actionId` yet).
`WidgetSimulationIntentPayload` is what reaches the widget (server adds `actionId`).
They must be kept in sync — same kinds, same extra fields.

The server handler in `packages/server/src/socket/handlers/widget.ts` picks up
the new kinds automatically. No server changes are required.

---

## How the signal flow works

```
Admin panel / ambiance engine
  └─ socket.emit('widget:simulate:intent', { widgetId, kind, ...extras })
       └─ server: widget.ts handler broadcasts to overlay namespace
            └─ overlay: useSceneEvents picks up 'widget:simulate:intent'
                 └─ dispatchWidgetSimulationIntent(payload)   ← DOM CustomEvent
                      └─ addWidgetSimulationIntentListener callback in your widget
```

The DOM CustomEvent bus (`widgetSimulationEvents.ts`) decouples the socket layer
from individual widget components. Widgets never import the socket directly.

---

## Patterns and rules

**Local state is fine.** If state is acceptable to lose on widget close (track
index, scroll position, form input), keep it in `useState`. Don't push it to
the server.

**Config state comes from the store.** Read `useAppStore((s) => s.config)` for
anything the admin panel should control: titles, colors, data sources, feature
flags. This automatically stays in sync with server saves.

**Guard your intent listener by `appId`.** If multiple instances of the same
widget type could be open, match on `payload.widgetId === appId`. If only one
instance is ever open, matching on the hardcoded component name (e.g.
`'scoreboard'`) is fine.

**Don't import `socket` directly.** Widgets receive server signals through the
intent bus. If you genuinely need a socket event that isn't a simulation intent,
add it to `useSceneEvents.ts` and propagate it through the store or a custom
DOM event — same pattern.

**Exit animation.** If you want a closing animation, watch `windowState`:

```tsx
const isClosing = windowState === 'closing'
// apply a CSS class or framer-motion exit when isClosing is true
// DesktopWindow handles the actual unmount timing via closingWidgets in the store
```
