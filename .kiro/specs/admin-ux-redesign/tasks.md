# Implementation Plan: Admin UX Redesign

## Overview

This implementation plan covers the complete UX/UI redesign of the IEOM Admin Panel. Work is organized into 10 phases, progressing from foundational design tokens through component creation, layout restructuring, feature migration, and final polish. Each phase builds on the previous one.

## Tasks

### Phase 1: Foundation (Design Token System & Utilities)

- [x] 1.1 Create `packages/admin/src/tokens/colors.ts` exporting semantic color token objects (primary, accent, success, danger, creative, neutral scales)
- [x] 1.2 Create `packages/admin/src/tokens/spacing.ts` exporting spacing scale (4px base, 1-16 levels)
- [x] 1.3 Create `packages/admin/src/tokens/typography.ts` exporting font families, sizes (xs-2xl), weights, and line heights
- [x] 1.4 Create `packages/admin/src/tokens/shadows.ts` exporting elevation levels (sm, md, lg, xl)
- [x] 1.5 Create `packages/admin/src/tokens/radii.ts` exporting border-radius scale (sm, md, lg, xl, full)
- [x] 1.6 Create `packages/admin/src/tokens/motion.ts` exporting duration tokens (fast, normal, slow) and easing curves
- [x] 1.7 Create `packages/admin/src/tokens/index.ts` barrel file re-exporting all token modules
- [x] 1.8 Refactor `packages/admin/src/styles/admin.css` to use CSS custom properties from the token system (replace all hardcoded color/spacing values with variables)
- [x] 1.9 Create `packages/admin/src/styles/animations.css` with keyframe definitions for page transitions, card entrances, modal animations, skeleton shimmer, and toast slide-in
- [x] 1.10 Create `packages/admin/src/utils/cn.ts` utility function combining `clsx` and `tailwind-merge` for conflict-free class composition
- [x] 1.11 Install `clsx` and `tailwind-merge` as dependencies in `packages/admin/package.json`
- [x] 1.12 Install `lucide-react` as a dependency for consistent iconography
- [x] 1.13 Create `packages/admin/src/hooks/useReducedMotion.ts` hook that reads `prefers-reduced-motion` media query
- [x] 1.14 Create `packages/admin/src/hooks/useLocalStorage.ts` hook for persisting UI preferences (sidebar state, onboarding dismissed)
- [x] 1.15 Create `packages/admin/src/utils/accessibility.ts` with focus trap utility and ARIA helper functions

## Phase 2: Atomic Component Library

- [x] 2.1 Create `packages/admin/src/components/atoms/Button.tsx` with variants (primary, secondary, ghost, danger, success), sizes (sm, md, lg), loading state, and icon support
- [x] 2.2 Create `packages/admin/src/components/atoms/Input.tsx` with variants, sizes, error state, prefix/suffix icon slots, and proper ARIA labels
- [x] 2.3 Create `packages/admin/src/components/atoms/Toggle.tsx` with spring animation, label support, sizes, and disabled state
- [x] 2.4 Create `packages/admin/src/components/atoms/Badge.tsx` with variants (default, primary, success, warning, danger), sizes, and dot indicator option
- [x] 2.5 Create `packages/admin/src/components/atoms/Icon.tsx` wrapper component for Lucide icons with consistent sizing and color token integration
- [x] 2.6 Create `packages/admin/src/components/atoms/Tooltip.tsx` with configurable position (top, bottom, left, right), delay (200ms default), and accessible markup
- [x] 2.7 Create `packages/admin/src/components/atoms/Skeleton.tsx` with shimmer animation, configurable width/height, and variant shapes (text, circle, rect)
- [x] 2.8 Create `packages/admin/src/components/atoms/index.ts` barrel file
- [x] 2.9 Create `packages/admin/src/components/molecules/Field.tsx` composing Label + Input + error message + tooltip hint
- [x] 2.10 Create `packages/admin/src/components/molecules/Card.tsx` with variants (default, elevated, interactive, status), glow options, and padding sizes
- [x] 2.11 Create `packages/admin/src/components/molecules/Toast.tsx` with type-based styling (success/error/info/warning), auto-dismiss timer, and close button
- [x] 2.12 Create `packages/admin/src/components/molecules/StatusIndicator.tsx` with animated dot, label, and color-coded connection states
- [x] 2.13 Create `packages/admin/src/components/molecules/Breadcrumb.tsx` with clickable path segments and current page indicator
- [x] 2.14 Create `packages/admin/src/components/molecules/SearchResult.tsx` with highlighted matching characters, category badge, and keyboard selection state
- [x] 2.15 Create `packages/admin/src/components/molecules/index.ts` barrel file
- [x] 2.16 Create `packages/admin/src/components/organisms/Modal.tsx` with scale-up entrance animation, backdrop, focus trap, and Escape key close
- [x] 2.17 Create `packages/admin/src/components/organisms/ToastContainer.tsx` portal-based container rendering toast stack with staggered animations
- [x] 2.18 Create `packages/admin/src/components/organisms/ConfigPanel.tsx` replacing current ConfigSectionPanel with improved header, collapsible sections, and save bar integration
- [x] 2.19 Create `packages/admin/src/components/organisms/index.ts` barrel file
- [x] 2.20 Create `packages/admin/src/components/index.ts` root barrel file re-exporting all component categories

## Phase 3: Layout Shell & Navigation

- [x] 3.1 Create `packages/admin/src/components/organisms/Sidebar.tsx` with collapsible mode (48px icon-only / 240px expanded), section grouping, active indicator, expand/collapse animation, and keyboard navigation
- [x] 3.2 Create `packages/admin/src/components/organisms/TopBar.tsx` with brand mark, connection status indicators, search trigger button, quick actions, and auth badge
- [x] 3.3 Create `packages/admin/src/layouts/DashboardLayout.tsx` implementing the responsive grid (sidebar + content + optional inspector) with breakpoint handling
- [x] 3.4 Extend `packages/admin/src/store/slices/uiSlice.ts` with sidebar collapsed state, active section, breadcrumb path, and toast queue
- [x] 3.5 Create `packages/admin/src/hooks/useKeyboardShortcuts.ts` implementing global shortcuts (Ctrl+K search, Ctrl+S save, Escape close, Ctrl+1-6 section nav)
- [x] 3.6 Implement sidebar collapse/expand persistence using `useLocalStorage` hook
- [x] 3.7 Implement responsive breakpoint detection that auto-collapses sidebar below 768px viewport width
- [x] 3.8 Add drag-to-resize handle on sidebar right edge (200px-320px range) with visual feedback

## Phase 4: Command Palette & Search

- [x] 4.1 Create `packages/admin/src/utils/searchIndex.ts` with fuzzy search scoring algorithm (prefix: 100, word boundary: 80, substring: 60, fuzzy: 40)
- [x] 4.2 Create `packages/admin/src/store/slices/searchSlice.ts` managing search index, query state, and filtered results
- [x] 4.3 Create `packages/admin/src/hooks/useSearch.ts` hook that builds search index from config store (applications, scenes, settings, navigation items)
- [x] 4.4 Create `packages/admin/src/components/organisms/CommandPalette.tsx` with overlay, input field, grouped results, keyboard navigation (arrows + Enter), and recent searches
- [x] 4.5 Wire CommandPalette to Ctrl+K shortcut and search icon in TopBar
- [x] 4.6 Implement search result navigation (selecting a result navigates to the corresponding panel and briefly highlights the target)

## Phase 5: Dashboard Overview

- [x] 5.1 Create `packages/admin/src/features/dashboard/DashboardOverview.tsx` as the new default landing view
- [x] 5.2 Create status cards section showing Overlay connection, OBS connection, and Online Rooms count with color-coded indicators and pulse animation on state change
- [x] 5.3 Create active scene display card with scene name, thumbnail preview, and quick-switch dropdown
- [x] 5.4 Create quick-action buttons grid (Switch Scene, Toggle Widget, Open Overlay, Settings) with icon + label
- [x] 5.5 Create recent activity feed component showing last 5 actions with timestamps and action type icons
- [x] 5.6 Wire dashboard overview to real-time store updates (overlay status polling, socket events)

## Phase 6: Feedback & Microinteractions

- [x] 6.1 Create `packages/admin/src/hooks/useToast.ts` hook exposing `addToast()` function connected to the UI store toast queue
- [x] 6.2 Implement button press animation (scale 0.97 on mousedown, return on mouseup) in Button component
- [x] 6.3 Implement form field dirty-state border transition (border color changes to accent when value differs from saved)
- [x] 6.4 Implement skeleton loading states in ConfigPanel for async data loading
- [x] 6.5 Implement staggered fade-in animation for sidebar section children when expanding
- [x] 6.6 Implement hover elevation change (shadow increase over 150ms) on interactive Card components
- [x] 6.7 Integrate toast notifications into save operations (success toast on config save, error toast on failure)
- [x] 6.8 Implement save success animation using warm amber/gold color pulse on the save button

## Phase 7: Feature Panel Migration

- [x] 7.1 Migrate `AmbiancePanel.tsx` to use new component library (replace old ConfigCard, ConfigNotice, ConfigSectionPanel, Toggle, Slider with new components)
- [x] 7.2 Migrate `ArchivePanel.tsx` to use new component library
- [x] 7.3 Migrate `AssetLibraryPanel.tsx` to use new component library
- [x] 7.4 Migrate `AudioPanel.tsx` to use new component library
- [x] 7.5 Migrate `OnlineRoomsPanel.tsx` to use new component library
- [x] 7.6 Migrate `KeybindEditor.tsx` to use new component library
- [x] 7.7 Migrate `SettingsPage.tsx` to use new component library
- [x] 7.8 Migrate `SceneConfig.tsx` and `EnvEditors.tsx` to use new component library
- [x] 7.9 Migrate `AppForm.tsx` and `NewWidgetForm.tsx` to use new component library
- [x] 7.10 Migrate `LoginPage.tsx` to use new component library and updated color tokens
- [x] 7.11 Remove old `packages/admin/src/shared/ui.tsx` after all migrations are complete (or keep as deprecated re-exports during transition)

## Phase 8: Onboarding & Contextual Help

- [x] 8.1 Create `packages/admin/src/features/onboarding/WelcomeTour.tsx` with step-by-step overlay highlighting sidebar, content area, top bar, and quick actions
- [x] 8.2 Implement "Don't show again" dismissal persisted in localStorage
- [x] 8.3 Add section description headers to each feature panel (1-2 sentence explanation of purpose)
- [x] 8.4 Add contextual tooltip hints on configuration field labels explaining what each field controls
- [x] 8.5 Create empty state components with illustrations and action prompts for sections with no configured items

## Phase 9: Accessibility & Polish

- [x] 9.1 Add visible focus ring (2px cyan outline, 2px offset) to all interactive elements via global CSS
- [x] 9.2 Implement ARIA roles: sidebar as `nav`, panels as `region`, modals as `dialog`, toasts as `alert`
- [x] 9.3 Implement focus trap in Modal and CommandPalette components (trap on open, restore on close)
- [x] 9.4 Add `aria-live="polite"` regions for toast notifications and status updates
- [x] 9.5 Verify and fix tab order to follow visual layout (top bar → sidebar → content → modals)
- [x] 9.6 Implement `prefers-reduced-motion` check that disables all non-essential animations globally
- [x] 9.7 Add screen reader announcements for navigation changes and async operation completions
- [x] 9.8 Final visual polish pass: verify color contrast ratios (4.5:1 text, 3:1 large text), consistent spacing, and animation timing across all panels

## Phase 10: Integration & Cleanup

- [x] 10.1 Update `packages/admin/src/App.tsx` to use new DashboardLayout and routing structure
- [x] 10.2 Update `packages/admin/src/features/dashboard/Dashboard.tsx` to integrate new Sidebar, TopBar, CommandPalette, and DashboardOverview
- [x] 10.3 Remove deprecated components and unused CSS classes from old design system
- [x] 10.4 Run full TypeScript type check (`pnpm typecheck`) and fix any type errors introduced during migration
- [x] 10.5 Run production build (`pnpm build`) and verify no build errors or warnings
- [x] 10.6 Verify all existing functionality (scene switching, widget toggling, config saving, OBS connection, online rooms) works correctly with new UI
- [x] 10.7 Document the new component library with JSDoc comments on all exported components describing purpose, props, and usage


## Task Dependency Graph

```json
{
  "waves": [
    {
      "name": "Wave 1: Foundation",
      "tasks": ["1.1", "1.2", "1.3", "1.4", "1.5", "1.6", "1.7", "1.8", "1.9", "1.10", "1.11", "1.12", "1.13", "1.14", "1.15"]
    },
    {
      "name": "Wave 2: Atomic Components",
      "tasks": ["2.1", "2.2", "2.3", "2.4", "2.5", "2.6", "2.7", "2.8", "2.9", "2.10", "2.11", "2.12", "2.13", "2.14", "2.15", "2.16", "2.17", "2.18", "2.19", "2.20"],
      "dependsOn": ["1.7", "1.10", "1.11", "1.12", "1.13"]
    },
    {
      "name": "Wave 3: Layout Shell & Navigation",
      "tasks": ["3.1", "3.2", "3.3", "3.4", "3.5", "3.6", "3.7", "3.8"],
      "dependsOn": ["2.8", "2.15", "2.19"]
    },
    {
      "name": "Wave 4: Search & Dashboard",
      "tasks": ["4.1", "4.2", "4.3", "4.4", "4.5", "4.6", "5.1", "5.2", "5.3", "5.4", "5.5", "5.6"],
      "dependsOn": ["3.3", "3.4", "3.5"]
    },
    {
      "name": "Wave 5: Feedback & Microinteractions",
      "tasks": ["6.1", "6.2", "6.3", "6.4", "6.5", "6.6", "6.7", "6.8"],
      "dependsOn": ["2.20", "3.4"]
    },
    {
      "name": "Wave 6: Feature Migration",
      "tasks": ["7.1", "7.2", "7.3", "7.4", "7.5", "7.6", "7.7", "7.8", "7.9", "7.10", "7.11"],
      "dependsOn": ["6.1", "6.7"]
    },
    {
      "name": "Wave 7: Onboarding & Accessibility",
      "tasks": ["8.1", "8.2", "8.3", "8.4", "8.5", "9.1", "9.2", "9.3", "9.4", "9.5", "9.6", "9.7", "9.8"],
      "dependsOn": ["7.11"]
    },
    {
      "name": "Wave 8: Integration & Cleanup",
      "tasks": ["10.1", "10.2", "10.3", "10.4", "10.5", "10.6", "10.7"],
      "dependsOn": ["9.8"]
    }
  ]
}
```

## Notes

- The migration is designed to be incremental. Old components in `shared/ui.tsx` remain functional during transition. New components are created alongside, and feature panels are migrated one at a time.
- The existing Zustand store structure is preserved and extended (not replaced). New slices are added for UI state and search.
- Tailwind CSS 4 is already configured. The token system uses CSS custom properties that Tailwind can reference via `var()`.
- The `98.css` dependency (Win98 styling) is only used in the overlay, not the admin panel, so it won't conflict with the redesign.
- Inter and JetBrains Mono fonts should be loaded via Google Fonts CDN in `index.html` or self-hosted in `public/fonts/`.
- All animations must check `prefers-reduced-motion` — the `useReducedMotion` hook provides this at the component level, and the CSS media query handles it globally.
