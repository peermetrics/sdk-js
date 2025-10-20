# Integration Guides

## 🔌 Supported SDKs

The PeerMetrics SDK supports integration with major WebRTC frameworks and SDKs:

- **LiveKit** - Modern WebRTC SFU
- **Twilio Video** - Twilio's video communication platform
- **Mediasoup** - High-performance WebRTC SFU
- **Janus** - WebRTC gateway
- **Vonage** (OpenTok) - Vonage video platform
- **Agora** - Agora video platform

## 🚀 Integration Patterns

### Basic Integration Flow

```typescript
// 1. Initialize PeerMetrics
const peerMetrics = new PeerMetrics({
  apiKey: 'your-api-key',
  userId: 'user-123',
  conferenceId: 'conference-1'
})

// 2. Initialize the SDK
await peerMetrics.initialize()

// 3. Add SDK integration
await peerMetrics.addSdkIntegration({
  // SDK-specific options
})

// 4. That's it! PeerMetrics will automatically monitor connections
```

## 📱 LiveKit Integration

### Setup

```typescript
import { Room } from 'livekit-client'
import { PeerMetrics } from '@peermetrics/sdk'

// Initialize PeerMetrics
const peerMetrics = new PeerMetrics({
  apiKey: 'your-api-key',
  userId: 'user-123',
  conferenceId: 'room-1'
})

await peerMetrics.initialize()

// Create LiveKit room
const room = new Room(roomOptions)

// Integrate with PeerMetrics
await peerMetrics.addSdkIntegration({
  livekit: {
    room: room,
    serverId: 'sfu-server-1',        // Optional
    serverName: 'LiveKit SFU Server' // Optional
  }
})
```

### Features
- **Automatic Connection Monitoring**: All peer connections are automatically tracked
- **Room Events**: Room join/leave events are captured
- **Track Events**: Audio/video track events are monitored
- **Connection Quality**: Real-time connection quality metrics

### Requirements
- LiveKit client version 0.16.2 or higher
- Room instance must be created before integration

## 📞 Twilio Video Integration

### Setup

```typescript
import Video from 'twilio-video'
import { PeerMetrics } from '@peermetrics/sdk'

// Initialize PeerMetrics
const peerMetrics = new PeerMetrics({
  apiKey: 'your-api-key',
  userId: 'user-123',
  conferenceId: 'room-1'
})

await peerMetrics.initialize()

// Connect to Twilio Video room
Video.connect('$TOKEN', { name: 'room-name' }).then(room => {
  // Integrate with PeerMetrics
  peerMetrics.addSdkIntegration({
    twilioVideo: {
      room: room
    }
  })
})
```

### Features
- **Room Monitoring**: Automatic room event tracking
- **Participant Events**: Join/leave events for all participants
- **Track Events**: Audio/video track state changes
- **Connection Quality**: Real-time quality metrics

### Requirements
- Twilio Video SDK v2
- Room instance must be connected before integration

## 🎥 Mediasoup Integration

### Setup

```typescript
import * as mediasoupClient from 'mediasoup-client'
import { PeerMetrics } from '@peermetrics/sdk'

// Initialize PeerMetrics
const peerMetrics = new PeerMetrics({
  apiKey: 'your-api-key',
  userId: 'user-123',
  conferenceId: 'room-1'
})

await peerMetrics.initialize()

// Create Mediasoup device
const device = new mediasoupClient.Device({
  handlerName: 'Chrome74'
})

// Integrate with PeerMetrics
await peerMetrics.addSdkIntegration({
  mediasoup: {
    device: device,
    serverId: 'mediasoup-server-1',     // Optional
    serverName: 'Mediasoup SFU Server'   // Optional
  }
})
```

### Features
- **Device Monitoring**: Mediasoup device events
- **Transport Events**: WebRTC transport state changes
- **Producer/Consumer Events**: Media producer and consumer events
- **Connection Quality**: Real-time quality metrics

### Requirements
- Mediasoup client library
- Device instance must be created before integration

## 🌐 Janus Integration

### Setup

```typescript
import { PeerMetrics } from '@peermetrics/sdk'

// Initialize PeerMetrics
const peerMetrics = new PeerMetrics({
  apiKey: 'your-api-key',
  userId: 'user-123',
  conferenceId: 'room-1'
})

await peerMetrics.initialize()

// Create Janus instance
const janus = new Janus({
  server: 'wss://janus.example.com:8188',
  success: function() {
    // Attach to VideoCall plugin
    janus.attach({
      plugin: "janus.plugin.videocall",
      opaqueId: opaqueId,
      success: function(pluginHandle) {
        // Integrate with PeerMetrics
        peerMetrics.addSdkIntegration({
          janus: {
            plugin: pluginHandle,
            serverId: 'janus-server-1',     // Optional
            serverName: 'Janus SFU Server'  // Optional
          }
        })
      }
    })
  }
})
```

### Features
- **Plugin Events**: Janus plugin event monitoring
- **Session Events**: Janus session state changes
- **Connection Events**: WebRTC connection events
- **Quality Metrics**: Real-time connection quality

### Requirements
- Janus JavaScript SDK
- Plugin handler must be attached before integration

## 📺 Vonage (OpenTok) Integration

### Browser Setup

```html
<!-- Set global option for peer connection wrapping -->
<script>
  var PeerMetricsOptions = {
    wrapPeerConnection: true
  }
</script>

<!-- Load PeerMetrics SDK -->
<script src="//cdn.peermetrics.io/js/sdk/peermetrics.min.js"></script>

<!-- Initialize PeerMetrics -->
<script>
  (async () => {
    const peerMetrics = new PeerMetrics({
      apiKey: 'your-api-key',
      userId: 'user-123',
      conferenceId: 'room-1'
    })
    
    await peerMetrics.initialize()
    
    // Enable Vonage integration
    peerMetrics.addSdkIntegration({
      vonage: true
    })
  })()
</script>

<!-- Load OpenTok SDK -->
<script src="https://static.opentok.com/v2/js/opentok.min.js"></script>
```

### Module Setup

```typescript
import { PeerMetrics } from '@peermetrics/sdk'

// Wrap peer connection before OpenTok loads
PeerMetrics.wrapPeerConnection()

// Initialize PeerMetrics
const peerMetrics = new PeerMetrics({
  apiKey: 'your-api-key',
  userId: 'user-123',
  conferenceId: 'room-1'
})

await peerMetrics.initialize()

// Enable Vonage integration
peerMetrics.addSdkIntegration({
  vonage: true
})
```

### Features
- **Session Monitoring**: OpenTok session events
- **Stream Events**: Audio/video stream events
- **Connection Quality**: Real-time quality metrics
- **Error Tracking**: Connection and stream errors

### Requirements
- OpenTok SDK must be loaded after PeerMetrics
- Peer connection wrapping must be enabled

## 🎯 Agora Integration

### Browser Setup

```html
<!-- Set global option for peer connection wrapping -->
<script>
  var PeerMetricsOptions = {
    wrapPeerConnection: true
  }
</script>

<!-- Load PeerMetrics SDK -->
<script src="//cdn.peermetrics.io/js/sdk/peermetrics.min.js"></script>

<!-- Initialize PeerMetrics -->
<script>
  (async () => {
    const peerMetrics = new PeerMetrics({
      apiKey: 'your-api-key',
      userId: 'user-123',
      conferenceId: 'room-1'
    })
    
    await peerMetrics.initialize()
    
    // Enable Agora integration
    peerMetrics.addSdkIntegration({
      agora: true
    })
  })()
</script>

<!-- Load Agora SDK -->
<script src="https://download.agora.io/sdk/release/AgoraRTC_N.js"></script>
```

### Module Setup

```typescript
import { PeerMetrics } from '@peermetrics/sdk'

// Wrap peer connection before Agora loads
PeerMetrics.wrapPeerConnection()

// Initialize PeerMetrics
const peerMetrics = new PeerMetrics({
  apiKey: 'your-api-key',
  userId: 'user-123',
  conferenceId: 'room-1'
})

await peerMetrics.initialize()

// Enable Agora integration
peerMetrics.addSdkIntegration({
  agora: true
})
```

### Features
- **Client Monitoring**: Agora client events
- **Stream Events**: Audio/video stream events
- **Connection Quality**: Real-time quality metrics
- **Error Tracking**: Connection and stream errors

### Requirements
- Agora SDK must be loaded after PeerMetrics
- Peer connection wrapping must be enabled

## 🚀 Pion Integration

### Setup

```typescript
import { Client, LocalStream, RemoteStream } from 'ion-sdk-js'
import { IonSFUJSONRPCSignal } from 'ion-sdk-js/lib/signal/json-rpc-impl'
import { PeerMetrics } from '@peermetrics/sdk'

// Initialize PeerMetrics
const peerMetrics = new PeerMetrics({
  apiKey: 'your-api-key',
  userId: 'user-123',
  conferenceId: 'room-1'
})

await peerMetrics.initialize()

// Enable Pion integration
peerMetrics.addSdkIntegration({
  pion: {
    serverId: 'pion-sfu-na',           // Optional
    serverName: 'Pion SFU North America' // Optional
  }
})

// Continue with Pion setup
const signal = new IonSFUJSONRPCSignal("wss://ion-sfu:7000/ws")
const client = new Client(signal)
signal.onopen = () => client.join("test session", "test uid")
```

### Features
- **Client Monitoring**: Pion client events
- **Stream Events**: Audio/video stream events
- **Connection Quality**: Real-time quality metrics
- **Error Tracking**: Connection and stream errors

### Requirements
- Pion SDK must be loaded after PeerMetrics
- Peer connection wrapping is automatic

## 🔗 SimplePeer Integration

### Setup

```typescript
import { PeerMetrics } from '@peermetrics/sdk'

// Initialize PeerMetrics
const peerMetrics = new PeerMetrics({
  apiKey: 'your-api-key',
  userId: 'user-123',
  conferenceId: 'room-1'
})

await peerMetrics.initialize()

// Create SimplePeer instance
const peer = new SimplePeer({
  initiator: true,
  config: iceServers,
  stream: stream,
  trickle: true
})

// Add connection to PeerMetrics
peerMetrics.addConnection({
  pc: peer._pc,
  peerId: 'peer-1'
})
```

### Features
- **Connection Monitoring**: WebRTC connection events
- **Stream Events**: Audio/video stream events
- **Connection Quality**: Real-time quality metrics
- **Error Tracking**: Connection errors

### Requirements
- SimplePeer library
- Manual connection addition required

## 🔧 Advanced Integration

### Multiple SDKs

```typescript
// Initialize PeerMetrics
const peerMetrics = new PeerMetrics({
  apiKey: 'your-api-key',
  userId: 'user-123',
  conferenceId: 'room-1'
})

await peerMetrics.initialize()

// Add multiple integrations
await peerMetrics.addSdkIntegration({
  livekit: { room: room },
  twilioVideo: { room: twilioRoom }
})
```

### Custom Integration

```typescript
// For custom WebRTC implementations
const peerConnection = new RTCPeerConnection()

// Add connection manually
await peerMetrics.addConnection({
  pc: peerConnection,
  peerId: 'custom-peer-1',
  peerName: 'Custom Implementation'
})
```

## 🐛 Troubleshooting

### Common Issues

#### Integration Not Working
```typescript
// Check if SDK is initialized
if (!peerMetrics._initialized) {
  console.error('PeerMetrics not initialized')
}

// Check if integration was successful
try {
  await peerMetrics.addSdkIntegration(options)
} catch (error) {
  console.error('Integration failed:', error.message)
}
```

#### Connection Not Monitored
```typescript
// Verify connection was added
const { connectionId } = await peerMetrics.addConnection({
  pc: peerConnection,
  peerId: 'peer-1'
})

console.log('Connection ID:', connectionId)
```

#### Events Not Captured
```typescript
// Check if SDK is properly initialized
if (!peerMetrics._initialized) {
  await peerMetrics.initialize()
}

// Verify integration
await peerMetrics.addSdkIntegration({
  // SDK-specific options
})
```

### Debug Mode

```typescript
// Enable debug mode
const peerMetrics = new PeerMetrics({
  apiKey: 'your-api-key',
  userId: 'user-123',
  conferenceId: 'room-1',
  debug: true  // Enable debug logging
})
```

## 📊 Best Practices

### Performance Optimization
- Initialize PeerMetrics early in your application
- Use SDK integrations when possible for automatic monitoring
- Avoid adding connections manually unless necessary
- End sessions properly to clean up resources

### Error Handling
- Always wrap integration calls in try-catch blocks
- Handle initialization errors gracefully
- Provide fallback behavior for failed integrations
- Log errors for debugging

### Resource Management
- Call `endCall()` when sessions are complete
- Remove connections when no longer needed
- Monitor memory usage in long-running applications
- Use connection pooling for multiple connections
