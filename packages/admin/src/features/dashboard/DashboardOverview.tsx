import { useEffect, useRef, useState } from 'react';
import { Monitor, Wifi, Globe, Layers, Zap, LayoutGrid, Film, Clapperboard, BookmarkCheck, MousePointer2, Palette, AudioLines } from 'lucide-react';
import type { EventConfig } from '@ieomlabs/shared';
import { cn } from '../../utils/cn';
import { Card } from '../../components/molecules/Card';
import { StatusIndicator } from '../../components/molecules/StatusIndicator';
import { EmptyState } from '../../components/molecules/EmptyState';
import { Button } from '../../components/atoms/Button';
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

export interface DashboardSequenceEntry {
  id: string;
  label: string;
}

export interface DashboardShowEntry {
  id: string;
  label: string;
}

export interface DashboardPresetEntry {
  id: string;
  label: string;
}

/**
 * DashboardOverview — Kiosk-mode control surface for the IEOM Admin Panel.
 *
 * A single dense screen of tap-tiles that fire real actions immediately:
 * switch scenes, open/close widgets, apply widget layouts/sequences/shows/
 * presets, trigger saved effects, and flip manager toggles — no drilling
 * into other tabs required. Every tile is itself the button (no separate
 * switches); active state is shown purely via glow + a compact status dot.
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

  sequences: DashboardSequenceEntry[];
  onRunSequence: (sequenceId: string) => void;

  shows: DashboardShowEntry[];
  runningShowIds: string[];
  onToggleShow: (showId: string) => void;

  presets: DashboardPresetEntry[];
  onApplyPreset: (presetId: string) => void;

  aiAmbianceEnabled: boolean;
  onToggleAiAmbiance: () => void;
  effectAmbianceEnabled: boolean;
  onToggleEffectAmbiance: () => void;
  themeRotationEnabled: boolean;
  onToggleThemeRotation: () => void;
  audioReactiveEnabled: boolean;
  onToggleAudioReactive: () => void;
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[9px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-1 leading-none">
      {children}
    </h2>
  );
}

function TileGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 xl:grid-cols-14 gap-1">
      {children}
    </div>
  );
}

/** Compact tap-tile shared by every dashboard grid — icon + label, active
 *  state communicated purely by glow/border (no separate status text) so
 *  each tile stays a single dense row. */
function Tile({
  active,
  glow = 'primary',
  onClick,
  icon,
  label,
}: {
  active?: boolean;
  glow?: 'primary' | 'success';
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Card
      variant="interactive"
      padding="xs"
      glow={active ? glow : 'none'}
      onClick={onClick}
      className={cn(
        'flex flex-col items-center gap-0.5 text-center animate-card-entrance',
        active && (glow === 'success' ? 'border-[var(--color-success-400)]' : 'border-[var(--color-primary-400)]'),
      )}
    >
      {icon}
      <span className="text-[10px] font-medium leading-tight text-[var(--color-text-primary)] line-clamp-2 w-full">
        {label}
      </span>
    </Card>
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
  sequences,
  onRunSequence,
  shows,
  runningShowIds,
  onToggleShow,
  presets,
  onApplyPreset,
  aiAmbianceEnabled,
  onToggleAiAmbiance,
  effectAmbianceEnabled,
  onToggleEffectAmbiance,
  themeRotationEnabled,
  onToggleThemeRotation,
  audioReactiveEnabled,
  onToggleAudioReactive,
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

  const managers: Array<{ id: string; label: string; icon: React.ReactNode; enabled: boolean; onToggle: () => void }> = [
    { id: 'desktop-interaction', label: 'Desktop Interaction', icon: <MousePointer2 className="h-3.5 w-3.5 text-[var(--color-text-muted)]" />, enabled: aiAmbianceEnabled, onToggle: onToggleAiAmbiance },
    { id: 'effect-storms', label: 'Effect Storms', icon: <Zap className="h-3.5 w-3.5 text-[var(--color-text-muted)]" />, enabled: effectAmbianceEnabled, onToggle: onToggleEffectAmbiance },
    { id: 'theme-rotation', label: 'Theme Rotation', icon: <Palette className="h-3.5 w-3.5 text-[var(--color-text-muted)]" />, enabled: themeRotationEnabled, onToggle: onToggleThemeRotation },
    { id: 'audio-reactive', label: 'Audio Reactive', icon: <AudioLines className="h-3.5 w-3.5 text-[var(--color-text-muted)]" />, enabled: audioReactiveEnabled, onToggle: onToggleAudioReactive },
  ];

  return (
    <div className="flex flex-col gap-2">
      {/* ─── Status strip ─── */}
      <section aria-label="Connection status">
        <div className="flex flex-wrap items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-3 py-1.5">
          <div className={cn('flex items-center gap-1.5', overlayFlash && 'animate-highlight-flash')}>
            <Monitor className="h-3.5 w-3.5 text-[var(--color-text-muted)]" />
            <StatusIndicator status={overlayStatus} label={overlayStatus === 'connected' ? 'Overlay connected' : 'Overlay offline'} />
          </div>
          <div className={cn('flex items-center gap-1.5', obsFlash && 'animate-highlight-flash')}>
            <Wifi className="h-3.5 w-3.5 text-[var(--color-text-muted)]" />
            <StatusIndicator status={obsStatus} label={obsStatus === 'connected' ? 'OBS connected' : 'OBS offline'} />
          </div>
          <div className={cn('flex items-center gap-1.5', roomFlash && 'animate-highlight-flash')}>
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
            {scenes.map((scene) => (
              <Tile
                key={scene.id}
                active={scene.id === currentSceneId}
                onClick={() => onActivateScene(scene.id)}
                icon={<span className="text-base leading-none">{scene.icon}</span>}
                label={scene.label}
              />
            ))}
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
            {applications.map((app) => (
              <Tile
                key={app.id}
                active={openWidgetIds.includes(app.id)}
                glow="success"
                onClick={() => onToggleWidget(app.id)}
                icon={<IconGlyph icon={app.icon} label={app.label} size={16} />}
                label={app.label}
              />
            ))}
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
          />
        ) : (
          <TileGrid>
            {widgetLayouts.map((layout) => (
              <Tile
                key={layout.id}
                onClick={() => onApplyWidgetLayout(layout.id)}
                icon={<span className="text-base leading-none">{layout.icon}</span>}
                label={layout.label}
              />
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
          />
        ) : (
          <TileGrid>
            {events.map((event) => (
              <Card
                key={event.id}
                variant="interactive"
                padding="xs"
                glow={event.auto.enabled ? 'success' : 'none'}
                onClick={() => onTriggerEffect(event)}
                className={cn(
                  'flex flex-col items-center gap-0.5 text-center animate-card-entrance',
                  event.auto.enabled && 'border-[var(--color-success-400)]',
                )}
              >
                <span className={cn('text-base leading-none', event.color)}>{event.icon}</span>
                <span className="text-[10px] font-medium leading-tight text-[var(--color-text-primary)] line-clamp-2 w-full">
                  {event.label}
                </span>
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => { e.stopPropagation(); onToggleEffectAuto(event.id); }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.stopPropagation();
                      e.preventDefault();
                      onToggleEffectAuto(event.id);
                    }
                  }}
                  className={cn(
                    'text-[9px] font-medium leading-none',
                    event.auto.enabled ? 'text-[var(--color-success-400)]' : 'text-[var(--color-text-muted)]',
                  )}
                >
                  Auto: {event.auto.enabled ? 'On' : 'Off'}
                </span>
              </Card>
            ))}
          </TileGrid>
        )}
      </section>

      {/* ─── Sequences ─── */}
      <section aria-label="Sequences">
        <SectionHeader>Sequences</SectionHeader>
        {sequences.length === 0 ? (
          <EmptyState icon={<Film className="h-full w-full" />} title="No sequences configured" />
        ) : (
          <TileGrid>
            {sequences.map((sequence) => (
              <Tile
                key={sequence.id}
                onClick={() => onRunSequence(sequence.id)}
                icon={<Film className="h-3.5 w-3.5 text-[var(--color-text-muted)]" />}
                label={sequence.label}
              />
            ))}
          </TileGrid>
        )}
      </section>

      {/* ─── Shows ─── */}
      <section aria-label="Shows">
        <SectionHeader>Shows</SectionHeader>
        {shows.length === 0 ? (
          <EmptyState icon={<Clapperboard className="h-full w-full" />} title="No shows configured" />
        ) : (
          <TileGrid>
            {shows.map((show) => (
              <Tile
                key={show.id}
                active={runningShowIds.includes(show.id)}
                onClick={() => onToggleShow(show.id)}
                icon={<Clapperboard className="h-3.5 w-3.5 text-[var(--color-text-muted)]" />}
                label={show.label}
              />
            ))}
          </TileGrid>
        )}
      </section>

      {/* ─── Presets ─── */}
      <section aria-label="Presets">
        <SectionHeader>Presets</SectionHeader>
        {presets.length === 0 ? (
          <EmptyState icon={<BookmarkCheck className="h-full w-full" />} title="No presets saved" />
        ) : (
          <TileGrid>
            {presets.map((preset) => (
              <Tile
                key={preset.id}
                onClick={() => onApplyPreset(preset.id)}
                icon={<BookmarkCheck className="h-3.5 w-3.5 text-[var(--color-text-muted)]" />}
                label={preset.label}
              />
            ))}
          </TileGrid>
        )}
      </section>

      {/* ─── Manager toggles ─── */}
      <section aria-label="Manager toggles">
        <SectionHeader>Managers</SectionHeader>
        <TileGrid>
          {managers.map((m) => (
            <Tile
              key={m.id}
              active={m.enabled}
              glow="success"
              onClick={m.onToggle}
              icon={m.icon}
              label={m.label}
            />
          ))}
        </TileGrid>
      </section>
    </div>
  );
}
