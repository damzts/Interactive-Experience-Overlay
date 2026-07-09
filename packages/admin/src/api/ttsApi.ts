import { apiFetch } from './client.js'

/** Voice names the server's TTS backend can speak with (SAPI installed voices). */
export async function getTtsVoices(provider?: string): Promise<string[]> {
  const query = provider ? `?provider=${encodeURIComponent(provider)}` : ''
  const json = await apiFetch<{ voices: string[] }>(`/api/tts/voices${query}`)
  return Array.isArray(json.voices) ? json.voices : []
}
