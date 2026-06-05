# Design Document: Admin UX Redesign

## Components and Interfaces

### Core Component Interfaces

```typescript
// Button atom
export interface ButtonProps {
  variant: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
  size: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}

// Card molecule
export interface CardProps {
  variant: 'default' | 'elevated' | 'interactive' | 'status';
  padding: 'sm' | 'md' | 'lg';
  glow?: 'primary' | 'success' | 'accent' | 'none';
  children: React.ReactNode;
  onClick?: () => void;
}

// Sidebar organism
export interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  activeSection: string;
  onNavigate: (section: string) => void;
  sections: SidebarSection[];
}

export interface SidebarSection {
  id: string;
  label: string;
  icon: LucideIcon;
  badge?: string | number;
  children?: SidebarItem[];
}

export interface SidebarItem {
  id: string;
  label: string;
  icon?: LucideIcon;
  status?: 'live' | 'open' | 'closed';
}

// Toast system
export interface ToastItem {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  description?: string;
  duration?: number;
}

// Command Palette
export interface SearchResultItem {
  id: string;
  label: string;
  category: 'scene' | 'widget' | 'setting' | 'action';
  icon?: LucideIcon;
  path?: string;
  score: number;
}

// Navigation
export interface NavigationItem {
  id: string;
  label: string;
  icon: LucideIcon;
  path: string;
  children?: NavigationItem[];
  badge?: string | number;
}
```

## Data Models

### UI State Model (Zustand Store Extension)

```typescript
interface UiSliceExtension {
  sidebarCollapsed: boolean;
  activeSection: string;
  breadcrumbPath: string[];
  toasts: ToastItem[];
  commandPaletteOpen: boolean;
  onboardingDismissed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setActiveSection: (section: string) => void;
  setBreadcrumbPath: (path: string[]) => void;
  addToast: (toast: Omit<ToastItem, 'id'>) => void;
  removeToast: (id: string) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  dismissOnboarding: () => void;
}

interface SearchSlice {
  query: string;
  results: SearchResultItem[];
  recentSearches: string[];
  setQuery: (query: string) => void;
  search: (query: string) => void;
  addRecentSearch: (query: string) => void;
}
```

### Design Token Data Model

```typescript
interface DesignTokens {
  colors: {
    primary: ColorScale;
    accent: ColorScale;
    success: ColorScale;
    danger: ColorScale;
    creative: ColorScale;
    neutral: ColorScale;
  };
  spacing: Record<number, string>;
  typography: {
    fontFamily: { sans: string; mono: string };
    fontSize: Record<string, string>;
    fontWeight: Record<string, number>;
    lineHeight: Record<string, string>;
  };
  shadows: Record<string, string>;
  radii: Record<string, string>;
  motion: {
    duration: Record<string, string>;
    easing: Record<string, string>;
  };
}

interface ColorScale {
  50: string;
  100: string;
  200: string;
  300: string;
  400: string;
  500: string;
  600: string;
  700: string;
  800?: string;
  900?: string;
}
```

## Overview

This design document describes the technical implementation plan for the complete UX/UI redesign of the IEOM Admin Panel. The redesign transforms the current functional-but-utilitarian interface into a motivating, visually engaging, and highly maintainable control surface using color psychology, modern interaction patterns, and atomic component architecture.

## Architecture

### High-Level Structure

```
packages/admin/src/
├── tokens/                    # Design system tokens
│   ├── colors.ts              # Color palette & semantic tokens
│   ├── spacing.ts             # Spacing scale
│   ├── typography.ts          # Font sizes, weights, line heights
│   ├── shadows.ts             # Elevation levels
│   ├── radii.ts               # Border radius scale
│   ├── motion.ts              # Duration & easing tokens
│   └── index.ts               # Barrel export
├── components/                # Shared UI component library
│   ├── atoms/                 # Smallest building blocks
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Toggle.tsx
│   │   ├── Badge.tsx
│   │   ├── Icon.tsx
│   │   ├── Tooltip.tsx
│   │   ├── Skeleton.tsx
│   │   └── index.ts
│   ├── molecules/             # Composed from atoms
│   │   ├── Field.tsx
│   │   ├── Card.tsx
│   │   ├── Toast.tsx
│   │   ├── SearchResult.tsx
│   │   ├── StatusIndicator.tsx
│   │   ├── Breadcrumb.tsx
│   │   └── index.ts
│   ├── organisms/             # Complex UI sections
│   │   ├── Sidebar.tsx
│   │   ├── CommandPalette.tsx
│   │   ├── Modal.tsx
│   │   ├── ConfigPanel.tsx
│   │   ├── TopBar.tsx
│   │   ├── ToastContainer.tsx
│   │   └── index.ts
│   └── index.ts               # Root barrel
├── layouts/                   # Page-level layout shells
│   ├── DashboardLayout.tsx    # Sidebar + content + inspector
│   ├── SettingsLayout.tsx     # Full-width settings
│   └── index.ts
├── features/                  # Domain-specific modules (existing, refactored)
│   ├── dashboard/
│   ├── scenes/
│   ├── widgets/
│   ├── media/
│   ├── online/
│   ├── settings/
│   ├── ambiance/
│   └── archive/
├── hooks/                     # Shared custom hooks
│   ├── useToast.ts
│   ├── useSearch.ts
│   ├── useKeyboardShortcuts.ts
│   ├── useLocalStorage.ts
│   ├── useReducedMotion.ts
│   └── index.ts
├── store/                     # Zustand store (existing, extended)
│   └── slices/
│       ├── configSlice.ts
│       ├── runtimeSlice.ts
│       ├── uiSlice.ts         # Extended with sidebar state, toast queue
│       └── searchSlice.ts     # New: search index & results
├── utils/                     # Pure utility functions
│   ├── cn.ts                  # Class name merger (clsx + tailwind-merge)
│   ├── searchIndex.ts         # Fuzzy search implementation
│   └── accessibility.ts      # Focus trap, ARIA helpers
└── styles/
    ├── admin.css              # Refactored: imports tokens, base layer
    └── animations.css         # Keyframe definitions
```

### Technology Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| CSS Framework | Tailwind CSS 4 (existing) | Already in use, excellent DX, design token integration via CSS custom properties |
| Class Merging | `clsx` + `tailwind-merge` | Conflict-free conditional class composition |
| Animation | CSS transitions + keyframes | No additional library needed; respects prefers-reduced-motion natively |
| Search | Custom fuzzy search (in-memory) | Small dataset (< 200 items), no need for external library |
| Icons | Lucide React | Consistent, tree-shakeable, MIT licensed icon set to replace emoji icons |
| Toast System | Custom (Zustand + portal) | Lightweight, no external dependency, full control over animation |

## Design Token System

### Color Tokens (CSS Custom Properties)

```css
:root {
  /* Base palette - Dark mode optimized for extended use */
  --color-bg-base: #09090b;
  --color-bg-surface: #18181b;
  --color-bg-elevated: #27272a;
  --color-bg-overlay: rgba(9, 9, 11, 0.85);

  /* Primary - Cyan (Trust, Technology, Reliability) */
  --color-primary-50: #ecfeff;
  --color-primary-100: #cffafe;
  --color-primary-200: #a5f3fc;
  --color-primary-300: #67e8f9;
  --color-primary-400: #22d3ee;
  --color-primary-500: #06b6d4;
  --color-primary-600: #0891b2;
  --color-primary-700: #0e7490;

  /* Accent - Amber/Gold (Achievement, Motivation, Warmth) */
  --color-accent-50: #fffbeb;
  --color-accent-100: #fef3c7;
  --color-accent-200: #fde68a;
  --color-accent-300: #fcd34d;
  --color-accent-400: #fbbf24;
  --color-accent-500: #f59e0b;
  --color-accent-600: #d97706;

  /* Success - Emerald (Progress, Health, Completion) */
  --color-success-50: #ecfdf5;
  --color-success-400: #34d399;
  --color-success-500: #10b981;
  --color-success-600: #059669;

  /* Danger - Red (Errors, Destructive actions) */
  --color-danger-400: #f87171;
  --color-danger-500: #ef4444;
  --color-danger-600: #dc2626;

  /* Creative - Violet (Premium, Inspiration) */
  --color-creative-400: #a78bfa;
  --color-creative-500: #8b5cf6;
  --color-creative-600: #7c3aed;

  /* Neutral - Zinc (Text, Borders, Backgrounds) */
  --color-text-primary: #f4f4f5;
  --color-text-secondary: #a1a1aa;
  --color-text-muted: #71717a;
  --color-border-default: rgba(255, 255, 255, 0.08);
  --color-border-strong: rgba(255, 255, 255, 0.16);

  /* Spacing (4px base) */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;

  /* Typography */
  --font-sans: 'Inter', ui-sans-serif, system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, monospace;
  --text-xs: 0.75rem;
  --text-sm: 0.875rem;
  --text-base: 1rem;
  --text-lg: 1.125rem;
  --text-xl: 1.25rem;
  --text-2xl: 1.5rem;

  /* Elevation */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.4);
  --shadow-lg: 0 12px 40px rgba(0, 0, 0, 0.5);
  --shadow-xl: 0 24px 60px rgba(0, 0, 0, 0.6);

  /* Radii */
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-full: 9999px;

  /* Motion */
  --duration-fast: 150ms;
  --duration-normal: 250ms;
  --duration-slow: 400ms;
  --ease-default: cubic-bezier(0.4, 0, 0.2, 1);
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --ease-out: cubic-bezier(0, 0, 0.2, 1);
}
```

## Component Design

### Button Component (Atom)

```typescript
interface ButtonProps {
  variant: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
  size: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}
```

### Card Component (Molecule)

```typescript
interface CardProps {
  variant: 'default' | 'elevated' | 'interactive' | 'status';
  padding: 'sm' | 'md' | 'lg';
  glow?: 'primary' | 'success' | 'accent' | 'none';
  children: React.ReactNode;
  onClick?: () => void;
}
```

### Sidebar Component (Organism)

```typescript
interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  activeSection: string;
  onNavigate: (section: string) => void;
  sections: SidebarSection[];
}

interface SidebarSection {
  id: string;
  label: string;
  icon: LucideIcon;
  badge?: string | number;
  children?: SidebarItem[];
}
```

## Navigation Architecture

### Section Mapping

| Category | Icon | Contains |
|----------|------|----------|
| Dashboard | LayoutDashboard | Overview, status, quick actions |
| Scenes | Monitor | Lobby, Desktop, User Scenes, Transitions |
| Widgets | Layers | System widgets, User widgets, Layouts, Decorations |
| Media | Image | Asset Library, Sources, Events |
| Online | Globe | Rooms, POV, Participants |
| System | Settings | OBS, Audio, Keybinds, Ambiance, Archive, Account |

### Command Palette Search Index

The search system indexes:
- All sidebar navigation items (section names, sub-items)
- All application/widget names from config
- All scene names
- Setting field labels
- Action names (scene:change, widget:toggle, etc.)

Search implementation uses a simple scoring algorithm:
1. Exact prefix match: score 100
2. Word boundary match: score 80
3. Substring match: score 60
4. Fuzzy (character sequence): score 40

## Layout System

### Breakpoint Strategy

```
< 768px:   Mobile layout (bottom nav + full-width content)
768-1200px: Standard layout (sidebar 240px + content)
> 1200px:  Extended layout (sidebar 240px + content + inspector 320px)
```

### Dashboard Layout Component

```typescript
export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const sidebarCollapsed = useAdminStore((s) => s.ui.sidebarCollapsed);
  const sidebarWidth = sidebarCollapsed ? 48 : 240;

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--color-bg-base)]">
      <Sidebar collapsed={sidebarCollapsed} />
      <main
        className="flex-1 flex flex-col min-w-0 overflow-hidden"
        style={{ marginLeft: sidebarWidth }}
      >
        <TopBar />
        <div className="flex-1 overflow-y-auto p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
```

## Feedback & Toast System

### Toast Store Slice

```typescript
interface ToastItem {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  description?: string;
  duration?: number; // default 3000ms
}

interface ToastSlice {
  toasts: ToastItem[];
  addToast: (toast: Omit<ToastItem, 'id'>) => void;
  removeToast: (id: string) => void;
}
```

### Animation Strategy

All animations respect `prefers-reduced-motion`:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

## Migration Strategy

The redesign will be implemented incrementally to avoid a single massive PR:

### Phase 1: Foundation (Non-breaking)
- Create `tokens/` directory with all design tokens
- Create `components/atoms/` with new Button, Input, Toggle
- Add `cn()` utility (clsx + tailwind-merge)
- Add Lucide React icons package
- Create `hooks/useReducedMotion.ts`

### Phase 2: Layout Shell
- Create `layouts/DashboardLayout.tsx`
- Create new `components/organisms/Sidebar.tsx`
- Create new `components/organisms/TopBar.tsx`
- Wire up sidebar collapse/expand with persistence

### Phase 3: Component Migration
- Replace existing `shared/ui.tsx` components one-by-one
- Migrate `Btn` → `Button`, `Panel` → `Card`, `Toggle` → new Toggle
- Update feature panels to use new components

### Phase 4: Navigation & Search
- Implement `CommandPalette` component
- Build search index from config store
- Add keyboard shortcuts (Ctrl+K, Ctrl+S, etc.)
- Add breadcrumb navigation

### Phase 5: Dashboard & Feedback
- Create dashboard overview with status cards
- Implement toast notification system
- Add skeleton loading states
- Add microinteraction animations

### Phase 6: Polish & Accessibility
- Implement onboarding flow
- Add ARIA labels and roles
- Implement focus management
- Add contextual tooltips
- Final animation polish

## Error Handling

### UI Error Boundaries
- Each feature panel is wrapped in a React Error Boundary that catches render errors and displays a retry UI
- The existing `RightPaneErrorBoundary` pattern is preserved and extended to all organism-level components
- Toast notifications display user-friendly error messages for failed API calls (config save, OBS test, etc.)

### Network Error Handling
- Failed config saves show a danger toast with "Save failed — check connection" and a retry button
- Socket disconnection triggers a persistent warning banner in the TopBar until reconnection
- API timeouts (>5s) show a warning toast suggesting the user check the server

### Validation Errors
- Form fields display inline error messages below the input with danger color
- Invalid color hex values fall back to the previous valid value
- Number inputs clamp to min/max bounds on blur

## Testing Strategy

### Unit Tests
- Design token exports: verify all token objects have expected keys and valid CSS values
- `cn()` utility: verify class merging handles conflicts correctly
- `searchIndex.ts`: verify fuzzy scoring algorithm produces correct rankings
- `useReducedMotion` hook: verify it returns correct boolean based on media query

### Component Tests (React Testing Library)
- Button: renders all variants, handles click, shows loading state, respects disabled
- Toggle: animates on change, fires onChange callback, supports keyboard activation
- Modal: traps focus, closes on Escape, renders portal
- CommandPalette: opens on Ctrl+K, filters results, navigates with keyboard
- Sidebar: collapses/expands, highlights active section, persists state

### Integration Tests
- Full navigation flow: sidebar click → content panel renders → breadcrumb updates
- Config save flow: edit field → save button enabled → click save → toast appears → field resets dirty state
- Search flow: Ctrl+K → type query → results appear → select result → navigates to panel

### Visual Regression (Manual)
- Compare screenshots of each panel before/after migration to ensure no layout regressions
- Verify color contrast ratios using browser DevTools accessibility audit

## Correctness Properties

### Property 1: Token Consistency
For all rendered components, every color, spacing, and typography value references a design token variable rather than a hardcoded value.

**Validates: Requirements 1.8**

### Property 2: Navigation Completeness
For all features accessible in the current admin panel, there exists a navigation path in the redesigned sidebar that reaches the same feature within 2 clicks.

**Validates: Requirements 3.1**

### Property 3: Keyboard Accessibility
For all interactive elements rendered in the admin panel, the element is reachable via Tab key navigation and activatable via Enter or Space key.

**Validates: Requirements 10.5**

### Property 4: Responsive Integrity
For all viewport widths between 320px and 2560px, the admin panel renders without horizontal overflow and all interactive elements remain accessible.

**Validates: Requirements 8.1**

### Property 5: Animation Safety
While the user has `prefers-reduced-motion: reduce` enabled, no CSS animation or transition with duration greater than 1ms is applied to any element.

**Validates: Requirements 11.4**

### Property 6: Search Completeness
For all items displayed in the sidebar navigation, the item appears in command palette search results when queried by its exact label text.

**Validates: Requirements 4.2**
