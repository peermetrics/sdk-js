import { EventEmitter } from 'events'

import { CONSTRAINTS } from "./constants";

import type {
    SdkIntegrationInterface,
    WebrtcSDKs,
} from './types/index'

export default class SdkIntegration extends EventEmitter {
    foundIntegration: boolean = false
    webrtcSDK: WebrtcSDKs
    private _emittedPCs: WeakSet<RTCPeerConnection> = new WeakSet()

    addIntegration(options: SdkIntegrationInterface, peerConnectionEventEmitter: null | EventEmitter): boolean {

        this.addMediaSoupIntegration(options.mediasoup)
        this.addJanusIntegration(options.janus)
        this.addLivekitIntegration(options.livekit)
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

    addLivekitIntegration(options) {
        if (!options) return

        let { room, serverId = 'livekit-sfu-server', serverName = 'LiveKit SFU Server' } = options

        // check if the user sent the right room instance
        if (!room || typeof room.engine !== 'object') {
            throw new Error("For integrating with LiveKit, you need to send an instace of the room as soon as creating it.")
        }

        serverId = this.checkServerId(serverId)

        serverName = this.checkServerName(serverName)

        // Listen for LiveKit transport creation events
        room.engine.on('transportsCreated', (publisher, subscriber) => {
            this._addLiveKitConnection(publisher.pc, serverId, serverName, 'outbound')
            this._addLiveKitConnection(subscriber.pc, serverId, serverName, 'inbound')
        })
        
        // Search for existing connections as fallback
        setTimeout(() => this._searchExistingLiveKitConnections(room, serverId, serverName), 1000)

        this.webrtcSDK = 'livekit'
        this.foundIntegration = true
    }

    _addLiveKitConnection(pc, serverId, serverName, direction) {
        this.emit('newConnection', {
            pc: pc,
            peerId: `${serverId}-${direction}`,
            peerName: `${serverName} ${direction}`,
            isSfu: true,
            remote: true
        })
    }

    _searchExistingLiveKitConnections(room, serverId, serverName) {
        try {
            const connections = []
            
            // Check common connection locations
            const locations = [
                room.engine?.pcManager?.pc,
                room.engine?.publisher?.pc,
                room.engine?.subscriber?.pc,
                room.engine?.transport?.pc
            ]
            
            locations.forEach(pc => pc && connections.push(pc))
            
            // Deep search if no connections found
            if (connections.length === 0 && room.engine) {
                this._deepSearchForConnections(room.engine, connections)
            }
            
            // Add found connections with descriptive direction names
            connections.forEach((pc, index) => {
                const direction = index === 0 ? 'outbound' : 'inbound'
                this._addLiveKitConnection(pc, serverId, serverName, direction)
            })
            
        } catch (error) {
            // Silently handle errors - connections will be caught by event listeners
        }
    }

    _deepSearchForConnections(obj, connections, visited = new Set()) {
        if (!obj || typeof obj !== 'object' || visited.has(obj)) return
        
        visited.add(obj)
        
        if (obj.constructor?.name === 'RTCPeerConnection') {
            connections.push(obj)
            return
        }
        
        // Recursively search object properties
        Object.values(obj).forEach(value => {
            if (value && typeof value === 'object') {
                this._deepSearchForConnections(value, connections, visited)
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

        let { serverId = 'jitsi-sfu-server', serverName = 'Jitsi SFU Server' } = options;

        let peerId = this.checkServerId(serverId);
        let peerName = this.checkServerName(serverName);

        if (!peerConnectionEventEmitter) {
            throw new Error("Could not integrate with Jitsi. Please make sure you set PeerMetricsOptions.wrapPeerConnection before loading the PeerMetrics script.");            
        }

        peerConnectionEventEmitter.on('newRTCPeerconnection', (pc) => {
            this._addJitsiConnection(pc, peerId, peerName)
        })

        this._searchExistingJitsiConnections(peerId, peerName)

        this.webrtcSDK = 'jitsi';
        this.foundIntegration = true;
    }

    _addJitsiConnection(pc, peerId, peerName) {
        if (this._emittedPCs.has(pc)) return
        this._emittedPCs.add(pc)

        this.emit('newConnection', {
            pc,
            peerId,
            peerName,
            isSfu: true,
            remote: true
        })
    }

    _searchExistingJitsiConnections(peerId, peerName) {
        try {
            if (window.JitsiMeetJS?.app?._room?.rtc) {
                this._searchExistingJitsiConnectionsInternal(window.JitsiMeetJS.app._room.rtc, peerId, peerName)
            }
        } catch (error) {
            // Jitsi not ready yet, connections will be captured via event emitter
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