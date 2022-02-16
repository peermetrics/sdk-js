
export * from './api'

export interface PageEvents {
    pageVisibility: boolean,
    // fullScreen: boolean
}

export interface DefaultOptions {
    apiRoot: string,
    getStatsInterval: number,
    remote?: boolean,
    debug?: boolean,
    mockRequests?: boolean,
    pageEvents?: PageEvents
}

interface MediaSoupIntegration {
    device: any
    serverId: string
    serverName?: string
}

interface JanusIntegrationInterface {
    plugin: any
    serverId: string
    serverName?: string
}

interface LiveKitIntegrationInterface {
    room: any
    serverId: string
    serverName?: string
}

interface TwilioVideoIntegrationInterface {
    room: any
    serverId: string
    serverName?: string
}

export interface SdkIntegration {
    // sdk
    mediasoup?: MediaSoupIntegration,
    janus?: JanusIntegrationInterface,
    livekit?: LiveKitIntegrationInterface,
    twilioVideo?: TwilioVideoIntegrationInterface
}

export interface PeerMetricsConstructor extends DefaultOptions, SdkIntegration {
    apiKey: string,
    userId: string,
    userName?: string,
    conferenceId: string,
    conferenceName?: string,
    appVersion?: string,
    meta?: object
}

export type WebrtcSDKs = '' | 'mediasoup' | 'jitsi' | 'janus' | 'livekit' | 'twilioVideo'

export interface SessionData {
    platform: object,
    constraints: object,
    devices: object,
    appVersion: string,
    meta: object,
    webrtcSdk: string
}

export interface AddConnectionOptions {
    peerId: string,
    pc: RTCPeerConnection,
    connectionId?: string,
    remote?: boolean,
    peerName?: string,
    isSfu?: boolean
}

export interface AddEventOptions extends Object {
    eventName?: string
}