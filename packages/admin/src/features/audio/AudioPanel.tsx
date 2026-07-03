import { useState, useEffect } from 'react'
import { useAdminStore } from '../../store/useAdminStore'
import { Slider, ConfigPageIntro, ConfigTable } from '../../shared/ui'
import { Button } from '../../components/atoms'
import { ConfigPanel } from '../../components/organisms'
import { MediaSelectionInput } from '../media-library/MediaLibrary'

/** Notice component for informational/warning messages within config panels */
function Notice({ tone = 'info', children }: { tone?: 'info' | 'warning' | 'danger' | 'success'; children: React.ReactNode }) {
  const toneStyles: Record<string, string> = {
    info: 'border-[var(--color-primary-400)]/25 bg-[var(--color-primary-500)]/10 text-[var(--color-primary-100)]',
    warning: 'border-[var(--color-accent-400)]/30 bg-[var(--color-accent-500)]/12 text-[var(--color-accent-100)]',
    danger: 'border-[var(--color-danger-400)]/30 bg-[var(--color-danger-500)]/12 text-[var(--color-danger-400)]',
    success: 'border-[var(--color-success-400)]/30 bg-[var(--color-success-500)]/12 text-[var(--color-success-400)]',
  }
  return (
    <div className={`rounded-[var(--radius-lg)] border px-3 py-2.5 text-sm shadow-[var(--shadow-sm)] backdrop-blur ${toneStyles[tone]}`}>
      {children}
    </div>
  )
}

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

      <div className="space-y-6 pt-3">
        <ConfigPanel title="Volume Controls" collapsible>
          <div className="space-y-4">
            <Notice>
              Volume changes affect the live overlay immediately after you apply them.
            </Notice>
            <div className="space-y-2">
              <Slider label="Master Volume" value={audio.masterVolume}
                onChange={(v) => setAudio((a) => ({ ...a, masterVolume: v }))} />
              <Slider label="Music Volume" value={audio.musicVolume}
                onChange={(v) => setAudio((a) => ({ ...a, musicVolume: v }))} />
              <Slider label="SFX Volume" value={audio.sfxVolume}
                onChange={(v) => setAudio((a) => ({ ...a, sfxVolume: v }))} />
              <Slider label="Ambient Volume" value={audio.ambientVolume ?? 0.6}
                onChange={(v) => setAudio((a) => ({ ...a, ambientVolume: v }))} />
            </div>
            <Button variant="primary" size="md" onClick={handleSave} disabled={saving}>
              {saved ? '✔ Saved' : saving ? 'Saving…' : 'Apply Changes'}
            </Button>
          </div>
        </ConfigPanel>

        <ConfigPanel title="Ambient Track" collapsible>
          <div className="space-y-4">
            <Notice>
              A global looping ambient layer (room tone, rain, crowd noise) that plays across every scene.
              A scene with its own ambient track overrides this while active.
            </Notice>
            <MediaSelectionInput
              value={audio.ambientTrack ?? ''}
              onChange={(url) => setAudio((a) => ({ ...a, ambientTrack: url }))}
              kinds={['audio']}
              modalTitle="Choose Ambient Track"
              placeholder="/assets/audio/room-tone.mp3 or https://…"
              hint="Loops continuously at the Ambient Volume level. Leave empty for silence."
            />
            <div className="flex items-center gap-3">
              <Button variant="primary" size="md" onClick={handleSave} disabled={saving}>
                {saved ? '✔ Saved' : saving ? 'Saving…' : 'Apply Changes'}
              </Button>
              {(audio.ambientTrack ?? '') !== '' && (
                <Button variant="ghost" size="md" onClick={() => setAudio((a) => ({ ...a, ambientTrack: '' }))}>
                  Clear Track
                </Button>
              )}
            </div>
          </div>
        </ConfigPanel>

        <ConfigPanel title="Mood to Music Mapping" collapsible>
          <div className="space-y-4">
            <Notice>
              Each runtime state resolves to a soundtrack mood bucket so scene changes keep a predictable audio identity.
            </Notice>
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
                      <td className="font-mono text-xs text-[var(--color-primary-300)]">{state}</td>
                      <td className="text-xs text-[var(--color-text-secondary)]">{mood}</td>
                      <td className="text-xs italic text-[var(--color-text-muted)]">
                        {desc} <span className="text-[var(--color-text-muted)]/60">(v2)</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ConfigTable>
          </div>
        </ConfigPanel>
      </div>
    </div>
  )
}
