# Contributing to IEOM

## Architecture first

Before writing code, read:
- `ARCHITECTURE.md` — the system mental model (kernel/userspace/ABI)
- `docs/engine-overview.md` — what the engine is and how its directories are organized

The short version: the server is the **kernel**, the overlay is **userspace**, and `@ieom/shared` is the **ABI** between them. Every change falls somewhere in this model.

---

## Where does my code go?

**I want to add a new widget (visual app on the overlay)**
→ See `docs/widget-authoring.md`. Three files, no server changes.

**I want to add a new kernel manager (autonomous server subsystem)**
→ See `docs/manager-authoring.md`. Implement the `Manager` interface, register in `desktop-entry.ts`.

**I want to add a new Socket.IO event**
→ Signal (server→client): add to `packages/shared/src/contracts/signals.ts`
→ Command (client→server): add to `packages/shared/src/contracts/commands.ts`
→ Then update `docs/signal-catalog.md`.

**I want to add an API endpoint**
→ Add a Fastify route in `packages/server/src/transport/http/`

**I want to add admin UI for an existing manager**
→ Add a page in `packages/admin/src/features/`. No server changes needed if the manager already emits diagnostics.

**I want to change how a manager works**
→ The canonical files are in `packages/server/src/kernel/managers/`.
→ The originals in `state/`, `ambiance/`, `events/`, `obs/`, `pov/` are kept for compatibility during migration.

---

## Architectural invariants

These are hard rules. Break them and the system's conceptual integrity degrades:

1. **Kernel never imports from overlay.** `@ieom/shared` is the only coupling.
2. **Widgets never import socket directly.** Use the DOM event bus or Zustand store.
3. **Engine types never depend on presentation types.** `domain/application.ts` ≠ `domain/desktop.ts`.
4. **Config never read from SQLite on the hot path.** Always from `RuntimeStateStore` or the in-memory cache.
5. **Managers communicate via `KernelBus`, not direct imports.**
6. **Single overlay instance.** The slot system is not optional.
7. **`@ieom/shared` has zero runtime.** Types and constants only.

---

## PR checklist

Before opening a PR:

- [ ] Does the change touch the signal contract? → Update `signal-catalog.md`
- [ ] Does the change add a manager? → Implements `Manager` interface? Registered in `desktop-entry.ts`?
- [ ] Does the change add a widget? → Registered in `widgetRegistry.ts`? Type in `application.ts`?
- [ ] Are architectural invariants respected? (see list above)
- [ ] No event names or payload shapes changed without a migration plan?
- [ ] No new runtime imports added to `@ieom/shared`?

---

## Dev setup

```bash
pnpm dev              # kernel + overlay + admin in watch mode
pnpm dev:desktop      # full Electron app (requires build first)
```

No environment variables required for local development. The system works fully offline.

See `.env.example` for optional cloud configuration.
