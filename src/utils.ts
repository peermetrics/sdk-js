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