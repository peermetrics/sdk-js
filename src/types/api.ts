
export interface ApiInitializeData {
    conferenceId: string,
    conferenceName: string,
}

export interface RequestData {
    data?: object,
    token?: string,
    devices?: object[],
    eventName?: string,
    timestamp?: DOMHighResTimeStamp,
    delta?: number
}

export interface MakeRequest {
    path: string,
    data: RequestData,
    timestamp?: DOMHighResTimeStamp,
    method?: 'post' | 'put'
}

export interface ConnectionEventData {
    eventName: string,
    peerId: string,
    connectionId?: string,
    peerName?: string,
    timestamp?: null | DOMHighResTimeStamp,
    data?: null | RequestData
}