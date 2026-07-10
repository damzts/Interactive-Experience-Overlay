> **AI Agent Notes**
> Update this catalog when signals or commands are added or removed.
> The ground truth is `packages/shared/src/contracts/signals.ts` and `commands.ts`.
> This file provides prose context that type definitions alone don't convey. If something here contradicts the code, the code wins — fix the doc.

---

# Signal Catalog

All Socket.IO event types between kernel and userspace.

**Reading the table:**
- **Direction** — `K→U` = kernel emits, client listens. `U→K` = client emits, kernel handles. `U→K (ack)` = client emits with a callback for the response.
- **File** — which contract file defines this event.

---

## Signals (Kernel → Overlay)

Two planes, both defined in `packages/shared/src/contracts/signals.ts`:

- **Protocol/lifecycle signals** — bespoke `ServerToClientEvents` entries, one `socket.on(...)` per event. Reserved for things that aren't manager domain events: state/config sync, overlay slot ownership, WebRTC signaling, diagnostics.
- **Domain (manager) signals** — travel over one generic `'kernel:signal'` socket event carrying a `BusFrame` envelope (`{ event, payload, source, t, seq }`). `KernelSignalMap` is the single source of truth for which KernelBus events are public and what they carry; the server allowlists by its keys (`isPublicKernelSignal`) and forwards automatically (`transport/socket/handlers/kernelSignal.ts`) — adding a manager event here costs zero transport code. Overlay clients subscribe with the typed helper `onKernelSignal('some:event', payload => ...)` (`overlay/src/socket/kernelSignals.ts`).

### Protocol/lifecycle (`ServerToClientEvents`)

| Event | Payload | When | Receiver action |
|-------|---------|------|----------------|
| `state:update` | `{ state, previousState }` | SceneMachine transitions | Update visual state; pulse reactive icon |
| `transition:play` | `TransitionPlayPayload` | Before scene swap | Play exit pipeline, swap, play intro pipeline |
| `overlay:show` | `OverlayTriggerPayload` | Admin trigger, event fire | Run effects + SFX |
| `config:update` | `AppConfig` | Full (non-patch) config save | Replace full config in store |
| `config:patch` | `Partial<AppConfig>` | Partial config save (the common path) | Merge patch into config |
| `runtime:config` | `RuntimeConfig` | Admin preview / runtime tweak | Apply scoped override without persisting |
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
| `presentation:state` | `PresentationStatePayload` | A reported skin presentation fact changes | Skin-defined — overlay/admin mirror the opaque `{ key, value }` fact (start-menu, recycle-bin, …) |
| `desktop:screen-saver:test` | `DesktopScreenSaverPreviewPayload` | Admin previews screen saver | Activate screen saver temporarily |
| `widget:chain:action` | `{ targetWidgetId, action, sourceSignal }` | Automation rule fires a custom widget action | Widget receives the action |
| `widget:signal` | `{ source, event, payload }` | Server-originated automation `signal:emit` action | Overlay re-enters it on the widget DOM signal bus |
| `kernel:signal` | `BusFrame` | Any public KernelBus event (see table below) | `onKernelSignal` fans it out to per-event listeners |
| `bus:trace:frames` | `BusFrame[]` | BusHistoryRecorder | Batched bus frames pushed to `bus:trace` room subscribers |
| `pov-online:relay:offer` | `{ sdp: string }` | RoomRelay when active participant changes | Overlay creates answer PC, calls `pov-online:relay:answer` |
| `pov-online:relay:ice` | `RTCIceCandidateInit` | RoomRelay during ICE negotiation | Overlay adds ICE candidate to its PC |

### Domain signals (via `kernel:signal`, defined in `KernelSignalMap`)

| Event | Payload | When |
|-------|---------|------|
| `chat:message` | `ChatMessagePayload` | Every Twitch PRIVMSG (IRC) or simulated chat message |
| `chat:connected` | `{ channel: string }` | IRC JOIN confirmed |
| `twitch:eventsub:connected` | `TwitchEventSubConnectedPayload` | EventSub WebSocket session established |
| `twitch:follow` / `twitch:subscribe` / `twitch:gift-sub` / `twitch:cheer` / `twitch:raid` / `twitch:points:redemption` | per-event payload types | Corresponding Twitch EventSub notification |
| `twitch:stream:online` / `twitch:stream:offline` | `TwitchStreamOnlinePayload` / `{}` | Channel goes live / offline |
| `twitch:hype-train:begin` / `twitch:hype-train:end` | begin/end payload types | Hype train starts/ends |
| `obs:stream:started` / `obs:stream:stopped` | `{}` | OBS starts/stops streaming |
| `obs:recording:started` / `obs:recording:stopped` | `{}` | OBS starts/stops recording |
| `obs:virtualcam:changed` | `{ active: boolean }` | Virtual camera toggled |
| `show:step` | `ShowStepPayload` | Each step of a running show executes |
| `audio:beat` | `AudioBeatPayload` | Overlay's audio-reactivity monitor detects a beat |
| `audio:energy:high` / `audio:energy:low` | `AudioEnergyPayload` | Audio level crosses a reactivity threshold |
| `audio:silence` | `{}` | Audio-reactivity monitor detects silence |
| `persona:speak` | `PersonaSpeakPayload` | PersonaManager speaks — the optional `kind` tags the source: echoed `chat`, an `event` reaction line, a chat `summary` for the streamer, a `console` reply, or an LLM viewer `reply`. Overlay plays the wav (robotic filter + ducking), shows the caption bubble, and pops in the avatar art |

Ground truth for this table is `KernelSignalMap` in `signals.ts` — it's a compiler-enforced total record against `PUBLIC_KERNEL_SIGNAL_FLAGS`, so it can never drift out of sync with the allowlist itself (only with this doc).

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
| `persona:console` | `{ text }` + ack `(reply \| null)` | Admin persona Console (admin-only) | PersonaManager.converse() — LLM reply in character, spoken via `persona:speak`, returned in the ack |
| `persona:summarize` | ack `(err \| null)` | Admin "Summarize chat now" (admin-only); also triggerable as a bus event via automation `signal:emit` | PersonaManager.summarizeNow() — speaks a chat summary to the streamer |
| `runtime:config:reset` | ack `(err \| null)` | Admin clear override (admin-only) | Remove all runtime overrides |
| `runtime:config:widget:reset` | `widgetId` + ack | Widget drag/resize end (admin-only) | Remove override for one widget |
| `runtime:config:widget-layout:reset` | `widgetId[]` + ack | Layout reset (admin-only) | Remove overrides for a set of widgets |
| `ambiance:history:clear` | — | Admin diagnostics | Clear ambiance history log |
| `ambiance:simulate:accepted` | `AmbianceSimulationAcceptedPayload` | Overlay leader accepts | Kernel records accept, clears pending timeout |
| `ambiance:simulate:done` | `AmbianceSimulationDonePayload` | Overlay finishes simulation | Kernel records outcome, updates metrics |
| `widget:simulate:intent` | `WidgetSimulationIntentPayload` | Widget interaction | Kernel broadcasts to all clients |
| `widget:signal` | `{ source, event, payload }` | Widget/renderer emits a signal | Forwarded to the kernel; both sides evaluate automation rules |
| `desktop:notify` | `DesktopNotificationPayload` | Admin send notification | Broadcast notification to overlay |
| `presentation:state` | `PresentationStateReportPayload` | Overlay reports a skin fact (start menu, recycle bin, …) | Store opaquely in RuntimeStateStore + rebroadcast; `activity: true` also pings the idle scheduler |
| `desktop:screen-saver:test` | `{ preset }` | Admin preview button | Emit to overlay |
| `desktop:icon:drag` | `DesktopIconDragPayload` | Overlay drag event | Forward to all clients |
| `desktop:widget:drag` | `DesktopWidgetDragPayload` | Overlay drag event | Update runtime widget position |
| `desktop:widget:resize` | `DesktopWidgetResizePayload` | Overlay resize event | Update runtime widget size |
| `overlay:runtime:status` | `OverlayRuntimeStatusPayload` | Overlay on mount | Kernel records overlay readiness |
| `overlay:perf` | `OverlayPerfPayload` | Overlay perf monitor, every ~5s (overlay slot only) | Stored on the handler context; surfaces as `runtime:diagnostics.overlayPerf` |
| `bus:trace:subscribe` | — | Admin diagnostics panel | Join `bus:trace` Socket.IO room; receive `bus:trace:frames` |
| `bus:trace:unsubscribe` | — | Admin diagnostics panel | Leave `bus:trace` room |
| `pov-online:relay:subscribe` | — | POVStreamWidget / PovStream plugin on connect | Server begins relay; creates offer for this overlay client |
| `pov-online:relay:answer` | `{ sdp: string }` | POVStreamWidget after receiving offer | Server sets remote description on RoomRelay PC |
| `pov-online:relay:ice` | `RTCIceCandidateInit` | POVStreamWidget during ICE | Server adds ICE candidate to RoomRelay PC |

---

## Queries (Overlay/Admin → Kernel, with response)

Defined in `packages/shared/src/contracts/queries.ts`.

| Event | Response | When | Use |
|-------|----------|------|-----|
| `overlay:sync` | `OverlaySyncSnapshot` | On connect/reconnect | Atomic initial sync — returns `{ state, desktop, config }` in one round-trip |

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
