# PeerMetrics SDK Documentation

A lightweight JavaScript SDK that captures WebRTC statistics and sends them to the PeerMetrics API.

## 📚 Documentation

- **[API Reference](./api-reference.md)** - Complete API documentation and usage examples
- **[Integration Guides](./integrations.md)** - SDK integration patterns and examples
- **[Architecture](./architecture.md)** - System design and components
- **[Development Guide](./development.md)** - Coding standards, testing, and contribution guidelines

## 🚀 Quick Start

### Installation
```bash
npm install @peermetrics/sdk
```

### Basic Usage
```javascript
import { PeerMetrics } from '@peermetrics/sdk'

// Initialize SDK
const peerMetrics = new PeerMetrics({
    apiKey: 'your-api-key',
    userId: 'user-123',
    conferenceId: 'conference-1'
})

await peerMetrics.initialize()

// Add WebRTC connection to monitor
await peerMetrics.addConnection({
    pc: peerConnection,
    peerId: 'peer-1'
})
```

### With WebRTC SDKs
```javascript
// LiveKit integration
await peerMetrics.addSdkIntegration({
    livekit: { room: livekitRoom }
})

// Twilio Video integration  
await peerMetrics.addSdkIntegration({
    twilioVideo: { room: twilioRoom }
})
```

## 🎯 Core Purpose

This SDK has one focused goal: **capture WebRTC statistics and send them to the PeerMetrics API**. It provides:

- **WebRTC Stats Collection**: Automatic capture of connection quality metrics
- **SDK Integrations**: Easy integration with popular WebRTC frameworks
- **Real-time Monitoring**: Live insights into connection performance
- **Minimal Overhead**: Lightweight with minimal performance impact

## 🔗 External Resources

- [PeerMetrics Service](https://peermetrics.io/)
- [WebRTC Stats Library](https://github.com/peermetrics/webrtc-stats)
- [NPM Package](https://www.npmjs.com/package/@peermetrics/sdk)
