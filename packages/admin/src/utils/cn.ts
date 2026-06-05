import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merges class names using clsx for conditional composition
 * and tailwind-merge for conflict-free Tailwind CSS class resolution.
 *
 * @example
 * cn('px-4 py-2', isActive && 'bg-primary-500', 'px-6')
 * // → 'py-2 px-6 bg-primary-500' (px-4 is resolved in favor of px-6)
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
