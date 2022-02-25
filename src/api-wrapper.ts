import wretch from 'wretch'

import {log} from './utils'

import type {User} from './user'
import type { ApiInitializeData, MakeRequest, ConnectionEventData, SessionData } from './types'
import type {Wretcher} from 'wretch'

let externalApi: Wretcher

let token = ''
let start = 0

const DEFAULT_OPTIONS = {
  batchConnectionEvents: false,
  connectionTimeoutValue: 500
}

const REQUEST_TIMEOUT = 10 * 1000

const EXPONENTIAL_BACKOFF = 500
const MAX_EXPONENTIAL_BACKOFF = 60 * 1000

const UNRECOVERABLE_ERRORS = [
  'domain_not_allowed',
  'quota_exceeded',
  'invalid_api_key',
  'app_not_recording'
]

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
  'stats': '/stats',
  'track': '/tracks'
}

export class ApiWrapper {
  private apiKey: string
  private apiRoot: string
  private user: User
  private mockRequests: boolean
  private unrecoverable: string[] = UNRECOVERABLE_ERRORS
  /**
   * If we should batch connections events
   * defaults to false and we'll let the server tell us if we should
   */
  private batchConnectionEvents: boolean = DEFAULT_OPTIONS.batchConnectionEvents
  private connectionEvents: Array<[ConnectionEventData, DOMHighResTimeStamp]> = []
  private connectionTimeout: number | null = null

  constructor (options) {
    this.apiKey = options.apiKey
    this.apiRoot = options.apiRoot

    this.user = options.user

    // debug options
    this.mockRequests = options.mockRequests

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
      // .catcher(405, this._handleFailedRequest)
  }

  /*
   * Checks to see if the apiKey is valid
   * and if the account has enough ...
   * initialiaze the session
   * @return {Promise} The fetch promise
   */
  async initialize (data: ApiInitializeData): Promise<Response> {
    let toSend = {...data} as any

    // add the user details
    // used to create the participant object
    toSend.userId = this.user.userId
    toSend.userName = this.user.userName
    toSend.apiKey = this.apiKey

    return this.makeRequest({
      // this is the only hard coded path that should not change
      path: '/initialize',
      // @ts-ignore
      data: toSend
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

  createSession(data) {
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

  sendConnectionEvent (data: ConnectionEventData) {
    if (this.batchConnectionEvents === false) {
      return this._sendConnectionEvent(data)
    }

    if (this.connectionTimeout !== null) {
      clearTimeout(this.connectionTimeout)
    }

    this.connectionTimeout = window.setTimeout(() => {
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

  private _handleSingleConnectionEvent ([ev, timestamp]: [ConnectionEventData, DOMHighResTimeStamp]) {
    let now = Date.now()
    let { eventName, peerId, data } = ev

    return this._sendConnectionEvent({
      eventName,
      peerId,
      timeDelta: now - timestamp,
      data
    })
  }

  private _handleBatchConnectionEvents (events: Array<[ConnectionEventData, DOMHighResTimeStamp]>) {
    let now = Date.now()

    let data = events.map((ev) => {
      let [ eventData, timestamp ] = ev
      let { eventName, peerId, data } = eventData

      return {
        eventName,
        peerId,
        timeDelta: now - timestamp,
        data
      }
    })

    return this._sendBatchConnectionEvents(data)
  }

  private _sendConnectionEvent (data) {
    return this.makeRequest({
      path: urlsMap['connection'],
      data: data
    })
  }

  private _sendBatchConnectionEvents (data) {
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

  sendTrackEvent (data) {
    return Promise.resolve()
    return this.makeRequest({
      path: urlsMap['track'],
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

  private async makeRequest (options: MakeRequest) {
    // we just need the path, the base url is set at initialization
    let {path, timestamp, data} = options

    if (path === '/initialize' && start === 0) {
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
        let response = {}
        if (data.eventName === 'addConnection') {
          response = {
            // @ts-ignore
            peer_id: data.peerId
          }
        }
        // mock a request that takes anywhere between 0 and 1000ms
        setTimeout(() => resolve(response), Math.floor(Math.random() * 1000))
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

    let toSend: string
    try {
      toSend = JSON.stringify(data)
    } catch (e) {
      throw new Error('Could not stringify request data')
    }

    // keep the content type as text plain to avoid CORS preflight requests
    let request = externalApi.url(path).content('text/plain')
    let requestToMake

    if (options.method === 'put') {
      requestToMake = request.put(toSend)
    } else {
      requestToMake = request.post(toSend)
    }

    return requestToMake
      .setTimeout(REQUEST_TIMEOUT)
      .json(this._handleResponse)
      .catch((response) => {
        return this._handleFailedRequest({response, timestamp, options})
      })
  }

  private async _handleResponse (response) {
    if (response) {
      log(response)
    }

    return response
  }

  /**
   * Used to handle a failed fetch request
   * @param  {Object} arg
   */
  private async _handleFailedRequest (arg) {
    let {response, timestamp, options} = arg
    let {backoff = EXPONENTIAL_BACKOFF} = options
    let body

    try {
      body = JSON.parse(response.message)
      // we have a domain restriction, app paused, invalid api key or over quota, no need for retry
      if (this.unrecoverable.includes(body.error_code)) {
        return Promise.reject(body)
      }
    } catch (e) {}

    // if we got an error, then the user is offline or a timeout
    if (response instanceof Error || response.status > 500) {
      // double the value with each run. starts at 1s
      backoff *= 2

      // don't go over 1 min
      if (backoff > MAX_EXPONENTIAL_BACKOFF) {
        throw new Error('request failed after exponential backoff')
      }

      return new Promise((resolve, reject) => {
        setTimeout(() => {
          options.timestamp = timestamp
          options.backoff = backoff
          this.makeRequest(options).then(resolve).catch(reject)
        }, backoff)
      })
    }

    return Promise.reject(body)
  }

  private _createUrl (path = '/') {
    return `${this.apiRoot}${path}`
  }
}
