> **AI Agent Notes**
> Update this catalog when signals or commands are added or removed.
> The ground truth is `packages/shared/src/contracts/signals.ts` and `commands.ts`.
> This file provides prose context that type definitions alone don't convey.

---

# Signal Catalog

All Socket.IO event types between kernel and userspace.

**Reading the table:**
- **Direction** — `K→U` = kernel emits, client listens. `U→K` = client emits, kernel handles. `U→K (ack)` = client emits with a callback for the response.
- **File** — which contract file defines this event.

---

## Signals (Kernel → Overlay)

Defined in `packages/shared/src/contracts/signals.ts` as `ServerToClientEvents`.

| Event | Payload | When | Receiver action |
|-------|---------|------|----------------|
| `state:update` | `{ state, previousState }` | SceneMachine transitions | Update visual state; pulse reactive icon |
| `transition:play` | `TransitionPlayPayload` | Before scene swap | Play exit pipeline, swap, play intro pipeline |
| `overlay:show` | `OverlayTriggerPayload` | Admin trigger, event fire | Run effects + SFX |
| `config:update` | `AppConfig` | Admin saves config | Replace full config in store |
| `config:patch` | `Partial<AppConfig>` | Partial config save | Merge patch into config |
| `runtime:config:override` | `RuntimeConfigOverridePayload` | Admin preview / runtime tweak | Apply scoped override without persisting |
| `obs:status` | `ObsStatusPayload` | OBS connection state changes | Update OBS indicator in admin/overlay |
| `ambiance:metrics` | `{ accepted, rejected }` | After each simulation cycle | Update diagnostics display |
| `runtime:diagnostics` | `RuntimeDiagnosticsPayload` | Throttled periodic emit | Update admin diagnostics panels |
| `overlay:owner` | `{ socketId }` | Overlay slot changes | Track overlay ownership in admin |
| `overlay:resync` | `{ reason }` | Slot reconnect or reset | Re-request full state snapshot |
| `overlay:rejected` | `{ reason }` | Second overlay tries to connect | Show "already open" message, disconnect |
| `ambiance:simulate` | `AmbianceSimulationPayload` | AmbianceManager picks an action | Leader executes the simulation |
| `widget:simulate:intent` | `WidgetSimulationIntentPayload` | Kernel forwards widget interaction | Widget receives DOM intent (gallery:next, etc.) |
| `widget:toggle` | `widgetId: string` | Widget open/close triggered | Toggle widget window |
| `widget:layout:apply` | `layoutId: string` | Layout preset activated | Apply named widget layout |
| `widget:layout:apply:items` | `WidgetLayoutItem[]` | Layout items applied | Apply raw widget positions/sizes |
| `desktop:notify` | `DesktopNotificationPayload` | Server wants to notify user | Show OS-style notification toast |
| `desktop:recycle-bin` | `{ full: boolean }` | Recycle bin state changes | Update bin icon appearance |
| `desktop:start-menu:state` | `DesktopStartMenuStatePayload` | Start menu visibility changes | Sync start menu open/closed state |
| `desktop:start-menu:phase` | `DesktopStartMenuSimulationPhasePayload` | Ambiance navigates start menu | Animate cursor through menu phases |
| `desktop:screen-saver:test` | `{ preset }` | Admin previews screen saver | Activate screen saver temporarily |
| `desktop:icon:drag` | `DesktopIconDragPayload` | Ambiance drags an icon | Animate icon to new position |
| `desktop:widget:drag` | `DesktopWidgetDragPayload` | Ambiance drags a window | Move widget to new position |
| `desktop:widget:resize` | `DesktopWidgetResizePayload` | Ambiance resizes a window | Resize widget |
| `cursor:mirror` | `CursorMirrorPayload` | Ambiance moves/clicks cursor | Move/click/show-hide the cursor overlay |
| `cursor:mirror:menu-timeline` | `OpenWidgetMenuTimelinePayload` | Ambiance opens a widget via menu | Play full menu navigation animation |
| `bus:custom` | `{ event: string; payload: unknown }` | Manager calls `bus.emitCustom()` | Forward custom manager event to overlay |
| `widget:chain:action` | `{ targetWidgetId, action, sourceSignal }` | Widget wire fires a non-toggle action | Widget receives custom wire action |

---

## Commands (Overlay/Admin → Kernel)

Defined in `packages/shared/src/contracts/commands.ts` as `ClientToServerEvents`.

| Event | Payload | Triggered by | Kernel action |
|-------|---------|-------------|---------------|
| `scene:change` | `STATE` | Admin scene button | SceneMachine.transition() |
| `overlay:trigger` | `OverlayTriggerPayload` | Admin effect button | SceneMachine.triggerOverlay() |
| `event:preview` | `EventConfig` | Admin event preview | Execute event actions once |
| `transition:preview` | `TransitionStep[]` | Admin transition tester | Play transition without state change |
| `panic` | — | Admin panic button | ForceState to DESKTOP, clear overrides |
| `widget:toggle` | `widgetId` | Admin widget toggle | Toggle widget in runtime state |
| `widget:simulate` | `widgetId` | Admin simulate button | Trigger ambiance-style open |
| `widget:simulate:action` | `WidgetSimulationCommandPayload` | Admin explicit action | Execute open/close/toggle |
| `widget:layout:apply` | `layoutId` | Admin layout button | Apply named layout preset |
| `widget:layout:apply:items` | `WidgetLayoutItem[]` | Admin layout editor | Save + apply raw layout |
| `keybind:execute` | `KeybindExecutionPayload` | Keyboard shortcut | Execute configured keybind action |
| `runtime:config:override:clear` | — | Admin clear override | Remove all runtime overrides |
| `runtime:config:override:widget:clear` | `widgetId` | Widget drag/resize end | Remove override for one widget |
| `runtime:config:override:widget-layout:clear` | `widgetId[]` | Layout reset | Remove overrides for a set of widgets |
| `ambiance:history:clear` | — | Admin diagnostics | Clear ambiance history log |
| `ambiance:simulate:accepted` | `AmbianceSimulationAcceptedPayload` | Overlay leader accepts | Kernel records accept, clears pending timeout |
| `ambiance:simulate:done` | `AmbianceSimulationDonePayload` | Overlay finishes simulation | Kernel records outcome, updates metrics |
| `widget:simulate:intent` | `WidgetSimulationIntentPayload` | Widget interaction | Kernel broadcasts to all clients |
| `widget:signal` | `{ source, event, payload }` | Widget emits a signal | Overlay routes through widget wires |
| `cursor:mirror` | `CursorMirrorPayload` | Overlay cursor moved | Broadcast to all admins |
| `cursor:mirror:menu-timeline` | `OpenWidgetMenuTimelinePayload` | Overlay menu animation | Broadcast to all admins |
| `desktop:notify` | `DesktopNotificationPayload` | Admin send notification | Broadcast notification to overlay |
| `desktop:recycle-bin` | `{ full }` | Overlay state change | Update runtime state |
| `desktop:start-menu:state` | `DesktopStartMenuStatePayload` | Overlay start menu toggle | Update runtime state |
| `desktop:start-menu:phase` | `DesktopStartMenuSimulationPhasePayload` | Ambiance sim phase | Broadcast to leader overlay |
| `desktop:screen-saver:test` | `{ preset }` | Admin preview button | Emit to overlay |
| `desktop:icon:drag` | `DesktopIconDragPayload` | Overlay drag event | Forward to all clients |
| `desktop:widget:drag` | `DesktopWidgetDragPayload` | Overlay drag event | Update runtime widget position |
| `desktop:widget:resize` | `DesktopWidgetResizePayload` | Overlay resize event | Update runtime widget size |
| `overlay:runtime:status` | `OverlayRuntimeStatusPayload` | Overlay on mount | Kernel records overlay readiness |

---

## Queries (Overlay/Admin → Kernel, with response)

Defined in `packages/shared/src/contracts/queries.ts`.

| Event | Response | When | Use |
|-------|----------|------|-----|
| `state:request` | `STATE` | On connect/reconnect | Sync scene without waiting for next `state:update` |
| `desktop:state:request` | `DesktopRuntimeStatePayload` | On connect/reconnect | Restore widget state, recycle bin, start menu |

---

## Adding a signal

1. Add payload type and event entry to `ServerToClientEvents` in `signals.ts`
2. Add the handler to `signalMap.ts` in `packages/overlay/src/socket/`
3. Emit from the appropriate place in `transport/socket/handlers/`

No other files need to change.

## Adding a command

1. Add payload type and event entry to `ClientToServerEvents` in `commands.ts`
2. Register the handler in the appropriate `transport/socket/handlers/` module
3. If the overlay sends it, add `socket.emit(...)` in the overlay

No other files need to change.
