> **AI Agent Notes**
> This is a how-to guide, not a conceptual model doc — keep it in sync with the actual widget registration code, not the other way around.
> If a step here no longer matches `widgetRegistry.ts` or the widget definition shape, fix the doc.

---

# Widget Authoring Guide

A widget is a React component rendered inside a `DesktopWindow`. It can own
local ephemeral state (timers, UI state, animation ticks) and respond to
server-issued signals (ambiance simulation intents). The two concerns are
independent — you use one, both, or neither.

---

## Anatomy of a widget

```
packages/shared/src/widgets/scoreboard/definition.ts  ← declare metadata (Step 1)
packages/overlay/src/desktop/ScoreboardWidget.tsx      ← your component (Step 2)
packages/overlay/src/desktop/widgetRegistry.ts         ← register for lazy loading (Step 3)
packages/shared/src/contracts/signals.ts               ← add intent kinds here (if signalable)
```

The `definition.ts` file is the single source of truth for the widget's metadata:
its `id`, `componentType`, default size, z-index, and signal/action manifests. All
lookup tables in `defaults.ts` and `widgetIntentManifests.ts` derive from it
automatically — no other files need editing for a new system widget.

---

## Step 1 — Create the widget definition

```ts
// packages/shared/src/widgets/scoreboard/definition.ts
import type { WidgetDefinition } from '../../contracts/widget.js'

export const scoreboardDefinition: WidgetDefinition = {
  id: 'scoreboard',
  componentType: 'scoreboard',
  defaultSize: { width: 260, height: 200 },
  zIndex: 110,
  system: false,   // true only for widgets that ship with every install
  emits: [
    { event: 'scoreboard:score-changed', label: 'Score changed' },
  ],
  accepts: [
    { action: 'scoreboard:reset', label: 'Reset scores' },
  ],
}
```

Then re-export it from `packages/shared/src/widgets/index.ts`:

```ts
import { scoreboardDefinition } from './scoreboard/definition.js'
export const WIDGET_DEFINITIONS: WidgetDefinition[] = [
  // existing definitions...
  scoreboardDefinition,
]
```

Rebuild `@ieomlabs/shared` (`pnpm --filter @ieomlabs/shared build`) so the server
and overlay type-check against the updated dist.

---

## Step 2 — Create the component

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

  // --- Ambiance-signaled updates (simulation intents) ---
  // The ambiance engine can push a named action into this widget while
  // simulating activity. The intent is dispatched on the overlay's local
  // DOM CustomEvent bus (no server round-trip), so no prop drilling is needed.
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

## Step 3 — Register in the widget manifest

In `widgetRegistry.ts`, add one line to `widgetManifest`:

```ts
'scoreboard': () => import('./ScoreboardWidget').then((m) => m.ScoreboardWidget),
```

This is the only registration needed. The component loads lazily on first open
and caches for all subsequent opens.

`WidgetComponentType` in `packages/shared/src/domain/application.ts` is **derived**
from `WIDGET_DEFINITIONS` (`DefinedWidgetComponentType` in `widgets/index.ts`) —
adding your `componentType` in Step 1's definition is enough. You never edit
`application.ts` by hand for a new widget.

---

## Step 4 — Add simulation intent kinds (if signalable)

If you want the ambiance engine to signal your widget, extend the two union
types in `packages/shared/src/contracts/signals.ts`
(`WidgetSimulationIntentSeed`, `WidgetSimulationIntentPayload`):

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

`WidgetSimulationIntentSeed` is what `pickAmbianceInteractionIntent` returns
(no `actionId` yet). `WidgetSimulationIntentPayload` is what reaches the
widget (the ambiance manager adds `actionId`). They must be kept in sync —
same kinds, same extra fields.

Also register the new kind in `pickAmbianceInteractionIntent` /
`getAmbianceInteractMirrorPolicy` (see [widget-communication.md](widget-communication.md))
so the ambiance engine knows when to pick it.

---

## How the signal flow works

```
AmbianceManager (server) picks an interaction
  └─ emits ambiance:simulate to the overlay leader only
       └─ Desktop.tsx: runs the cursor animation, then
            └─ dispatchWidgetSimulationIntent(payload.sharedIntent)   ← local DOM CustomEvent, no socket hop
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

**Lazy-load flash is intentional.** If a widget opens before its dynamic import resolves, the overlay shows a generic fallback for one frame then replaces it once the import settles. Don't try to eliminate this — it's a `forceUpdate`-after-load re-render, not a bug.

**Exit animation.** If you want a closing animation, watch `windowState`:

```tsx
const isClosing = windowState === 'closing'
// apply a CSS class or framer-motion exit when isClosing is true
// DesktopWindow handles the actual unmount timing via closingWidgets in the store
```
