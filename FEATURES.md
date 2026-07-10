# Features & Implementation Details

> **AI Agent Notes**
> This file is an index only — it has no content of its own. [ARCHITECTURE.md](ARCHITECTURE.md) is the single source of truth for the conceptual system model; the files below go one level deeper on a specific feature.
> Do NOT add file paths, function names, or code structure here — those belong in the linked docs, not the index.
> When modifying a feature's implementation, find the relevant doc and check whether the flow or constraint described still holds. Update or delete stale sections — incorrect docs are worse than no docs.
> If something here contradicts the code, the code wins — fix the doc.

---

## docs/

| File | Covers |
|---|---|
| [engine-overview.md](docs/engine-overview.md) | What the engine does, the engine/presentation boundary, the Desktop OS as one interpretation, adding a second overlay |
| [state-management.md](docs/state-management.md) | Config persistence vs runtime state, the ownership rule, client-side Zustand slice split, reconnect recovery |
| [socket-handlers.md](docs/socket-handlers.md) | Domain module split rationale, HandlerContext pattern, overlay slot gate, domain boundary rules |
| [signal-catalog.md](docs/signal-catalog.md) | Full Socket.IO signal/command/query catalog between kernel and userspace |
| [auth-flow.md](docs/auth-flow.md) | Web and desktop OAuth flows, why auth delegates to the cloud, Vite proxy split, key config |
| [webrtc-online-rooms.md](docs/webrtc-online-rooms.md) | SFU architecture, cloud rooms, LAN join, POV pipeline, overlay relay, ICE ordering constraint, werift gotchas |
| [online-rooms-admin-guide.md](docs/online-rooms-admin-guide.md) | Operator guide for tuning and troubleshooting Online Rooms (not an architecture doc) |
| [twitch-chat.md](docs/twitch-chat.md) | Twitch IRC + EventSub integration, chat reactions, the two paths into `ChatWidget` |
| [automation-rules.md](docs/automation-rules.md) | Unified any-signal → any-action rule engine, signal/action manifests, dual-site evaluation |
| [show-sequencer.md](docs/show-sequencer.md) | Scripted multi-step show pipelines and their dispatch path |
| [widget-authoring.md](docs/widget-authoring.md) | How to write a new widget, local state vs server config, simulation intents, the three-file checklist |
| [widget-communication.md](docs/widget-communication.md) | Widget-to-widget pub/sub, the DOM intent bus, the server-mediated signal path, the full ambiance reactive loop |
| [manager-authoring.md](docs/manager-authoring.md) | How to add a new kernel manager, bus event declarations, making an event public |
| [admin-engine-pages.md](docs/admin-engine-pages.md) | Panel-to-table ownership map, DB table inventory, routing checklist |
| [architecture-debt.md](docs/architecture-debt.md) | Historical gap-analysis of the engine's "lego" composability goal — a dated record, not living documentation |
