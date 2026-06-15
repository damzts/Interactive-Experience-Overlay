/**
 * SDP ↔ mediasoup bridge.
 *
 * Translates standard WebRTC SDP offers from browser guests into mediasoup
 * transport/produce parameters, and generates SDP answers from mediasoup
 * transport info.
 *
 * This allows browser guests using standard RTCPeerConnection to connect
 * to our mediasoup-based SFU without requiring mediasoup-client.
 */

import * as sdpTransform from 'sdp-transform'
import type * as mediasoup from 'mediasoup'
import logger from '../../lib/logger.js'

// ── Types ────────────────────────────────────────────────────────

export interface ParsedOffer {
  dtlsParameters: mediasoup.types.DtlsParameters
  rtpParametersByKind: Map<'audio' | 'video', mediasoup.types.RtpParameters>
  /** ICE credentials from the offer (ufrag + pwd) */
  iceUfrag: string
  icePwd: string
  /** Mid values per media section */
  mids: string[]
}

// ── Parse SDP Offer ──────────────────────────────────────────────

export function parseOffer(sdp: string, routerRtpCapabilities: mediasoup.types.RtpCapabilities): ParsedOffer {
  const parsed = sdpTransform.parse(sdp)
  const mediaSections = parsed.media || []

  let iceUfrag = parsed.iceUfrag || ''
  let icePwd = parsed.icePwd || ''
  let fingerprint = parsed.fingerprint?.hash || ''
  let fingerprintAlgorithm = parsed.fingerprint?.type || 'sha-256'
  let dtlsRole: 'client' | 'server' | 'auto' = 'auto'

  const rtpParametersByKind = new Map<'audio' | 'video', mediasoup.types.RtpParameters>()
  const mids: string[] = []

  for (const media of mediaSections) {
    const kind = media.type as 'audio' | 'video'
    if (kind !== 'audio' && kind !== 'video') continue

    // Extract ICE from media-level if not at session level
    if (!iceUfrag && media.iceUfrag) iceUfrag = media.iceUfrag
    if (!icePwd && media.icePwd) icePwd = media.icePwd

    // Extract fingerprint from media-level if not at session level
    if (!fingerprint && media.fingerprint) {
      fingerprint = media.fingerprint.hash
      fingerprintAlgorithm = media.fingerprint.type
    }

    // Extract DTLS setup
    if (media.setup) {
      if (media.setup === 'actpass' || media.setup === 'active') {
        dtlsRole = 'client' // Remote is active/actpass → we are server
      } else {
        dtlsRole = 'server'
      }
    }

    const mid = media.mid?.toString() ?? mids.length.toString()
    mids.push(mid)

    // Build RTP parameters from the SDP
    const codecs: mediasoup.types.RtpCodecParameters[] = []
    const headerExtensions: mediasoup.types.RtpHeaderExtensionParameters[] = []

    // Parse codecs from the offer
    const rtpMaps = media.rtp || []
    const fmtps = media.fmtp || []
    const rtcpFbs = (media as any).rtcpFb || []

    for (const rtp of rtpMaps) {
      // Check if this codec is supported by the router (by mimeType + clockRate).
      // For H264, mediasoup will do its own profile-level-id matching internally,
      // so we just check mimeType/clockRate here and let produce() handle the rest.
      const codecMimeType = `${kind}/${rtp.codec}`.toLowerCase()

      // For H264, we need to find a router codec that matches the profile-level-id
      // from the fmtp parameters, because mediasoup is strict about this.
      const fmtp = fmtps.find(f => f.payload === rtp.payload)
      const parameters: Record<string, string | number> = {}
      if (fmtp?.config) {
        for (const param of fmtp.config.split(';')) {
          const [key, value] = param.trim().split('=')
          if (key && value !== undefined) {
            parameters[key.trim()] = isNaN(Number(value)) ? value : Number(value)
          }
        }
      }

      let routerCodec: any = null
      if (codecMimeType === 'video/h264') {
        // H264: must match profile-level-id (first 4 hex chars) AND packetization-mode
        const offerProfile = String(parameters['profile-level-id'] || '').toLowerCase()
        const offerPacketizationMode = parameters['packetization-mode'] ?? 0
        routerCodec = routerRtpCapabilities.codecs?.find(rc => {
          if (rc.mimeType.toLowerCase() !== codecMimeType) return false
          if (rc.clockRate !== rtp.rate) return false
          const rcProfile = String((rc.parameters as any)?.['profile-level-id'] || '').toLowerCase()
          const rcPackMode = (rc.parameters as any)?.['packetization-mode'] ?? 0
          // mediasoup matches H264 by comparing first 4 hex chars of profile-level-id
          // and packetization-mode must match exactly
          return offerProfile.slice(0, 4) === rcProfile.slice(0, 4) &&
                 Number(offerPacketizationMode) === Number(rcPackMode)
        })
      } else {
        routerCodec = routerRtpCapabilities.codecs?.find(rc =>
          rc.mimeType.toLowerCase() === codecMimeType &&
          rc.clockRate === rtp.rate
        )
      }
      if (!routerCodec) continue

      const rtcpFeedback: mediasoup.types.RtcpFeedback[] = []
      for (const fb of rtcpFbs) {
        if (fb.payload === rtp.payload) {
          rtcpFeedback.push({ type: fb.type, parameter: fb.subtype || '' })
        }
      }

      codecs.push({
        mimeType: `${kind}/${rtp.codec}`,
        payloadType: rtp.payload,
        clockRate: rtp.rate,
        ...(rtp.encoding ? { channels: Number(rtp.encoding) } : {}),
        parameters,
        rtcpFeedback,
      } as mediasoup.types.RtpCodecParameters)
    }

    // Parse header extensions
    const exts = media.ext || []
    for (const ext of exts) {
      // Check if the router supports this extension
      const routerExt = routerRtpCapabilities.headerExtensions?.find(re =>
        re.uri === ext.uri && (re.kind === kind || !re.kind)
      )
      if (routerExt) {
        headerExtensions.push({
          uri: ext.uri as mediasoup.types.RtpHeaderExtensionUri,
          id: ext.value,
          encrypt: false,
        })
      }
    }

    // Parse SSRC
    const ssrcs = media.ssrcs || []
    const ssrcId = ssrcs.length > 0 ? ssrcs[0].id : undefined

    const encodings: mediasoup.types.RtpEncodingParameters[] = []
    if (ssrcId) {
      encodings.push({ ssrc: ssrcId })
    } else {
      encodings.push({})
    }

    if (codecs.length > 0) {
      // Filter out orphaned RTX codecs — RTX whose `apt` doesn't reference
      // a media codec that's present in our list. mediasoup will reject these.
      const mediaPayloadTypes = new Set(
        codecs.filter(c => !c.mimeType.toLowerCase().endsWith('/rtx')).map(c => c.payloadType)
      )
      const filteredCodecs = codecs.filter(c => {
        if (!c.mimeType.toLowerCase().endsWith('/rtx')) return true
        const apt = (c.parameters as Record<string, unknown>)?.['apt']
        return apt !== undefined && mediaPayloadTypes.has(Number(apt))
      })

      rtpParametersByKind.set(kind, {
        mid,
        codecs: filteredCodecs,
        headerExtensions,
        encodings,
      })
    }
  }

  const dtlsParameters: mediasoup.types.DtlsParameters = {
    role: dtlsRole,
    fingerprints: [
      {
        algorithm: fingerprintAlgorithm as mediasoup.types.FingerprintAlgorithm,
        value: fingerprint,
      },
    ],
  }

  return { dtlsParameters, rtpParametersByKind, iceUfrag, icePwd, mids }
}

// ── Generate SDP Answer ──────────────────────────────────────────

export function generateAnswer(
  transport: mediasoup.types.WebRtcTransport,
  parsedOffer: ParsedOffer,
  producers: Map<string, mediasoup.types.Producer>, // mid → producer
): string {
  const { iceParameters, iceCandidates, dtlsParameters } = transport

  const mediaSections: sdpTransform.MediaDescription[] = []

  for (const mid of parsedOffer.mids) {
    const offerRtp = parsedOffer.rtpParametersByKind.get(
      mid === '0' || parsedOffer.mids.indexOf(mid) === 0 ? getKindForMid(parsedOffer, mid) : getKindForMid(parsedOffer, mid)
    )

    if (!offerRtp) continue

    const kind = offerRtp.codecs[0]?.mimeType.split('/')[0] as 'audio' | 'video'
    const port = 9 // Standard for bundled media

    const mediaDesc: sdpTransform.MediaDescription = {
      type: kind,
      port,
      protocol: 'UDP/TLS/RTP/SAVPF',
      payloads: offerRtp.codecs.map(c => c.payloadType).join(' '),
      mid,
      direction: 'recvonly' as any,
      iceUfrag: iceParameters.usernameFragment,
      icePwd: iceParameters.password,
      fingerprint: {
        type: dtlsParameters.fingerprints[dtlsParameters.fingerprints.length - 1].algorithm,
        hash: dtlsParameters.fingerprints[dtlsParameters.fingerprints.length - 1].value,
      },
      setup: dtlsParameters.role === 'client' ? 'active' : 'passive',
      connection: { ip: '127.0.0.1', version: 4 },
      rtp: offerRtp.codecs.map(c => ({
        payload: c.payloadType,
        codec: c.mimeType.split('/')[1],
        rate: c.clockRate,
        encoding: c.channels,
      })),
      fmtp: offerRtp.codecs
        .filter(c => Object.keys(c.parameters || {}).length > 0)
        .map(c => ({
          payload: c.payloadType,
          config: Object.entries(c.parameters || {}).map(([k, v]) => `${k}=${v}`).join(';'),
        })),
      ext: (offerRtp.headerExtensions || []).map(e => ({
        value: e.id,
        uri: e.uri,
      })),
      rtcpMux: 'rtcp-mux',
      candidates: iceCandidates.map(c => ({
        foundation: c.foundation,
        component: 1,
        transport: c.protocol,
        priority: c.priority,
        ip: c.address ?? c.ip,
        port: c.port,
        type: c.type,
      })),
    }

    mediaSections.push(mediaDesc)
  }

  const sdpObj: sdpTransform.SessionDescription = {
    version: 0,
    origin: {
      username: 'mediasoup',
      sessionId: '10000',
      sessionVersion: 1,
      netType: 'IN',
      ipVer: 4,
      address: '127.0.0.1',
    },
    name: '-',
    timing: { start: 0, stop: 0 },
    groups: [{ type: 'BUNDLE', mids: parsedOffer.mids.join(' ') }],
    msidSemantic: { semantic: 'WMS', token: '*' },
    media: mediaSections,
  }

  return sdpTransform.write(sdpObj)
}

// ── Helpers ──────────────────────────────────────────────────────

function getKindForMid(parsedOffer: ParsedOffer, mid: string): 'audio' | 'video' {
  // Find which kind corresponds to this mid by checking the rtpParametersByKind map
  for (const [kind, params] of parsedOffer.rtpParametersByKind) {
    if (params.mid === mid) return kind
  }
  return 'video' // default fallback
}

/**
 * Generate a simple SDP answer for consumption by a standard RTCPeerConnection.
 * This is a simplified version for the overlay/admin that use mediasoup-client
 * style signaling (not SDP-based).
 */
export function generateSimpleAnswer(
  transport: mediasoup.types.WebRtcTransport,
  offerSdp: string,
): string {
  const parsedOffer = parseOffer(offerSdp, { codecs: [], headerExtensions: [] })
  return generateAnswer(transport, parsedOffer, new Map())
}
