import { User } from '../user'

describe('User', () => {
  it('throws when userId is missing', () => {
    expect(() => new User({ userId: '' as any })).toThrow(/userId/)
    expect(() => new User({} as any)).toThrow(/userId/)
  })

  it('stores userId and optional userName', () => {
    const u = new User({ userId: 'u-1', userName: 'Alice' })
    expect(u.userId).toBe('u-1')
    expect(u.userName).toBe('Alice')
    expect(u.platform).toEqual({})
    expect(u.devices).toEqual([])
  })

  describe('getContraints', () => {
    const origDesc = Object.getOwnPropertyDescriptor(window.navigator, 'mediaDevices')

    afterEach(() => {
      if (origDesc) {
        Object.defineProperty(window.navigator, 'mediaDevices', origDesc)
      } else {
        delete (window.navigator as any).mediaDevices
      }
    })

    it('returns {} when mediaDevices is not available', () => {
      Object.defineProperty(window.navigator, 'mediaDevices', {
        value: undefined,
        configurable: true
      })
      const u = new User({ userId: 'u-1' })
      expect(u.getContraints()).toEqual({})
    })

    it('delegates to navigator.mediaDevices.getSupportedConstraints()', () => {
      const getSupportedConstraints = jest.fn().mockReturnValue({ echoCancellation: true })
      Object.defineProperty(window.navigator, 'mediaDevices', {
        value: { getSupportedConstraints },
        configurable: true
      })
      const u = new User({ userId: 'u-1' })
      expect(u.getContraints()).toEqual({ echoCancellation: true })
      expect(getSupportedConstraints).toHaveBeenCalledTimes(1)
    })
  })

  describe('getDevices', () => {
    const origDesc = Object.getOwnPropertyDescriptor(window.navigator, 'mediaDevices')

    afterEach(() => {
      if (origDesc) {
        Object.defineProperty(window.navigator, 'mediaDevices', origDesc)
      } else {
        delete (window.navigator as any).mediaDevices
      }
    })

    it('resolves to [] when enumerateDevices is not available', async () => {
      Object.defineProperty(window.navigator, 'mediaDevices', {
        value: {},
        configurable: true
      })
      const u = new User({ userId: 'u-1' })
      await expect(u.getDevices()).resolves.toEqual([])
    })

    it('filters out devices without a label', async () => {
      const enumerateDevices = jest.fn().mockResolvedValue([
        { toJSON: () => ({ label: 'Camera', kind: 'videoinput' }) },
        { toJSON: () => ({ label: '', kind: 'audioinput' }) },
        { toJSON: () => ({ label: 'Mic', kind: 'audioinput' }) }
      ])
      Object.defineProperty(window.navigator, 'mediaDevices', {
        value: { enumerateDevices },
        configurable: true
      })
      const u = new User({ userId: 'u-1' })
      const devices = await u.getDevices()
      expect(devices).toEqual([
        { label: 'Camera', kind: 'videoinput' },
        { label: 'Mic', kind: 'audioinput' }
      ])
    })

    it('returns [] when enumerateDevices rejects', async () => {
      const enumerateDevices = jest.fn().mockRejectedValue(new Error('denied'))
      Object.defineProperty(window.navigator, 'mediaDevices', {
        value: { enumerateDevices },
        configurable: true
      })
      const u = new User({ userId: 'u-1' })
      await expect(u.getDevices()).resolves.toEqual([])
    })
  })
})
