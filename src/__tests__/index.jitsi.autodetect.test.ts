import { PeerMetrics } from '../index'

describe('PeerMetrics auto-detect Jitsi peer mapping', () => {
  const baseOptions: any = {
    apiKey: 'test-key',
    userId: 'user-1',
    userName: 'Test User',
    conferenceId: 'conf-1',
    conferenceName: 'Conf',
    mockRequests: true
  }

  it('maps Jitsi connections to transport-scoped peerIds (not participant-derived ids)', () => {
    const pm = new PeerMetrics(baseOptions) as any

    class FakePC {}
    const originalPC = (global as any).RTCPeerConnection
    ;(global as any).RTCPeerConnection = FakePC
    ;(window as any).RTCPeerConnection = FakePC

    try {
      const p2pPc = Object.assign(new FakePC(), { isP2P: true })
      const jvbPc = Object.assign(new FakePC(), { isP2P: false })
      const unknownPc = new FakePC()

      const rtc = {
        peerConnections: new Map([
          ['alice-endpoint-id', p2pPc],
          ['bob-endpoint-id', jvbPc],
          ['charlie-endpoint-id', unknownPc]
        ])
      }

      const seen: Array<{ peerId: string; source: string }> = []
      pm._searchJitsiConnections(rtc, (_pc: any, peerId: string, source: string) => {
        seen.push({ peerId, source })
      })

      expect(seen.map(x => x.peerId)).toEqual([
        'jitsi-sfu-server-p2p',
        'jitsi-sfu-server-jvb',
        'jitsi-sfu-server'
      ])
      expect(seen.every(x => x.source === 'jitsi-pattern')).toBe(true)
      expect(seen.some(x => x.peerId.includes('alice-endpoint-id'))).toBe(false)
      expect(seen.some(x => x.peerId.includes('bob-endpoint-id'))).toBe(false)
    } finally {
      ;(global as any).RTCPeerConnection = originalPC
      ;(window as any).RTCPeerConnection = originalPC
    }
  })
})

