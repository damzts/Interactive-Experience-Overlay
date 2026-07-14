import { SchedulerPanel } from './SchedulerPanel'
import { PresetRotationPanel } from './PresetRotationPanel'
import { EffectAmbiancePanel } from './EffectAmbiancePanel'
import { ThemeDriftPanel } from './ThemeDriftPanel'
import { PersonaPanel } from './PersonaPanel'
import { DesktopAmbiancePanel } from './DesktopAmbiancePanel'

export type SchedulerTab = 'events' | 'preset-rotation' | 'effect-ambiance' | 'theme-drift' | 'persona' | 'desktop-ambiance'

export const SCHEDULER_TABS: Array<{ tab: SchedulerTab; icon: string; label: string }> = [
  { tab: 'events',            icon: '⏱', label: 'Scheduler' },
  { tab: 'preset-rotation',   icon: '💾', label: 'Preset Rotation' },
  { tab: 'effect-ambiance',   icon: '🌩', label: 'Effect Storms' },
  { tab: 'theme-drift',       icon: '🎨', label: 'Theme Rotation' },
  { tab: 'desktop-ambiance',  icon: '🖱', label: 'Desktop Interaction' },
  { tab: 'persona',           icon: '🗣', label: 'Persona' },
]

export function SchedulerHost({ tab, onTabChange, onOpenAvatar }: {
  tab: SchedulerTab
  onTabChange: (tab: SchedulerTab) => void
  onOpenAvatar?: () => void
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center border-b border-[var(--color-border-default)]">
        {SCHEDULER_TABS.map(({ tab: t, icon, label }) => (
          <button
            key={t}
            type="button"
            onClick={() => onTabChange(t)}
            className={
              '-mb-px flex items-center gap-1.5 border-b-2 px-3 pb-2.5 pt-2 text-xs font-medium transition-colors ' +
              (tab === t
                ? 'border-cyan-400 text-zinc-50'
                : 'border-transparent text-zinc-500 hover:text-zinc-200')
            }
          >
            <span className="text-sm leading-none">{icon}</span>
            <span>{label}</span>
          </button>
        ))}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto pt-4">
        {tab === 'events' && <SchedulerPanel />}
        {tab === 'preset-rotation' && <PresetRotationPanel />}
        {tab === 'effect-ambiance' && <EffectAmbiancePanel />}
        {tab === 'theme-drift' && <ThemeDriftPanel />}
        {tab === 'persona' && <PersonaPanel onOpenAvatar={onOpenAvatar} />}
        {tab === 'desktop-ambiance' && <DesktopAmbiancePanel />}
      </div>
    </div>
  )
}
