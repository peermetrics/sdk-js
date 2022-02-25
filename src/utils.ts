import { EventEmitter } from 'events'

let debug = false
let realPeerConnection = null

export function enableDebug (newValue) {
  debug = newValue
}

export function log (...options) {
  debug && console.log(...arguments)
}

export class PeerMetricsError extends Error {
  code: number
}

export function wrapPeerConnection(global) {
  if (global.RTCPeerConnection) {
    realPeerConnection = global.RTCPeerConnection
    let peerConnectionEventEmitter = new EventEmitter()

    // this is the ideal way but it causes problems with AdBlocker's wrapper
    // class RTCPeerConnection extends global.RTCPeerConnection {
    //   constructor(parameters) {
    //     super(parameters)
    //     peerConnectionEventEmitter.emit('newRTCPeerconnection', this)
    //   }
    // }
    // global.RTCPeerConnection = RTCPeerConnection

    let WrappedRTCPeerConnection = function (configuration, constraints) {
      let peerconnection = new realPeerConnection(configuration, constraints)
      peerConnectionEventEmitter.emit('newRTCPeerconnection', peerconnection)
      return peerconnection
    }
    WrappedRTCPeerConnection.prototype = realPeerConnection.prototype
    global.RTCPeerConnection = WrappedRTCPeerConnection

    return peerConnectionEventEmitter
  }

  return false
}