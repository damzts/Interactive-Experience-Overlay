> **AI Agent Notes**
> This file documents how to add a new kernel manager. Update if the Kernel class or Manager interface changes.
> Document **why** patterns exist, not just what they are.

---

# Manager Authoring Guide

A kernel manager is an autonomous server-side subsystem responsible for one domain. Examples: SceneMachine (state transitions), AmbianceManager (widget simulation), EventScheduler (time-based triggers).

Managers are the brain of the system. Each one owns its own state, lifecycle, and event emission. They communicate through the kernel bus, not by importing each other.

---

## Anatomy of a manager

```
packages/server/src/kernel/managers/yourmanager.ts   ← implementation
packages/server/src/desktop-entry.ts                 ← register with kernel
packages/shared/src/contracts/signals.ts             ← add signals (if emitting)
packages/shared/src/contracts/commands.ts            ← add commands (if receiving)
```

---

## Step 1 — Implement the Manager interface

```ts
// packages/server/src/kernel/managers/yourmanager.ts
import type { Manager, ManagerStatus } from '@ieom/shared'

export class YourManager implements Manager {
  readonly name = 'YourManager'
  private _status: ManagerStatus = 'idle'

  // ── Lifecycle ────────────────────────────────────────────────
  init(): void {
    // One-time setup: open connections, allocate resources.
    // Called once before start(). If nothing to set up, leave empty.
    this._status = 'idle'
  }

  start(): void {
    // Begin active work: start timers, subscribe to events, connect.
    this._status = 'running'
    // ...
  }

  stop(): void {
    // Halt active work. Manager stays in memory. May be restarted.
    this._status = 'stopped'
    // ...
  }

  dispose(): void {
    // Full teardown. Release all resources. Not restartable after this.
    this.stop()
  }

  status(): ManagerStatus {
    return this._status
  }

  // ── Domain logic ─────────────────────────────────────────────
  // ... your manager's actual methods
}
```

**Why the Manager interface?** The Kernel calls `init/start/stop/dispose` uniformly on all managers. This means the entry point never knows or cares what each manager does internally — it just calls the lifecycle hooks in the right order.

---

## Step 2 — Register with the kernel

In `desktop-entry.ts`, add one line in the manager registration block:

```ts
const yourManager = new YourManager(/* deps */)

kernel.register(configService)   // existing
kernel.register(machine)         // existing
kernel.register(yourManager)     // ← add here, after its dependencies
```

Registration order matters: `boot()` calls `init()` then `start()` in registration order. If your manager depends on another (e.g. needs `machine.currentState`), register after it.

**Why not auto-discover managers?** Explicit registration means the startup order is visible in one file. Auto-discovery via decorators or file scanning hides ordering requirements and makes boot sequencing fragile.

---

## Step 3 — Publish bus events (if the manager needs to notify others)

```ts
import { KernelBus } from '../bus.js'

export class YourManager implements Manager {
  constructor(private bus: KernelBus) {}

  private somethingHappened() {
    this.bus.emit('your:event', { detail: '...' })
  }
}
```

To add a new bus event, extend `KernelEvents` in `kernel/bus.ts`:

```ts
export interface KernelEvents {
  // existing...
  'your:event': { detail: string }
}
```

**Why not call other managers directly?** Direct calls create coupling — adding a feature means editing both the caller and the callee. Bus events let other managers subscribe independently. You can add a new subscriber without touching the publisher.

---

## Step 4 — Add socket signals (if the manager emits to the overlay)

In `packages/shared/src/contracts/signals.ts`, add to `ServerToClientEvents`:

```ts
'your:signal': (payload: YourSignalPayload) => void
```

In the socket handler layer (`transport/socket/handlers/`), subscribe to the bus event and forward:

```ts
bus.on('your:event', (payload) => {
  io.emit('your:signal', { ... })
})
```

**Why separate bus events from socket signals?** Bus events are internal. Multiple consumers can listen (diagnostics, logging, other managers). Socket signals are external ABI — once you emit them, the overlay depends on them. Keeping them separate means you can change internal plumbing without touching the ABI.

---

## Step 5 — Add a socket command handler (if admin/overlay can trigger actions)

In the appropriate `transport/socket/handlers/` module:

```ts
socket.on('your:command', (payload, callback) => {
  // validate payload
  // call manager method
  yourManager.doThing(payload)
  callback?.(null)
})
```

Add the command type in `packages/shared/src/contracts/commands.ts`.

---

## Checklist

- [ ] Implements `Manager` interface with all five lifecycle methods
- [ ] `name` is unique among registered managers
- [ ] `status()` reflects actual lifecycle state
- [ ] Communicates via `KernelBus`, not by importing other managers
- [ ] Registered in `desktop-entry.ts` after its dependencies
- [ ] Bus events (if any) added to `KernelEvents` in `kernel/bus.ts`
- [ ] Socket signals (if any) added to `ServerToClientEvents` in `signals.ts`
- [ ] Socket commands (if any) added to `ClientToServerEvents` in `commands.ts`
