> **AI Agent Notes**
> Focus on the data flow and configuration. Don't describe the IRC protocol in detail — the implementation is readable. Document why anonymous mode works and the two convergence paths into ChatWidget.

---

# Twitch Chat

## Overview

Two managers handle Twitch chat:

- **`TwitchChatManager`** — connects to Twitch IRC, parses messages, emits them on the KernelBus.
- **`ChatReactionManager`** — sits on top, evaluates configured rules against every `chat:message`, and fires effects or actions when they match.

---

## TwitchChatManager

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

Set via the config API: `POST /api/config/section { section: 'twitch', data: { channel: 'mychannel', enabled: true } }`.

### What gets emitted

Every PRIVMSG parsed from Twitch IRC produces a `chat:message` event on `KernelBus`:

```ts
bus.emitCustom('chat:message', {
  user:    string,   // display-name tag, falls back to IRC nick
  text:    string,   // message body
  color:   string,   // #RRGGBB from color tag, or '' if unset
  badges:  string[], // badge keys from badges tag, e.g. ['broadcaster/1', 'subscriber/0']
  channel: string,
  source:  'twitch'
})
```

`KernelBus.emitCustom` automatically forwards this to every connected overlay client as a `bus:custom` Socket.IO event.

### Reconnect

Exponential backoff: `[5s, 10s, 30s, 60s, 120s]`. After the last tier it keeps retrying at 120s. Resets to 0 on a successful join.

`onConfigChange(config)` is called by `DesktopConfigService` on every config save. If the channel or token changed, the manager disconnects and reconnects.

---

## ChatWidget integration

`ChatWidget.tsx` receives messages from two convergent paths:

```
Twitch IRC
  → TwitchChatManager
  → bus.emitCustom('chat:message')
  → bus:custom socket event
  → ChatWidget useEffect → setMessages()

Admin simulate button
  → kernel simulate handler
  → bus.emitCustom('chat:message', { source: 'simulation' })
  → bus:custom socket event
  → ChatWidget useEffect → setMessages()
```

Both paths produce identical `Message` objects in the widget. `source` field lets you distinguish real from simulated if needed.

After `setMessages`, the widget also calls `dispatchWidgetSignal({ source: appId, event: 'chat:message', payload: { message } })` — so widget wires can react to incoming chat.

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

Set via: `POST /api/config/section { section: 'chatReactions', data: [...] }`.

---

## Key files

| File | Role |
|------|------|
| `packages/server/src/kernel/managers/twitchChat.ts` | IRC connection, parsing, reconnect |
| `packages/server/src/kernel/managers/twitchChat.signals.ts` | `chat:message`, `chat:connected` KernelEvents augmentation |
| `packages/server/src/kernel/managers/chatReactions.ts` | Rule evaluation, cooldown, dispatch |
| `packages/shared/src/domain/config.ts` | `TwitchConfig`, `ChatReactionMatch`, `ChatReactionRule` types |
| `packages/overlay/src/desktop/ChatWidget.tsx` | Receives `bus:custom` chat:message events |
