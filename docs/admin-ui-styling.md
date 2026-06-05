# Admin UI Styling Guide

## Critical: Tailwind v4 + Vite — Utility Classes Often Don't Apply

**Problem**: Many Tailwind utility classes appear to have no visible effect in the admin panel, even when HMR confirms the file was updated.

**Root cause**: Tailwind v4 scans source files and generates only the classes it finds. Classes that are dynamically constructed, only exist in `defaultProps`/default parameter values, or are in files that Tailwind doesn't scan may silently not be generated.

**Verified behavior**:
- `bodyClassName = 'p-8'` as a default parameter in a function — **not generated**
- `className="p-8"` hardcoded in JSX — **works**
- `style={{ padding: '2rem' }}` inline styles — **always works**

**Rule**: When adding spacing/sizing to key layout containers, use **inline `style` props**, not Tailwind utility classes. Tailwind classes are fine for colors, borders, flex/grid layout, and typography where the class names are hardcoded literals in JSX.

---

## Layout Architecture

### App Shell (`Dashboard.tsx`)
```
<div absolute inset-0>           ← full viewport, no outer padding
  <TopBar />                     ← fixed height header
  <div flex flex-1 overflow-hidden>
    <LeftSidebar />              ← w-60, fixed width
    <RightPane />                ← flex-1, fills remaining width
  </div>
</div>
```

### Left Sidebar (`LeftSidebar.tsx`)
- Outer container: `style={{ padding: '0.75rem' }}` — inline style required
- Inner scroll area: `overflow-y-auto`
- Items: `SidebarBtn` with `mb-1.5 px-3 py-2.5`
- Section labels: `mt-7 mb-3` between groups

### Right Pane (`RightPane.tsx`)
- Header bar: `px-3 py-2.5` (Tailwind works here, small fixed element)
- **Content scroll area**: `style={{ padding: '2rem' }}` — inline style required, Tailwind `p-*` ignored
- Section spacing: `space-y-6` between `ConfigSectionPanel` blocks

---

## Component Padding Reference

| Component | Padding | Method |
|---|---|---|
| `Panel` body | `p-8` default | Tailwind (may not apply — use explicit `bodyClassName`) |
| `ConfigSectionPanel` body | `p-8` | Tailwind via `bodyClassName` prop |
| `ConfigCard` | `p-8` | Tailwind (hardcoded) |
| Right pane scroll area | `2rem` all sides | **Inline style** |
| Left sidebar | `0.75rem` all sides | **Inline style** |

---

## HMR Debugging

If a UI change has no visible effect:

1. Add `style={{ outline: '3px solid red' }}` to the target element
2. If red outline appears → HMR works, the Tailwind class is the problem → use inline style
3. If red outline doesn't appear → there's a **TypeScript error** in the file silently breaking HMR
   - Run `pnpm exec tsc --noEmit` in `packages/admin` to find it
   - Fix the error, then HMR resumes

---

## Tailwind v4 Safe Usage

**Safe** (class name is a hardcoded string literal):
```tsx
<div className="rounded-xl border border-zinc-800/80 bg-zinc-900/70 p-4">
```

**Unsafe** (class generated dynamically or as a default value):
```tsx
// Won't reliably generate the class:
function Panel({ bodyClassName = 'p-8' }) { ... }
const cls = `p-${size}`
```

**Workaround** for dynamic values: use inline styles or CSS variables.
