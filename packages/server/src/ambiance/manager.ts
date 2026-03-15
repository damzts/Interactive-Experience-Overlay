import type { Server } from 'socket.io'
import { appendLog } from '../db/db.js'
import { getConfig } from '../routes/config.js'
import { withDesktopAmbianceDefaults } from '@ieom/shared'

function shouldTrigger(chance: number): boolean {
  if (chance <= 0) return false
  if (chance >= 1) return true
  return Math.random() < chance
}

export class AmbianceManager {
  private tickTimer: ReturnType<typeof setInterval> | null = null
  private getOpenWidgetIds?: () => Set<string>

  constructor(private io: Server) {}

  setOpenWidgetIdsGetter(getter: () => Set<string>) {
    this.getOpenWidgetIds = getter
  }

  start() {
    this.stop()
    const config = withDesktopAmbianceDefaults(getConfig().desktopAmbiance)
    const intervalMs = Math.max(1, config.widgetSimulation.intervalSeconds) * 1000
    
    if (intervalMs > 0) {
      this.tickTimer = setInterval(() => this.tick(), intervalMs)
      console.log(`[ambiance] AI simulation manager started. Ticking every ${intervalMs / 1000}s.`)
    }
  }

  stop() {
    if (this.tickTimer) {
      clearInterval(this.tickTimer)
      this.tickTimer = null
      console.log('[ambiance] AI simulation manager stopped.')
    }
  }

  private tick() {
    const config = withDesktopAmbianceDefaults(getConfig().desktopAmbiance)
    const simConfig = config.widgetSimulation
    
    if (!simConfig.enabled) {
      return
    }
    
    const openWidgetIds = this.getOpenWidgetIds?.() ?? new Set()
    const allWidgetIds = Object.keys(simConfig.behaviors)

    for (const widgetId of allWidgetIds) {
      const behavior = simConfig.behaviors[widgetId]
      if (!behavior || !behavior.enabled) {
        continue
      }
      
      const isOpen = openWidgetIds.has(widgetId)
      
      if (isOpen) {
        if (shouldTrigger(behavior.closeChance)) {
          appendLog('ambiance-sim', `Close requested for widget: ${widgetId} (handled by client simulation)`)
          continue
        }
      } else {
        if (shouldTrigger(behavior.openChance)) {
          appendLog('ambiance-sim', `Open requested for widget: ${widgetId} (handled by client simulation)`)
        }
      }
    }
  }
}
