import type { DefaultOptions } from './types/index'

export const DEFAULT_OPTIONS = {
    pageEvents: {
        pageVisibility: false,
        // fullScreen: false
    },
    apiRoot: 'https://api.peermetrics.io/v1',
    debug: false,
    mockRequests: false,
    remote: true,
    getStatsInterval: 5000
} as DefaultOptions

export const CONSTRAINTS = {
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
        nameLength: 64,
        idLength: 64
    }
}
