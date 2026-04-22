import { ApiWrapper } from '../api-wrapper'
import { User } from '../user'

describe('ApiWrapper timeout helper runtime safety', () => {
  it('uses globalThis timers instead of window timers', async () => {
    const globalSetTimeoutSpy = jest.spyOn(globalThis, 'setTimeout')

    const user = new User({ userId: 'u1' })
    const wrapper = new ApiWrapper({
      apiRoot: 'http://localhost:8081/v1',
      apiKey: 'key',
      mockRequests: true,
      user
    }) as any

    const res = await wrapper.sendConnectionEvent({
      eventName: 'addConnection',
      peerId: 'peer-1'
    } as any)
    expect(res.peer_id).toBe('peer-1')
    expect(globalSetTimeoutSpy).toHaveBeenCalled()

    globalSetTimeoutSpy.mockRestore()
  })
})

