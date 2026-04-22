import { EventEmitter } from 'events'
import SdkIntegration from '../sdk_integrations'

/**
 * Tests for Jitsi integration behavior in sdk-js.
 *
 * These tests exercise `SdkIntegration` directly (no real PeerMetrics
 * instance, no network) and validate that each distinct Jitsi
 * RTCPeerConnection is emitted as a `newConnection` while repeated emits
 * of the same PC are ignored.
 */

function makeFakePC(id: string) {
  // Cast through `unknown` so downstream typings don't object; we only
  // need reference identity for the integration's WeakSet / Map keys.
  return { __id: id } as unknown as RTCPeerConnection
}

function makeFakePCWithKind(id: string, isP2P: boolean) {
  return { __id: id, isP2P } as unknown as RTCPeerConnection
}

describe('SdkIntegration - Jitsi transport handling', () => {
  let emitter: EventEmitter
  let integration: SdkIntegration

  beforeEach(() => {
    emitter = new EventEmitter()
    integration = new SdkIntegration()
  })

  it('emits a single newConnection for the first PC', () => {
    const events: Array<{ name: string; payload: any }> = []
    integration.on('newConnection', (payload) => events.push({ name: 'newConnection', payload }))
    integration.addJitsiIntegration({ serverId: 'jitsi-server' }, emitter)

    const pc1 = makeFakePC('p2p')
    emitter.emit('newRTCPeerconnection', pc1)

    expect(events).toEqual([
      {
        name: 'newConnection',
        payload: expect.objectContaining({
          pc: pc1,
          peerId: 'jitsi-server-p2p',
          peerName: 'Jitsi SFU Server (P2P)',
          isSfu: true,
          remote: true
        })
      }
    ])
  })

  it('ignores a duplicate emit for the same PC (idempotent)', () => {
    const events: string[] = []
    integration.on('newConnection', () => events.push('newConnection'))

    integration.addJitsiIntegration({ serverId: 'jitsi-server' }, emitter)

    const pc = makeFakePC('same')
    emitter.emit('newRTCPeerconnection', pc)
    emitter.emit('newRTCPeerconnection', pc)

    expect(events).toEqual(['newConnection'])
  })

  it('emits distinct labeled connections for p2p and jvb transports', () => {
    const events: Array<any> = []
    integration.on('newConnection', (payload) => events.push(payload))

    integration.addJitsiIntegration({ serverId: 'jitsi-server' }, emitter)

    const p2pPC = makeFakePCWithKind('p2p', true)
    const jvbPC = makeFakePCWithKind('jvb', false)

    emitter.emit('newRTCPeerconnection', p2pPC)
    emitter.emit('newRTCPeerconnection', jvbPC)

    expect(events).toHaveLength(2)
    expect(events[0]).toMatchObject({ pc: p2pPC, peerId: 'jitsi-server-p2p', peerName: 'Jitsi SFU Server (P2P)' })
    expect(events[1]).toMatchObject({ pc: jvbPC, peerId: 'jitsi-server-jvb', peerName: 'Jitsi SFU Server (JVB/SFU)' })
  })

  it('uses the default serverId when none is provided', () => {
    const seen: any[] = []
    integration.on('newConnection', (payload) => seen.push(payload))

    integration.addJitsiIntegration(true, emitter)

    emitter.emit('newRTCPeerconnection', makeFakePC('x'))

    expect(seen).toHaveLength(1)
    expect(seen[0].peerId).toBe('jitsi-sfu-server')
    expect(seen[0].peerName).toBe('Jitsi SFU Server')
  })

  it('throws when wrapPeerConnection was never enabled', () => {
    expect(() => integration.addJitsiIntegration({}, null as unknown as EventEmitter)).toThrow(
      /Could not integrate with Jitsi/
    )
  })
})

describe('SdkIntegration - Jitsi conference events', () => {
  beforeEach(() => {
    // Mimic JitsiMeetJS.events.conference on window
    ;(window as any).JitsiMeetJS = {
      events: {
        conference: {
          USER_JOINED: 'conference.userJoined',
          USER_LEFT: 'conference.userLeft',
          DISPLAY_NAME_CHANGED: 'conference.displayNameChanged',
          TRACK_ADDED: 'conference.trackAdded',
          TRACK_REMOVED: 'conference.trackRemoved',
          CONFERENCE_JOINED: 'conference.joined',
          CONFERENCE_LEFT: 'conference.left',
          CONFERENCE_FAILED: 'conference.failed'
        }
      }
    }
  })

  afterEach(() => {
    delete (window as any).JitsiMeetJS
  })

  it('forwards USER_JOINED / USER_LEFT / DISPLAY_NAME_CHANGED as jitsiParticipantEvent', () => {
    const conference = new EventEmitter() as any
    const emitter = new EventEmitter()
    const integration = new SdkIntegration()

    const events: any[] = []
    integration.on('jitsiParticipantEvent', (ev) => events.push(ev))

    integration.addJitsiIntegration({ conference }, emitter)

    conference.emit('conference.userJoined', 'alice', {
      getDisplayName: () => 'Alice'
    })
    conference.emit('conference.displayNameChanged', 'alice', 'Alice Smith')
    conference.emit('conference.userLeft', 'alice')

    expect(events).toEqual([
      { eventName: 'jitsiUserJoined', participantId: 'alice', displayName: 'Alice' },
      { eventName: 'jitsiDisplayNameChanged', participantId: 'alice', displayName: 'Alice Smith' },
      { eventName: 'jitsiUserLeft', participantId: 'alice', displayName: 'Alice Smith' }
    ])
  })

  it('is idempotent for duplicate join and late duplicate leave events', () => {
    const conference = new EventEmitter() as any
    const emitter = new EventEmitter()
    const integration = new SdkIntegration()

    const events: any[] = []
    integration.on('jitsiParticipantEvent', (ev) => events.push(ev))

    integration.addJitsiIntegration({ conference }, emitter)

    conference.emit('conference.userJoined', 'alice', { getDisplayName: () => 'Alice' })
    conference.emit('conference.userJoined', 'alice', { getDisplayName: () => 'Alice duplicate' })
    conference.emit('conference.userLeft', 'alice')
    conference.emit('conference.userLeft', 'alice')

    expect(events.map((e) => e.eventName)).toEqual(['jitsiUserJoined', 'jitsiUserLeft'])
  })

  it('supports leave and rejoin for the same participant id', () => {
    const conference = new EventEmitter() as any
    const emitter = new EventEmitter()
    const integration = new SdkIntegration()

    const events: any[] = []
    integration.on('jitsiParticipantEvent', (ev) => events.push(ev))

    integration.addJitsiIntegration({ conference }, emitter)

    conference.emit('conference.userJoined', 'alice', { getDisplayName: () => 'Alice' })
    conference.emit('conference.userLeft', 'alice')
    conference.emit('conference.userJoined', 'alice', { getDisplayName: () => 'Alice Rejoin' })

    expect(events.map((e) => [e.eventName, e.participantId])).toEqual([
      ['jitsiUserJoined', 'alice'],
      ['jitsiUserLeft', 'alice'],
      ['jitsiUserJoined', 'alice']
    ])
    expect(events[2].displayName).toBe('Alice Rejoin')
  })

  it('handles multiple participants deterministically', () => {
    const conference = new EventEmitter() as any
    const emitter = new EventEmitter()
    const integration = new SdkIntegration()

    const events: any[] = []
    integration.on('jitsiParticipantEvent', (ev) => events.push(ev))

    integration.addJitsiIntegration({ conference }, emitter)

    conference.emit('conference.userJoined', 'alice', { getDisplayName: () => 'Alice' })
    conference.emit('conference.userJoined', 'bob', { getDisplayName: () => 'Bob' })
    conference.emit('conference.displayNameChanged', 'bob', 'Bobby')
    conference.emit('conference.userLeft', 'alice')

    expect(events).toEqual([
      { eventName: 'jitsiUserJoined', participantId: 'alice', displayName: 'Alice' },
      { eventName: 'jitsiUserJoined', participantId: 'bob', displayName: 'Bob' },
      { eventName: 'jitsiDisplayNameChanged', participantId: 'bob', displayName: 'Bobby' },
      { eventName: 'jitsiUserLeft', participantId: 'alice', displayName: 'Alice' }
    ])
  })

  it('emits track add/remove participant hints and conference reset', () => {
    const conference = new EventEmitter() as any
    const emitter = new EventEmitter()
    const integration = new SdkIntegration()

    const events: any[] = []
    integration.on('jitsiParticipantEvent', (ev) => events.push(ev))

    integration.addJitsiIntegration({ conference }, emitter)

    const track = {
      getParticipantId: () => 'alice',
      getType: () => 'video',
      getTrackId: () => 'track-1',
      isP2P: () => false
    }

    conference.emit('conference.userJoined', 'alice', { getDisplayName: () => 'Alice' })
    conference.emit('conference.trackAdded', track)
    conference.emit('conference.trackRemoved', track)
    conference.emit('conference.left')

    expect(events).toEqual([
      { eventName: 'jitsiUserJoined', participantId: 'alice', displayName: 'Alice' },
      {
        eventName: 'jitsiTrackAdded',
        participantId: 'alice',
        displayName: 'Alice',
        transportType: 'jvb',
        trackType: 'video',
        trackId: 'track-1'
      },
      {
        eventName: 'jitsiTrackRemoved',
        participantId: 'alice',
        displayName: 'Alice',
        transportType: 'jvb',
        trackType: 'video',
        trackId: 'track-1'
      },
      {
        eventName: 'jitsiConferenceReset',
        reason: 'conference-left',
        participantsTracked: 1
      }
    ])
  })
})
