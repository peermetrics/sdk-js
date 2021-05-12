import {WebRTCStats} from '@peermetrics/webrtc-stats'

import {User} from './user'
import {ApiWrapper} from './api-wrapper'

import {enableDebug, log} from './utils'

const DEFAULT_OPTIONS = {
  pageEvents: {
    refresh: true,
    pageVisibility: false,
    fullScreen: false
  },
  apiRoot: 'https://api.peermetrics.io/v1',
  debug: false,
  mockRequests: false,
  remote: true,
  getStatsInterval: 5000
}

const CONSTRAINTS = {
  meta: {
    // how many tags per conference we allow
    length: 5,
    keyLength: 64,
    accepted: ['number', 'string', 'boolean']
    // how long should a tag be
    // tagLengs: 50
  },
  customEvent: {
    eventNameLength: 120,
    bodyLength: 2048
  },
  peer: {
    nameLength: 120
  }
}

/**
 * Used to keep track of peers
 * @type {Object}
 */
let peersToMonitor = {}

let eventQueue = []

export class PeerMetrics {
  /**
   * Used to initialize the SDK
   * @param  {Object} options
   */
  constructor (options = {}) {
    // check if options are valid
    if (typeof options !== 'object') {
      throw new Error('Invalid argument. Expected object, got something else.')
    }

    options = {...DEFAULT_OPTIONS, ...options}

    // check if browser
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      throw new Error('The SDK is meant to be used in a browser.')
    }

    // check if webrtc compatible
    let pc = window.RTCPeerConnection
    let gum = navigator.mediaDevices.getUserMedia
    if (!pc || !gum) {
      throw new Error('This device doesn\'t seem to support RTCPeerConnection or getUserMedia')
    }

    // check if fetch is available
    if (typeof window.fetch === 'undefined') {
      throw new Error('This device doesn\'t seem to support the fetch API.')
    }

    // validate options
    if (!options.apiKey) {
      throw new Error('Missing argument apiKey')
    }

    if (!options.conferenceId) {
      throw new Error('Missing argument conferenceId')
    }

    if ('appVersion' in options) {
      if (typeof options.appVersion !== 'string') {
        throw new Error('appVersion must be a string')
      }

      if (options.appVersion.length > 16) {
        throw new Error('appVersion must have a max length of 16')
      }
    }

    // if meta tags were added
    if ('meta' in options) {
      if (!options.meta || typeof options.meta !== 'object') {
        throw new Error('The meta attribute should be of type object')
      }

      const keys = Object.keys(options.meta)

      if (keys.length > CONSTRAINTS.meta.length) {
        throw new Error(`Argument meta should only have a maximum of ${CONSTRAINTS.meta.length} attributes`)
      }

      for (const key of keys) {
        if (key.length > CONSTRAINTS.meta.keyLength) {
          console.error(`Meta keys should not be larger than ${CONSTRAINTS.meta.keyLength}`)
          delete options.meta[key]
          continue
        }

        // make sure each value is an accepted format
        const value = options.meta[key]
        if (!CONSTRAINTS.meta.accepted.includes(typeof value)) {
          console.error(`Meta values should be one of the following: ${CONSTRAINTS.meta.accepted.join(', ')}`)
          delete options.meta[key]
        }
      }
    }

    // create the user model
    // userId
    // userName
    // conferenceId
    // conference name
    this.user = new User(options)

    /**
     * Let the user specify a different apiRoot
     * useful in dev, might be removed for prod
     * @type {String}
     */
    var apiRoot = options.apiRoot || DEFAULT_OPTIONS.apiRoot

    // create the api wrapper, used to talk with the api server
    this.apiWrapper = new ApiWrapper({
      apiRoot: apiRoot,
      apiKey: options.apiKey,
      mockRequests: options.mockRequests,
      user: this.user
    })

    /**
     * the initial options the user used to instantiate the sdk
     * @type {[type]}
     */
    this._options = options

    this._initialized = false

    this.pageEvents = options.pageEvents

    enableDebug(!!options.debug)
  }

  /**
   * Used to initialize the sdk
   * @return {Promise}
   */
  async initialize () {
    let response

    // if we are already initialized
    if (this._initialized) return

    try {
      // initialize the session
      // check if the apiKey is valid
      // check quota, etc
      // create the conference
      response = await this.apiWrapper.initialize({
        conferenceId: this._options.conferenceId,
        conferenceName: this._options.conferenceName
      })
    } catch (responseError) {
      const error = new Error(responseError.message)
      // if the api key is not valid
      // or the quota is exceded
      if (responseError.error_code) {
        error.code = responseError.error_code
      }

      throw error
    }

    // if the apiKey is ok
    // what's the interval desired

    // gather platform info about the user's device. OS, browser, etc
    // we need to do them after gUM is called to get the correct labels for devices
    // when we get all of them send them over
    let sessionData = await this.user.getUserDetails()

    // add app version and meta if present
    sessionData.appVersion = this._options.appVersion
    sessionData.meta = this._options.meta

    try {
      // save this initial details about this user
      await this.apiWrapper.createSession(sessionData)
    } catch (e) {
      console.error(e)
      throw new Error('Could not start session.')
    }

    this._initialized = true

    // add global event listeners
    this.addPageEventListeners(this.pageEvents)

    this.addMediaDeviceChangeListener()

    this._initializeStatsModule(response.getStatsInterval)
  }

  /**
   * Used to start monitoring for a peer
   * @param {Object} options Options for this peer
   */
  async addPeer (options = {}) {
    if (!this._initialized) {
      throw new Error('SDK not initialized. Please call initialize() first.')
    }

    if (!this.webrtcStats) {
      throw new Error('The stats module is not instantiated yet.')
    }

    if (!options.pc) {
      throw new Error('Missing argument pc: RTCPeerConnection.')
    }

    if (!options.peerId) {
      throw new Error('Missing argument peerId.')
    }

    // validate the peerName if it exists
    if ('peerName' in options) {
      if (typeof options.peerName !== 'string') {
        throw new Error('peerName should be a string')
      }

      // if the name is too long, just snip it
      if (options.peerName.length > CONSTRAINTS.peer.nameLength) {
        options.peerName = options.peerName.substr(0, CONSTRAINTS.peer.nameLength)
      }
    }

    log('addPeer', options)

    try {
      // add the peer to webrtcStats now, so we don't miss any events
      this.webrtcStats.addPeer(options)

      // make the request to add the peer to DB
      const response = await this.apiWrapper.sendConnectionEvent({
        eventName: 'addPeer',
        peerId: options.peerId,
        peerName: options.peerName
      })

      // we'll receive a new peer id, use peersToMonitor make a connection between them
      let oldPeerId = options.peerId
      peersToMonitor[oldPeerId] = response.peer_id

      // all the events that we captured while waiting for 'addPeer' are here
      // send them to the server
      eventQueue.map((event) => {
        this.handleTimelineEvent(event)
      })
      // clear the queue
      eventQueue.length = 0
    } catch (e) {
      console.error(e)
      throw e
    }
  }

  async removePeer (peerId) {
    if (!peersToMonitor[peerId]) {
      throw new Error(`Could not find peer with id ${peerId}`)
    }

    this.webrtcStats.removePeer(peerId)
  }

  addPageEventListeners (options = {}) {
    window.addEventListener('unload', () => {
      this.apiWrapper.sendLeaveEvent('unload')
    }, false)

    // full screen
    // options.fullScreen && this.addFullScreenEventListeners()

    // tab focus/unfocus
    options.pageVisibility && this.addPageVisibilityListeners()
  }

  addPageVisibilityListeners () {
    // Set the name of the hidden property and the change event for visibility
    let hidden, visibilityChange

    if (typeof document.hidden !== 'undefined') { // Opera 12.10 and Firefox 18 and later support
      hidden = 'hidden'
      visibilityChange = 'visibilitychange'
    } else if (typeof document.msHidden !== 'undefined') {
      hidden = 'msHidden'
      visibilityChange = 'msvisibilitychange'
    } else if (typeof document.webkitHidden !== 'undefined') {
      hidden = 'webkitHidden'
      visibilityChange = 'webkitvisibilitychange'
    }

    if (hidden === undefined) {
      log('Page visibility is not supported')
      return
    }

    // TODO: inspire some functionality from
    // https://github.com/addyosmani/visibly.js/blob/master/visibly.js
    document.addEventListener(visibilityChange, (ev) => {
      this.apiWrapper.sendPageEvent({
        eventName: 'tabFocus',
        focus: document[hidden]
      })
    }, false)
  }

  /**
   * Add event listeners for fullScreen events
   * from: https://gist.github.com/samccone/1653975
   */
  addFullScreenEventListeners () {
    // TODO: add full screen events

    let isSupported = document.body.mozRequestFullScreen || document.body.webkitRequestFullScreen || document.body.requestFullScreen

    if (!isSupported) return

    let fullScreenEvent = (ev) => {
      log(ev)
    }
    (document.body.requestFullScreen && window.addEventListener('fullscreenchange', fullScreenEvent)) ||
    (document.body.webkitRequestFullScreen && window.addEventListener('webkitfullscreenchange', fullScreenEvent)) ||
    (document.body.mozRequestFullScreen && window.addEventListener('mozfullscreenchange', fullScreenEvent))

    // document.addEventListener('fullscreenchange', (ev) => {
    //   this.apiWrapper.sendPageEvent({
    //     eventName: 'fullScreen',
    //     fullScreen: true
    //   })
    // })
  }

  addMediaDeviceChangeListener () {
    navigator.mediaDevices.addEventListener('devicechange', () => {
      // first get the new devices
      return this.user.getDevices()
        .then((devices) => {
          this.user.devices = devices
          // and then send the event to the server
          this.apiWrapper.sendMediaDeviceChange(devices)
        })
    })
  }

  /**
   * Add a custom event for this user
   * @param {Object} options The details for this event
   */
  async addEvent (options = {}) {
    if (options.eventName && options.eventName.length > CONSTRAINTS.customEvent.eventNameLength) {
      throw new Error(`eventName should be shorter than ${CONSTRAINTS.customEvent.eventNameLength}.`)
    }

    try {
      let json = JSON.stringify(options)
      if (json.length > CONSTRAINTS.customEvent.bodyLength) {
        throw new Error('Custom event body size limit reached.')
      }
    } catch (e) {
      throw new Error('Custom event is not serializable.')
    }
    this.apiWrapper.sendCustomEvent(options)
  }

  /**
   * Called when the current user has muted the mic
   */
  async mute () {
    this.apiWrapper.sendCustomEvent({eventName: 'mute'})
  }

  async unmute () {
    this.apiWrapper.sendCustomEvent({eventName: 'unmute'})
  }

  _initializeStatsModule (getStatsInterval = DEFAULT_OPTIONS.getStatsInterval) {
    // initialize the webrtc stats module
    this.webrtcStats = new WebRTCStats({
      getStatsInterval: getStatsInterval,
      rawStats: false,
      statsObject: false,
      filteredStats: false,
      remote: this._options.remote,
      wrapGetUserMedia: true,
      logLevel: 'none'
    })

    this._addWebrtcStatsEventListeners()
  }

  /**
   * Adds event listener for the stats library
   */
  _addWebrtcStatsEventListeners () {
    this.webrtcStats
      // just listen on the timeline and handle them differently
      .on('timeline', this.handleTimelineEvent.bind(this))
  }

  handleTimelineEvent (ev) {
    if (ev.peerId) {
      if (peersToMonitor[ev.peerId]) {
        // update with the new peer
        ev.peerId = peersToMonitor[ev.peerId]
      } else {
        // add this special flag to signal that we've manually delayed sending this request
        ev.delayed = true
        eventQueue.push(ev)
        return
      }
    }

    switch (ev.tag) {
      case 'getUserMedia':
        this._handleGumEvent(ev)
        break
      case 'stats':
        this._handleStatsEvent(ev)
        break
      case 'track':
        log(ev)
        break
      default:
        this._handleConnectionEvent(ev)
        break
    }
  }

  // Handle different types of events
  // TODO: move this somewhere else
  _handleGumEvent (ev) {
    /**
     * The data for this event
     * Can have one of 3 arguments
     *   constraints: the gUM constraints
     *   stream: after we get the stream
     *   error: well, the error
     * @type {Object}
     */
    let data = ev.data

    /**
     * The object that we'll save in the DB
     * after we parse data
     * @type {Object}
     */
    let dataToSend = {}
    if (data.constraints) {
      dataToSend.constraints = data.constraints
    }

    // after we get the stream, make sure we captured all the devices
    // only do this after we get the stream
    if (data.stream) {
      this.user.getDevices()
        .then((devices) => {
          // if we get more devices then before
          if (devices.length !== this.user.devices.length) {
            // TODO: maybe save this as a change event?
            this.user.devices = devices
            this.apiWrapper.addSessionDetails({
              devices: this.user.devices
            })
          }
        })

      dataToSend = {...data.details}
    }

    if (data.error) {
      dataToSend.error = {
        name: data.error.name,
        message: data.error.message
      }
    }

    this.apiWrapper.saveGetUserMediaEvent(dataToSend)
  }

  _handleStatsEvent (ev) {
    let {data, peerId} = ev

    this.apiWrapper.sendWebrtcStats({data, peerId})
  }

  async _handleConnectionEvent (ev) {
    let {event, peerId, data, delayed} = ev
    let eventData = data

    switch (event) {
      case 'addPeer':
        // we don't need the actual RTCPeerConnection object
        delete eventData.options.pc

        // rename the event name
        event = 'peerDetails'
        break
      case 'onicecandidate':
        if (data) {
          eventData = {
            address: data.address,
            candidate: data.candidate,
            component: data.component,
            foundation: data.foundation,
            port: data.port,
            priority: data.priority,
            protocol: data.protocol,
            relatedAddress: data.relatedAddress,
            relatedPort: data.relatedPort,
            sdpMLineIndex: data.sdpMLineIndex,
            sdpMid: data.sdpMid,
            tcpType: data.tcpType,
            type: data.type,
            usernameFragment: data.usernameFragment
          }
        }
        break
      case 'icecandidateerror':
        eventData = ev.error.errorCode
        break
      case 'ondatachannel':
        eventData = null
        break
      default:
        log(ev)
        break
    }

    try {
      const timestamp = delayed ? ev.timestamp : null
      await this.apiWrapper.sendConnectionEvent({
        peerId,
        timestamp,
        eventName: event,
        data: eventData
      })
    } catch (e) {
      log(e)
    }
  }
}
