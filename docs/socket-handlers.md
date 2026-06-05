> **AI Agent Notes**
> The domain split is about merge safety and reasoning locality, not performance.
> The HandlerContext pattern is the key constraint — understand it before modifying any handler.
> Adding a new socket event means touching one domain file. If you find yourself touching more than one, the event belongs in a different domain or the domain boundaries need revisiting.

---

# Socket Handler Architecture

## Why the handlers are split

All socket events were originally handled in a single file. At 1200+ lines, every feature touched the same file — merge conflicts were constant and tracing an event's full lifecycle meant scanning hundreds of lines of unrelated code.

The split is into domain-scoped modules, each owning a coherent set of events:

- **Scene** — scene changes, transition previews, event execution, machine listeners
- **Widget** — widget toggle, simulate, layout apply
- **Ambiance** — simulation lifecycle, cursor mirror, leader management
- **Desktop** — icon and window drag/resize, notifications, start menu, screen saver
- **Config** — runtime override clears, keybind execution
- **Diagnostics** — overlay runtime status, throttled diagnostics broadcast
- **Runtime override** — the shared logic for merging, applying, and scheduling resets of temporary config overrides

An orchestrator module owns the overlay slot gate (one overlay at a time), connection/disconnection lifecycle, and initial state push on connect. It composes all domain modules.

## The HandlerContext pattern

All domain modules receive a single `HandlerContext` object by reference. This object holds all shared mutable state: the open widget set, the current runtime config override, the simulation leader socket ID, the overlay socket ID, and references to the server-level services (socket.io instance, config service, ambiance manager, etc.).

**Mutations are direct.** When the widget handler opens a widget, it mutates `context.openWidgetIds` directly. The scene handler reading `context.openWidgetIds` a millisecond later sees the updated value. There is no pub/sub between domain modules, no message passing, no copying.

This is intentional. The handlers are all running in the same Node.js event loop, synchronously within a single socket event callback. A more decoupled design (events between modules, immutable state) would add complexity with no benefit in this execution model.

## The overlay slot gate

The orchestrator enforces that only one overlay client is connected at a time. A second connection attempt is immediately rejected with an `overlay:rejected` event. This is a hard constraint — the ambiance system, the runtime override system, and the cursor mirror system all assume a single authoritative overlay.

If the overlay disconnects, the slot is immediately freed, pending overrides are cleared, and the ambiance leader is cleared. A reconnecting overlay starts fresh from a server-pushed state snapshot.

## Domain boundaries

The one non-obvious dependency: the scene handler imports helpers from the widget handler. This is intentional — scene changes can trigger widget layout changes (opening/closing widgets as part of a scene transition). The dependency is one-way: scene imports from widget, widget never imports from scene.

No other cross-domain imports exist. If a new event needs logic from two domains, that logic belongs in a shared utility (like `runtimeOverride.ts`), not as a cross-import between domain files.
