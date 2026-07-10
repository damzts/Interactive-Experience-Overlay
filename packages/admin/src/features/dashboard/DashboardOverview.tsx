import { useEffect, useRef, useState } from 'react';
import { Monitor, Wifi, Globe, Layers, Zap, Sparkles, LayoutGrid } from 'lucide-react';
import type { EventConfig } from '@ieomlabs/shared';
import { cn } from '../../utils/cn';
import { Card } from '../../components/molecules/Card';
import { StatusIndicator } from '../../components/molecules/StatusIndicator';
import { EmptyState } from '../../components/molecules/EmptyState';
import { Button } from '../../components/atoms/Button';
import { Toggle } from '../../components/atoms/Toggle';
import { IconGlyph } from '../../shared/ui';

/**
 * Hook that detects when a value changes and returns a transient
 * "just changed" flag that auto-resets after a short duration.
 * Used to trigger a one-shot pulse animation on state transitions.
 */
function useStateChangeFlash(value: string, durationMs = 600): boolean {
  const prevRef = useRef(value);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (prevRef.current !== value) {
      prevRef.current = value;
      setFlash(true);
      const timer = setTimeout(() => setFlash(false), durationMs);
      return () => clearTimeout(timer);
    }
  }, [value, durationMs]);

  return flash;
}

export interface DashboardSceneEntry {
  id: string;
  label: string;
  icon: string;
}

export interface DashboardAppEntry {
  id: string;
  label: string;
  icon: string;
}

export interface DashboardLayoutEntry {
  id: string;
  label: string;
  icon: string;
}

/**
 * DashboardOverview — Kiosk-mode control surface for the IEOM Admin Panel.
 *
 * A single screen of tap-tiles that fire real actions immediately: switch
 * scenes, open/close widgets, apply widget layouts, trigger saved effects,
 * and flip manager toggles — no drilling into other tabs required.
 */
export interface DashboardOverviewProps {
  overlayStatus?: 'connected' | 'disconnected';
  obsStatus?: 'connected' | 'disconnected';
  onlineRoomCount?: number;
  onOpenOverlay?: () => void;

  scenes: DashboardSceneEntry[];
  currentSceneId: string;
  onActivateScene: (id: string) => void;

  applications: DashboardAppEntry[];
  openWidgetIds: string[];
  onToggleWidget: (appId: string) => void;

  widgetLayouts: DashboardLayoutEntry[];
  onApplyWidgetLayout: (layoutId: string) => void;

  events: EventConfig[];
  onTriggerEffect: (event: EventConfig) => void;
  onToggleEffectAuto: (eventId: string) => void;

  aiAmbianceEnabled: boolean;
  onToggleAiAmbiance: () => void;
  effectAmbianceEnabled: boolean;
  onToggleEffectAmbiance: () => void;

  /** "Load starter pack" action offered on the Widget Layouts / Effects
   *  empty states — seeds a couple of example rows so a fresh install
   *  doesn't feel blank. See useLoadStarterPack. */
  onLoadStarterPack?: () => void;
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[11px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-[var(--space-2)]">
      {children}
    </h2>
  );
}

function TileGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-[var(--space-2)]">
      {children}
    </div>
  );
}

export function DashboardOverview({
  overlayStatus = 'disconnected',
  obsStatus = 'disconnected',
  onlineRoomCount = 0,
  onOpenOverlay,
  scenes,
  currentSceneId,
  onActivateScene,
  applications,
  openWidgetIds,
  onToggleWidget,
  widgetLayouts,
  onApplyWidgetLayout,
  events,
  onTriggerEffect,
  onToggleEffectAuto,
  aiAmbianceEnabled,
  onToggleAiAmbiance,
  effectAmbianceEnabled,
  onToggleEffectAmbiance,
  onLoadStarterPack,
}: DashboardOverviewProps) {
  const overlayFlash = useStateChangeFlash(overlayStatus);
  const obsFlash = useStateChangeFlash(obsStatus);
  const prevRoomCount = useRef(onlineRoomCount);
  const [roomFlash, setRoomFlash] = useState(false);

  useEffect(() => {
    if (prevRoomCount.current !== onlineRoomCount) {
      prevRoomCount.current = onlineRoomCount;
      setRoomFlash(true);
      const timer = setTimeout(() => setRoomFlash(false), 600);
      return () => clearTimeout(timer);
    }
  }, [onlineRoomCount]);

  return (
    <div className="flex flex-col gap-[var(--space-4)]">
      {/* ─── Status strip ─── */}
      <section aria-label="Connection status">
        <div className="flex flex-wrap items-center gap-[var(--space-3)] rounded-[var(--radius-lg)] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-[var(--space-3)] py-[var(--space-2)]">
          <div className={cn('flex items-center gap-[var(--space-2)]', overlayFlash && 'animate-highlight-flash')}>
            <Monitor className="h-3.5 w-3.5 text-[var(--color-text-muted)]" />
            <StatusIndicator status={overlayStatus} label={overlayStatus === 'connected' ? 'Overlay connected' : 'Overlay offline'} />
          </div>
          <div className={cn('flex items-center gap-[var(--space-2)]', obsFlash && 'animate-highlight-flash')}>
            <Wifi className="h-3.5 w-3.5 text-[var(--color-text-muted)]" />
            <StatusIndicator status={obsStatus} label={obsStatus === 'connected' ? 'OBS connected' : 'OBS offline'} />
          </div>
          <div className={cn('flex items-center gap-[var(--space-2)]', roomFlash && 'animate-highlight-flash')}>
            <Globe className="h-3.5 w-3.5 text-[var(--color-text-muted)]" />
            <span className="text-[var(--text-xs)] text-[var(--color-text-secondary)]">
              {onlineRoomCount} {onlineRoomCount === 1 ? 'room' : 'rooms'} active
            </span>
          </div>
          <Button variant="secondary" size="sm" icon={<Globe />} onClick={onOpenOverlay} className="ml-auto">
            Open Overlay
          </Button>
        </div>
      </section>

      {/* ─── Scenes ─── */}
      <section aria-label="Scenes">
        <SectionHeader>Scenes</SectionHeader>
        {scenes.length === 0 ? (
          <EmptyState icon={<Layers className="h-full w-full" />} title="No scenes configured" />
        ) : (
          <TileGrid>
            {scenes.map((scene) => {
              const isActive = scene.id === currentSceneId;
              return (
                <Card
                  key={scene.id}
                  variant="interactive"
                  padding="sm"
                  glow={isActive ? 'primary' : 'none'}
                  onClick={() => onActivateScene(scene.id)}
                  className={cn(
                    'flex flex-col items-center gap-[var(--space-1)] text-center animate-card-entrance',
                    isActive && 'border-[var(--color-primary-400)]',
                  )}
                >
                  <span className="text-lg leading-none">{scene.icon}</span>
                  <span className="text-[var(--text-xs)] font-medium text-[var(--color-text-primary)] truncate w-full">
                    {scene.label}
                  </span>
                  {isActive && (
                    <span className="text-[10px] font-medium text-[var(--color-primary-400)]">Live</span>
                  )}
                </Card>
              );
            })}
          </TileGrid>
        )}
      </section>

      {/* ─── Widgets ─── */}
      <section aria-label="Widgets">
        <SectionHeader>Widgets</SectionHeader>
        {applications.length === 0 ? (
          <EmptyState icon={<Monitor className="h-full w-full" />} title="No widgets configured" />
        ) : (
          <TileGrid>
            {applications.map((app) => {
              const isOpen = openWidgetIds.includes(app.id);
              return (
                <Card
                  key={app.id}
                  variant="interactive"
                  padding="sm"
                  glow={isOpen ? 'success' : 'none'}
                  onClick={() => onToggleWidget(app.id)}
                  className={cn(
                    'flex flex-col items-center gap-[var(--space-1)] text-center animate-card-entrance',
                    isOpen && 'border-[var(--color-success-400)]',
                  )}
                >
                  <IconGlyph icon={app.icon} label={app.label} size={20} />
                  <span className="text-[var(--text-xs)] font-medium text-[var(--color-text-primary)] truncate w-full">
                    {app.label}
                  </span>
                  {isOpen && (
                    <span className="text-[10px] font-medium text-[var(--color-success-400)]">Open</span>
                  )}
                </Card>
              );
            })}
          </TileGrid>
        )}
      </section>

      {/* ─── Widget Layouts ─── */}
      <section aria-label="Widget layouts">
        <SectionHeader>Widget Layouts</SectionHeader>
        {widgetLayouts.length === 0 ? (
          <EmptyState
            icon={<LayoutGrid className="h-full w-full" />}
            title="No widget layouts configured"
            description={onLoadStarterPack ? 'Load a starter pack to see an example layout.' : undefined}
            actionLabel={onLoadStarterPack ? 'Load starter pack' : undefined}
            onAction={onLoadStarterPack}
          />
        ) : (
          <TileGrid>
            {widgetLayouts.map((layout) => (
              <Card
                key={layout.id}
                variant="interactive"
                padding="sm"
                onClick={() => onApplyWidgetLayout(layout.id)}
                className="flex flex-col items-center gap-[var(--space-1)] text-center animate-card-entrance"
              >
                <span className="text-lg leading-none">{layout.icon}</span>
                <span className="text-[var(--text-xs)] font-medium text-[var(--color-text-primary)] truncate w-full">
                  {layout.label}
                </span>
              </Card>
            ))}
          </TileGrid>
        )}
      </section>

      {/* ─── Effects ─── */}
      <section aria-label="Effects">
        <SectionHeader>Effects</SectionHeader>
        {events.length === 0 ? (
          <EmptyState
            icon={<Zap className="h-full w-full" />}
            title="No saved effects"
            description={onLoadStarterPack ? 'Load a starter pack to see example effects.' : undefined}
            actionLabel={onLoadStarterPack ? 'Load starter pack' : undefined}
            onAction={onLoadStarterPack}
          />
        ) : (
          <TileGrid>
            {events.map((event) => (
              <Card
                key={event.id}
                variant="interactive"
                padding="sm"
                className="flex flex-col items-center gap-[var(--space-1)] text-center animate-card-entrance"
              >
                <button
                  type="button"
                  onClick={() => onTriggerEffect(event)}
                  className="flex w-full flex-col items-center gap-[var(--space-1)]"
                >
                  <span className={cn('text-lg leading-none', event.color)}>{event.icon}</span>
                  <span className="text-[var(--text-xs)] font-medium text-[var(--color-text-primary)] truncate w-full">
                    {event.label}
                  </span>
                </button>
                <Toggle
                  checked={event.auto.enabled}
                  onChange={() => onToggleEffectAuto(event.id)}
                  size="sm"
                  label="Auto"
                />
              </Card>
            ))}
          </TileGrid>
        )}
      </section>

      {/* ─── Manager toggles ─── */}
      <section aria-label="Manager toggles">
        <SectionHeader>Managers</SectionHeader>
        <div className="flex flex-wrap gap-[var(--space-2)]">
          <Card variant="default" padding="sm" className="flex items-center gap-[var(--space-2)]">
            <Sparkles className="h-3.5 w-3.5 text-[var(--color-text-muted)]" />
            <span className="text-[var(--text-xs)] text-[var(--color-text-primary)]">AI Ambiance</span>
            <Toggle checked={aiAmbianceEnabled} onChange={onToggleAiAmbiance} size="sm" />
          </Card>
          <Card variant="default" padding="sm" className="flex items-center gap-[var(--space-2)]">
            <Zap className="h-3.5 w-3.5 text-[var(--color-text-muted)]" />
            <span className="text-[var(--text-xs)] text-[var(--color-text-primary)]">Effect Ambiance</span>
            <Toggle checked={effectAmbianceEnabled} onChange={onToggleEffectAmbiance} size="sm" />
          </Card>
        </div>
      </section>
    </div>
  );
}
