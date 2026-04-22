import { ApiWrapper } from '../api-wrapper'
import { User } from '../user'

describe('ApiWrapper.sendConnectionEvent', () => {
  it('returns a promise for addConnection even when batchConnectionEvents is true', async () => {
    jest.useFakeTimers()
    const user = new User({ userId: 'u1' })
    const w = new ApiWrapper({
      apiRoot: 'http://localhost:8081/v1',
      apiKey: 'key',
      mockRequests: true,
      user
    }) as any
    w.batchConnectionEvents = true

    const p = w.sendConnectionEvent({
      eventName: 'addConnection',
      peerId: 'jitsi-sfu',
      connectionState: 'new'
    })

    expect(p).toBeInstanceOf(Promise)
    jest.runAllTimers()
    const res = await p
    expect(res.peer_id).toBe('jitsi-sfu')
    expect(res.connection_id).toBe('mock-connection-id')
    jest.useRealTimers()
  })

  it('still queues non-addConnection events when batching is enabled', () => {
    jest.useFakeTimers()
    const user = new User({ userId: 'u1' })
    const w = new ApiWrapper({
      apiRoot: 'http://localhost:8081/v1',
      apiKey: 'key',
      mockRequests: true,
      user
    }) as any
    w.batchConnectionEvents = true

    const ret = w.sendConnectionEvent({
      eventName: 'peerDetails',
      peerId: 'jitsi-sfu',
      connectionId: 'x',
      data: {}
    } as any)
    expect(ret).toBeUndefined()
    jest.useRealTimers()
  })
})
