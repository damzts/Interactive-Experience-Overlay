import { useCallback, useMemo } from 'react';
import { STATE, withDesktopAmbianceDefaults, withEffectStormsDefaults, type EventConfig } from '@ieomlabs/shared';
import { useAdminStore } from '../../store/useAdminStore';
import { socket } from '../../socket/client';
import { useLoadStarterPack } from '../../hooks/useLoadStarterPack';
import { DashboardOverview } from './DashboardOverview';

/**
 * DashboardContainer — Connects the DashboardOverview kiosk grid to the
 * Zustand admin store and socket, wiring each tile to a real action
 * (scene switch, widget toggle, effect trigger, manager toggle).
 */
export function DashboardContainer() {
  // ─── Runtime state from socket events ───
  const overlayOwnerSocketId = useAdminStore((s) => s.overlayOwnerSocketId);
  const obsConnected = useAdminStore((s) => s.obsConnected);
  const currentState = useAdminStore((s) => s.currentState);
  const clientCount = useAdminStore((s) => s.clientCount);
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
  const { loadStarterPack } = useLoadStarterPack();

  const overlayStatus: 'connected' | 'disconnected' =
    overlayOwnerSocketId != null ? 'connected' : 'disconnected';

  const obsStatus: 'connected' | 'disconnected' =
    obsConnected ? 'connected' : 'disconnected';

  const onlineRoomCount = clientCount;

  const scenes = useMemo(() => {
    return Object.values(scenesConfig ?? {}).map((s) => ({
      id: s.id,
      label: s.label,
      icon: s.id === STATE.DESKTOP ? '🖥' : '🎬',
    }));
  }, [scenesConfig]);

  const aiAmbianceEnabled = withDesktopAmbianceDefaults(rawDesktopAmbiance).widgetSimulation.enabled;
  const effectStormsEnabled = effectStorms.some((storm) => storm.enabled);

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

  const handleOpenOverlay = useCallback(() => {
    window.open('/', '_blank');
  }, []);

  return (
    <DashboardOverview
      overlayStatus={overlayStatus}
      obsStatus={obsStatus}
      onlineRoomCount={onlineRoomCount}
      onOpenOverlay={handleOpenOverlay}
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
      aiAmbianceEnabled={aiAmbianceEnabled}
      onToggleAiAmbiance={handleToggleAiAmbiance}
      effectAmbianceEnabled={effectStormsEnabled}
      onToggleEffectAmbiance={handleToggleEffectStorms}
      onLoadStarterPack={loadStarterPack}
    />
  );
}
