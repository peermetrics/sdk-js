import { enableDebug, log, PeerMetricsError, wrapPeerConnection } from '../utils'

describe('utils.PeerMetricsError', () => {
  it('is an Error with a numeric `code` field', () => {
    const err = new PeerMetricsError('boom')
    err.code = 42
    expect(err).toBeInstanceOf(Error)
    expect(err.message).toBe('boom')
    expect(err.code).toBe(42)
  })
})

describe('utils.enableDebug / log', () => {
  let consoleSpy: jest.SpyInstance

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined)
    enableDebug(false)
  })

  afterEach(() => {
    consoleSpy.mockRestore()
    enableDebug(false)
  })

  it('does not forward to console.log when debug is disabled', () => {
    log('should be silent')
    expect(consoleSpy).not.toHaveBeenCalled()
  })

  it('forwards to console.log when debug is enabled', () => {
    enableDebug(true)
    log('hello', 123)
    expect(consoleSpy).toHaveBeenCalledTimes(1)
    expect(consoleSpy).toHaveBeenCalledWith('hello', 123)
  })
})

describe('utils.wrapPeerConnection', () => {
  it('returns false when the global does not expose RTCPeerConnection', () => {
    const fakeGlobal: any = {}
    expect(wrapPeerConnection(fakeGlobal)).toBe(false)
  })

  it('replaces RTCPeerConnection with a wrapper that emits `newRTCPeerconnection`', () => {
    const instances: any[] = []
    class FakeRTCPeerConnection {
      public config: any
      public constraints: any
      constructor (config?: any, constraints?: any) {
        this.config = config
        this.constraints = constraints
        instances.push(this)
      }
    }

    const fakeGlobal: any = { RTCPeerConnection: FakeRTCPeerConnection }
    const emitter = wrapPeerConnection(fakeGlobal) as any
    expect(emitter).toBeTruthy()
    expect(typeof emitter.on).toBe('function')
    expect(fakeGlobal.RTCPeerConnection).not.toBe(FakeRTCPeerConnection)

    const emitted: any[] = []
    emitter.on('newRTCPeerconnection', (pc: any) => emitted.push(pc))

    const created = new fakeGlobal.RTCPeerConnection({ iceServers: [] }, { foo: 'bar' })

    expect(instances).toHaveLength(1)
    expect(created).toBe(instances[0])
    expect(created.config).toEqual({ iceServers: [] })
    expect(created.constraints).toEqual({ foo: 'bar' })
    expect(emitted).toHaveLength(1)
    expect(emitted[0]).toBe(instances[0])
  })

  it('does not stack a second wrapper when the global is still ours', () => {
    class FakeRTCPeerConnection {
      constructor () {}
    }
    const fakeGlobal: any = { RTCPeerConnection: FakeRTCPeerConnection }
    const emitter = wrapPeerConnection(fakeGlobal) as any
    const again = wrapPeerConnection(fakeGlobal, emitter)
    expect(again).toBe(emitter)

    const emitted: any[] = []
    emitter.on('newRTCPeerconnection', (pc: any) => emitted.push(pc))
    const created = new fakeGlobal.RTCPeerConnection()
    expect(emitted).toHaveLength(1)
    expect(emitted[0]).toBe(created)
  })

  it('re-chains when RTCPeerConnection was replaced after the first wrap (lib-jitsi shim)', () => {
    class ShimRTCPeerConnection {
      constructor (public cfg?: any) {}
    }
    const fakeGlobal: any = { RTCPeerConnection: ShimRTCPeerConnection }
    const emitter = wrapPeerConnection(fakeGlobal) as any

    class LibJitsiRTCPeerConnection {
      constructor (public cfg?: any) {}
    }
    fakeGlobal.RTCPeerConnection = LibJitsiRTCPeerConnection

    wrapPeerConnection(fakeGlobal, emitter)

    const emitted: any[] = []
    emitter.on('newRTCPeerconnection', (pc: any) => emitted.push(pc))
    const created = new fakeGlobal.RTCPeerConnection({ iceServers: [] })
    expect(created).toBeInstanceOf(LibJitsiRTCPeerConnection)
    expect(emitted).toHaveLength(1)
    expect(emitted[0]).toBe(created)
  })
})
