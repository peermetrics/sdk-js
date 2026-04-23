# Architecture

## 🎯 Core Purpose

**Single Goal**: Capture WebRTC statistics and send them to the PeerMetrics API.

## 🏗️ Simple Architecture

```
┌─────────────────────────────────────────┐
│              PeerMetrics SDK            │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│  │  User   │ │   API   │ │   SDK   │   │
│  │ Context │ │ Wrapper │ │Integr.  │   │
│  └─────────┘ └─────────┘ └─────────┘   │
├─────────────────────────────────────────┤
│            WebRTC Stats                 │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│  │Connection│ │ Events  │ │ Stats   │   │
│  │Monitoring│ │Handling │ │Collection│   │
│  └─────────┘ └─────────┘ └─────────┘   │
├─────────────────────────────────────────┤
│            Browser APIs                 │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│  │RTCPeer  │ │MediaDev │ │ Fetch   │   │
│  │Connection│ │ ices    │ │         │   │
│  └─────────┘ └─────────┘ └─────────┘   │
└─────────────────────────────────────────┘
```

## 🧩 Core Components

### 1. PeerMetrics (Main Class)
```typescript
class PeerMetrics {
  private user: User                    // User context & device info
  private apiWrapper: ApiWrapper        // API communication
  private webrtcStats: WebRTCStats      // WebRTC statistics
  private _options: PeerMetricsConstructor
  private _initialized: boolean
}
```

**Purpose**: Orchestrate WebRTC stats collection and API communication.

### 2. User (Context & Device Info)
```typescript
class User {
  userId: string
  userName: string
  deviceInfo: object
  platform: object
  devices: object[]
  
  getUserDetails(): Promise<SessionData>
  getDevices(): Promise<MediaDeviceInfo[]>
}
```

**Purpose**: Collect user context and device information for analytics.

### 3. ApiWrapper (HTTP Communication)
```typescript
class ApiWrapper {
  initialize(options): Promise<Response>
  createSession(data): Promise<void>
  sendConnectionEvent(event): Promise<void>
  sendWebrtcStats(stats): Promise<void>
}
```

**Purpose**: Handle all communication with the PeerMetrics API.

### 4. SdkIntegration (WebRTC SDK Support)
```typescript
class SdkIntegration {
  addIntegration(options, eventEmitter): void
  on(event, callback): void
}
```

**Purpose**: Wire PeerMetrics to WebRTC SDKs for automatic monitoring ([integrations](./integrations.md)).

## 🔄 Data Flow

### 1. Initialization
```
User Context → PeerMetrics → API Wrapper → PeerMetrics API
```

### 2. Stats Collection
```
WebRTC Connection → WebRTC Stats → API Wrapper → PeerMetrics API
```

### 3. SDK Integration
```
WebRTC SDK → SdkIntegration → PeerMetrics → API Wrapper → PeerMetrics API
```

## 📦 Dependencies

### Core Dependencies
- `@peermetrics/webrtc-stats` - WebRTC statistics collection
- `ua-parser-js` - User agent parsing  
- `wretch` - HTTP client

### File Structure
```
src/
├── index.ts              # Main entry point
├── user.ts               # User context & device info
├── api-wrapper.ts        # API communication
├── sdk_integrations.ts   # WebRTC SDK integrations
├── utils.ts              # Utility functions
├── constants.ts          # Constants and configuration
└── types/                # TypeScript definitions
    ├── index.ts
    └── api.ts
```

## 🎯 Key Principles

1. **Single Purpose**: Capture WebRTC stats and send to API
2. **Minimal Dependencies**: Only essential external libraries
3. **Simple Architecture**: Clear separation of concerns
4. **Performance First**: Lightweight with minimal overhead
5. **Easy Integration**: Simple setup with popular WebRTC SDKs
