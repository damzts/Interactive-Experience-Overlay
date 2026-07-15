> **AI Agent Notes**
> Focus on the data flow and configuration. Don't describe the IRC protocol in detail — the implementation is readable. Document why anonymous mode works and the two convergence paths into ChatWidget. If something here contradicts the code, the code wins — fix the doc.

---

# Twitch Chat

## Overview

Two managers handle Twitch:

- **`TwitchIntegrationManager`** (`kernel/managers/twitch.ts`) — connects to Twitch IRC for chat, and to EventSub for channel events (follow, subscribe, gift-sub, cheer, raid, points redemption, stream online/offline, hype train). Emits everything on the KernelBus.
- **`ChatReactionManager`** — sits on top, evaluates configured rules against every `chat:message`, and fires effects or actions when they match.

This doc focuses on the chat/IRC half. EventSub payloads (`twitch:follow`, `twitch:raid`, etc.) are cataloged in `docs/signal-catalog.md`.

---

## TwitchIntegrationManager (chat/IRC half)

### Connection

Connects to `wss://irc-ws.chat.twitch.tv:443` using the IRCv3 protocol.

**Anonymous (read-only):** Uses `justinfan<random>` as the nick with no password. Works for any public channel without OAuth — no credentials needed. This is the default when `twitch.accessToken` is absent.

**Authenticated:** Sends `PASS oauth:<accessToken>` before the nick. Required only if you need write access (sending chat) — the current implementation is read-only.

### Config

```ts
// AppConfig.twitch (persisted in twitch_config table)
{
  channel: string,       // channel name, without '#'
  accessToken?: string,  // stored in server only, never forwarded to overlay
  enabled: boolean
}
```

Set via the admin panel (**System → Twitch Chat**) or the config API: `POST /api/config/section { section: 'twitch', data: { channel: 'mychannel', enabled: true } }`.

The connection status dot in the admin panel is driven live by the `chat:connected` kernel signal (delivered over the generic `kernel:signal` channel — see below) — it turns green as soon as IRC JOIN is confirmed.

### What gets emitted

Every PRIVMSG parsed from Twitch IRC produces a `chat:message` event on `KernelBus`:

```ts
bus.emit('chat:message', {
  user:    string,   // display-name tag, falls back to IRC nick
  text:    string,   // message body
  color:   string,   // #RRGGBB from color tag, or '' if unset
  badges:  string[], // badge keys from badges tag, e.g. ['broadcaster/1', 'subscriber/0']
  channel: string,
  source:  'twitch'
})
```

`chat:message` is declared in the shared `KernelSignalMap` (`packages/shared/src/contracts/signals.ts`), so the generic kernel→client bridge (`transport/socket/handlers/kernelSignal.ts`) forwards it to every connected overlay client automatically as a `kernel:signal` BusFrame — there is no per-event bridge code to maintain. See `docs/signal-catalog.md` for the full domain-signal catalog and `docs/manager-authoring.md` for how to add a new one.

### Reconnect

Exponential backoff: `[5s, 10s, 30s, 60s, 120s]`. After the last tier it keeps retrying at 120s. Resets to 0 on a successful join.

`onConfigChange(config)` is called by `DesktopConfigService` on every config save. If the channel or token changed, the manager disconnects and reconnects.

---

## ChatWidget integration

`ChatWidget.tsx` receives messages from two convergent paths:

```
Twitch IRC
  → TwitchIntegrationManager
  → bus.emit('chat:message')
  → kernel:signal socket event (generic bridge)
  → onKernelSignal('chat:message') in ChatWidget → setMessages()

Admin simulate button
  → kernel simulate handler
  → bus.emit('chat:message', { source: 'simulation' })
  → kernel:signal socket event (generic bridge)
  → onKernelSignal('chat:message') in ChatWidget → setMessages()
```

Both paths produce identical `Message` objects in the widget. `source` field lets you distinguish real from simulated if needed.

After `setMessages`, the widget also calls `dispatchWidgetSignal({ source: appId, event: 'chat:message', payload: { message } })` — so automation rules can react to incoming chat.

---

## ChatReactionManager

Evaluates `AppConfig.chatReactions[]` against every `chat:message`. Each rule can define:

| Field | Type | Description |
|-------|------|-------------|
| `match.type` | `'keyword' \| 'command' \| 'regex'` | How to match the message text |
| `match.value` | string | The term to match |
| `effects?` | `EffectConfig[]` | Visual effects to fire |
| `actions?` | `EventAction[]` | Scene/widget actions to execute |
| `cooldownMs?` | number | Minimum ms between fires for this rule |

Match semantics:
- `keyword` — case-insensitive substring match
- `command` — text must start with `!value` (e.g. value `hype` matches `!hype ...`)
- `regex` — JS regex, case-insensitive flag added automatically

Dispatch goes through `scheduler:fired` so every `EventAction` kind (including `obs-stream`) works identically to any other scheduled event.

### Config example

```json
{
  "id": "hype-rule",
  "label": "!hype → fire glitch",
  "enabled": true,
  "match": { "type": "command", "value": "hype" },
  "effects": [{ "type": "glitch" }],
  "cooldownMs": 10000
}
```

Set via the admin panel (**System → Twitch Chat → Chat Reactions**) or: `POST /api/config/section { section: 'chatReactions', data: [...] }`.

The admin panel supports match type, match value, cooldown, and comma-separated effect types. For rules that also fire `EventAction` steps (widget commands, scene changes, etc.) use the config API directly.

---

## Key files

| File | Role |
|------|------|
| `packages/server/src/kernel/managers/twitch.ts` | `TwitchIntegrationManager` — IRC connection/parsing/reconnect + EventSub |
| `packages/shared/src/contracts/signals.ts` | `chat:message`, `chat:connected`, `twitch:*` entries in `KernelSignalMap` |
| `packages/server/src/kernel/managers/chatReactions.ts` | Rule evaluation, cooldown, dispatch |
| `packages/shared/src/domain/config.ts` | `TwitchConfig`, `ChatReactionMatch`, `ChatReactionRule` types |
| `packages/overlay/src/desktop/ChatWidget.tsx` | Receives `chat:message` via `onKernelSignal` |
| `packages/admin/src/features/twitch/TwitchPanel.tsx` | Admin panel (System → Twitch Chat) |
