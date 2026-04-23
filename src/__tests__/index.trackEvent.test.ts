/**
 * Regression tests for PeerMetrics._handleTrackEvent track-ID bookkeeping.
 *
 * Guards:
 *   - ontrack / subsequent updates are scoped per connectionId so the same
 *     trackId observed on two connections does not share state.
 *   - Pending create promises are awaited before updates so we don't lose
 *     mute/unmute/ended events fired between ontrack and server ack.
 */
import { PeerMetrics } from '../index'

const baseOptions: any = {
  apiKey: 'test-key',
  userId: 'user-1',
  userName: 'Test User',
  conferenceId: 'conf-1',
  conferenceName: 'Conf',
  mockRequests: true
}

type TrackEventArg = { event: string; connectionId: string; trackId: string; data?: any }

function buildEvent(e: TrackEventArg) {
  return {
    peerId: `peer-${e.connectionId}`,
    connectionId: e.connectionId,
    event: e.event,
    data: {
      track: { id: e.trackId, ...(e.data || {}) }
    }
  }
}

function flushMicrotasks() {
  return new Promise(resolve => setTimeout(resolve, 0))
}

describe('PeerMetrics._handleTrackEvent (connection-scoped bookkeeping)', () => {
  function makeInstance() {
    const pm: any = new PeerMetrics(baseOptions)
    const sendTrackEvent = jest.fn().mockResolvedValue(undefined)
    pm.apiWrapper = { sendTrackEvent }
    return { pm, sendTrackEvent }
  }

  it('keeps createdTrackIds isolated per connection even if trackId collides', async () => {
    const { pm, sendTrackEvent } = makeInstance()

    pm._handleTrackEvent(buildEvent({ event: 'ontrack', connectionId: 'conn-A', trackId: 'track-shared' }))
    pm._handleTrackEvent(buildEvent({ event: 'ontrack', connectionId: 'conn-B', trackId: 'track-shared' }))

    await flushMicrotasks()

    expect(pm.createdTrackIds['conn-A']).toBeInstanceOf(Set)
    expect(pm.createdTrackIds['conn-B']).toBeInstanceOf(Set)
    expect(pm.createdTrackIds['conn-A'].has('track-shared')).toBe(true)
    expect(pm.createdTrackIds['conn-B'].has('track-shared')).toBe(true)
    expect(sendTrackEvent).toHaveBeenCalledTimes(2)

    const [firstCall, secondCall] = sendTrackEvent.mock.calls
    expect(firstCall[0].connectionId).toBe('conn-A')
    expect(secondCall[0].connectionId).toBe('conn-B')
  })

  it('awaits the pending ontrack promise before sending an update for the same connection', async () => {
    const pm: any = new PeerMetrics(baseOptions)
    let resolveCreate: ((value?: any) => void) | null = null
    const pendingPromise = new Promise(resolve => { resolveCreate = resolve })
    const sendTrackEvent = jest.fn()
      .mockImplementationOnce(() => pendingPromise)
      .mockResolvedValueOnce(undefined)
    pm.apiWrapper = { sendTrackEvent }

    pm._handleTrackEvent(buildEvent({ event: 'ontrack', connectionId: 'c1', trackId: 't1' }))
    pm._handleTrackEvent(buildEvent({ event: 'mute', connectionId: 'c1', trackId: 't1' }))

    // update is deferred while create is still in flight
    expect(sendTrackEvent).toHaveBeenCalledTimes(1)

    resolveCreate!(undefined)
    await flushMicrotasks()
    await flushMicrotasks()

    expect(sendTrackEvent).toHaveBeenCalledTimes(2)
    expect(sendTrackEvent.mock.calls[1][0].event).toBe('mute')
  })

  it('drops updates for unknown trackIds on a connection that has not seen ontrack yet', async () => {
    const { pm, sendTrackEvent } = makeInstance()

    pm._handleTrackEvent(buildEvent({ event: 'mute', connectionId: 'conn-A', trackId: 'unknown-track' }))

    await flushMicrotasks()

    expect(sendTrackEvent).not.toHaveBeenCalled()
  })
})
