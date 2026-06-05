import { useState, useCallback, useRef, useEffect, type KeyboardEvent } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { cn } from '../../utils/cn';
import { Tooltip } from '../atoms';

/**
 * Sidebar organism component for the IEOM Admin Panel.
 *
 * Provides the primary navigation surface with collapsible mode
 * (48px icon-only / 240px expanded), section grouping with optional
 * sub-items, active section indicator, smooth expand/collapse animation,
 * and full keyboard navigation support.
 *
 * Uses `role="navigation"` for accessibility and supports Tab/Enter
 * keyboard interaction patterns.
 *
 * @example
 * ```tsx
 * <Sidebar
 *   collapsed={false}
 *   onToggle={() => setCollapsed(!collapsed)}
 *   activeSection="dashboard"
 *   onNavigate={(id) => setActiveSection(id)}
 *   sections={[
 *     { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
 *     { id: 'scenes', label: 'Scenes', icon: Monitor, children: [...] },
 *   ]}
 * />
 * ```
 */

export interface SidebarItemData {
  id: string;
  label: string;
  icon?: LucideIcon;
  status?: 'live' | 'open' | 'closed';
}

export interface SidebarSection {
  id: string;
  label: string;
  icon: LucideIcon;
  badge?: string | number;
  children?: SidebarItemData[];
}

export interface SidebarProps {
  /** Whether the sidebar is in collapsed (icon-only) mode */
  collapsed: boolean;
  /** Callback to toggle collapsed state */
  onToggle: () => void;
  /** ID of the currently active section or item */
  activeSection: string;
  /** Callback when a section or item is navigated to */
  onNavigate: (section: string) => void;
  /** Array of navigation sections to render */
  sections: SidebarSection[];
}

/** Status dot color mapping */
const statusColors: Record<string, string> = {
  live: 'bg-[var(--color-success-400)]',
  open: 'bg-[var(--color-primary-400)]',
  closed: 'bg-[var(--color-text-muted)]',
};

/**
 * Sidebar — primary navigation organism with collapsible mode,
 * section grouping, active indicator, and keyboard navigation.
 */
export function Sidebar({
  collapsed,
  onToggle,
  activeSection,
  onNavigate,
  sections,
}: SidebarProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(),
  );
  const navRef = useRef<HTMLElement>(null);

  const toggleSection = useCallback((sectionId: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  }, []);

  const handleSectionClick = useCallback(
    (section: SidebarSection) => {
      if (section.children && section.children.length > 0 && !collapsed) {
        toggleSection(section.id);
      }
      onNavigate(section.id);
    },
    [collapsed, onNavigate, toggleSection],
  );

  const handleItemClick = useCallback(
    (itemId: string) => {
      onNavigate(itemId);
    },
    [onNavigate],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLButtonElement>, action: () => void) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        action();
      }
    },
    [],
  );

  // Auto-collapse expanded sections when sidebar collapses
  useEffect(() => {
    if (collapsed) {
      setExpandedSections(new Set());
    }
  }, [collapsed]);

  return (
    <nav
      ref={navRef}
      role="navigation"
      aria-label="Main navigation"
      data-tour="sidebar"
      className={cn(
        'fixed top-0 left-0 z-40 h-screen flex flex-col',
        'bg-[var(--color-bg-surface)] border-r border-[var(--color-border-default)]',
        'transition-[width] duration-[250ms] ease-[var(--ease-out)]',
        collapsed ? 'w-[48px]' : 'w-[240px]',
      )}
    >
      {/* Section list */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden pt-[var(--space-4)] pb-[var(--space-2)]">
        <ul className="flex flex-col gap-1 px-[var(--space-2)]" role="list">
          {sections.map((section) => (
            <SidebarSectionItem
              key={section.id}
              section={section}
              collapsed={collapsed}
              isActive={
                activeSection === section.id ||
                (section.children?.some((c) => c.id === activeSection) ?? false)
              }
              activeItemId={activeSection}
              isExpanded={expandedSections.has(section.id)}
              onSectionClick={handleSectionClick}
              onItemClick={handleItemClick}
              onKeyDown={handleKeyDown}
            />
          ))}
        </ul>
      </div>

      {/* Toggle button */}
      <div className="border-t border-[var(--color-border-default)] p-[var(--space-2)]">
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={cn(
            'flex items-center justify-center w-full rounded-[var(--radius-md)]',
            'h-9 text-[var(--color-text-secondary)]',
            'hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-text-primary)]',
            'transition-colors duration-[var(--duration-fast)]',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary-400)]',
          )}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>
    </nav>
  );
}

/** Props for individual sidebar section rendering */
interface SidebarSectionItemProps {
  section: SidebarSection;
  collapsed: boolean;
  isActive: boolean;
  activeItemId: string;
  isExpanded: boolean;
  onSectionClick: (section: SidebarSection) => void;
  onItemClick: (itemId: string) => void;
  onKeyDown: (e: KeyboardEvent<HTMLButtonElement>, action: () => void) => void;
}

function SidebarSectionItem({
  section,
  collapsed,
  isActive,
  activeItemId,
  isExpanded,
  onSectionClick,
  onItemClick,
  onKeyDown,
}: SidebarSectionItemProps) {
  const Icon = section.icon;
  const hasChildren = section.children && section.children.length > 0;
  const childListRef = useRef<HTMLUListElement>(null);
  const [childHeight, setChildHeight] = useState<number>(0);

  // Measure child list height for smooth animation
  useEffect(() => {
    if (childListRef.current) {
      setChildHeight(childListRef.current.scrollHeight);
    }
  }, [isExpanded, section.children]);

  const buttonContent = (
    <button
      type="button"
      onClick={() => onSectionClick(section)}
      onKeyDown={(e) => onKeyDown(e, () => onSectionClick(section))}
      aria-current={isActive ? 'page' : undefined}
      aria-expanded={hasChildren && !collapsed ? isExpanded : undefined}
      className={cn(
        'relative flex items-center w-full rounded-[var(--radius-md)]',
        'transition-colors duration-[var(--duration-fast)]',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary-400)]',
        collapsed ? 'justify-center h-10 px-0' : 'h-10 px-3 gap-3',
        isActive && [
          'bg-[var(--color-primary-500)]/10 text-[var(--color-primary-400)]',
          'before:absolute before:left-0 before:top-1.5 before:bottom-1.5',
          'before:w-[3px] before:rounded-full before:bg-[var(--color-primary-400)]',
        ],
        !isActive && [
          'text-[var(--color-text-secondary)]',
          'hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-text-primary)]',
        ],
      )}
    >
      <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />

      {!collapsed && (
        <>
          <span className="flex-1 text-left text-sm font-medium truncate">
            {section.label}
          </span>

          {section.badge !== undefined && (
            <span
              className={cn(
                'inline-flex items-center justify-center min-w-[18px] h-[18px]',
                'px-1 text-[0.625rem] font-semibold rounded-full',
                'bg-[var(--color-primary-500)]/15 text-[var(--color-primary-400)]',
              )}
            >
              {section.badge}
            </span>
          )}

          {hasChildren && (
            <ChevronDown
              className={cn(
                'h-3.5 w-3.5 shrink-0 transition-transform duration-[var(--duration-fast)]',
                isExpanded && 'rotate-180',
              )}
              aria-hidden="true"
            />
          )}
        </>
      )}
    </button>
  );

  return (
    <li>
      {collapsed ? (
        <Tooltip content={section.label} position="right" delay={200}>
          {buttonContent}
        </Tooltip>
      ) : (
        buttonContent
      )}

      {/* Expandable children */}
      {hasChildren && !collapsed && (
        <ul
          ref={childListRef}
          role="list"
          className="overflow-hidden transition-[max-height,opacity] duration-[250ms] ease-[var(--ease-out)]"
          style={{
            maxHeight: isExpanded ? `${childHeight}px` : '0px',
            opacity: isExpanded ? 1 : 0,
          }}
        >
          {section.children!.map((item) => (
            <SidebarChildItem
              key={item.id}
              item={item}
              isActive={activeItemId === item.id}
              onItemClick={onItemClick}
              onKeyDown={onKeyDown}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

/** Props for individual child item rendering */
interface SidebarChildItemProps {
  item: SidebarItemData;
  isActive: boolean;
  onItemClick: (itemId: string) => void;
  onKeyDown: (e: KeyboardEvent<HTMLButtonElement>, action: () => void) => void;
}

function SidebarChildItem({
  item,
  isActive,
  onItemClick,
  onKeyDown,
}: SidebarChildItemProps) {
  const ItemIcon = item.icon;

  return (
    <li>
      <button
        type="button"
        onClick={() => onItemClick(item.id)}
        onKeyDown={(e) => onKeyDown(e, () => onItemClick(item.id))}
        aria-current={isActive ? 'page' : undefined}
        className={cn(
          'flex items-center w-full h-9 pl-10 pr-3 gap-2.5 rounded-[var(--radius-md)]',
          'text-sm transition-colors duration-[var(--duration-fast)]',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary-400)]',
          isActive
            ? 'text-[var(--color-primary-400)] bg-[var(--color-primary-500)]/5'
            : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)]',
        )}
      >
        {ItemIcon && (
          <ItemIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
        )}
        <span className="flex-1 text-left truncate">{item.label}</span>
        {item.status && (
          <span
            className={cn(
              'h-2 w-2 rounded-full shrink-0',
              statusColors[item.status],
            )}
            aria-label={`Status: ${item.status}`}
          />
        )}
      </button>
    </li>
  );
}
