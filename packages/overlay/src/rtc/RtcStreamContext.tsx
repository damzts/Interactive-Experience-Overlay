/**
 * RTC Stream Context — receives media from the server via mediasoup.
 *
 * Uses mediasoup-client Device to create a recv transport and consume
 * audio/video producers from the server relay.
 *
 * Protocol (Socket.IO events):
 *   overlay → server: 'pov-online:relay:subscribe'
 *   server → overlay: 'pov-online:relay:offer' { transportOptions, routerRtpCapabilities }
 *   overlay → server: 'pov-online:relay:answer' { dtlsParameters }
 *   server → overlay: 'pov-online:relay:new-consumer' { consumerId, producerId, kind, rtpParameters }
 */

import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { Device } from 'mediasoup-client'
import type { Transport, Consumer } from 'mediasoup-client/lib/types'
import { socket } from '../socket/client'

const RtcStreamContext = createContext<MediaStream | null>(null)

export function useRtcStream(): MediaStream | null {
  return useContext(RtcStreamContext)
}

export function RtcStreamProvider({ children }: { children: React.ReactNode }) {
  const [stream, setStream] = useState<MediaStream | null>(null)
  const deviceRef = useRef<Device | null>(null)
  const transportRef = useRef<Transport | null>(null)
  const consumersRef = useRef<Map<string, Consumer>>(new Map())
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const pendingConsumersRef = useRef<Array<any>>([])

  useEffect(() => {
    let cancelled = false
    let reconnectAttempt = 0
    const RECONNECT_MAX_DELAY = 10000

    const cleanup = (clearStream = true) => {
      // Close all consumers
      for (const consumer of consumersRef.current.values()) {
        consumer.close()
      }
      consumersRef.current.clear()
      pendingConsumersRef.current = []

      // Close transport
      if (transportRef.current) {
        try { transportRef.current.close() } catch {}
        transportRef.current = null
      }

      mediaStreamRef.current = null
      if (clearStream && !cancelled) setStream(null)
    }

    const subscribe = () => {
      cleanup(false)
      console.info('[rtc-stream] subscribing to relay')
      socket.emit('pov-online:relay:subscribe' as any)
    }

    const handleOffer = async (payload: {
      transportOptions: {
        id: string
        iceParameters: any
        iceCandidates: any[]
        dtlsParameters: any
        sctpParameters?: any
      }
      routerRtpCapabilities: any
    }) => {
      if (cancelled) return
      cleanup(false)
      console.info('[rtc-stream] received relay offer', payload)

      try {
        // Create or reuse Device
        let device = deviceRef.current
        if (!device || !device.loaded) {
          device = new Device()
          console.info('[rtc-stream] loading device with router capabilities')
          await device.load({ routerRtpCapabilities: payload.routerRtpCapabilities })
          deviceRef.current = device
          console.info('[rtc-stream] device loaded successfully')
        }

        // Create recv transport
        console.info('[rtc-stream] creating recv transport with options:', payload.transportOptions.id)
        const transport = device.createRecvTransport({
          id: payload.transportOptions.id,
          iceParameters: payload.transportOptions.iceParameters,
          iceCandidates: payload.transportOptions.iceCandidates,
          dtlsParameters: payload.transportOptions.dtlsParameters,
          sctpParameters: payload.transportOptions.sctpParameters,
        })
        transportRef.current = transport
        console.info('[rtc-stream] recv transport created')

        // When transport needs to connect (DTLS), send params to server
        transport.on('connect', ({ dtlsParameters }, callback, errback) => {
          console.info('[rtc-stream] transport connect event — sending dtlsParameters to server')
          try {
            socket.emit('pov-online:relay:answer' as any, { dtlsParameters })
            callback()
          } catch (err) {
            errback(err as Error)
          }
        })

        transport.on('connectionstatechange', (state: string) => {
          if (state === 'connected') {
            reconnectAttempt = 0
          }
          if (state === 'failed' && !cancelled) {
            reconnectAttempt++
            const delay = Math.min(1000 * Math.pow(2, reconnectAttempt - 1), RECONNECT_MAX_DELAY)
            setTimeout(() => {
              if (!cancelled) subscribe()
            }, delay)
          }
        })

        // Prepare MediaStream
        mediaStreamRef.current = new MediaStream()

        // Flush any consumers that arrived before the transport was ready
        if (pendingConsumersRef.current.length > 0) {
          console.info(`[rtc-stream] flushing ${pendingConsumersRef.current.length} pending consumers`)
          const pending = [...pendingConsumersRef.current]
          pendingConsumersRef.current = []
          for (const p of pending) {
            await consumeOne(p)
          }
        }

      } catch (e) {
        console.error('[rtc-stream] mediasoup device/transport error:', e)
      }
    }

    const consumeOne = async (payload: {
      consumerId: string
      producerId: string
      kind: 'audio' | 'video'
      rtpParameters: any
    }) => {
      const transport = transportRef.current
      if (!transport) return

      try {
        const consumer = await transport.consume({
          id: payload.consumerId,
          producerId: payload.producerId,
          kind: payload.kind,
          rtpParameters: payload.rtpParameters,
        })

        // Close previous consumer of the same kind (replace, don't accumulate)
        for (const [id, existing] of consumersRef.current) {
          if (existing.kind === payload.kind) {
            // Remove old track from MediaStream
            if (mediaStreamRef.current) {
              mediaStreamRef.current.removeTrack(existing.track)
            }
            existing.close()
            consumersRef.current.delete(id)
          }
        }

        consumersRef.current.set(consumer.id, consumer)

        if (!mediaStreamRef.current) {
          mediaStreamRef.current = new MediaStream()
        }
        mediaStreamRef.current.addTrack(consumer.track)

        if (!cancelled) {
          // Force React to see a new stream reference
          setStream(new MediaStream(mediaStreamRef.current.getTracks()))
        }

        consumer.on('trackended', () => {
          console.info(`[rtc-stream] consumer ${consumer.id} track ended`)
        })

        consumer.on('transportclose', () => {
          consumersRef.current.delete(consumer.id)
        })

        console.info(`[rtc-stream] consuming ${payload.kind} (consumer=${consumer.id})`)
      } catch (e) {
        console.error(`[rtc-stream] consume ${payload.kind} error:`, e)
      }
    }

    const handleNewConsumer = async (payload: {
      consumerId: string
      producerId: string
      kind: 'audio' | 'video'
      rtpParameters: any
    }) => {
      if (cancelled) return

      // If transport isn't ready yet, buffer the consumer for later
      if (!transportRef.current) {
        console.info(`[rtc-stream] buffering ${payload.kind} consumer (transport not ready)`)
        pendingConsumersRef.current.push(payload)
        return
      }

      await consumeOne(payload)
    }

    // Legacy ICE handler (no-op in mediasoup mode, kept for compat)
    const handleIce = () => {}

    socket.on('pov-online:relay:offer' as any, handleOffer)
    socket.on('pov-online:relay:new-consumer' as any, handleNewConsumer)
    socket.on('pov-online:relay:ice' as any, handleIce)
    socket.on('connect', subscribe)

    if (socket.connected) subscribe()

    return () => {
      cancelled = true
      socket.off('pov-online:relay:offer' as any, handleOffer)
      socket.off('pov-online:relay:new-consumer' as any, handleNewConsumer)
      socket.off('pov-online:relay:ice' as any, handleIce)
      socket.off('connect', subscribe)
      cleanup(true)
    }
  }, [])

  return (
    <RtcStreamContext.Provider value={stream}>
      {children}
    </RtcStreamContext.Provider>
  )
}
