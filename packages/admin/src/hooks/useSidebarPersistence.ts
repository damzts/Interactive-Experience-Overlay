import { useLocalStorage } from './useLocalStorage';

/**
 * Persists the sidebar collapsed/expanded state across browser sessions.
 *
 * A thin convenience wrapper around {@link useLocalStorage} that standardizes
 * the storage key (`ieom-sidebar-collapsed`) used for sidebar state throughout
 * the application. The default state is expanded (collapsed = `false`).
 *
 * @returns A tuple of the current collapsed state and a setter to update it.
 *
 * @example
 * ```tsx
 * const [collapsed, setCollapsed] = useSidebarPersistence();
 *
 * <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
 * ```
 */
export function useSidebarPersistence(): [boolean, (value: boolean) => void] {
  return useLocalStorage<boolean>('ieom-sidebar-collapsed', false);
}
