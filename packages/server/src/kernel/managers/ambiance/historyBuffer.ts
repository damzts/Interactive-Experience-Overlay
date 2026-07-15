/**
 * AmbianceHistoryBuffer — fixed-size circular buffer of recent ambiance
 * simulation events, newest first. Isolated from AmbianceManager so the
 * "keep the last N entries" bookkeeping isn't mixed in with simulation
 * timeout/lifecycle state.
 */

import type { AmbianceHistoryEntry } from '@ieomlabs/shared'

const AMBIANCE_HISTORY_LIMIT = 10

export class AmbianceHistoryBuffer {
  private entries: AmbianceHistoryEntry[] = []
  private sequence = 0

  get(): AmbianceHistoryEntry[] {
    return this.entries
  }

  clear(): boolean {
    if (this.entries.length === 0) return false
    this.entries = []
    return true
  }

  record(
    type: AmbianceHistoryEntry['type'],
    message: string,
    metadata: Omit<Partial<AmbianceHistoryEntry>, 'id' | 'timestamp' | 'type' | 'message'> = {},
  ): AmbianceHistoryEntry {
    const entry: AmbianceHistoryEntry = {
      id: `ambiance-history-${Date.now()}-${++this.sequence}`,
      timestamp: Date.now(),
      type,
      message,
      ...metadata,
    }
    this.entries = [entry, ...this.entries].slice(0, AMBIANCE_HISTORY_LIMIT)
    return entry
  }
}
