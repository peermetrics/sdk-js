import { EventEmitter } from 'events'

import { CONSTRAINTS } from "./constants";
import { inferJitsiTransportKind, log } from './utils'

import type {
    SdkIntegrationInterface,
    WebrtcSDKs,
} from './types/index'

export default class SdkIntegration extends EventEmitter {
    foundIntegration: boolean = false
    webrtcSDK: WebrtcSDKs
    private _emittedPCs: WeakSet<RTCPeerConnection> = new WeakSet()
    private _jitsiParticipantSnapshots: Map<string, { displayName?: string; isPresent?: boolean }> = new Map()
    private _jitsiTrackParticipantHints: WeakMap<object, string> = new WeakMap()
    private _jitsiTransportPeerId: string = ''
    private _jitsiTransportPeerName: string = ''
    private _jitsiConferenceAttachGuard: WeakSet<object> = new WeakSet()
    private _liveKitPcMeta: WeakMap<object, { direction: string; source: string }> = new WeakMap()
    private _liveKitWrapPending: WeakSet<object> = new WeakSet()

    addIntegration(options: SdkIntegrationInterface, peerConnectionEventEmitter: null | EventEmitter): boolean {

        this.addMediaSoupIntegration(options.mediasoup)
        this.addJanusIntegration(options.janus)
        this.addLivekitIntegration(options.livekit, peerConnectionEventEmitter)
        this.addTwilioVideoIntegration(options.twilioVideo)
        this.addVonageIntegration(options.vonage, peerConnectionEventEmitter)
        this.addAgoraIntegration(options.agora, peerConnectionEventEmitter)
        this.addPionIntegration(options.pion, peerConnectionEventEmitter)
        this.addJitsiIntegration(options.jitsi, peerConnectionEventEmitter)

        return this.foundIntegration
    }

    addMediaSoupIntegration(options) {
        if (!options) return

        let { device, serverId = 'mediasoup-sfu-server', serverName = 'MediaSoup SFU Server' } = options
        // check if the user sent the right device instance
        if (!device || !device.observer) {
            throw new Error("For integrating with MediaSoup, you need to send an instace of mediasoupClient.Device().")
        }

        serverId = this.checkServerId(serverId)

        serverName = this.checkServerName(serverName)

        this.webrtcSDK = 'mediasoup'

        // listen for new transports
        device.observer.on('newtransport', (transport) => {
            this.emit('newConnection', {
                pc: transport.handler._pc,
                peerId: serverId,
                peerName: serverName,
                isSfu: true,
                remote: true
            })
        })

        this.foundIntegration = true
    }

    addJanusIntegration(options) {
        if (!options) return

        let { plugin, serverId = 'janus-sfu-server', serverName = 'Janus SFU Server' } = options

        // check if the user sent the right plugin instance
        if (!plugin || typeof plugin.webrtcStuff !== 'object') {
            throw new Error("For integrating with Janus, you need to send an instace of plugin after calling .attach().")
        }

        serverId = this.checkServerId(serverId)

        serverName = this.checkServerName(serverName)

        // if the pc is already attached. should not happen
        if (plugin.webrtcStuff.pc) {
            this.emit('newConnection', {
                pc: plugin.webrtcStuff.pc,
                peerId: serverId,
                peerName: serverName,
                isSfu: true,
                remote: true
            })
        } else {
            let boundEmit = this.emit.bind(this)
            // create a proxy so we can watch when the pc gets created
            plugin.webrtcStuff = new Proxy(plugin.webrtcStuff, {
                set: function (obj, prop, value) {
                    if (prop === 'pc') {
                        boundEmit('newConnection', {
                            pc: value,
                            peerId: serverId,
                            peerName: serverName,
                            isSfu: true,
                            remote: true
                        })
                    }
                    obj[prop] = value;
                    return true;
                }
            })
        }

        this.webrtcSDK = 'janus'
        this.foundIntegration = true
    }

    addLivekitIntegration(options, peerConnectionEventEmitter?: EventEmitter | null) {
        if (!options) return

        let { room, serverId = 'livekit-sfu-server', serverName = 'LiveKit SFU Server' } = options

        // check if the user sent the right room instance
        if (!room || typeof room.engine !== 'object') {
            throw new Error("For integrating with LiveKit, you need to send an instace of the room as soon as creating it.")
        }

        serverId = this.checkServerId(serverId)

        serverName = this.checkServerName(serverName)

        if (peerConnectionEventEmitter) {
            peerConnectionEventEmitter.on('newRTCPeerconnection', (pc) => {
                this._handleLiveKitWrappedPc(pc, room, serverId, serverName)
            })
        }

        // Listen for LiveKit transport creation events
        room.engine.on('transportsCreated', (publisher, subscriber) => {
            this._rememberLiveKitPcMeta(publisher?.pc, 'outbound', 'transportsCreated')
            this._rememberLiveKitPcMeta(subscriber?.pc, 'inbound', 'transportsCreated')
            this._addLiveKitConnection(publisher?.pc, serverId, serverName, 'outbound')
            this._addLiveKitConnection(subscriber?.pc, serverId, serverName, 'inbound')
        })
        
        // Search existing/late-created connections as fallback (some builds create transports
        // before or after the event hook timing). Repeated scans are safe via PC dedupe.
        this._searchExistingLiveKitConnections(room, serverId, serverName)
        setTimeout(() => this._searchExistingLiveKitConnections(room, serverId, serverName), 250)
        setTimeout(() => this._searchExistingLiveKitConnections(room, serverId, serverName), 1000)
        setTimeout(() => this._searchExistingLiveKitConnections(room, serverId, serverName), 3000)

        this.webrtcSDK = 'livekit'
        this.foundIntegration = true
    }

    private _rememberLiveKitPcMeta(pc: any, direction: string, source: string) {
        if (!pc) return
        this._liveKitPcMeta.set(pc, { direction, source })
    }

    private _inferLiveKitDirectionFromRoom(room: any, pc: any): string {
        if (!pc || !room?.engine) return 'unknown'
        if (room.engine?.publisher?.pc === pc || room.engine?.pcManager?.publisher?.pc === pc) return 'outbound'
        if (room.engine?.subscriber?.pc === pc || room.engine?.pcManager?.subscriber?.pc === pc) return 'inbound'
        if (room.engine?.pcManager?.pc === pc || room.engine?.transport?.pc === pc) return 'transport'
        return 'unknown'
    }

    private _handleLiveKitWrappedPc(pc: any, room: any, serverId: string, serverName: string) {
        if (!pc) return

        const known = this._liveKitPcMeta.get(pc)
        const direction = known?.direction || this._inferLiveKitDirectionFromRoom(room, pc)
        if (direction !== 'unknown') {
            this._rememberLiveKitPcMeta(pc, direction, known?.source || 'wrap')
            this._addLiveKitConnection(pc, serverId, serverName, direction)
            return
        }

        if (this._liveKitWrapPending.has(pc)) return
        this._liveKitWrapPending.add(pc)

        const retryDelays = [50, 200, 1000]
        retryDelays.forEach((delayMs) => {
            setTimeout(() => {
                const meta = this._liveKitPcMeta.get(pc)
                const retryDirection = meta?.direction || this._inferLiveKitDirectionFromRoom(room, pc)
                if (retryDirection !== 'unknown') {
                    this._rememberLiveKitPcMeta(pc, retryDirection, meta?.source || 'wrap-retry')
                    this._addLiveKitConnection(pc, serverId, serverName, retryDirection)
                    this._liveKitWrapPending.delete(pc)
                }
            }, delayMs)
        })
    }

    _addLiveKitConnection(pc, serverId, serverName, direction) {
        if (!pc) return
        if (this._emittedPCs.has(pc)) return
        this._emittedPCs.add(pc)
        this._rememberLiveKitPcMeta(pc, direction, 'emit')
        const scopedPeerId = this._buildScopedPeerId(serverId, direction)
        this.emit('newConnection', {
            pc: pc,
            peerId: scopedPeerId,
            peerName: serverName,
            isSfu: true,
            remote: true
        })
    }

    _searchExistingLiveKitConnections(room, serverId, serverName) {
        try {
            const labeledConnections: Array<{ pc: any; direction: string }> = []
            const pushLabeled = (pc: any, direction: string) => {
                if (!pc) return
                labeledConnections.push({ pc, direction })
            }

            // Check known direction-bearing locations first.
            pushLabeled(room.engine?.publisher?.pc, 'outbound')
            pushLabeled(room.engine?.subscriber?.pc, 'inbound')
            pushLabeled(room.engine?.pcManager?.publisher?.pc, 'outbound')
            pushLabeled(room.engine?.pcManager?.subscriber?.pc, 'inbound')
            pushLabeled(room.engine?.pcManager?.pc, 'transport')
            pushLabeled(room.engine?.transport?.pc, 'transport')
            
            // Deep search if no connections found
            if (labeledConnections.length === 0 && room.engine) {
                const deepConnections: any[] = []
                this._deepSearchForConnections(room.engine, deepConnections)
                deepConnections.forEach((pc) => {
                    const direction = this._inferLiveKitDirectionFromRoom(room, pc)
                    pushLabeled(pc, direction === 'unknown' ? 'transport' : direction)
                })
            }
            
            labeledConnections.forEach(({ pc, direction }) => {
                this._rememberLiveKitPcMeta(pc, direction, 'scan')
                this._addLiveKitConnection(pc, serverId, serverName, direction)
            })
            
        } catch (error) {
            // Non-fatal: connections will be caught by event listeners. Surface the error
            // for diagnostics instead of silently swallowing it.
            log('LiveKit connection scan failed:', error)
        }
    }

    _deepSearchForConnections(obj, connections, visited = new Set(), depth = 8) {
        if (!obj || typeof obj !== 'object' || visited.has(obj) || depth < 0) return

        visited.add(obj)

        if (obj.constructor?.name === 'RTCPeerConnection') {
            connections.push(obj)
            return
        }

        // Recursively search object properties with a bounded depth to avoid walking
        // deep/circular object graphs (SDK internals often expose large meshes).
        Object.values(obj).forEach(value => {
            if (value && typeof value === 'object') {
                this._deepSearchForConnections(value, connections, visited, depth - 1)
            }
        })
    }

    addTwilioVideoIntegration (options) {
        if (!options) return

        let { room } = options
        // check if the user sent the right room instance
        if (!room || typeof room._signaling !== 'object') {
            throw new Error("For integrating with Twilio Video SDK, you need to send an instace of the room as soon as you create it.")
        }

        room._signaling._peerConnectionManager._peerConnections.forEach(pcs => {
            this.emit('newConnection', {
                pc: pcs._peerConnection._peerConnection,
                peerId: 'twilio-sfu-server',
                peerName: 'Twilio SFU Server',
                isSfu: true,
                remote: true
            })
        })

        this.webrtcSDK = 'twilioVideo'
        this.foundIntegration = true
    }

    addVonageIntegration(vonage: boolean, peerConnectionEventEmitter: EventEmitter) {
        if (!vonage) return

        if (!peerConnectionEventEmitter) {
            throw new Error("Could not integrate with Vonage. Please make sure you set PeerMetricsOptions.wrapPeerConnection before loading the PeerMetrics script.");            
        }

        peerConnectionEventEmitter.on('newRTCPeerconnection', (pc) => {
            this.emit('newConnection', {
                pc: pc,
                peerId: 'vonage-sfu-server',
                peerName: 'Vonage SFU server',
                isSfu: true,
                remote: true
            })
        })

        this.webrtcSDK = 'vonage'
        this.foundIntegration = true
    }

    addAgoraIntegration(agora: boolean, peerConnectionEventEmitter: EventEmitter) {
        if (!agora) return

        if (!peerConnectionEventEmitter) {
            throw new Error("Could not integrate with agora. Please make sure you set PeerMetricsOptions.wrapPeerConnection before loading the PeerMetrics script.");            
        }

        peerConnectionEventEmitter.on('newRTCPeerconnection', (pc) => {
            this.emit('newConnection', {
                pc: pc,
                peerId: 'agora-sfu-server',
                peerName: 'Agora SFU server',
                isSfu: true,
                remote: true
            })
        })

        this.webrtcSDK = 'agora'
        this.foundIntegration = true
    }

    addPionIntegration (options: SdkIntegrationInterface['pion'], peerConnectionEventEmitter) {
        if (!options) return

        // if the user sent just a boolean, use the default values for server id/name
        if (typeof options === 'boolean') {
            options = {}
        }

        let { serverId = 'pion-sfu-server', serverName = 'Pion SFU server' } = options;

        serverId = this.checkServerId(serverId);
        serverName = this.checkServerName(serverName);

        if (!peerConnectionEventEmitter) {
            throw new Error("Could not integrate with Pion. Please make sure you set PeerMetricsOptions.wrapPeerConnection before loading the PeerMetrics script.");
        }

        peerConnectionEventEmitter.on('newRTCPeerconnection', (pc) => {
            this.emit('newConnection', {
                pc: pc,
                peerId: serverId,
                peerName: serverName,
                isSfu: true,
                remote: true
            })
        })

        this.webrtcSDK = 'pion';
        this.foundIntegration = true;
    }

    addJitsiIntegration(options: SdkIntegrationInterface['jitsi'], peerConnectionEventEmitter: EventEmitter) {
        if (!options) return

        if (typeof options === 'boolean') {
            options = {}
        }

        let { serverId = 'jitsi-sfu-server', serverName = 'Jitsi SFU Server', conference } = options;

        let peerId = this.checkServerId(serverId);
        let peerName = this.checkServerName(serverName);
        this._jitsiTransportPeerId = peerId
        this._jitsiTransportPeerName = peerName

        if (!peerConnectionEventEmitter) {
            throw new Error("Could not integrate with Jitsi. Please make sure you set PeerMetricsOptions.wrapPeerConnection before loading the PeerMetrics script.");            
        }

        // Register before any JitsiConnection / RTCPeerConnection may be created,
        // otherwise early PCs are never observed and /stats never flows.
        peerConnectionEventEmitter.on('newRTCPeerconnection', (pc) => {
            this._addJitsiConnection(pc, peerId, peerName)
        })

        this._searchExistingJitsiConnections(peerId, peerName)

        // Opt-in: forward Jitsi participant lifecycle events as SDK custom
        // events so the dashboard can surface remote participants even
        // though the SFU transport is monitored as a single peer.
        if (conference) {
            this.attachJitsiConference(conference)
        }

        this.webrtcSDK = 'jitsi';
        this.foundIntegration = true;
    }

    /**
     * Attach participant lifecycle listeners to a `JitsiConference` after it exists.
     * Call once per conference instance (safe to call again on a new conference).
     * Transport hook must already be registered via `addJitsiIntegration`.
     */
    attachJitsiConference(conference: any): void {
        if (!conference) return
        if (this._jitsiConferenceAttachGuard.has(conference)) return
        this._jitsiConferenceAttachGuard.add(conference)
        this._attachJitsiConferenceEvents(conference)
    }

    private _buildScopedPeerId(baseId: string, suffix: string): string {
        const safeBase = String(baseId || '')
        const safeSuffix = String(suffix || '')
        if (!safeSuffix) return safeBase.slice(0, CONSTRAINTS.peer.idLength)

        const separator = '-'
        const suffixPart = separator + safeSuffix
        const maxLen = CONSTRAINTS.peer.idLength
        const maxBaseLen = Math.max(0, maxLen - suffixPart.length)

        if (maxBaseLen === 0) {
            return safeSuffix.slice(0, maxLen)
        }

        const trimmedBase = safeBase.slice(0, maxBaseLen)
        return `${trimmedBase}${suffixPart}`
    }

    private _buildScopedJitsiPeerId(baseId: string, suffix: string): string {
        return this._buildScopedPeerId(baseId, suffix)
    }

    private _inferJitsiTransportKindFromTrack(track: any): 'p2p' | 'jvb' | 'unknown' {
        if (!track) return 'unknown'
        const candidate = typeof track.isP2P === 'function' ? track.isP2P() : track.isP2P
        if (candidate === true) return 'p2p'
        if (candidate === false) return 'jvb'
        return 'unknown'
    }

    _addJitsiConnection(pc, peerId, peerName) {
        if (this._emittedPCs.has(pc)) return
        this._emittedPCs.add(pc)

        const kind = inferJitsiTransportKind(pc)
        let scopedPeerId = peerId
        let scopedPeerName = peerName
        if (kind === 'p2p') {
            scopedPeerId = this._buildScopedJitsiPeerId(peerId, 'p2p')
            scopedPeerName = `${peerName} (P2P)`
        } else if (kind === 'jvb') {
            scopedPeerId = this._buildScopedJitsiPeerId(peerId, 'jvb')
            scopedPeerName = `${peerName} (JVB/SFU)`
        }

        this.emit('newConnection', {
            pc,
            peerId: scopedPeerId,
            peerName: scopedPeerName,
            isSfu: true,
            remote: true
        })
    }

    /**
     * Subscribe to a `JitsiConference` instance and relay user-level events
     * as SDK custom events. This gives the dashboard visibility into remote
     * participants without changing how the transport PC itself is
     * monitored.
     */
    private _attachJitsiConferenceEvents(conference: any) {
        const events = (typeof window !== 'undefined' && (window as any).JitsiMeetJS?.events?.conference) || {}

        const safeOn = (eventName: string, handler: (...args: any[]) => void) => {
            if (!eventName) return
            try {
                if (typeof conference.on === 'function') {
                    conference.on(eventName, handler)
                } else if (typeof conference.addEventListener === 'function') {
                    conference.addEventListener(eventName, handler)
                }
            } catch {
                // best-effort: integration still works without these events
            }
        }

        const emitParticipantEvent = (eventName: string, participantId: string, data: object = {}) => {
            const snapshot = this._jitsiParticipantSnapshots.get(participantId) || {}
            this.emit('jitsiParticipantEvent', {
                eventName,
                participantId,
                displayName: snapshot.displayName,
                ...data
            })
        }

        safeOn(events.USER_JOINED, (id: string, participant: any) => {
            const previous = this._jitsiParticipantSnapshots.get(id)
            if (previous?.isPresent) return
            const displayName = typeof participant?.getDisplayName === 'function'
                ? participant.getDisplayName()
                : undefined
            this._jitsiParticipantSnapshots.set(id, { displayName, isPresent: true })
            emitParticipantEvent('jitsiUserJoined', id)
        })

        safeOn(events.USER_LEFT, (id: string) => {
            const previous = this._jitsiParticipantSnapshots.get(id)
            if (!previous?.isPresent) return
            emitParticipantEvent('jitsiUserLeft', id)
            this._jitsiParticipantSnapshots.set(id, { ...previous, isPresent: false })
        })

        safeOn(events.DISPLAY_NAME_CHANGED, (id: string, displayName: string) => {
            const snapshot = this._jitsiParticipantSnapshots.get(id) || {}
            snapshot.displayName = displayName
            this._jitsiParticipantSnapshots.set(id, snapshot)
            emitParticipantEvent('jitsiDisplayNameChanged', id, { displayName })
        })

        // Keep best-effort hints about which participant owns a track to support
        // deterministic enrichment of custom events and future per-track attribution.
        safeOn(events.TRACK_ADDED, (track: any) => {
            const participantId = this._extractParticipantIdFromTrack(track)
            if (!participantId || !track) return
            this._jitsiTrackParticipantHints.set(track, participantId)
            const transportType = this._inferJitsiTransportKindFromTrack(track)
            emitParticipantEvent('jitsiTrackAdded', participantId, {
                transportType,
                trackType: typeof track.getType === 'function' ? track.getType() : undefined,
                trackId: typeof track.getTrackId === 'function' ? track.getTrackId() : undefined
            })
        })

        safeOn(events.TRACK_REMOVED, (track: any) => {
            const hintedParticipantId = track ? this._jitsiTrackParticipantHints.get(track) : undefined
            const participantId = hintedParticipantId || this._extractParticipantIdFromTrack(track)
            if (!participantId) return
            const transportType = this._inferJitsiTransportKindFromTrack(track)
            emitParticipantEvent('jitsiTrackRemoved', participantId, {
                transportType,
                trackType: typeof track?.getType === 'function' ? track.getType() : undefined,
                trackId: typeof track?.getTrackId === 'function' ? track.getTrackId() : undefined
            })
            if (track) {
                this._jitsiTrackParticipantHints.delete(track)
            }
        })

        const clearConferenceState = (reason: string) => {
            if (this._jitsiParticipantSnapshots.size > 0) {
                this.emit('jitsiParticipantEvent', {
                    eventName: 'jitsiConferenceReset',
                    reason,
                    participantsTracked: this._jitsiParticipantSnapshots.size
                })
            }
            this._jitsiParticipantSnapshots.clear()
            this._jitsiTrackParticipantHints = new WeakMap()
        }

        const runPcDiscovery = (): boolean => {
            try {
                return this._discoverJitsiPeerConnectionsUnderConference(conference)
            } catch {
                // best-effort: discovery is optional across Jitsi versions
                return false
            }
        }

        if (events.CONFERENCE_JOINED) {
            safeOn(events.CONFERENCE_JOINED, () => {
                // Retry only if the first pass did not find any PC: lib-jitsi-meet may build
                // the PC slightly after CONFERENCE_JOINED on slow devices. Avoids the prior
                // 3×12k-node traversal cost on successful first passes.
                const foundImmediate = runPcDiscovery()
                if (!foundImmediate && typeof window !== 'undefined' && typeof window.setTimeout === 'function') {
                    window.setTimeout(runPcDiscovery, 800)
                }
            })
        }

        safeOn(events.CONFERENCE_LEFT, () => clearConferenceState('conference-left'))
        safeOn(events.CONFERENCE_FAILED, () => clearConferenceState('conference-failed'))
    }

    /**
     * Walk the conference object graph to find RTCPeerConnection instances lib-jitsi-meet
     * may have created before our wrap listener was registered (or that never go through
     * `window.RTCPeerConnection`).
     *
     * Bounded on both depth and node count to keep worst-case cost low on dense Jitsi
     * object graphs — `lib-jitsi-meet` objects expose many getters that can be expensive
     * to invoke. Returns whether at least one PC was emitted so callers can skip scheduled
     * retries on success.
     */
    private _discoverJitsiPeerConnectionsUnderConference(root: any): boolean {
        const peerId = this._jitsiTransportPeerId
        const peerName = this._jitsiTransportPeerName
        if (!peerId || !root || typeof root !== 'object') return false

        const visited = new WeakSet<object>()
        let nodes = 0
        let emitted = 0
        const MAX_NODES = 6000
        const MAX_DEPTH = 8

        const walk = (obj: any, depth: number): void => {
            if (obj == null || depth < 0 || nodes > MAX_NODES) return
            if (typeof obj !== 'object') return
            if (visited.has(obj)) return
            visited.add(obj)
            nodes++

            try {
                if (typeof RTCPeerConnection !== 'undefined' && obj instanceof RTCPeerConnection) {
                    const before = this._emittedPCs.has(obj)
                    this._addJitsiConnection(obj, peerId, peerName)
                    if (!before) emitted++
                    return
                }
            } catch {
                return
            }

            let keys: (string | symbol)[]
            try {
                keys = Reflect.ownKeys(obj)
            } catch {
                return
            }

            for (const key of keys) {
                if (typeof key === 'symbol') continue
                const k = key as string
                if (k === 'parent' || k === 'window' || k === 'document' || k === 'top' || k === 'self') continue
                try {
                    const desc = Object.getOwnPropertyDescriptor(obj, k)
                    if (desc && typeof desc.get === 'function') {
                        try {
                            walk(desc.get.call(obj), depth - 1)
                        } catch {
                            /* private / throwing getter */
                        }
                    } else {
                        walk((obj as any)[k], depth - 1)
                    }
                } catch {
                    /* ignore */
                }
            }
        }

        walk(root, MAX_DEPTH)
        return emitted > 0
    }

    private _extractParticipantIdFromTrack(track: any): string | null {
        if (!track) return null

        if (typeof track.getParticipantId === 'function') {
            const id = track.getParticipantId()
            if (typeof id === 'string' && id) return id
        }

        const owner = typeof track.getParticipant === 'function' ? track.getParticipant() : null
        if (owner) {
            const ownerId = typeof owner.getId === 'function' ? owner.getId() : owner.id
            if (typeof ownerId === 'string' && ownerId) return ownerId
        }

        const endpointId = track.getParticipantId || track.ownerEndpointId || track.endpointId
        if (typeof endpointId === 'string' && endpointId) return endpointId

        return null
    }

    _searchExistingJitsiConnections(peerId, peerName) {
        try {
            if (window.JitsiMeetJS?.app?._room?.rtc) {
                this._searchExistingJitsiConnectionsInternal(window.JitsiMeetJS.app._room.rtc, peerId, peerName)
            }
        } catch (error) {
            // Jitsi not ready yet, connections will be captured via event emitter.
            // Still log the underlying cause to aid debugging unexpected failures.
            log('Jitsi connection scan failed:', error)
        }
    }

    /**
     * Search for existing Jitsi WebRTC connections
     * @private
     */
    private _searchExistingJitsiConnectionsInternal(rtc, peerId: string, peerName: string) {
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
                    for (const [, pc] of current) {
                        if (pc instanceof RTCPeerConnection) {
                            this._addJitsiConnection(pc, peerId, peerName)
                        }
                    }
                } else if (Array.isArray(current)) {
                    current.forEach((pc) => {
                        if (pc instanceof RTCPeerConnection) {
                            this._addJitsiConnection(pc, peerId, peerName)
                        }
                    })
                } else if (current instanceof RTCPeerConnection) {
                    this._addJitsiConnection(current, peerId, peerName)
                }
            }
        }
    }

    /**
     * Checks if the serverId is valid
     * @param  {string} serverId [description]
     * @return {string}          [description]
     */
    private checkServerId (serverId: string): string {
        if (typeof serverId !== 'string') {
            throw new Error("The serverId must be a string")
        } else if (serverId.length > CONSTRAINTS.peer.idLength) {
            throw new Error(`The serverId must be no longer than ${CONSTRAINTS.peer.idLength} characters.`)
        }

        return serverId
    }

    /**
     * Used to check if the serverName argument is valid
     * @param serverName the string to check
     * @returns the string
     */
    private checkServerName(serverName: string): string {
        if (serverName) {
            if (typeof serverName !== 'string') {
                throw new Error('serverName should be a string')
            }

            // if the name is too long, just snip it
            if (serverName.length > CONSTRAINTS.peer.nameLength) {
                serverName = serverName.slice(CONSTRAINTS.peer.nameLength)
            }
        }

        return serverName
    }
}