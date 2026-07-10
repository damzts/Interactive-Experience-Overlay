import { useCallback } from 'react';
import { buildStarterPackSections, STARTER_PACK_PRESET_LABEL, type AppConfig } from '@ieomlabs/shared';
import { useAdminStore } from '../store/useAdminStore';
import { savePreset } from '../api/presetsApi';
import { useToast } from './useToast';

/**
 * Loads the shared starter content pack (see @ieomlabs/shared's
 * buildStarterPackSections): a couple of example events, one example widget
 * layout, and one example chat reaction, all named "Example: …" so they're
 * obviously discoverable and safe to delete.
 *
 * Additive by design — appends onto whatever sourceEvents/widgetLayouts/
 * chatReactions already exist (array config fields are replaced wholesale
 * on save, not merged, so we read-then-append here) and skips any row whose
 * id was already loaded, so re-running this is a no-op rather than a
 * duplicate pile-up. Also snapshots the result as one saved ConfigPreset
 * so operators see what "loading a preset" looks like too.
 */
export function useLoadStarterPack() {
  const config = useAdminStore((s) => s.config);
  const saveConfig = useAdminStore((s) => s.saveConfig);
  const { success, error } = useToast();

  const loadStarterPack = useCallback(async () => {
    const starter = buildStarterPackSections();
    const existingEventIds = new Set((config.sourceEvents ?? []).map((e) => e.id));
    const existingLayoutIds = new Set((config.widgetLayouts ?? []).map((l) => l.id));
    const existingReactionIds = new Set((config.chatReactions ?? []).map((r) => r.id));

    const newEvents = starter.sourceEvents.filter((e) => !existingEventIds.has(e.id));
    const newLayouts = starter.widgetLayouts.filter((l) => !existingLayoutIds.has(l.id));
    const newReactions = starter.chatReactions.filter((r) => !existingReactionIds.has(r.id));

    if (!newEvents.length && !newLayouts.length && !newReactions.length) {
      success('Starter pack already loaded', 'All example content is already in your config.');
      return;
    }

    const updates: Partial<AppConfig> = {};
    if (newEvents.length) updates.sourceEvents = [...(config.sourceEvents ?? []), ...newEvents];
    if (newLayouts.length) updates.widgetLayouts = [...(config.widgetLayouts ?? []), ...newLayouts];
    if (newReactions.length) updates.chatReactions = [...(config.chatReactions ?? []), ...newReactions];

    try {
      await saveConfig(updates);
      const sectionKeys = Object.keys(updates) as Array<keyof AppConfig>;
      await savePreset(STARTER_PACK_PRESET_LABEL, sectionKeys);
      success('Starter pack loaded', 'Example events, a widget layout, and a chat reaction were added — look for "Example: …" entries.');
    } catch (err) {
      error('Failed to load starter pack', err instanceof Error ? err.message : 'An unexpected error occurred');
    }
  }, [config.sourceEvents, config.widgetLayouts, config.chatReactions, saveConfig, success, error]);

  return { loadStarterPack };
}
