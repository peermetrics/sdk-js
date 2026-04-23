import { EventEmitter } from 'events'

let debug = false

/** Set on our outer RTCPeerConnection replacement so we can avoid double-wrapping. */
const PEERMETRICS_PC_WRAP = '__peerMetricsWrapped'

export function enableDebug (newValue) {
  debug = newValue
}

export function log (...options) {
  debug && console.log(...arguments)
}

export class PeerMetricsError extends Error {
  code: number
}

/**
 * Wraps `global.RTCPeerConnection` so `new RTCPeerConnection(...)` emits `newRTCPeerconnection`
 * on the returned EventEmitter with the **underlying** instance (native or shim).
 *
 * `lib-jitsi-meet` (and similar) often replace `window.RTCPeerConnection` after load. If PeerMetrics
 * wrapped the browser before that script ran, call again with the same `existingEmitter` to chain
 * outside the shim. Idempotent while our wrapper is still the global constructor.
 */
export function wrapPeerConnection(global: any, existingEmitter?: EventEmitter | null): false | EventEmitter {
  if (!global || !global.RTCPeerConnection) {
    return false
  }

  const Current = global.RTCPeerConnection as any
  if (Current[PEERMETRICS_PC_WRAP]) {
    if (existingEmitter) {
      return existingEmitter
    }
    return Current.__peerMetricsEmitter || false
  }

  const inner = Current
  const peerConnectionEventEmitter = existingEmitter || new EventEmitter()

  const WrappedRTCPeerConnection = function (configuration, constraints) {
    const peerconnection = new inner(configuration, constraints)
    peerConnectionEventEmitter.emit('newRTCPeerconnection', peerconnection)
    return peerconnection
  } as any
  WrappedRTCPeerConnection.prototype = inner.prototype
  WrappedRTCPeerConnection[PEERMETRICS_PC_WRAP] = true
  WrappedRTCPeerConnection.__peerMetricsEmitter = peerConnectionEventEmitter
  global.RTCPeerConnection = WrappedRTCPeerConnection

  return peerConnectionEventEmitter
}

/**
 * Classify a Jitsi-originated RTCPeerConnection as peer-to-peer or JVB-bridged.
 *
 * Jitsi exposes transport kind inconsistently across lib-jitsi-meet versions
 * (boolean flags on the PC, on wrapping traceable/tpc objects, on owners, or
 * only encoded in id/label strings). We probe each known location in priority
 * order and fall back to text hints so both the autoDetect code path and the
 * sdk_integrations wrap path label connections identically.
 */
export function inferJitsiTransportKind(pc: any): 'p2p' | 'jvb' | 'unknown' {
  const directHints = [
    pc?.isP2P,
    pc?.p2p,
    pc?.traceablePeerConnection?.isP2P,
    pc?.tpc?.isP2P,
    pc?.owner?._isP2P
  ]
  if (directHints.some(v => v === true)) return 'p2p'
  if (directHints.some(v => v === false)) return 'jvb'

  const textHints = [
    pc?.id,
    pc?.name,
    pc?.label,
    pc?.connectionId,
    pc?._id,
    pc?.__id
  ].filter(Boolean).map((v: any) => String(v).toLowerCase())

  if (textHints.some((v: string) => v.includes('p2p'))) return 'p2p'
  if (textHints.some((v: string) => v.includes('jvb') || v.includes('bridge') || v.includes('sfu'))) return 'jvb'
  return 'unknown'
}

/**
 * Iterate RTCPeerConnection instances stored in common lib-jitsi-meet RTC shapes.
 * Shared by integration and auto-detect paths so they stay behaviorally aligned.
 */
export function forEachJitsiPeerConnection (
  rtc: any,
  onPeerConnection: (pc: RTCPeerConnection) => void
): void {
  if (!rtc || typeof rtc !== 'object') return

  const possiblePaths = [
    ['peerConnections'],
    ['pc'],
    ['peerConnection'],
    ['rtc', 'peerConnections'],
    ['rtc', 'pc']
  ]

  for (const path of possiblePaths) {
    let current = rtc
    for (const key of path) {
      if (current && current[key]) {
        current = current[key]
      } else {
        current = null
        break
      }
    }

    if (!current || typeof current !== 'object') continue
    if (current instanceof Map) {
      for (const [, pc] of current) {
        if (pc instanceof RTCPeerConnection) onPeerConnection(pc)
      }
      continue
    }

    if (Array.isArray(current)) {
      current.forEach((pc) => {
        if (pc instanceof RTCPeerConnection) onPeerConnection(pc)
      })
      continue
    }

    if (current instanceof RTCPeerConnection) {
      onPeerConnection(current)
    }
  }
}