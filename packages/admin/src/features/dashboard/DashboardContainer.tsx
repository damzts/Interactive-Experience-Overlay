import { useCallback, useEffect, useMemo, useState } from 'react';
import { STATE, withDesktopAmbianceDefaults, withEffectStormsDefaults, DEFAULT_DESKTOP_THEME_DRIFT, type EventConfig, type Sequence, type DesktopThemeDriftConfig } from '@ieomlabs/shared';
import { useAdminStore } from '../../store/useAdminStore';
import { socket } from '../../socket/client';
import { fetchSequences } from '../../api/sequencesApi';
import { fetchRunningShowIds, runShow, cancelShow } from '../../api/showsApi';
import { fetchPresets, applyPreset } from '../../api/presetsApi';
import { DashboardOverview } from './DashboardOverview';
import type { DashboardPresetEntry } from './DashboardOverview';

/**
 * DashboardContainer — Connects the DashboardOverview kiosk grid to the
 * Zustand admin store and socket, wiring each tile to a real action
 * (scene switch, widget toggle, effect trigger, manager toggle).
 */
export function DashboardContainer() {
  // ─── Runtime state from socket events ───
  const currentState = useAdminStore((s) => s.currentState);
  const openWidgetIds = useAdminStore((s) => s.openWidgetIds);

  // ─── Config ───
  const applications = useAdminStore((s) => s.config.applications);
  const widgetLayouts = useAdminStore((s) => s.config.widgetLayouts ?? []);
  const scenesConfig = useAdminStore((s) => s.config.scenes);
  const sourceEvents = useAdminStore((s) => s.config.sourceEvents ?? []);
  const rawDesktopAmbiance = useAdminStore((s) => s.config.desktopAmbiance);
  const rawEffectStorms = useAdminStore((s) => s.config.effectStorms);
  const legacyEffectAmbiance = useAdminStore((s) => s.config.effectAmbiance);
  const effectStorms = withEffectStormsDefaults(rawEffectStorms, legacyEffectAmbiance);
  const saveConfig = useAdminStore((s) => s.saveConfig);
  const setLastError = useAdminStore((s) => s.setLastError);
  const shows = useAdminStore((s) => s.config.shows ?? []);
  const rawThemeDrift = useAdminStore((s) => s.config.desktopThemeDrift);
  const themeDrift: DesktopThemeDriftConfig = rawThemeDrift ?? DEFAULT_DESKTOP_THEME_DRIFT;
  const audioConfig = useAdminStore((s) => s.config.audio);
  const audioReactivity = audioConfig?.reactivity;

  // ─── Sequences (fetched separately — not part of AppConfig) ───
  const [sequences, setSequences] = useState<Sequence[]>([]);
  useEffect(() => {
    void fetchSequences().then(setSequences).catch(() => {});
  }, []);

  // ─── Shows: poll which ones are currently running ───
  const [runningShowIds, setRunningShowIds] = useState<string[]>([]);
  const refreshRunningShows = useCallback(() => {
    void fetchRunningShowIds().then(setRunningShowIds).catch(() => {});
  }, []);
  useEffect(() => {
    refreshRunningShows();
    const id = setInterval(refreshRunningShows, 3000);
    return () => clearInterval(id);
  }, [refreshRunningShows]);

  // ─── Presets (fetched separately — not part of AppConfig) ───
  const [presets, setPresets] = useState<DashboardPresetEntry[]>([]);
  useEffect(() => {
    void fetchPresets().then(setPresets).catch(() => {});
  }, []);

  const scenes = useMemo(() => {
    return Object.values(scenesConfig ?? {}).map((s) => ({
      id: s.id,
      label: s.label,
      icon: s.id === STATE.DESKTOP ? '🖥' : '🎬',
    }));
  }, [scenesConfig]);

  const aiAmbianceEnabled = withDesktopAmbianceDefaults(rawDesktopAmbiance).widgetSimulation.enabled;
  const effectStormsEnabled = effectStorms.some((storm) => storm.enabled);
  const themeRotationEnabled = themeDrift.enabled;
  const audioReactiveEnabled = audioReactivity?.enabled ?? false;

  const handleActivateScene = useCallback(
    (id: string) => {
      socket.emit('scene:change', id, (err: string | null) => {
        if (err) setLastError(err);
      });
    },
    [setLastError],
  );

  const handleToggleWidget = useCallback((appId: string) => {
    socket.emit('widget:toggle', appId);
  }, []);

  const handleApplyWidgetLayout = useCallback((layoutId: string) => {
    socket.emit('widget:layout:apply', layoutId);
  }, []);

  const handleTriggerEffect = useCallback((event: EventConfig) => {
    socket.emit('event:preview', event);
  }, []);

  const handleToggleEffectAuto = useCallback(
    (eventId: string) => {
      const next = sourceEvents.map((e) =>
        e.id === eventId ? { ...e, auto: { ...e.auto, enabled: !e.auto.enabled } } : e,
      );
      void saveConfig({ sourceEvents: next });
    },
    [sourceEvents, saveConfig],
  );

  const handleToggleAiAmbiance = useCallback(() => {
    const widgetSimulation = withDesktopAmbianceDefaults(rawDesktopAmbiance).widgetSimulation;
    void saveConfig({
      desktopAmbiance: { widgetSimulation: { ...widgetSimulation, enabled: !widgetSimulation.enabled } },
    });
  }, [rawDesktopAmbiance, saveConfig]);

  const handleToggleEffectStorms = useCallback(() => {
    // Dashboard summary tile — flips all storms together as a single
    // on/off switch. Per-storm control lives in Ambiance → Effect Storms.
    const next = !effectStorms.some((storm) => storm.enabled);
    void saveConfig({ effectStorms: effectStorms.map((storm) => ({ ...storm, enabled: next })) });
  }, [effectStorms, saveConfig]);

  const handleApplyPreset = useCallback((presetId: string) => {
    void applyPreset(presetId);
  }, []);

  const handleRunSequence = useCallback((sequenceId: string) => {
    const sequence = sequences.find((s) => s.id === sequenceId);
    if (sequence) socket.emit('transition:preview', sequence.steps);
  }, [sequences]);

  const handleToggleShow = useCallback((showId: string) => {
    if (runningShowIds.includes(showId)) {
      void cancelShow(showId).then(refreshRunningShows);
    } else {
      void runShow(showId).then(refreshRunningShows);
    }
  }, [runningShowIds, refreshRunningShows]);

  const handleToggleThemeRotation = useCallback(() => {
    void saveConfig({ desktopThemeDrift: { ...themeDrift, enabled: !themeDrift.enabled } });
  }, [themeDrift, saveConfig]);

  const handleToggleAudioReactive = useCallback(() => {
    const reactivity = audioReactivity ?? { enabled: false, source: 'internal' as const, sensitivity: 0.5, smoothing: 0.7 };
    void saveConfig({ audio: { ...audioConfig, reactivity: { ...reactivity, enabled: !reactivity.enabled } } });
  }, [audioConfig, audioReactivity, saveConfig]);

  return (
    <DashboardOverview
      scenes={scenes}
      currentSceneId={currentState}
      onActivateScene={handleActivateScene}
      applications={applications}
      openWidgetIds={openWidgetIds}
      onToggleWidget={handleToggleWidget}
      widgetLayouts={widgetLayouts}
      onApplyWidgetLayout={handleApplyWidgetLayout}
      events={sourceEvents}
      onTriggerEffect={handleTriggerEffect}
      onToggleEffectAuto={handleToggleEffectAuto}
      sequences={sequences}
      onRunSequence={handleRunSequence}
      shows={shows}
      runningShowIds={runningShowIds}
      onToggleShow={handleToggleShow}
      presets={presets}
      onApplyPreset={handleApplyPreset}
      aiAmbianceEnabled={aiAmbianceEnabled}
      onToggleAiAmbiance={handleToggleAiAmbiance}
      effectAmbianceEnabled={effectStormsEnabled}
      onToggleEffectAmbiance={handleToggleEffectStorms}
      themeRotationEnabled={themeRotationEnabled}
      onToggleThemeRotation={handleToggleThemeRotation}
      audioReactiveEnabled={audioReactiveEnabled}
      onToggleAudioReactive={handleToggleAudioReactive}
    />
  );
}
