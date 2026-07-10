> **AI Agent Notes**
> This describes the rule engine's shape and evaluation split (overlay vs server), not the UI. Keep it high-level and stable.
> If something here contradicts the code, the code wins — fix the doc.

---

# Automation Rules

Automation Rules connect **any signal** to **any action** — persistently, without writing code. One rule engine covers what used to be two separate systems (kernel-event "automation" and widget-to-widget "wires").

Examples:
- Twitch subscriber → fire a glitter-bomb overlay effect
- Weather widget detects a storm → open the particles widget
- StreamQuest renderer completes a quest → emit a `party:time` signal → other rules react to it
- Scene changes to LOBBY → desktop notification

---

## Concepts

**Trigger** — what fires the rule. Two sources:
- `kernel` — any KernelBus event (`twitch:follow`, `scene:changed`, …), matched by name plus an optional field-match on the payload.
- `widget` — a signal emitted on the overlay DOM bus by a widget **or a scene renderer** (`quest:complete`, `weather:storm`, …), optionally restricted to one emitting instance (`widgetId`).

Both trigger types support an optional `sceneIs` gate (rule only fires in the listed scenes) and a `match` payload filter.

**Action** — what runs when the trigger matches:

| kind | params | executed in |
|---|---|---|
| `widget:action` | `{ targetWidgetId, action }` | overlay (synchronous) — except `open`/`close`/`toggle`, which mutate authoritative open state and run in the server |
| `widget:toggle` | `{ widgetId }` | server |
| `scene:change` | `{ sceneId }` | server |
| `overlay:show` | `OverlayTriggerPayload` (effects stack) | server → overlay |
| `desktop:notify` | `DesktopNotificationPayload` | server → overlay |
| `signal:emit` | `{ event, payload? }` | server — mints a new widget-style signal |

**`signal:emit`** makes the model symmetric: a rule's output can be a signal that other rules (and widgets/renderers) consume. Synthetic signals carry a marker and may **not** trigger another `signal:emit` — a single-hop guard that prevents loops.

---

## How evaluation works

```
Widget/renderer emits a DOM signal:
  dispatchWidgetSignal({ source: appId, event: 'weather:storm' })

1. Overlay (useSocket → evaluateWidgetRules):
   - widget-source rules with kind widget:action (custom actions only)
     → dispatchWidgetChainAction, zero round-trip
   - the signal is forwarded to the server (unless synthetic)

2. Server (AutomationManager on the KernelBus):
   - kernel-source rules match bus events directly
   - widget-source rules match forwarded widget:signal frames
   - executes every kind except custom widget:action
     (open/close/toggle run here — authoritative open state)
```

The action-kind split guarantees nothing executes twice. Rules are delivered to the overlay inside `AppConfig.automationRules` and broadcast via `config:patch { automationRules }` on every mutation — no restart needed.

---

## Storage & API

`automation_rules` SQLite table, owned by `AutomationRuleRepository`. Legacy `widget_wires` rows (and old-shape `automation_rules` rows) are imported automatically on first boot by `migrateAutomationRules` in `desktop-db.ts`, then the old table is dropped.

`GET/POST/PATCH/DELETE /api/automation/rules` is the CRUD layer. `GET /api/automation/manifests` serves the widget signal/action manifests for the admin rule-builder pickers.

---

## Manifests — declaring signals and actions

Unchanged from the wires era: each widget declares `emits`/`accepts` in its co-located definition under `packages/shared/src/widgets/{id}/definition.ts`; `WIDGET_INTENT_MANIFESTS` is derived automatically. Renderers declare `emits`/`accepts` in their `RENDERER_CATALOG` entry (`packages/shared/src/domain/plugin.ts`).

The built-in actions `open`, `close`, and `toggle` work on every widget without being declared.

## Emitting a signal from a widget

```ts
import { dispatchWidgetSignal } from './widgetSimulationEvents'
dispatchWidgetSignal({ source: appId, event: 'weather:storm' })
```

## Receiving an action in a widget

```ts
import { addWidgetChainActionListener } from './widgetSimulationEvents'
useEffect(() => {
  return addWidgetChainActionListener(({ targetWidgetId, action }) => {
    if (targetWidgetId !== appId) return
    if (action === 'gallery:next') showNext()
  })
}, [appId, showNext])
```

Renderers receive actions through their `onSignal('action', …)` prop and emit via `emit('signal', { event, payload })` — see `overlay/src/renderers/rendererSignals.ts`.

---

## Admin panel

**System → Automation.** The rule builder has a trigger-source toggle (kernel event with suggestions, or widget picker + signal picker fed by manifests), optional payload match and scene chips, and a per-kind action editor. Rules activate immediately and survive restarts.
