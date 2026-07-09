/**
 * ABI contract test — boots the socket handler orchestrator headless
 * (real managers, fake io/socket, no network) and asserts the invariants
 * every client relies on:
 *
 *   1. Every public KernelSignalMap event round-trips through the generic
 *      kernel:signal bridge; non-public bus events never leak.
 *   2. overlay:sync returns the atomic { state, desktop, config } snapshot,
 *      and the desktop payload speaks no skin concepts (P4).
 *   3. presentation:state reports are stored opaquely, rebroadcast, and
 *      included in subsequent syncs.
 *   4. The single-overlay slot rule rejects a second overlay connection.
 *
 * If this file fails to compile after a contracts change, the ABI moved —
 * update clients, not just this test.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { PUBLIC_KERNEL_SIGNALS, DEFAULT_CONFIG, STATE } from '@ieomlabs/shared'
import type { AppConfig, BusFrame, OverlaySyncSnapshot } from '@ieomlabs/shared'
import { KernelBus } from '../../../kernel/bus.js'
import { SceneManager } from '../../../kernel/managers/scene.js'
import { EventScheduler } from '../../../kernel/managers/scheduler.js'
import { AmbianceManager } from '../../../kernel/managers/ambiance.js'
import { RuntimeStateStore } from '../../../kernel/managers/runtime.js'
import { setupSocketHandlers } from '../handlers/index.js'
import type { IO, AppSocket } from '../handlers/types.js'

type Handler = (...args: unknown[]) => void

function makeFakeSocket(id: string, clientType: 'overlay' | 'admin') {
  const handlers = new Map<string, Handler[]>()
  const socket = {
    id,
    handshake: { auth: { clientType } },
    data: {},
    emit: vi.fn(),
    join: vi.fn(),
    disconnect: vi.fn(),
    on: (event: string, handler: Handler) => {
      const list = handlers.get(event) ?? []
      list.push(handler)
      handlers.set(event, list)
    },
    off: vi.fn(),
  }
  const invoke = (event: string, ...args: unknown[]) => {
    const list = handlers.get(event)
    expect(list, `no handler registered for '${event}'`).toBeDefined()
    for (const h of list!) h(...args)
  }
  return { socket: socket as unknown as AppSocket, raw: socket, invoke, handlers }
}

function setup() {
  let connectionHandler: Handler | null = null
  const socketsMap = new Map<string, unknown>()
  const io = {
    emit: vi.fn(),
    on: (event: string, handler: Handler) => {
      if (event === 'connection') connectionHandler = handler
    },
    to: () => ({ emit: vi.fn() }),
    sockets: { sockets: socketsMap },
  }

  const bus = new KernelBus()
  const machine = new SceneManager(bus)
  const getConfig = () => DEFAULT_CONFIG as unknown as AppConfig
  const scheduler = new EventScheduler(machine, getConfig, bus)
  const ambiance = new AmbianceManager(io as unknown as Parameters<typeof setupSocketHandlers>[0], getConfig, bus)
  const runtimeState = new RuntimeStateStore()

  setupSocketHandlers(io as unknown as IO, machine, scheduler, ambiance, { bus, runtimeState })

  const connect = (id: string, clientType: 'overlay' | 'admin') => {
    const fake = makeFakeSocket(id, clientType)
    socketsMap.set(id, fake.raw)
    connectionHandler!(fake.socket)
    return fake
  }

  return { io, bus, machine, scheduler, ambiance, runtimeState, connect }
}

// Emit an arbitrary event on the typed bus (payload shapes are opaque to the bridge).
function busEmit(bus: KernelBus, event: string, payload: unknown) {
  ;(bus.emit as unknown as (e: string, p: unknown) => void)(event, payload)
}

let cleanup: Array<() => void> = []
afterEach(() => {
  for (const fn of cleanup) fn()
  cleanup = []
})

describe('kernel:signal bridge (P1 fabric)', () => {
  it('forwards every public KernelSignalMap event as a BusFrame envelope', () => {
    const { io, bus, scheduler, ambiance } = setup()
    cleanup.push(() => { scheduler.dispose(); ambiance.dispose() })

    expect(PUBLIC_KERNEL_SIGNALS.length).toBeGreaterThan(0)
    for (const event of PUBLIC_KERNEL_SIGNALS) {
      busEmit(bus, event, { probe: event })
    }

    const forwarded = io.emit.mock.calls
      .filter(([channel]) => channel === 'kernel:signal')
      .map(([, frame]) => frame as BusFrame)

    const forwardedEvents = new Set(forwarded.map((f) => f.event))
    for (const event of PUBLIC_KERNEL_SIGNALS) {
      expect(forwardedEvents.has(event), `public signal '${event}' did not forward`).toBe(true)
    }
    // Envelope shape
    for (const frame of forwarded) {
      expect(typeof frame.t).toBe('number')
      expect(typeof frame.seq).toBe('number')
      expect(frame).toHaveProperty('payload')
    }
  })

  it('never leaks non-public bus events to clients', () => {
    const { io, bus, scheduler, ambiance } = setup()
    cleanup.push(() => { scheduler.dispose(); ambiance.dispose() })

    busEmit(bus, 'internal:definitely-not-public', { secret: true })

    const leaked = io.emit.mock.calls
      .filter(([channel]) => channel === 'kernel:signal')
      .map(([, frame]) => (frame as BusFrame).event)
    expect(leaked).not.toContain('internal:definitely-not-public')
  })
})

describe('overlay:sync (atomic connect snapshot)', () => {
  it('returns { state, desktop, config } and the desktop payload speaks no skin concepts', () => {
    const { scheduler, ambiance, connect } = setup()
    cleanup.push(() => { scheduler.dispose(); ambiance.dispose() })

    const overlay = connect('overlay-1', 'overlay')
    let snapshot: OverlaySyncSnapshot | null = null
    overlay.invoke('overlay:sync', (s: OverlaySyncSnapshot) => { snapshot = s })

    expect(snapshot).not.toBeNull()
    const snap = snapshot! as OverlaySyncSnapshot
    expect(snap.state).toBe(STATE.DESKTOP)
    expect(Array.isArray(snap.desktop.openWidgetIds)).toBe(true)
    expect(snap.desktop.presentation).toEqual({})
    expect(snap.config).toHaveProperty('scenes')
    // P4 regression: the kernel-owned desktop payload carries no Win98 fields
    expect(snap.desktop).not.toHaveProperty('recycleBinFull')
    expect(snap.desktop).not.toHaveProperty('startMenuState')
  })
})

describe('presentation:state relay (P4)', () => {
  it('stores reported facts opaquely, rebroadcasts them, and includes them in later syncs', () => {
    const { io, runtimeState, scheduler, ambiance, connect } = setup()
    cleanup.push(() => { scheduler.dispose(); ambiance.dispose() })

    const overlay = connect('overlay-1', 'overlay')
    const value = { open: true, activeRoot: 'programs' }
    overlay.invoke('presentation:state', { key: 'start-menu', value, activity: true })

    expect(runtimeState.presentationState['start-menu']).toEqual(value)
    expect(io.emit).toHaveBeenCalledWith('presentation:state', { key: 'start-menu', value })

    let snapshot: OverlaySyncSnapshot | null = null
    overlay.invoke('overlay:sync', (s: OverlaySyncSnapshot) => { snapshot = s })
    expect((snapshot! as OverlaySyncSnapshot).desktop.presentation['start-menu']).toEqual(value)
  })

  it('ignores malformed reports (no key)', () => {
    const { io, runtimeState, scheduler, ambiance, connect } = setup()
    cleanup.push(() => { scheduler.dispose(); ambiance.dispose() })

    const overlay = connect('overlay-1', 'overlay')
    io.emit.mockClear()
    overlay.invoke('presentation:state', { value: { full: true } })

    expect(Object.keys(runtimeState.presentationState)).toHaveLength(0)
    expect(io.emit).not.toHaveBeenCalledWith('presentation:state', expect.anything())
  })
})

describe('single-overlay slot rule', () => {
  it('rejects a second overlay connection while the slot is taken', () => {
    vi.useFakeTimers()
    const { runtimeState, scheduler, ambiance, connect } = setup()
    cleanup.push(() => { scheduler.dispose(); ambiance.dispose(); vi.useRealTimers() })

    connect('overlay-1', 'overlay')
    expect(runtimeState.overlaySocketId).toBe('overlay-1')

    const second = connect('overlay-2', 'overlay')
    expect(second.raw.emit).toHaveBeenCalledWith(
      'overlay:rejected',
      expect.objectContaining({ reason: expect.any(String) }),
    )
    expect(runtimeState.overlaySocketId).toBe('overlay-1')
  })
})
