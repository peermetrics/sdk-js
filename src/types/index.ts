
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

export interface PeerMetricsConstructor extends DefaultOptions {
    apiKey: string,
    userId: string,
    userName?: string,
    conferenceId: string,
    conferenceName?: string,
    appVersion?: string,
    meta?: object
}

export interface SessionData {
    platform: object,
    constraints: object,
    devices: object,
    appVersion: string,
    meta: object
}

export interface AddConnectionOptions {
    peerId: string,
    pc: RTCPeerConnection,
    connectionId?: string,
    remote?: boolean,
    peerName?: string
}

export interface AddEventOptions extends Object {
    eventName?: string
}