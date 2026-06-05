import { useState, useEffect } from 'react'
import { useAdminStore } from '../../store/useAdminStore'
import { Slider, ConfigPageIntro, ConfigTable } from '../../shared/ui'
import { Button } from '../../components/atoms'
import { Card } from '../../components/molecules'
import { ConfigPanel } from '../../components/organisms'

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
            </div>
            <Button variant="primary" size="md" onClick={handleSave} disabled={saving}>
              {saved ? '✔ Saved' : saving ? 'Saving…' : 'Apply Changes'}
            </Button>
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

        <ConfigPanel title="SFX Library" collapsible>
          <div className="space-y-4">
            <Notice>
              Place <span className="admin-inline-code">.wav</span> or <span className="admin-inline-code">.mp3</span> files in <span className="admin-inline-code">assets/sfx/</span> to make them available to the runtime.
            </Notice>
            <div className="space-y-2">
              {['startup', 'transition', 'death', 'victory', 'revive', 'glitch'].map((id) => (
                <Card key={id} variant="default" padding="sm" className="flex items-center gap-3">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-bg-base)] text-sm text-[var(--color-primary-200)]">
                      ♪
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-xs font-semibold text-[var(--color-text-primary)]">{id}.wav</div>
                      <div className="text-[11px] text-[var(--color-text-muted)]">Preview the current effect asset.</div>
                    </div>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      const audio = new Audio(`/assets/sfx/${id}.wav`)
                      audio.volume = 0.5
                      audio.play().catch(() => {})
                    }}
                  >
                    Test
                  </Button>
                </Card>
              ))}
            </div>
          </div>
        </ConfigPanel>
      </div>
    </div>
  )
}
