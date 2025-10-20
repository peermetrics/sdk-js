# Development Guide

## 🎯 Project Goal

**Single Purpose**: Capture WebRTC statistics and send them to the PeerMetrics API.

## 🏗️ Architecture

### Core Components
```
PeerMetrics (main class)
├── User (user context & device info)
├── ApiWrapper (HTTP communication)
├── WebRTCStats (stats collection)
└── SdkIntegration (WebRTC SDK integrations)
```

### Data Flow
```
WebRTC Connection → Stats Collection → API Wrapper → PeerMetrics API
```

## 📝 Coding Standards

### TypeScript Conventions
```typescript
// Classes: PascalCase
class PeerMetrics { }

// Variables/functions: camelCase
const connectionId = await peerMetrics.addConnection()

// Private members: underscore prefix
private _initialized: boolean = false

// Constants: UPPER_SNAKE_CASE
const DEFAULT_OPTIONS = { }
```

### File Organization
```typescript
// 1. External imports
import { WebRTCStats } from '@peermetrics/webrtc-stats'

// 2. Internal imports
import { User } from './user'
import { ApiWrapper } from './api-wrapper'

// 3. Type imports
import type { PeerMetricsConstructor } from './types'

// 4. Class definition
export class PeerMetrics { }
```

### Error Handling
```typescript
// Always throw meaningful errors
if (!options.apiKey) {
  throw new Error('Missing argument apiKey')
}

// Use custom error class
class PeerMetricsError extends Error {
  code?: string
  constructor(message: string) {
    super(message)
    this.name = 'PeerMetricsError'
  }
}
```

## 🧪 Testing

### Test Structure
```typescript
describe('PeerMetrics', () => {
  let peerMetrics: PeerMetrics

  beforeEach(() => {
    peerMetrics = new PeerMetrics({
      apiKey: 'test-key',
      userId: 'test-user',
      conferenceId: 'test-conference'
    })
  })

  describe('initialize', () => {
    it('should initialize successfully', async () => {
      await expect(peerMetrics.initialize()).resolves.toBeUndefined()
    })
  })
})
```

### Coverage Requirements
- **Minimum**: 80% code coverage
- **Critical Paths**: 100% coverage for core functionality
- **Bundle Size**: < 50KB gzipped

## 🚀 Development Workflow

### Git Conventions
```bash
# Feature branches
git checkout -b feature/feature-name

# Commit messages
git commit -m "feat: add new feature"
git commit -m "fix: resolve bug"
git commit -m "docs: update documentation"
```

### Build Process
```bash
# Development
npm run watch

# Production build
npm run build

# Test
npm test
```

## 📦 Dependencies

### Core Dependencies
- `@peermetrics/webrtc-stats` - WebRTC statistics collection
- `ua-parser-js` - User agent parsing
- `wretch` - HTTP client

### Development Dependencies
- `typescript` - Type checking
- `rollup` - Module bundling
- `jest` - Testing framework

## 🔧 Performance Guidelines

### Bundle Size
- **Target**: < 50KB gzipped
- **Strategy**: Tree shaking, minimal dependencies

### Runtime Performance
- **Initialization**: < 100ms
- **Memory**: < 10MB baseline
- **CPU Impact**: < 1% during operation

## 🔒 Security

### Data Handling
- **No Sensitive Data**: Never collect audio/video content
- **Input Validation**: Validate all inputs
- **HTTPS Only**: All API calls use HTTPS
- **Error Messages**: Generic error messages

## 📋 Checklist

### Before Committing
- [ ] Code follows TypeScript conventions
- [ ] Error handling is comprehensive
- [ ] Tests cover new functionality
- [ ] Bundle size is acceptable
- [ ] No console.log statements

### Before Release
- [ ] All tests passing
- [ ] Documentation updated
- [ ] Version bumped
- [ ] Build successful
