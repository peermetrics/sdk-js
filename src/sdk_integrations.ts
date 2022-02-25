import { EventEmitter } from 'events'

import { CONSTRAINTS } from "./constants";

import type {
    SdkIntegrationInterface,
    WebrtcSDKs,
} from './types/index'

export default class SdkIntegration extends EventEmitter {
    foundIntegration: boolean = false
    webrtcSDK: WebrtcSDKs

    addIntegration(options: SdkIntegrationInterface, peerConnectionEventEmitter: null | EventEmitter) {

        this.addMediaSoupIntegration(options.mediasoup)
        this.addJanusIntegration(options.janus)
        this.addLivekitIntegration(options.livekit)
        this.addTwilioVideoIntegration(options.twilioVideo)
        this.addVonageIntegration(options.vonage, peerConnectionEventEmitter)

        return this.foundIntegration
    }

    addMediaSoupIntegration(options) {
        if (!options) return

        let { device, serverId, serverName } = options
        // check if the user sent the right device instance
        if (!device || !device.observer) {
            throw new Error("For integrating with MediaSoup, you need to send an instace of mediasoupClient.Device().")
        }

        if (!serverId) {
            throw new Error("For integrating with MediaSoup, you need to send a serverId as argument.")
        }

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

        let { plugin, serverId, serverName } = options
        // check if the user sent the right plugin instance
        if (!plugin || typeof plugin.webrtcStuff !== 'object') {
            throw new Error("For integrating with Janus, you need to send an instace of plugin after calling .attach().")
        }

        if (!serverId) {
            throw new Error("For integrating with Janus, you need to send a serverId as argument.")
        }
        
        serverName = this.checkServerName(serverName)

        this.webrtcSDK = 'janus'

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

        this.foundIntegration = true
    }

    addLivekitIntegration(options) {
        if (!options) return

        let { room, serverId, serverName } = options

        // check if the user sent the right room instance
        if (!room || typeof room.engine !== 'object') {
            throw new Error("For integrating with LiveKit, you need to send an instace of the room as soon as creating it.")
        }

        if (!serverId) {
            throw new Error("For integrating with LiveKit, you need to send a serverId as argument.")
        }

        serverName = this.checkServerName(serverName)

        this.webrtcSDK = 'livekit'

        // listen for the transportCreated event
        room.engine.on('transportsCreated', (publiser, subscriber) => {
            this.emit('newConnection', {
                pc: publiser.pc,
                peerId: serverId,
                peerName: serverName,
                isSfu: true
            })

            this.emit('newConnection', {
                pc: subscriber.pc,
                peerId: serverId,
                peerName: serverName,
                isSfu: true
            })
        })

        this.foundIntegration = true
    }

    addTwilioVideoIntegration (options) {
        if (!options) return

        let { room, serverId, serverName } = options
        // check if the user sent the right room instance
        if (!room || typeof room._signaling !== 'object') {
            throw new Error("For integrating with Twilio Video SDK, you need to send an instace of the room as soon as you create it.")
        }

        if (!serverId) {
            throw new Error("For integrating with Twilio Video SDK, you need to send a serverId as argument.")
        }

        serverName = this.checkServerName(serverName)

        this.webrtcSDK = 'twilioVideo'

        room._signaling._peerConnectionManager._peerConnections.forEach(pcs => {
            this.emit('newConnection', {
                pc: pcs._peerConnection._peerConnection,
                peerId: serverId,
                peerName: serverName
            })
        })

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