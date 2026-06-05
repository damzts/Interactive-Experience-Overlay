## Plan: Refactor to Kernel/Userspace Architecture

Goal: align the implementation with the computer architecture model described in ARCHITECTURE.md. Make the kernel a proper orchestrator with composable managers, formalize the signal contract, and keep the codebase navigable for any collaborator.

This is a **non-breaking incremental refactor** — each step produces a working system. No feature changes, only structural clarity.

---

### Phase 1: Kernel Manager Protocol

**Problem:** Managers (SceneMachine, AmbianceManager, EventScheduler, OBSBridge, etc.) are ad-hoc classes with inconsistent lifecycle patterns. There's no way to discover, start, stop, or introspect them uniformly.

**Changes:**

1. Define a `Manager` interface in `@ieom/shared/contracts/manager.ts`:
   ```ts
   interface Manager {
     readonly name: string;
     init(): Promise<void> | void;
     start(): Promise<void> | void;
     stop(): Promise<void> | void;
     dispose(): Promise<void> | void;
     status(): ManagerStatus; // 'idle' | 'running' | 'stopped' | 'error'
   }
   ```

2. Retrofit existing managers to implement this interface (additive — existing methods stay):
   - `SceneMachine` → add `init/start/stop/dispose/status`
   - `AmbianceManager` → already has start/stop, add the rest
   - `EventScheduler` → already has start/stop, add the rest
   - `OBSBridge` → wrap connect/disconnect as start/stop
   - `RuntimeStateStore` → trivial (already stateless init)
   - `DesktopConfigService` → wrap db open/close as init/dispose
   - `POVOrchestrator` → add lifecycle wrapper

3. No behavior changes — just a uniform shape on each manager.

**Result:** Every kernel subsystem is discoverable and has a predictable lifecycle.

---

### Phase 2: Kernel Internal Event Bus

**Problem:** Managers communicate through the mutable `HandlerContext` object passed by reference. The socket handler orchestrator directly calls into manager internals. This means you can't add a new manager without editing the orchestrator.

**Changes:**

1. Create `packages/server/src/kernel/bus.ts` — a typed internal EventEmitter:
   ```ts
   // KernelEvents type map (internal, not exposed to clients)
   type KernelEvents = {
     'scene:changed': { from: string; to: string };
     'scheduler:fired': { eventId: string; action: EventAction };
     'ambiance:tick': { widgetId: string; action: string };
     'config:changed': { section: string };
     'overlay:connected': { socketId: string };
     'overlay:disconnected': {};
   };
   ```

2. Managers publish to the bus instead of reaching into each other:
   - `SceneMachine` emits `scene:changed` on the bus (currently emits on its own EventEmitter — redirect)
   - `EventScheduler` emits `scheduler:fired` (currently emits on the machine — decouple)
   - `AmbianceManager` emits `ambiance:tick` (currently calls socket directly — decouple)

3. The **socket layer subscribes** to bus events and translates them into outward signals:
   - Bus `scene:changed` → Socket.IO `state:update` signal
   - Bus `scheduler:fired` → execute event action → emit appropriate signals
   - Bus `ambiance:tick` → Socket.IO `simulation:intent` signal

4. Keep `HandlerContext` for now (socket-scoped mutable state), but stop using it as a cross-manager communication channel.

**Result:** Managers are decoupled. Adding a new manager = implement interface + publish/subscribe to bus events. No orchestrator edits needed.

---

### Phase 3: Kernel Bootstrap (replace procedural wiring)

**Problem:** `desktop-entry.ts` is a 382-line procedural function that manually constructs and wires every manager, route, and namespace. Adding anything requires editing this god-function.

**Changes:**

1. Create `packages/server/src/kernel/index.ts` — the Kernel class:
   ```ts
   class Kernel {
     private managers: Map<string, Manager>;
     private bus: KernelBus;
     
     register(manager: Manager): void;
     async boot(): Promise<void>;    // init all → start all (in order)
     async shutdown(): Promise<void>; // stop all → dispose all (reverse order)
     getManager<T>(name: string): T;
   }
   ```

2. Refactor `desktop-entry.ts` into a thin bootstrap that:
   - Creates the Kernel
   - Registers managers (explicit order for now — topological sort is future work)
   - Calls `kernel.boot()`
   - Returns `{ listen, close }` that delegate to kernel lifecycle

3. Move Fastify setup, route registration, and Socket.IO namespace setup into a `TransportManager` (or keep them as procedural setup called by boot — either works, preference is to keep HTTP/Socket as infrastructure, not a "manager").

**Result:** The entry point is ~50 lines. Each manager is self-contained. New collaborators add managers without touching the bootstrap.

---

### Phase 4: Formalize Signal Contract (Shared ABI)

**Problem:** `contracts/socket.ts` has all 60+ events in two flat maps. There's no conceptual distinction between a command going up (userspace → kernel), a signal going down (kernel → userspace), or a query (request/response).

**Changes:**

1. Split `contracts/socket.ts` into three files:
   ```
   contracts/
     signals.ts    — Kernel → Userspace (directives to render)
     commands.ts   — Userspace/Admin → Kernel (requests to act)
     queries.ts    — Request/response pairs (snapshots, diagnostics)
     socket.ts     — Re-exports combined maps (backward compat)
   ```

2. Categorize existing events:
   - **Signals** (server emits, client listens): `state:update`, `widget:toggle`, `transition:play`, `overlay:show`, `config:update`, `config:patch`, `runtime:config:override`, `simulation:intent`, `cursor:mirror:*`, `desktop:notify`, `runtime:diagnostics`
   - **Commands** (client emits, server handles): `scene:change`, `widget:simulate`, `widget:layout:apply`, `keybind:execute`, `desktop:widget:drag`, `desktop:widget:resize`, `ambiance:simulate:*`, `overlay:trigger`, `panic`
   - **Queries** (client emits, server responds via callback or paired event): `overlay:runtime:status`, `desktop:state:snapshot`, initial config fetch

3. Keep the combined `ServerToClientEvents` / `ClientToServerEvents` re-export in `socket.ts` for full backward compat — the split is organizational, not a runtime change.

4. Add JSDoc to each event type explaining: direction, when it fires, what the receiver should do.

**Result:** A new developer opening `signals.ts` immediately understands "these are things the kernel tells the overlay to do." The ABI is self-documenting.

---

### Phase 5: Overlay Signal Receiver Pattern

**Problem:** Overlay socket hooks (`useSceneEvents`, `useDesktopEvents`, `useConfigSync`) are imperative — each one manually calls `socket.on(...)` for specific events. Adding a new signal requires editing the right hook and knowing which one handles what.

**Changes:**

1. Create `packages/overlay/src/socket/signalMap.ts` — a declarative registry:
   ```ts
   const signalHandlers: SignalHandlerMap = {
     'state:update': (payload, store) => { ... },
     'widget:toggle': (payload, store) => { ... },
     'transition:play': (payload, store) => { ... },
     'config:update': (payload, store) => { ... },
     // ...
   };
   ```

2. Create `packages/overlay/src/socket/useSignalReceiver.ts` — a single hook that:
   - Iterates the signal map on mount
   - Registers all `socket.on(...)` handlers
   - Cleans up on unmount
   - Optionally logs/traces signals in dev mode

3. Keep existing hooks as **thin wrappers** or migrate them into the map gradually. The existing hooks can become groups within the map (scene signals, desktop signals, config signals) for organizational clarity.

4. Each layer or plugin can declare additional signal handlers via a registration function (future: plugin-contributed signals).

**Result:** Adding a new signal = add one entry to the map. No plumbing, no hook hunting. The signal flow is visible in one file.

---

### Phase 6: Directory Restructure (Kernel)

**Problem:** Server source tree uses domain folders (`ambiance/`, `events/`, `obs/`, `pov/`) but lacks a clear "this is the kernel core" vs "this is transport/infrastructure" distinction.

**Changes:**

Proposed structure:
```
packages/server/src/
├── kernel/
│   ├── index.ts              # Kernel class (boot, shutdown, registry)
│   ├── bus.ts                # Internal event bus
│   ├── types.ts              # Manager interface, KernelEvents
│   └── managers/
│       ├── scene.ts          # SceneMachine (moved from state/)
│       ├── ambiance.ts       # AmbianceManager (moved from ambiance/)
│       ├── scheduler.ts      # EventScheduler (moved from events/)
│       ├── config.ts         # DesktopConfigService (moved from db/)
│       ├── runtime.ts        # RuntimeStateStore (moved from state/)
│       ├── obs.ts            # OBSBridge (moved from obs/)
│       └── pov.ts            # POVOrchestrator (moved from pov/)
├── transport/
│   ├── http/                 # Fastify routes (moved from routes/)
│   ├── socket/               # Socket.IO handlers (moved from socket/)
│   └── webrtc/               # werift hub + relay (moved from room/)
├── db/                       # SQLite init, migrations, repositories
├── online/                   # Online room system (uses transport + kernel)
├── index.ts                  # Re-exports
└── desktop-entry.ts          # Thin bootstrap → Kernel.boot()
```

This makes the separation visible at the filesystem level:
- `kernel/` = the brain (managers, bus, lifecycle)
- `transport/` = how the kernel talks to the outside world
- `db/` = persistent storage layer
- `online/` = a feature vertical that composes kernel + transport

**Result:** A collaborator can navigate by concept. "I need to change how ambiance works" → `kernel/managers/ambiance.ts`. "I need to add an API endpoint" → `transport/http/`.

---

### Phase 7: Documentation & Onboarding

**Changes:**

1. Create `docs/manager-authoring.md` — step-by-step guide to add a new kernel manager (analogous to `widget-authoring.md`)
2. Create `docs/signal-catalog.md` — reference of all signals with direction, payload, and example
3. Update `docs/engine-overview.md` to reference the kernel/manager structure
4. Add a `CONTRIBUTING.md` at repo root with:
   - Architecture overview link
   - "Where do I put my code?" decision tree
   - PR checklist (signal types added? manager interface satisfied? invariants preserved?)

---

### Execution Order & Dependencies

```
Phase 1 (Manager interface)     — no deps, pure additive
Phase 2 (Internal bus)          — depends on Phase 1 (managers emit to bus)
Phase 3 (Kernel bootstrap)      — depends on Phase 1+2 (registry uses interface)
Phase 4 (Signal contract split) — no deps, pure organizational (@ieom/shared)
Phase 5 (Signal receiver)       — depends on Phase 4 (uses signal types)
Phase 6 (Directory restructure) — depends on Phase 2+3 (move into new structure)
Phase 7 (Documentation)         — do continuously, finalize after Phase 6
```

Phases 1 and 4 can start in parallel (independent packages).
Phase 7 should be done incrementally with each phase.

---

### What This Does NOT Change

- Widget authoring workflow (still 3 steps, still works the same)
- Socket.IO event names or payloads (backward compat)
- Overlay rendering pipeline (layers, effects, transitions)
- Admin panel functionality
- Any user-facing behavior

This is purely a **structural refactor** that makes the computer architecture metaphor concrete in the code, so that the next feature built on top of it inherits clarity for free.

---

### Success Criteria

- [ ] Every manager implements the `Manager` interface
- [ ] No manager imports another manager directly (bus only)
- [ ] `desktop-entry.ts` is under 80 lines
- [ ] Signal contract is split into signals/commands/queries with JSDoc
- [ ] A new developer can add a manager without editing the bootstrap
- [ ] A new developer can add a signal without editing socket hooks
- [ ] Directory structure matches kernel/transport/db separation
- [ ] All existing tests still pass
- [ ] No event name or payload changes (overlay/admin unaffected)
