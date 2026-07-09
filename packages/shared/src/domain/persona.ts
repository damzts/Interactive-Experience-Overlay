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

export interface PersonaConfig {
  enabled: boolean
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
  /** TTS backend id ('sapi' built-in; others register via TtsService). Omit = 'sapi'. */
  ttsProvider?: string
  /** Spoken reactions to kernel events (independent of chat triggerMode;
   *  shares the same cooldown). */
  eventLines: PersonaEventLine[]
  voice: PersonaVoiceConfig
}
