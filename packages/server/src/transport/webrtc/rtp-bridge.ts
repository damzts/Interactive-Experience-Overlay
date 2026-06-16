/**
 * RTP Bridge — pipes werift MediaStreamTracks into mediasoup Producers.
 *
 * For each werift track, creates a mediasoup PlainTransport on localhost,
 * forwards RTP packets from werift → PlainTransport → Producer.
 *
 * This enables the hybrid architecture:
 *  - werift: ICE completo (guest → server, NAT traversal)
 *  - mediasoup: Consumer model (server → overlay, reconnect sin freeze)
 */

import type * as mediasoup from 'mediasoup'
import type { MediaStreamTrack } from 'werift'
import { createSocket, type Socket as DgramSocket } from 'dgram'
import logger from '../../lib/logger.js'

export interface BridgedProducer {
  kind: 'audio' | 'video'
  producer: mediasoup.types.Producer
  transport: mediasoup.types.PlainTransport
  udpSocket: DgramSocket
  unsubscribe: () => void
}

/**
 * Bridge a werift track into a mediasoup Producer.
 * Returns the Producer (for consumption by relay/preview) and cleanup handles.
 */
export async function bridgeTrackToProducer(
  router: mediasoup.types.Router,
  track: MediaStreamTrack,
  kind: 'audio' | 'video',
): Promise<BridgedProducer> {
  // Create a PlainTransport that listens on a random localhost port
  const transport = await router.createPlainTransport({
    listenInfo: { protocol: 'udp', ip: '127.0.0.1' },
    rtcpMux: true,
    comedia: true, // Let mediasoup figure out the remote port from incoming packets
  })

  const localPort = transport.tuple.localPort

  // Choose codec based on kind
  const codec = kind === 'audio'
    ? router.rtpCapabilities.codecs!.find(c => c.mimeType.toLowerCase() === 'audio/opus')!
    : router.rtpCapabilities.codecs!.find(c => c.mimeType.toLowerCase() === 'video/vp8')
      ?? router.rtpCapabilities.codecs!.find(c => c.mimeType.toLowerCase().startsWith('video/'))!

  // Create Producer on the PlainTransport
  const payloadType = codec.preferredPayloadType!
  const ssrc = kind === 'audio' ? 11111111 : 22222222

  const producer = await transport.produce({
    kind,
    rtpParameters: {
      codecs: [{
        mimeType: codec.mimeType,
        payloadType,
        clockRate: codec.clockRate,
        channels: codec.channels,
        parameters: codec.parameters as Record<string, string | number> ?? {},
      }],
      encodings: [{ ssrc }],
    },
  })

  // Create a UDP socket to forward RTP from werift → PlainTransport
  const udpSocket = createSocket('udp4')
  udpSocket.bind() // Bind to random port

  // Subscribe to werift track's RTP packets and forward them
  // We need to rewrite the SSRC and payload type to match what mediasoup expects
  let packetCount = 0
  let lastLogTime = Date.now()
  const subscription = track.onReceiveRtp.subscribe((rtpPacket) => {
    try {
      const buf = rtpPacket.serialize()
      // Rewrite SSRC (bytes 8-11) to match our Producer's expected SSRC
      buf.writeUInt32BE(ssrc, 8)
      // Rewrite payload type (byte 1, lower 7 bits) to match mediasoup's expected PT
      buf[1] = (buf[1] & 0x80) | (payloadType & 0x7f)
      udpSocket.send(buf, localPort, '127.0.0.1')
      packetCount++
      // Log every 5 seconds to confirm RTP is flowing
      const now = Date.now()
      if (now - lastLogTime > 5000) {
        logger.info(`[rtp-bridge] ${kind} flowing: ${packetCount} packets sent to localhost:${localPort}`)
        packetCount = 0
        lastLogTime = now
      }
    } catch {
      // Ignore send errors (socket closed, etc.)
    }
  })

  const unsubscribe = () => {
    subscription.unSubscribe()
  }

  logger.info(`[rtp-bridge] bridged ${kind} track → Producer ${producer.id} (localhost:${localPort}, ssrc=${ssrc}, pt=${payloadType})`)

  // Create a UDP socket to forward RTP from werift → PlainTransport
  const udpSocket = createSocket('udp4')
  udpSocket.bind() // Bind to random port

  // Subscribe to werift track's RTP packets and forward them
  // We need to rewrite the SSRC and payload type to match what mediasoup expects
  let packetCount = 0
  let lastLogTime = Date.now()
  const subscription = track.onReceiveRtp.subscribe((rtpPacket) => {
    try {
      const buf = rtpPacket.serialize()
      // Rewrite SSRC (bytes 8-11) to match our Producer's expected SSRC
      buf.writeUInt32BE(ssrc, 8)
      // Rewrite payload type (byte 1, lower 7 bits) to match mediasoup's expected PT
      buf[1] = (buf[1] & 0x80) | (payloadType & 0x7f)
      udpSocket.send(buf, localPort, '127.0.0.1')
      packetCount++
      // Log every 5 seconds to confirm RTP is flowing
      const now = Date.now()
      if (now - lastLogTime > 5000) {
        logger.info(`[rtp-bridge] ${kind} flowing: ${packetCount} packets sent to localhost:${localPort}`)
        packetCount = 0
        lastLogTime = now
      }
    } catch {
      // Ignore send errors (socket closed, etc.)
    }
  })

  const unsubscribe = () => {
    subscription.unSubscribe()
  }

  logger.info(`[rtp-bridge] bridged ${kind} track → Producer ${producer.id} (localhost:${localPort}, ssrc=${ssrc}, pt=${payloadType})`)

  return { kind, producer, transport, udpSocket, unsubscribe }
}

/**
 * Close and clean up a bridged producer.
 */
export function closeBridgedProducer(bridged: BridgedProducer): void {
  bridged.unsubscribe()
  try { bridged.udpSocket.close() } catch {}
  try { bridged.producer.close() } catch {}
  try { bridged.transport.close() } catch {}
}
