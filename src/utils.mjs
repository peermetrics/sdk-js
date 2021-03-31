
let debug = false

export function enableDebug (newValue) {
  debug = newValue
}

export function log () {
  debug && console.log(...arguments)
}
