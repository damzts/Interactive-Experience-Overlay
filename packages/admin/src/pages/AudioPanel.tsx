import { useState, useEffect } from 'react'
import { useAdminStore } from '../store/useAdminStore'
import { Btn, Slider, ConfigSectionPanel } from '../components/ui'

export function AudioPanel() {
  const config = useAdminStore((s) => s.config)
  const saveConfig = useAdminStore((s) => s.saveConfig)

  const [audio, setAudio] = useState(() => ({ ...config.audio }))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Keep local state in sync if server pushes a config update
  useEffect(() => {
    setAudio({ ...config.audio })
  }, [config.audio])

  const handleSave = async () => {
    setSaving(true)
    await saveConfig({ audio })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="w-full max-w-none space-y-0 pt-1">
      <ConfigSectionPanel label="Volume Controls" first>
        <div className="space-y-2">
          <Slider label="Master Volume" value={audio.masterVolume}
            onChange={(v) => setAudio((a) => ({ ...a, masterVolume: v }))} />
          <Slider label="Music Volume" value={audio.musicVolume}
            onChange={(v) => setAudio((a) => ({ ...a, musicVolume: v }))} />
          <Slider label="SFX Volume" value={audio.sfxVolume}
            onChange={(v) => setAudio((a) => ({ ...a, sfxVolume: v }))} />
        </div>
        <Btn variant="primary" className="mt-4" onClick={handleSave} disabled={saving}>
          {saved ? '✔ Saved' : saving ? 'Saving…' : 'Apply Changes'}
        </Btn>
      </ConfigSectionPanel>

      <ConfigSectionPanel label="Mood to Music Mapping">
        <p className="text-xs text-zinc-400 mb-3">Each scene state maps to a music mood. Assign audio files/URLs per mood.</p>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left border-b border-zinc-700">
              <th className="pb-2 text-zinc-400 font-medium">State</th>
              <th className="pb-2 text-zinc-400 font-medium">Mood</th>
              <th className="pb-2 text-zinc-400 font-medium">Track</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['LOBBY', 'chill', 'Lo-fi, liquid, ambient'],
              ['GAMEPLAY', 'suspense', 'Tense, rhythmic'],
              ['TV', 'broadcast', 'Retro TV feel'],
              ['MUSIC', 'featured', 'Featured music'],
              ['ARCHIVE', 'ambient', 'Contemplative'],
            ].map(([state, mood, desc]) => (
              <tr key={state} className="border-b border-zinc-800">
                <td className="py-2 font-mono text-cyan-400 text-xs">{state}</td>
                <td className="py-2 text-zinc-300 text-xs">{mood}</td>
                <td className="py-2 text-zinc-500 text-xs italic">
                  {desc} <span className="text-zinc-600">(v2)</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ConfigSectionPanel>

      <ConfigSectionPanel label="SFX Library">
        <p className="text-xs text-zinc-400 mb-3">
          Place <code className="font-mono text-cyan-400">.wav</code> / <code className="font-mono text-cyan-400">.mp3</code> files in{' '}
          <code className="font-mono text-cyan-400">ieom/assets/sfx/</code> to enable sound effects.
        </p>
        {['startup', 'transition', 'death', 'victory', 'revive', 'glitch'].map((id) => (
          <div key={id} className="flex items-center gap-3 mb-2">
            <span className="w-24 text-xs font-mono text-zinc-300">{id}.wav</span>
            <button
              className="px-2.5 py-1 rounded bg-zinc-700 hover:bg-zinc-600 border border-zinc-600 text-xs text-zinc-100 transition-colors"
              onClick={() => {
                const audio = new Audio(`/assets/sfx/${id}.wav`)
                audio.volume = 0.5
                audio.play().catch(() => {})
              }}
            >
              ▶ Test
            </button>
          </div>
        ))}
      </ConfigSectionPanel>
    </div>
  )
}
