import {WebRTCStats} from '@peermetrics/webrtc-stats'

// import type { RemoveConnectionOptions } from '@peermetrics/webrtc-stats'

import {User} from './user'
import { DEFAULT_OPTIONS, CONSTRAINTS } from "./constants";
import {ApiWrapper} from './api-wrapper'
import SdkIntegration from "./sdk_integrations";

import { enableDebug, log, wrapPeerConnection, PeerMetricsError} from './utils'

import type {
  PeerMetricsConstructor,
  InitializeObject,
  GetUrlOptions,
  SdkIntegrationInterface,
  WebrtcSDKs,
  AddConnectionOptions,
  RemoveConnectionOptions,
  SessionData,
  PageEvents,
  AddEventOptions,
  PeersToMonitor
} from './types/index'

export {PeerMetricsConstructor, AddConnectionOptions, AddEventOptions}

/**
 * Used to keep track of peers
 * @type {Object}
 */
let peersToMonitor = {} as PeersToMonitor

/**
 * Used to keep track of connection IDs: the ones from WebrtcStats and the ones from the DB
 */
let monitoredConnections = {}

let eventQueue = []

let peerConnectionEventEmitter = null
// if the user has provided an options object
if (typeof window !== "undefined" && typeof window.PeerMetricsOptions === 'object') {
  if (window.PeerMetricsOptions.wrapPeerConnection === true) {
    peerConnectionEventEmitter = wrapPeerConnection(window)
    if (!peerConnectionEventEmitter) {
      console.warn('Could not wrap window.RTCPeerConnection')
    }
  }
}

export class PeerMetrics {

  private user: User
  private apiWrapper: ApiWrapper
  private webrtcStats: typeof WebRTCStats
  private pageEvents: PageEvents
  private _options: PeerMetricsConstructor
  private _initialized: boolean = false
  private webrtcSDK: WebrtcSDKs = ''

  /**
   * Used to initialize the SDK
   * @param  {Object} options
   */
  constructor (options: PeerMetricsConstructor) {
    // check if options are valid
    if (typeof options !== 'object') {
      throw new Error('Invalid argument. Expected object, got something else.')
    }

    options = {...DEFAULT_OPTIONS, ...options}

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

    this.pageEvents = options.pageEvents

    enableDebug(!!options.debug)

    if (options.wrapPeerConnection) {
      if (peerConnectionEventEmitter) {
        console.warn('RTCPeerConnection already wrapped')
      } else {
        peerConnectionEventEmitter = wrapPeerConnection(window)
      }
    }
  }

  /**
   * Used to initialize the sdk. Accepts an optional object with a conferenceId and conferenceName
   * @return {Promise}
   */
  async initialize (options?: InitializeObject) {
    let response
    let conferenceId = this._options.conferenceId
    let conferenceName = this._options.conferenceName

    // if the user sent an object, extract the conferenceId and conferenceName
    if (typeof options === 'object') {
      if (!options.conferenceId) {
        throw new Error('Missing conferenceId argument')
      }

      conferenceId = options.conferenceId

      if (options.conferenceName) {
        conferenceName = options.conferenceName
      }
    }

    // if we are already initialized
    if (this._initialized) return

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

    try {
      // initialize the session
      // check if the apiKey is valid
      // check quota, etc
      // create the conference
      response = await this.apiWrapper.initialize({
        conferenceId,
        conferenceName
      })
    } catch (responseError) {
      const error = new PeerMetricsError(responseError.message)
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
    let sessionData = await this.user.getUserDetails() as SessionData

    // add app version and meta if present
    sessionData.appVersion = this._options.appVersion
    sessionData.meta = this._options.meta

    sessionData.webrtcSdk = this.webrtcSDK

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
   * Wrap native RTCPeerConnection class
   * @return {boolean} if the wrapping was successful
   */
  static wrapPeerConnection(): boolean {
    if (typeof window === 'undefined') {
      throw new Error('Could not find gloal window. This method should be called in a browser context.')
    }

    peerConnectionEventEmitter = wrapPeerConnection(window)
    if (!peerConnectionEventEmitter) {
      log('Could not wrap window.RTCPeerConnection')
      return false
    }

    return true
  }

  /**
   * Automatically detect and add WebRTC connections from any source
   * This method searches for RTCPeerConnection instances in various places
   * @return {Promise<number>} Number of connections found and added
   */
  async autoDetectConnections(): Promise<number> {
    if (!this._initialized) {
      throw new Error('SDK not initialized. Please call initialize() first.')
    }

    if (!this.webrtcStats) {
      throw new Error('The stats module is not instantiated yet.')
    }

    log('🔍 Auto-detecting WebRTC connections...')
    const connections = []
    
    // Method 1: Search in common global objects
    const searchInObject = (obj, path = '', maxDepth = 5) => {
      if (maxDepth <= 0 || !obj || typeof obj !== 'object') return
      
      try {
        for (const [key, value] of Object.entries(obj)) {
          if (value instanceof RTCPeerConnection) {
            connections.push({ 
              pc: value, 
              peerId: `${path}.${key}`.replace(/^\./, '') || 'detected-connection',
              source: 'global-search'
            })
            log(`✅ Found RTCPeerConnection at: ${path}.${key}`)
          } else if (value && typeof value === 'object' && !Array.isArray(value)) {
            // Recursively search but limit depth
            searchInObject(value, `${path}.${key}`, maxDepth - 1)
          }
        }
      } catch (error) {
        // Ignore access errors (e.g., private properties)
      }
    }

    // Search in common places where WebRTC connections might be stored
    const searchTargets = [
      { obj: window, name: 'window' },
      { obj: window.JitsiMeetJS, name: 'JitsiMeetJS' },
      { obj: window.LiveKit, name: 'LiveKit' },
      { obj: window.Twilio, name: 'Twilio' },
      { obj: window.AgoraRTC, name: 'AgoraRTC' }
    ]

    for (const target of searchTargets) {
      if (target.obj) {
        searchInObject(target.obj, target.name)
      }
    }

    // Method 2: Try to find connections in known SDK patterns
    this._searchKnownSDKPatterns(connections)

    // Method 3: Look for connections created after our wrap
    if (peerConnectionEventEmitter) {
      // The wrapPeerConnection already captures new connections
      // This is handled automatically by the event emitter
    }

    // Add all found connections to PeerMetrics
    let addedCount = 0
    for (const { pc, peerId, source } of connections) {
      try {
        await this.addConnection({
          pc: pc,
          peerId: peerId,
          peerName: `Auto-detected (${source})`,
          isSfu: true
        })
        addedCount++
        log(`✅ Added auto-detected connection: ${peerId}`)
      } catch (error) {
        log(`❌ Failed to add connection ${peerId}: ${error.message}`)
      }
    }

    log(`📡 Auto-detection complete: ${addedCount}/${connections.length} connections added`)
    return addedCount
  }

  /**
   * Search for WebRTC connections in known SDK patterns
   * @private
   */
  private _searchKnownSDKPatterns(connections: any[]) {
    // Jitsi Meet patterns
    if (window.JitsiMeetJS && window.JitsiMeetJS.app) {
      try {
        const app = window.JitsiMeetJS.app
        if (app._room && app._room.rtc) {
          this._searchJitsiConnections(app._room.rtc, connections)
        }
      } catch (error) {
        log('Could not access Jitsi room object')
      }
    }

    // LiveKit patterns
    if (window.LiveKit) {
      try {
        // Search for room instances
        const rooms = document.querySelectorAll('[data-livekit-room]')
        rooms.forEach((roomEl, index) => {
          const room = (roomEl as any).livekitRoom
          if (room && room.engine) {
            this._searchLiveKitConnections(room.engine, connections, index)
          }
        })
      } catch (error) {
        log('Could not access LiveKit room objects')
      }
    }

    // Twilio Video patterns
    if (window.Twilio) {
      try {
        // Search for room instances in global scope
        const searchTwilio = (obj, path = '') => {
          if (obj && typeof obj === 'object') {
            if (obj._peerConnections && obj._peerConnections instanceof Map) {
              for (const [key, pc] of obj._peerConnections) {
                if (pc && pc._peerConnection && pc._peerConnection instanceof RTCPeerConnection) {
                  connections.push({
                    pc: pc._peerConnection,
                    peerId: `twilio-${path}-${key}`,
                    source: 'twilio-pattern'
                  })
                }
              }
            }
            // Recursively search
            Object.entries(obj).forEach(([key, value]) => {
              if (value && typeof value === 'object' && path.length < 10) {
                searchTwilio(value, `${path}.${key}`)
              }
            })
          }
        }
        searchTwilio(window.Twilio)
      } catch (error) {
        log('Could not access Twilio objects')
      }
    }
  }

  /**
   * Search for Jitsi WebRTC connections
   * @private
   */
  private _searchJitsiConnections(rtc, connections: any[]) {
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

      if (current && typeof current === 'object') {
        if (current instanceof Map) {
          for (const [peerId, pc] of current) {
            if (pc instanceof RTCPeerConnection) {
              connections.push({ pc, peerId: `jitsi-${peerId}`, source: 'jitsi-pattern' })
            }
          }
        } else if (Array.isArray(current)) {
          current.forEach((pc, index) => {
            if (pc instanceof RTCPeerConnection) {
              connections.push({ pc, peerId: `jitsi-${index}`, source: 'jitsi-pattern' })
            }
          })
        } else if (current instanceof RTCPeerConnection) {
          connections.push({ pc: current, peerId: 'jitsi-main', source: 'jitsi-pattern' })
        }
      }
    }
  }

  /**
   * Search for LiveKit WebRTC connections
   * @private
   */
  private _searchLiveKitConnections(engine, connections: any[], roomIndex: number) {
    try {
      if (engine.publisher && engine.publisher.pc) {
        connections.push({
          pc: engine.publisher.pc,
          peerId: `livekit-publisher-${roomIndex}`,
          source: 'livekit-pattern'
        })
      }
      if (engine.subscriber && engine.subscriber.pc) {
        connections.push({
          pc: engine.subscriber.pc,
          peerId: `livekit-subscriber-${roomIndex}`,
          source: 'livekit-pattern'
        })
      }
    } catch (error) {
      log('Could not access LiveKit engine connections')
    }
  }

  /**
   * Method used to return an app url for a conference or a participant
   * @param  {Object} options Object containing participantId or conferenceId
   * @return {string}         The url
   */
  static async getPageUrl (options: GetUrlOptions): Promise<string> {
    const {apiKey, userId, conferenceId} = options

    if (!apiKey) {
      throw new Error('Missing apiKey argument')
    }

    if (!userId && !conferenceId) {
      throw new Error('Missing arguments. Either userId or conferenceId must be sent.')
    }

    if (userId && conferenceId) {
      throw new Error('Either userId or conferenceId must be sent as arguments.')
    }

    let apiWrapper = new ApiWrapper({
      apiRoot: DEFAULT_OPTIONS.apiRoot,
      apiKey
    })

    return apiWrapper.getPageUrl({
      apiKey,
      userId,
      conferenceId
    })
  }

  async addPeer (options: AddConnectionOptions) {
    console.warn('The addPeer() method has been deprecated, please use addConnection() instead')
    return this.addConnection(options)
  }

  /**
   * Used to start monitoring for a peer
   * @param {Object} options Options for this peer
   */
  async addConnection (options: AddConnectionOptions) {
    if (!this._initialized) {
      throw new Error('SDK not initialized. Please call initialize() first.')
    }

    if (!this.webrtcStats) {
      throw new Error('The stats module is not instantiated yet.')
    }

    if (typeof options !== 'object') {
      throw new Error('Argument for addConnection() should be an object.')
    }

    let {pc, peerId, peerName, isSfu} = options

    if (!pc) {
      throw new Error('Missing argument pc: RTCPeerConnection.')
    }

    if (!peerId) {
      throw new Error('Missing argument peerId.')
    }

    // make the peerId a string
    peerId = String(peerId)

    // validate the peerName if it exists
    if (peerName) {
      if (typeof peerName !== 'string') {
        throw new Error('peerName should be a string')
      }

      // if the name is too long, just snip it
      if (peerName.length > CONSTRAINTS.peer.nameLength) {
        peerName = peerName.slice(CONSTRAINTS.peer.nameLength)
      }
    }

    if (peerId === this.user.userId) {
      throw new Error('peerId can\'t be the same as the id used to initialize PeerMetrics.')
    }

    log('addConnection', options)

    // add the peer to webrtcStats now, so we don't miss any events
    let {connectionId} = await this.webrtcStats.addConnection({peerId, pc})

    // lets not block this function call for this request
    this._sendAddConnectionRequest({connectionId, options: {pc, peerId, peerName, isSfu}})

    return {
      connectionId
    }
  }

  /**
   * Stop listening for events for a specific connection
   */
  async removeConnection (options: RemoveConnectionOptions) {
    let peerId, peer

    // remove the event listeners
    let {connectionId} = this.webrtcStats.removeConnection(options)

    const internalId = monitoredConnections[connectionId]

    if (!internalId) {
      return
    }

    for (let pId in peersToMonitor) {
      if (peersToMonitor[pId].connections.includes(internalId)) {
        peer = peersToMonitor[pId]
        peerId = pId
        break
      }
    }

    // we need both connectionId and peerId for this request
    await this.apiWrapper.sendConnectionEvent({
      eventName: 'removeConnection',
      connectionId: internalId,
      peerId: peerId
    })

    // cleanup
    delete monitoredConnections[connectionId]
    peer.connections = peer.connections.filter(cId => cId !== internalId)
  }

  /**
   * Stop listening for all connections for a specific peer
   * @param {string} peerId The peer ID to stop listening to
   */
  async removePeer (peerId: string) {
    if (typeof peerId !== 'string') {
      throw new Error('Argument for removePeer() should be a string.')
    }

    if (!peersToMonitor[peerId]) {
      throw new Error(`Could not find peer with id ${peerId}`)
    }

    this.webrtcStats.removePeer(peerId)

    await this.apiWrapper.sendConnectionEvent({
      eventName: 'removePeer',
      peerId: peerId
    })

    delete peersToMonitor[peerId]
  }

  /**
   * Method used to add an integration with different WebRTC SDKs
   * @param options Options object
   */
  public async addSdkIntegration(options: SdkIntegrationInterface) {

    let sdkIntegration = new SdkIntegration()

    sdkIntegration.on('newConnection', (options) => {
      this.addConnection(options)
    })

    // if we have a pion or jitsi integration, it's safe to wrap the peer connection later
    if (options.pion || options.jitsi) {
      // if we haven't already wrapped
      if (!peerConnectionEventEmitter) {
        peerConnectionEventEmitter = wrapPeerConnection(window)
      }
    }

    sdkIntegration.addIntegration(options, peerConnectionEventEmitter)

    this.webrtcSDK = sdkIntegration.webrtcSDK

    // if the user is integrating with any sdk
    if (sdkIntegration.foundIntegration) {
      // and PM is already initialized
      if (this._initialized) {
        // update the session to signal as such
        this.apiWrapper.addSessionDetails({
          webrtcSdk: this.webrtcSDK
        })
      }
    } else {
      throw new Error("We could not find any integration details in the options object that was passed in.")
    }
  }

  /**
   * Add a custom event for this user
   * @param {Object} options The details for this event
   */
  async addEvent (options: AddEventOptions) {
    if (typeof options !== 'object') {
      throw new Error('Parameter for addEvent() should be an object.')
    }

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

    await this.apiWrapper.sendCustomEvent(options)
  }

  /**
   * Called when the current user has muted the mic
   */
  async mute () {
    return this.apiWrapper.sendCustomEvent({eventName: 'mute'})
  }

  /**
   * Called when the current user has unmuted the mic
   */
  async unmute () {
    return this.apiWrapper.sendCustomEvent({eventName: 'unmute'})
  }

  /**
   * Used to stop all event listeners and end current session
   */
  async endCall () {
    this.webrtcStats.destroy()
    this.webrtcStats = null

    peersToMonitor = {}
    monitoredConnections = {}

    this._initialized = false

    window.removeEventListener('beforeunload', this._eventListenersCallbacks.beforeunload)
    window.removeEventListener('unload', this._eventListenersCallbacks.unload)
    navigator.mediaDevices.removeEventListener('devicechange', this._eventListenersCallbacks.devicechange)

    return this.apiWrapper.sendEndCall()
  }

  private addPageEventListeners (options: PageEvents) {
    window.addEventListener('beforeunload', this._eventListenersCallbacks.beforeunload)

    window.addEventListener('unload', this._eventListenersCallbacks.unload)

    // tab focus/unfocus
    if (options.pageVisibility && window.document) {
      this.addPageVisibilityListeners(window.document)
    }

    // track full screen
    // if (options.fullScreen) {
    //  this.addFullScreenEventListeners()
    // }
  }

  private addPageVisibilityListeners (document: Document & {msHidden?: boolean; webkitHidden?: boolean}) {
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
  private addFullScreenEventListeners () {
    // TODO: add full screen events

    if (document.body.requestFullscreen) {
      window.addEventListener('fullscreenchange', (ev) => {
      log(ev)

      // this.apiWrapper.sendPageEvent({
      //   eventName: 'fullScreen',
      //   fullScreen: true
      // })
    })
   }
  }

  private addMediaDeviceChangeListener () {
    navigator.mediaDevices.addEventListener('devicechange', this._eventListenersCallbacks.devicechange)
  }

  private _eventListenersCallbacks = {
    beforeunload: () => {
      this.apiWrapper.sendLeaveEvent('beforeunload')
    },

    unload: () => {
      this.apiWrapper.sendBeaconEvent('unload')
    },

    devicechange: () => {
      // first get the new devices
      return this.user.getDevices()
        .then((devices) => {
          this.user.devices = devices
          // and then send the event to the server
          this.apiWrapper.sendMediaDeviceChange(devices)
        })
    }
  }

  private _initializeStatsModule (getStatsInterval = DEFAULT_OPTIONS.getStatsInterval) {
    // initialize the webrtc stats module
    this.webrtcStats = new WebRTCStats({
      getStatsInterval: getStatsInterval,
      rawStats: false,
      statsObject: true,
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
  private _addWebrtcStatsEventListeners () {
    this.webrtcStats
      // just listen on the timeline and handle them differently
      .on('timeline', this._handleTimelineEvent.bind(this))
  }

  /**
   * Make a request to the api server to signal a new connection
   * @param {String} connectionId The ID of the connection offered by WebRTCStats
   */
  private async _sendAddConnectionRequest ({connectionId, options}) {
    let {pc, peerId, peerName, isSfu} = options
    let response

    try {
      // make the request to add the peer to DB
      response = await this.apiWrapper.sendConnectionEvent({
        eventName: 'addConnection',
        peerId: peerId,
        peerName: peerName,
        connectionState: pc.connectionState,
        isSfu: !!isSfu
      })

      if (!response) {
        throw new Error('There was a problem while adding this connection')
      }
    } catch (e) {
      log(e)
      this.removeConnection({connectionId})
      throw e
    }

    // we'll receive a new peer id, use peersToMonitor to make the connection between them
    peersToMonitor[peerId] = {
      id: response.peer_id,
      connections: []
    }

    monitoredConnections[connectionId] = response.connection_id
    peersToMonitor[peerId].connections.push(response.connection_id)

    // all the events that we captured while waiting for 'addConnection' are here
    // send them to the server
    eventQueue.map((event) => {
      this._handleTimelineEvent(event)
    })

    // clear the queue
    eventQueue.length = 0
  }

  private _handleTimelineEvent (ev) {
    if (ev.peerId) {
      if (peersToMonitor[ev.peerId]) {
        // update with the new peer
        ev.peerId = peersToMonitor[ev.peerId].id
      } else {
        // add this special flag to signal that we've manually delayed sending this request
        ev.delayed = true
        eventQueue.push(ev)
        return
      }
    }

    // if we have a connectionId from the server, 
    // swap it with the old value. same as peersToMonitor
    if (ev.connectionId) {
      if (ev.connectionId in monitoredConnections) {
        ev.connectionId = monitoredConnections[ev.connectionId]
      } else {
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
        this._handleTrackEvent(ev)
        break
      default:
        this._handleConnectionEvent(ev)
        break
    }
  }

  // Handle different types of events
  // TODO: move this somewhere else
  private _handleGumEvent (ev) {
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
    let dataToSend: any = {}
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

  private _handleStatsEvent (ev) {
    let {data, peerId, connectionId, timeTaken} = ev

    this.apiWrapper.sendWebrtcStats({data, peerId, connectionId, timeTaken})
  }

  private _handleTrackEvent (ev) {
    let {data, peerId, connectionId, event} = ev
    let dataToSend = {
      event,
      peerId,
      connectionId,
      trackId: null,
      data: {} as any
    }

    if (event === 'ontrack') {
      dataToSend.data = data.track
      delete dataToSend.data._track
    }

    if (data.track) {
      dataToSend.trackId = data.track.id
    } else if (data.event) {
      if (data.event.target) {
        dataToSend.trackId = data.event.target.id
      }

      if (data.event.detail && data.event.detail.check) {
        dataToSend.data.check = data.event.detail.check
      }
    } else {
      log('Received track event without track')
    }

    this.apiWrapper.sendTrackEvent(dataToSend)
  }

  private async _handleConnectionEvent (ev) {
    let {event, peerId, connectionId, data, delayed} = ev
    let eventData = data

    switch (event) {
      case 'addConnection':
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
      case 'onicecandidateerror':
        eventData = ev.error
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
        eventName: event,
        peerId,
        connectionId,
        timestamp,
        data: eventData
      })
    } catch (e) {
      log(e)
    }
  }
}
