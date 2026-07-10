/**
 * Persona — chat-to-voice companion.
 *
 * Bridges Twitch chat to the stream: an occasional chat message is picked
 * (per triggerMode below), synthesized to speech server-side (TtsService),
 * and played in the overlay through a client-side robotic voice filter
 * (AudioEngine.playPersonaLine) alongside a caption bubble — so the
 * streamer can react to a "voice" instead of just reading text.
 */

export interface PersonaVoiceConfig {
  /** Pitch shift applied client-side, in semitones. Positive = higher/more childlike. */
  pitchSemitones: number
  /** 0–1 — blend of the ring-modulated "robotic" signal vs the dry TTS voice. */
  roboticIntensity: number
  /** Speech rate passed to the synthesizer, -10..10 (SAPI convention, 0 = normal). */
  rate: number
  /** Provider-specific voice name (e.g. an installed SAPI voice). Omit = provider default. */
  ttsVoice?: string
}

/** On-screen character art for the persona — a transparent png/webp that
 *  appears on the overlay and moves with the live voice amplitude. Always
 *  active (cannot be disabled) — an empty `images` list is what makes the
 *  avatar not render, not a separate toggle. */
export interface PersonaAvatarConfig {
  /** 'pop-in': slides in while speaking, lingers, leaves. 'persistent': always on screen. */
  mode: 'pop-in' | 'persistent'
  /** Root-relative image URLs (e.g. '/assets/persona/ene/Ene_Anime.webp').
   *  A random pose is picked per appearance. Empty = avatar never shows. */
  images: string[]
  corner: 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right'
  /** Rendered image width in pixels. */
  widthPx: number
  /** Pop-in mode: how long she stays after speech ends, in milliseconds. */
  lingerMs: number
}

/** A named, reusable avatar built in Graphics → Avatar (media_renders-style
 *  asset, not tied to any one persona profile) — Persona profiles reference
 *  one of these by id instead of embedding an avatar config inline. */
export interface AvatarPreset extends PersonaAvatarConfig {
  id: string
  name: string
}

/** A spoken reaction to a kernel event — the persona announces raids,
 *  scene changes, silence, anything on the bus. */
export interface PersonaEventLine {
  /** Kernel bus event to react to (e.g. 'twitch:raid', 'scene:changed', 'audio:silence'). */
  event: string
  /** Spoken template. {field} placeholders resolve from the event payload,
   *  e.g. "welcome raiders from {from}!" */
  template: string
  /** Probability 0–1 of speaking when the event fires. Default 1. */
  chance?: number
  /** Default true. */
  enabled?: boolean
}

/** The persona's brain — an LLM that summarizes chat for the streamer,
 *  chats with the streamer (admin console), and can generate real replies
 *  to viewers. The Anthropic API key lives in the ANTHROPIC_API_KEY env
 *  var, never in config (config is broadcast to clients). Per-profile —
 *  each named identity can have its own personality/provider. */
export interface PersonaBrainConfig {
  enabled: boolean
  /** 'anthropic' (cloud, needs ANTHROPIC_API_KEY) or 'ollama' (local). */
  provider: 'anthropic' | 'ollama'
  /** Model name; '' = provider default (claude-haiku-4-5 / llama3.2). */
  model: string
  ollamaUrl: string
  /** System-prompt personality description. */
  personality: string
  /** Trigger-selected chat goes through the LLM instead of being echoed. */
  replyToViewers: boolean
  /** When true (and replyToViewers is on), the LLM reply is also posted
   *  back to Twitch chat via TwitchIntegrationManager.sendMessage — not
   *  just spoken over the overlay. Requires config.twitch.accessToken with
   *  the chat:edit scope; silently does nothing without it. Off by default:
   *  speaking is a local overlay effect, posting to chat is publicly
   *  visible and should be an explicit opt-in. */
  postRepliesToChat: boolean
  /** Spoken replies/summaries are truncated to this length. */
  maxReplyChars: number
  /** Speak a chat summary every N minutes. 0 = off. */
  summaryIntervalMin: number
  /** Skip interval summaries when fewer new messages arrived. */
  summaryMinMessages: number
}

/** A named persona identity — who she is (voice, avatar reference, and
 *  brain) plus her own behavior config. One profile is active at a time;
 *  activating a profile flattens all of this onto PersonaConfig's top-level
 *  fields (see withPersonaDefaults) so existing consumers keep reading
 *  flat fields without knowing profiles exist. */
export interface PersonaProfile {
  id: string
  name: string
  /** TTS backend id ('sapi' built-in). Omit = 'sapi'. */
  ttsProvider?: string
  voice: PersonaVoiceConfig
  /** References an AppConfig.avatarPresets entry by id. Unset/deleted
   *  preset = no avatar (falls back to empty images, i.e. never shows). */
  avatarPresetId?: string
  brain: PersonaBrainConfig
  /** 'all': every message is a candidate. 'keyword'/'command': only matching messages.
   *  'chance': every message rolls against `chance`. */
  triggerMode: 'all' | 'keyword' | 'command' | 'chance'
  /** Keyword substring or command name (without '!'), required for those trigger modes. */
  triggerValue?: string
  /** Probability 0–1 a message is selected, used when triggerMode is 'chance'. */
  chance?: number
  /** Minimum milliseconds between spoken lines. */
  cooldownMs: number
  /** Chat messages longer than this are truncated before synthesis. */
  maxChars: number
  /** How much to attenuate music/ambient layers while speaking (0 = none, 1 = silence). */
  duckAmount: number
  /** Spoken reactions to kernel events (independent of chat triggerMode;
   *  shares the same cooldown). */
  eventLines: PersonaEventLine[]
}

export interface PersonaConfig {
  enabled: boolean
  /** 'all': every message is a candidate. 'keyword'/'command': only matching messages.
   *  'chance': every message rolls against `chance`. (Resolved from the
   *  active profile — see withPersonaDefaults.) */
  triggerMode: 'all' | 'keyword' | 'command' | 'chance'
  /** Keyword substring or command name (without '!'), required for those trigger modes. */
  triggerValue?: string
  /** Probability 0–1 a message is selected, used when triggerMode is 'chance'. */
  chance?: number
  /** Minimum milliseconds between spoken lines. */
  cooldownMs: number
  /** Chat messages longer than this are truncated before synthesis. */
  maxChars: number
  /** How much to attenuate music/ambient layers while speaking (0 = none, 1 = silence). */
  duckAmount: number
  /** TTS backend id ('sapi' built-in; others register via TtsService). Omit = 'sapi'. */
  ttsProvider?: string
  /** Spoken reactions to kernel events (independent of chat triggerMode;
   *  shares the same cooldown). */
  eventLines: PersonaEventLine[]
  /** Resolved identity of the ACTIVE profile — withPersonaDefaults flattens
   *  the active profile onto voice/avatar/ttsProvider/brain/triggerMode/etc,
   *  so consumers read these flat fields and never touch profiles directly. */
  voice: PersonaVoiceConfig
  /** On-screen character art shown while the persona speaks (active
   *  profile's referenced avatar preset, flattened). */
  avatar: PersonaAvatarConfig
  /** Named identities — a profile is Config (trigger/cooldown/voice/event
   *  lines) + Avatar (by reference) + Brain, selected as a unit. Empty = a
   *  'default' profile is synthesized from the legacy flat fields on
   *  resolution. */
  profiles: PersonaProfile[]
  /** Which profile is live. */
  activeProfileId: string
  /** LLM brain (summaries, console, viewer replies) — resolved from the
   *  active profile. */
  brain: PersonaBrainConfig
}
