import { EventEmitter } from 'events'

import { CONSTRAINTS } from "./constants";

import type {
    SdkIntegrationInterface,
    WebrtcSDKs,
} from './types/index'

export default class SdkIntegration extends EventEmitter {
    foundIntegration: boolean = false
    webrtcSDK: WebrtcSDKs

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

        // listen for the transportCreated event
        room.engine.on('transportsCreated', (publiser, subscriber) => {
            this.emit('newConnection', {
                pc: publiser.pc,
                peerId: serverId,
                peerName: serverName,
                isSfu: true,
                remote: true
            })

            this.emit('newConnection', {
                pc: subscriber.pc,
                peerId: serverId,
                peerName: serverName,
                isSfu: true,
                remote: true
            })
        })

        this.webrtcSDK = 'livekit'
        this.foundIntegration = true
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

        // if the user sent just a boolean, use the default values for server id/name
        if (typeof options === 'boolean') {
            options = {}
        }

        let { serverId = 'jitsi-sfu-server', serverName = 'Jitsi SFU Server' } = options;

        serverId = this.checkServerId(serverId);
        serverName = this.checkServerName(serverName);

        if (!peerConnectionEventEmitter) {
            throw new Error("Could not integrate with Jitsi. Please make sure you set PeerMetricsOptions.wrapPeerConnection before loading the PeerMetrics script.");            
        }

        // Listen for new RTCPeerConnection instances created by Jitsi
        peerConnectionEventEmitter.on('newRTCPeerconnection', (pc) => {
            this.emit('newConnection', {
                pc: pc,
                peerId: serverId,
                peerName: serverName,
                isSfu: true,
                remote: true
            })
        })

        // Also try to find existing Jitsi connections
        if (window.JitsiMeetJS && window.JitsiMeetJS.app) {
            try {
                const app = window.JitsiMeetJS.app
                if (app._room && app._room.rtc) {
                    this._searchExistingJitsiConnections(app._room.rtc, serverId, serverName)
                }
            } catch (error) {
                // Jitsi not ready yet, connections will be captured via event emitter
            }
        }

        this.webrtcSDK = 'jitsi';
        this.foundIntegration = true;
    }

    /**
     * Search for existing Jitsi WebRTC connections
     * @private
     */
    private _searchExistingJitsiConnections(rtc, serverId: string, serverName: string) {
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
                            this.emit('newConnection', {
                                pc: pc,
                                peerId: `${serverId}-${peerId}`,
                                peerName: serverName,
                                isSfu: true,
                                remote: true
                            })
                        }
                    }
                } else if (Array.isArray(current)) {
                    current.forEach((pc, index) => {
                        if (pc instanceof RTCPeerConnection) {
                            this.emit('newConnection', {
                                pc: pc,
                                peerId: `${serverId}-${index}`,
                                peerName: serverName,
                                isSfu: true,
                                remote: true
                            })
                        }
                    })
                } else if (current instanceof RTCPeerConnection) {
                    this.emit('newConnection', {
                        pc: current,
                        peerId: serverId,
                        peerName: serverName,
                        isSfu: true,
                        remote: true
                    })
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