// Domain entities
export * from './domain/geometry.js'
export * from './domain/overlay.js'
export * from './domain/plugin.js'
export * from './domain/fields.js'
export * from './domain/effectCatalog.js'
export * from './domain/actionCatalog.js'
export * from './domain/scene.js'
export * from './domain/sequence.js'
export * from './domain/application.js'
export * from './domain/desktop.js'
export * from './domain/themeDrift.js'
export * from './domain/persona.js'
export * from './domain/ambiance.js'
export * from './domain/event.js'
export * from './domain/config.js'
export * from './domain/pov.js'
export * from './domain/online.js'

// Contracts (socket, effects, state, diagnostics, widget lifecycle, automation)
export * from './contracts/manager.js'
export * from './contracts/automation.js'
export * from './contracts/state.js'
export * from './contracts/effects.js'
// socket.ts is a backward-compat barrel that re-exports signals.ts + commands.ts + queries.ts
// Import from signals/commands/queries directly for focused access
export * from './contracts/socket.js'
export type { BusFrame } from './contracts/signals.js'
export * from './contracts/diagnostics.js'
export * from './contracts/online-socket.js'
export * from './contracts/widget.js'

// Widget declarations (declaration-first: one definition.ts per widget)
export * from './widgets/index.js'

// Constants and utilities
export * from './constants/ambianceSimulation.js'
export * from './constants/automationGate.js'
export * from './constants/defaults.js'
export * from './constants/widgetIntentManifests.js'
