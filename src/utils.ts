
let debug = false

export function enableDebug (newValue) {
  debug = newValue
}

export function log (...options) {
  debug && console.log(...arguments)
}

export class PeerMetricsError extends Error {
  code: number
}