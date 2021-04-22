
import {log} from './utils'

import wretch from 'wretch'

let externalApi = {}

let token = ''
let start = 0

const DEFAULT_OPTIONS = {
  batchConnectionEvents: false,
  connectionTimeoutValue: 500
}

const REQUEST_TIMEOUT = 10 * 1000

const EXPONENTIAL_BACKOFF = 500
const MAX_EXPONENTIAL_BACKOFF = 60 * 1000

/**
 * An object to map endpoint names to URLs
 * @type {Object}
 */
let urlsMap = {
  'session': '/sessions',
  'events-getusermedia': '/events/get-user-media',
  'events-browser': '/events/browser',
  'connection': '/connection',
  'batch-connection': '/connection/batch',
  'stats': '/stats'
}

export class ApiWrapper {
  constructor (options) {
    this.apiKey = options.apiKey
    this.apiRoot = options.apiRoot

    this.user = options.user

    // debug options
    this.mockRequests = options.mockRequests

    /**
     * If we should batch connections events
     * defaults to false and we'll let the server tell us if we should
     * @type {Boolean}
     */
    this.batchConnectionEvents = DEFAULT_OPTIONS.batchConnectionEvents

    this.connectionEvents = []
    this.connectionTimeout = null

    externalApi = wretch()
      // Set the base url
      .url(this.apiRoot)
      .content('text/plain')
      .accept('application/json')
      .options({
        mode: 'cors',
        cache: 'no-cache',
        redirect: 'follow'
      })
      // .catcher(405, this.handleFailedRequest)
  }

  /*
   * Checks to see if the apiKey is valid
   * and if the account has enough ...
   * initialiaze the session
   * @return {Promise} The fetch promise
   */
  initialize (data = {}) {
    // add the user details
    // used to create the participant object
    data.userId = this.user.userId
    data.userName = this.user.userName
    data.apiKey = this.apiKey

    return this.makeRequest({
      // this is the only hard coded path that should not change
      path: '/initialize',
      data: data
    }).then((response) => {
      if (response) {
        if (response.urls) {
          // update the urls map with the response from server
          urlsMap = {urlsMap, ...response.urls}
        }

        if (typeof response.batchConnectionEvents === 'boolean') {
          this.batchConnectionEvents = response.batchConnectionEvents
        }

        token = response.token
      }

      return response
    })
  }

  createSession (data) {
    return this.makeRequest({
      path: urlsMap['session'],
      data: data
    }).then((response) => {
      if (response.token) {
        token = response.token
      }
    })
  }

  /**
   * Used to save initial data about the current user
   * @return {Promise} The fetch promise
   */
  addSessionDetails (data) {
    return this.makeRequest({
      path: urlsMap['session'],
      method: 'put',
      data: data
    })
  }

  sendPageEvent (data) {
    return this.makeRequest({
      path: urlsMap['events-browser'],
      data: data
    })
  }

  sendCustomEvent (data) {
    return this.makeRequest({
      path: urlsMap['events-browser'],
      data: {
        eventName: data.eventName || 'custom',
        data: data
      }
    })
  }

  sendMediaDeviceChange (devices) {
    return this.makeRequest({
      path: urlsMap['events-browser'],
      data: {
        eventName: 'mediaDeviceChange',
        devices: devices
      }
    })
  }

  saveGetUserMediaEvent (data) {
    return this.makeRequest({
      path: urlsMap['events-getusermedia'],
      data: {
        eventName: 'getUserMedia',
        data: data
      }
    })
  }

  sendConnectionEvent (data) {
    if (this.batchConnectionEvents === false) {
      if (this.mockRequests && data.eventName === 'addPeer') {
        return {peer_id: data.peerId}
      }

      return this._sendConnectionEvent(data)
    }

    if (this.connectionTimeout !== null) {
      clearTimeout(this.connectionTimeout)
    }

    this.connectionTimeout = setTimeout(() => {
      this.sendBatchConnectionEvents()
    }, DEFAULT_OPTIONS.connectionTimeoutValue)

    this.connectionEvents.push([data, Date.now()])
  }

  sendBatchConnectionEvents () {
    let events = Array.from(this.connectionEvents)
    this.connectionEvents = []
    clearTimeout(this.connectionTimeout)

    if (events.length === 1) {
      this._handleSingleConnectionEvent(events[0])
    } else {
      this._handleBatchConnectionEvents(events)
    }
  }

  _handleSingleConnectionEvent ([ev, timestamp]) {
    let now = Date.now()
    let { event, peerId, eventData } = ev

    return this._sendConnectionEvent({
      eventName: event,
      peerId,
      timeDelta: now - timestamp,
      data: eventData
    })
  }

  _handleBatchConnectionEvents (events) {
    let now = Date.now()

    let data = events.map((ev) => {
      let [ data, timestamp ] = ev
      let { event, peerId, eventData } = data

      return {
        eventName: event,
        peerId,
        timeDelta: now - timestamp,
        data: eventData
      }
    })

    return this._sendBatchConnectionEvents(data)
  }

  _sendConnectionEvent (data) {
    return this.makeRequest({
      path: urlsMap['connection'],
      data: data
    })
  }

  _sendBatchConnectionEvents (data) {
    return this.makeRequest({
      path: urlsMap['batch-connection'],
      data: data
    })
  }

  sendWebrtcStats (data) {
    return this.makeRequest({
      path: urlsMap['stats'],
      data: data
    })
  }

  /**
   * This is a special method because it uses beacons instead of fetch
   */
  sendLeaveEvent (event) {
    if (!navigator.sendBeacon) return

    let url = this._createUrl(urlsMap['events-browser'])
    let data = JSON.stringify({
      token: token,
      eventName: event
    })

    if (this.mockRequests) {
      log('request', Date.now() - start, urlsMap['events-browser'], data)
    } else {
      navigator.sendBeacon(url, data)
    }
  }

  makeRequest (options) {
    // we just need the path, the base url is set at initialization
    let {path, timestamp, data = {}} = options

    if (data.eventName === 'addPeer') {
      start = Date.now()
    }

    log('request', Date.now() - start, path, data)

    // most of the request require a token
    // if we have it, add it to the body
    if (token) {
      data.token = token
    }

    // if we mock requests, resolve immediately
    if (this.mockRequests) {
      return new Promise((resolve) => {
        // mock a request that takes anywhere between 0 and 1000ms
        setTimeout(() => resolve({}), Math.floor(Math.random() * 1000))
      })
    }

    // if we have a timestamps than this event happened in the past
    // add the delta attribute so the backend knows
    // we might get the timestamp attribute inside data
    // this happens for events that we manually delay sending
    timestamp = timestamp || data.timestamp
    if (timestamp) {
      data.delta = Date.now() - timestamp
    } else {
      // if not, than timestamp this request to be used in case of failure
      timestamp = Date.now()
    }

    try {
      data = JSON.stringify(data)
    } catch (e) {
      return Promise.reject(new Error('Could not stringify request data'))
    }

    // keep the content type as text plain to avoid CORS preflight requests
    let request = externalApi.url(path).content('text/plain')

    if (options.method === 'put') {
      request = request.put(data)
    } else {
      request = request.post(data)
    }

    return request
      .setTimeout(REQUEST_TIMEOUT)
      .json(this.handleResponse)
      .catch((response) => {
        return this.handleFailedRequest({response, timestamp, options})
      })
  }

  handleResponse (response) {
    if (response) {
      log(response)
    }

    return Promise.resolve(response)
  }

  /**
   * Used to handle a failed fetch request
   * @param  {Object} arg
   */
  handleFailedRequest (arg) {
    let {response, timestamp, options} = arg
    let {backoff = EXPONENTIAL_BACKOFF} = options

    console.warn(response, response.status)

    // if we got an error, then the user is offline or a timeout
    if (response instanceof Error || response.status > 500) {
      // double the value with each run. starts at 1s
      backoff *= 2

      // don't go over 1 min
      if (backoff > MAX_EXPONENTIAL_BACKOFF) {
        return Promise.reject(new Error('request failed after exponential backoff'))
      }

      return new Promise((resolve, reject) => {
        setTimeout(() => {
          options.timestamp = timestamp
          options.backoff = backoff
          this.makeRequest(options).then(resolve).catch(reject)
        }, backoff)
      })
    }

    let responseObject = {}
    try {
      responseObject = JSON.parse(response.text)
    } catch (e) {}

    return Promise.reject(responseObject)
  }

  _createUrl (path = '/') {
    return `${this.apiRoot}${path}`
  }
}
