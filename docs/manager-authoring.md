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
packages/server/src/kernel/managers/yourmanager.ts          ← implementation
packages/server/src/kernel/managers/yourmanager.signals.ts  ← bus event declarations (if emitting)
packages/server/src/desktop-entry.ts                        ← register with kernel
packages/shared/src/contracts/signals.ts                    ← add signals (if emitting to overlay)
packages/shared/src/contracts/commands.ts                   ← add commands (if receiving)
```

---

## Step 1 — Implement the Manager interface

```ts
// packages/server/src/kernel/managers/yourmanager.ts
import type { Manager, ManagerStatus } from '@ieom/shared'

export class YourManager implements Manager {
  readonly name = 'YourManager'
  readonly bootPriority = 10  // lower = boots sooner; default is 0 (DesktopConfigService)
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

## Step 3 — Declare your bus events in a co-located signals file

Each manager owns its own `KernelEvents` augmentation. Create a `yourmanager.signals.ts` file next to your manager:

```ts
// packages/server/src/kernel/managers/yourmanager.signals.ts
declare module '../bus.js' {
  interface KernelEvents {
    'your:event': { detail: string }
  }
}
```

Then side-effect import it in `packages/server/src/kernel/index.ts` so the augmentation is always in scope:

```ts
import './managers/yourmanager.signals.js'
```

**Never edit `kernel/bus.ts` to add events.** `KernelEvents` in `bus.ts` holds only the three events that have no owning manager: `scene:changed`, `overlay:connected`, `overlay:disconnected`. All other events live in their manager's `*.signals.ts` file.

Emit from your manager:

```ts
import type { KernelBus } from '../bus.js'
import './yourmanager.signals.js' // ensure augmentation is loaded

export class YourManager implements Manager {
  constructor(private bus: KernelBus) {}

  private somethingHappened() {
    this.bus.emit('your:event', { detail: '...' })
  }
}
```

**Why not call other managers directly?** Direct calls create coupling — adding a feature means editing both the caller and the callee. Bus events let other managers subscribe independently. You can add a new subscriber without touching the publisher.

---

## Step 4 — Make the event public (if the manager emits to the overlay)

Domain events reach clients through one generic channel, not bespoke socket events. Add your event to `KernelSignalMap` (and its allowlist flag) in `packages/shared/src/contracts/signals.ts`:

```ts
export interface KernelSignalMap {
  // ...
  'your:event': YourEventPayload
}

const PUBLIC_KERNEL_SIGNAL_FLAGS: Record<KernelSignalEvent, true> = {
  // ...
  'your:event': true,
}
```

That's it — nothing else to touch. `KernelEvents` picks up the augmentation automatically (`kernel/publicSignals.ts` does `interface KernelEvents extends KernelSignalMap {}` once, for every event), and the transport bridge (`transport/socket/handlers/kernelSignal.ts`) forwards every allowlisted bus event to clients as a `kernel:signal` BusFrame with zero per-event code. Overlay clients consume it with a typed helper:

```ts
onKernelSignal('your:event', (payload) => { /* ... */ })
```

**Why a generic channel instead of a bespoke `ServerToClientEvents` entry per event?** The compiler-enforced `PUBLIC_KERNEL_SIGNAL_FLAGS` map keeps the map and the allowlist in sync, so making an event public is a one-line, one-file change instead of a bus declaration + payload type + bridge line + client handler across four files. Reserve bespoke `ServerToClientEvents` entries for protocol/lifecycle concerns only (config sync, state:update, overlay slot ownership, WebRTC signaling) — not for manager domain events.

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
- [ ] `bootPriority` set to reflect intended boot order relative to other managers
- [ ] `status()` reflects actual lifecycle state
- [ ] Communicates via `KernelBus`, not by importing other managers
- [ ] Registered in `desktop-entry.ts` after its dependencies
- [ ] Bus events (if any) declared in a co-located `yourmanager.signals.ts` (never edit `kernel/bus.ts` directly)
- [ ] `yourmanager.signals.ts` side-effect imported in `kernel/index.ts`
- [ ] Public overlay-facing events (if any) added to `KernelSignalMap` + its allowlist flag in `signals.ts`
- [ ] Socket commands (if any) added to `ClientToServerEvents` in `commands.ts`
