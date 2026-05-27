import { useState, useEffect } from 'react'
import { useAdminStore } from '../../store/useAdminStore'
import { Btn, Slider, ConfigCard, ConfigNotice, ConfigPageIntro, ConfigSectionPanel, ConfigTable } from '../../shared/ui'

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
      <ConfigPageIntro title="Audio Configuration">
        Calibrate system levels, confirm the current music routing, and validate sound effects without leaving the admin dashboard.
      </ConfigPageIntro>

      <ConfigSectionPanel label="Volume Controls" first>
        <ConfigNotice>
          Volume changes affect the live overlay immediately after you apply them.
        </ConfigNotice>
        <div className="mt-4 space-y-2">
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
        <ConfigNotice>
          Each runtime state resolves to a soundtrack mood bucket so scene changes keep a predictable audio identity.
        </ConfigNotice>
        <ConfigTable className="mt-3">
          <table>
            <thead>
              <tr>
                <th>State</th>
                <th>Mood</th>
                <th>Track Direction</th>
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
                <tr key={state}>
                  <td className="font-mono text-xs text-cyan-300">{state}</td>
                  <td className="text-xs text-zinc-300">{mood}</td>
                  <td className="text-xs italic text-zinc-500">
                    {desc} <span className="text-zinc-600">(v2)</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ConfigTable>
      </ConfigSectionPanel>

      <ConfigSectionPanel label="SFX Library">
        <ConfigNotice>
          Place <span className="admin-inline-code">.wav</span> or <span className="admin-inline-code">.mp3</span> files in <span className="admin-inline-code">assets/sfx/</span> to make them available to the runtime.
        </ConfigNotice>
        <div className="mt-3 space-y-2">
          {['startup', 'transition', 'death', 'victory', 'revive', 'glitch'].map((id) => (
            <ConfigCard key={id} className="flex items-center gap-3">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-zinc-800/80 bg-zinc-900/80 text-sm text-cyan-200">
                  ♪
                </div>
                <div className="min-w-0">
                  <div className="truncate text-xs font-semibold text-zinc-200">{id}.wav</div>
                  <div className="text-[11px] text-zinc-500">Preview the current effect asset.</div>
                </div>
              </div>
              <Btn
                onClick={() => {
                  const audio = new Audio(`/assets/sfx/${id}.wav`)
                  audio.volume = 0.5
                  audio.play().catch(() => {})
                }}
              >
                Test
              </Btn>
            </ConfigCard>
          ))}
        </div>
      </ConfigSectionPanel>
    </div>
  )
}
