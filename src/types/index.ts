
export * from './api'

declare global {
    interface Window { PeerMetricsOptions: any; }
}

export interface PageEvents {
    pageVisibility: boolean,
    // fullScreen: boolean
}

export interface DefaultOptions {
    apiRoot?: string,
    getStatsInterval?: number,
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
}

export interface PionIntegrationInterface {
    serverId?: string
    serverName?: string
}

export interface SdkIntegrationInterface {
    mediasoup?: MediaSoupIntegration,
    janus?: JanusIntegrationInterface,
    livekit?: LiveKitIntegrationInterface,
    twilioVideo?: TwilioVideoIntegrationInterface
    vonage?: boolean
    agora?: boolean
    pion?: boolean | PionIntegrationInterface
}

export interface InitializeObject {
    conferenceId: string,
    conferenceName?: string,
}

export interface PeerMetricsConstructor extends DefaultOptions {
    apiKey: string,
    userId: string,
    userName?: string,
    conferenceId: string,
    conferenceName?: string,
    appVersion?: string,
    meta?: object,
    wrapPeerConnection?: boolean
}

export type WebrtcSDKs = '' | 'mediasoup' | 'jitsi' | 'janus' | 'livekit' | 'twilioVideo' | 'vonage' | 'agora' | 'pion'

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

export interface RemoveConnectionOptions {
    pc?: RTCPeerConnection
    connectionId?: string
}

export interface AddEventOptions extends Object {
    eventName?: string
}

export interface PeersToMonitor {
    [id: string]: {
        id: string,
        connections: string[]
    }
}

export interface GetUrlOptions {
    apiKey: string,
    userId?: string,
    conferenceId?: string,
}