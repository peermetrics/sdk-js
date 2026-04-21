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
          peerId: 'jitsi-server',
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

  it('emits newConnection for each distinct PC under the same peerId', () => {
    const events: Array<any> = []
    integration.on('newConnection', (payload) => events.push(payload))

    integration.addJitsiIntegration({ serverId: 'jitsi-server' }, emitter)

    const p2pPC = makeFakePC('p2p')
    const jvbPC = makeFakePC('jvb')

    emitter.emit('newRTCPeerconnection', p2pPC)
    emitter.emit('newRTCPeerconnection', jvbPC)

    expect(events).toHaveLength(2)
    expect(events[0]).toMatchObject({ pc: p2pPC, peerId: 'jitsi-server' })
    expect(events[1]).toMatchObject({ pc: jvbPC, peerId: 'jitsi-server' })
  })

  it('uses the default serverId when none is provided', () => {
    const seen: any[] = []
    integration.on('newConnection', (payload) => seen.push(payload))

    integration.addJitsiIntegration(true, emitter)

    emitter.emit('newRTCPeerconnection', makeFakePC('x'))

    expect(seen).toHaveLength(1)
    expect(seen[0].peerId).toBe('jitsi-sfu-server')
  })

  it('throws when wrapPeerConnection was never enabled', () => {
    expect(() => integration.addJitsiIntegration({}, null as unknown as EventEmitter)).toThrow(
      /Could not integrate with Jitsi/
    )
  })
})

describe('SdkIntegration - Jitsi conference events', () => {
  it('forwards USER_JOINED / USER_LEFT / DISPLAY_NAME_CHANGED as jitsiParticipantEvent', () => {
    // Mimic JitsiMeetJS.events.conference on window
    ;(window as any).JitsiMeetJS = {
      events: {
        conference: {
          USER_JOINED: 'conference.userJoined',
          USER_LEFT: 'conference.userLeft',
          DISPLAY_NAME_CHANGED: 'conference.displayNameChanged'
        }
      }
    }

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
      { eventName: 'jitsiUserLeft', participantId: 'alice' }
    ])

    delete (window as any).JitsiMeetJS
  })
})
