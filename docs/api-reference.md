# API Reference

## 📚 Core API

### PeerMetrics Class

The main class for the PeerMetrics SDK. Provides methods for initializing the SDK, managing connections, and tracking events.

```typescript
class PeerMetrics {
  constructor(options: PeerMetricsConstructor)
  async initialize(options?: InitializeObject): Promise<void>
  async addConnection(options: AddConnectionOptions): Promise<{ connectionId: string }>
  async autoDetectConnections(options?: AutoDetectConnectionsOptions): Promise<number>
  async removeConnection(options: RemoveConnectionOptions): Promise<void>
  async removePeer(peerId: string): Promise<void>
  async addSdkIntegration(options: SdkIntegrationInterface): Promise<void>
  async addEvent(options: AddEventOptions): Promise<void>
  async mute(): Promise<void>
  async unmute(): Promise<void>
  async endCall(): Promise<void>
  static wrapPeerConnection(): boolean
  static async getPageUrl(options: GetUrlOptions): Promise<string>
}
```

## 🔧 Constructor

### PeerMetrics(options)

Creates a new PeerMetrics instance.

```typescript
const peerMetrics = new PeerMetrics({
  apiKey: 'your-api-key',
  userId: 'user-123',
  conferenceId: 'conference-1',
  conferenceName: 'My Conference',
  appVersion: '1.0.0',
  remote: true,
  meta: {
    isRegistered: true,
    plan: 'premium'
  },
  pageEvents: {
    pageVisibility: true
  }
})
```

#### Parameters
- **apiKey** (string, required): Your PeerMetrics API key
- **userId** (string, required): Unique identifier for the user
- **conferenceId** (string, required): Unique identifier for the conference
- **conferenceName** (string, optional): Human-readable conference name
- **appVersion** (string, optional): Version of your application
- **remote** (boolean, optional): Enable remote stats collection (default: true)
- **meta** (object, optional): Additional metadata (max 5 attributes)
- **pageEvents** (object, optional): Page event tracking configuration

#### Throws
- `Error`: When required parameters are missing
- `Error`: When parameters are invalid

## 🚀 Initialization

### initialize(options?)

Initializes the SDK and establishes a session with the PeerMetrics service.

```typescript
await peerMetrics.initialize()
// or
await peerMetrics.initialize({
  conferenceId: 'new-conference',
  conferenceName: 'New Conference'
})
```

#### Parameters
- **options** (object, optional): Override conference details
  - **conferenceId** (string, required): New conference ID
  - **conferenceName** (string, optional): New conference name

#### Returns
- `Promise<void>`: Resolves when initialization is complete

#### Throws
- `Error`: When SDK is not supported in current environment
- `Error`: When API key is invalid
- `Error`: When quota is exceeded

## 🔗 Connection Management

### addConnection(options)

Adds a WebRTC connection to the monitoring system.

```typescript
const { connectionId } = await peerMetrics.addConnection({
  pc: new RTCPeerConnection(),
  peerId: 'peer-1',
  peerName: 'Alice',
  isSfu: false
})
```

#### Parameters
- **options** (object): Connection configuration
  - **pc** (RTCPeerConnection, required): WebRTC connection to monitor
  - **peerId** (string, required): Unique identifier for the peer
  - **peerName** (string, optional): Human-readable peer name
  - **isSfu** (boolean, optional): Whether this is an SFU connection

#### Returns
- `Promise<{ connectionId: string }>`: Connection details

#### Throws
- `Error`: When SDK is not initialized
- `Error`: When required parameters are missing
- `Error`: When peerId matches the current user ID

### autoDetectConnections(options?)

Finds `RTCPeerConnection` instances via SDK globals / known shapes and calls `addConnection` once per PC (deduped).

```typescript
await peerMetrics.autoDetectConnections() // default: not SFU, no full window scan
await peerMetrics.autoDetectConnections({ isSfu: true, scanBrowserGlobals: false })
```

- **isSfu** — pass through to `addConnection` (default: omit).
- **scanBrowserGlobals** — walk `window` (slow / risky; default off).

Returns `Promise<number>`: how many were added (skips duplicates and “already monitoring”).

### removeConnection(options)

Stops monitoring a specific connection.

```typescript
// Remove by connection ID
await peerMetrics.removeConnection({ connectionId: 'conn-123' })

// Remove by RTCPeerConnection
await peerMetrics.removeConnection({ pc: peerConnection })
```

#### Parameters
- **options** (object): Removal options
  - **connectionId** (string): Connection ID returned by addConnection
  - **pc** (RTCPeerConnection): RTCPeerConnection instance

#### Returns
- `Promise<void>`: Resolves when connection is removed

### removePeer(peerId)

Stops monitoring all connections for a specific peer.

```typescript
await peerMetrics.removePeer('peer-1')
```

#### Parameters
- **peerId** (string, required): Peer ID to remove

#### Returns
- `Promise<void>`: Resolves when peer is removed

#### Throws
- `Error`: When peer ID is not found

## 🔌 SDK Integrations

### addSdkIntegration(options)

Integrates with various WebRTC SDKs for automatic connection monitoring.

```typescript
// LiveKit integration
await peerMetrics.addSdkIntegration({
  livekit: {
    room: room,
    serverId: 'sfu-server-1',
    serverName: 'LiveKit SFU Server'
  }
})

// Twilio Video integration
await peerMetrics.addSdkIntegration({
  twilioVideo: {
    room: room
  }
})

// Mediasoup integration
await peerMetrics.addSdkIntegration({
  mediasoup: {
    device: device,
    serverId: 'mediasoup-server-1',
    serverName: 'Mediasoup SFU Server'
  }
})
// janus, vonage, agora, jitsi, pion: see integrations.md (jitsi/pion need wrapPeerConnection)
```

#### Parameters
- **options** (object): One integration key per call (e.g. **livekit**, **twilioVideo**, **mediasoup**, **janus**, **vonage**, **agora**, **jitsi**, **pion**). **jitsi** / **pion**: `true` or `{ serverId?, serverName? }`.
- Stacks without an adapter (e.g. **SimplePeer**): use `addConnection({ pc, peerId })` — [integrations.md](./integrations.md).
- For **jitsi**, passing `conference` (a JitsiConference instance) enables participant lifecycle custom events (`jitsiUserJoined`, `jitsiUserLeft`, `jitsiDisplayNameChanged`, `jitsiTrackAdded`, `jitsiTrackRemoved`).

#### Returns
- `Promise<void>`: Resolves when integration is complete

#### Throws
- `Error`: When no valid integration is found

## 📊 Event Tracking

### addEvent(options)

Adds a custom event to the analytics timeline.

```typescript
await peerMetrics.addEvent({
  eventName: 'user-action',
  description: 'User clicked settings button',
  metadata: {
    buttonId: 'settings-btn',
    timestamp: Date.now()
  }
})
```

#### Parameters
- **options** (object): Event details
  - **eventName** (string, optional): Event name (max 50 characters)
  - **description** (string, optional): Event description
  - **metadata** (object, optional): Additional event data

#### Returns
- `Promise<void>`: Resolves when event is recorded

#### Throws
- `Error`: When event data is invalid
- `Error`: When event size exceeds limits

### mute()

Records a mute event for the current user.

```typescript
await peerMetrics.mute()
```

#### Returns
- `Promise<void>`: Resolves when event is recorded

### unmute()

Records an unmute event for the current user.

```typescript
await peerMetrics.unmute()
```

#### Returns
- `Promise<void>`: Resolves when event is recorded

## 🔚 Session Management

### endCall()

Ends the current session and stops all monitoring.

```typescript
await peerMetrics.endCall()
```

#### Returns
- `Promise<void>`: Resolves when session is ended

### endConference() (deprecated)

Backward-compatible alias for `endCall()`.

```typescript
await peerMetrics.endConference()
```

#### Returns
- `Promise<void>`: Resolves when session is ended

## 🛠️ Static Methods

### wrapPeerConnection()

Wraps the native RTCPeerConnection class for automatic monitoring.

```typescript
PeerMetrics.wrapPeerConnection()
```

#### Returns
- `boolean`: True if wrapping was successful

#### Throws
- `Error`: When not called in browser context

### getPageUrl(options)

Gets the PeerMetrics dashboard URL for a conference or participant.

```typescript
const url = await PeerMetrics.getPageUrl({
  apiKey: 'your-api-key',
  userId: 'user-123'
  // or
  conferenceId: 'conference-1'
})
```

#### Parameters
- **options** (object): URL options
  - **apiKey** (string, required): Your API key
  - **userId** (string, optional): User ID for participant view
  - **conferenceId** (string, optional): Conference ID for conference view

#### Returns
- `Promise<string>`: Dashboard URL

#### Throws
- `Error`: When required parameters are missing
- `Error`: When both userId and conferenceId are provided

## 📝 Type Definitions

### PeerMetricsConstructor

```typescript
interface PeerMetricsConstructor {
  apiKey: string
  userId: string
  conferenceId: string
  conferenceName?: string
  appVersion?: string
  remote?: boolean
  meta?: Record<string, string | number | boolean>
  pageEvents?: PageEvents
  apiRoot?: string
  mockRequests?: boolean
  debug?: boolean
  wrapPeerConnection?: boolean
}
```

### AddConnectionOptions

```typescript
interface AddConnectionOptions {
  pc: RTCPeerConnection
  peerId: string
  peerName?: string
  isSfu?: boolean
}
```

### AutoDetectConnectionsOptions

```typescript
interface AutoDetectConnectionsOptions {
  isSfu?: boolean
  scanBrowserGlobals?: boolean
}
```

### RemoveConnectionOptions

```typescript
interface RemoveConnectionOptions {
  connectionId?: string
  pc?: RTCPeerConnection
}
```

### AddEventOptions

```typescript
interface AddEventOptions {
  eventName?: string
  description?: string
  metadata?: Record<string, any>
}
```

### SdkIntegrationInterface

```typescript
interface SdkIntegrationInterface {
  livekit?: {
    room: any
    serverId?: string
    serverName?: string
  }
  twilioVideo?: {
    room: any
  }
  mediasoup?: {
    device: any
    serverId?: string
    serverName?: string
  }
  janus?: {
    plugin: any
    serverId?: string
    serverName?: string
  }
  vonage?: boolean
  agora?: boolean
  pion?: boolean | {
    serverId?: string
    serverName?: string
  }
  jitsi?: boolean | {
    serverId?: string
    serverName?: string
    conference?: any
  }
}
```

### PageEvents

```typescript
interface PageEvents {
  pageVisibility?: boolean
  fullScreen?: boolean
}
```

### GetUrlOptions

```typescript
interface GetUrlOptions {
  apiKey: string
  userId?: string
  conferenceId?: string
}
```

## 🚨 Error Handling

### PeerMetricsError

Custom error class for SDK-specific errors.

```typescript
class PeerMetricsError extends Error {
  code?: string
  constructor(message: string)
}
```

### Common Error Codes

- **INVALID_API_KEY**: API key is invalid or expired
- **QUOTA_EXCEEDED**: API quota has been exceeded
- **INVALID_CONFERENCE**: Conference ID is invalid
- **CONNECTION_FAILED**: Failed to establish connection
- **INITIALIZATION_FAILED**: SDK initialization failed

### Error Handling Example

```typescript
try {
  await peerMetrics.initialize()
} catch (error) {
  if (error instanceof PeerMetricsError) {
    console.error('PeerMetrics Error:', error.message)
    if (error.code === 'INVALID_API_KEY') {
      // Handle invalid API key
    }
  } else {
    console.error('Unexpected error:', error)
  }
}
```

## 📊 Performance Considerations

### Bundle Size
- **Gzipped**: ~45KB
- **Minified**: ~140KB
- **Tree Shaking**: Supported

### Runtime Performance
- **Initialization**: < 100ms
- **Memory Usage**: < 10MB baseline
- **CPU Impact**: < 1% during normal operation

### Browser Support
- **Chrome**: 60+
- **Firefox**: 55+
- **Safari**: 12+
- **Edge**: 79+

## 🔧 Configuration Options

### Default Options

```typescript
const DEFAULT_OPTIONS = {
  apiRoot: 'https://api.peermetrics.io',
  remote: true,
  getStatsInterval: 1000,
  pageEvents: {
    pageVisibility: false,
    fullScreen: false
  }
}
```

### Constraints

```typescript
const CONSTRAINTS = {
  meta: {
    length: 5,
    keyLength: 20,
    accepted: ['string', 'number', 'boolean']
  },
  peer: {
    nameLength: 50
  },
  customEvent: {
    eventNameLength: 50,
    bodyLength: 1000
  }
}
```
