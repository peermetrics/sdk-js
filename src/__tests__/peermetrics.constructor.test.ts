/**
 * These tests only exercise the PeerMetrics constructor (input validation).
 * They do NOT call .initialize(), so no network requests or session creation happen.
 */
import { PeerMetrics } from '../index'

describe('PeerMetrics constructor', () => {
  const validBaseOptions = {
    apiKey: 'test-key',
    userId: 'user-1',
    userName: 'Test User',
    conferenceId: 'conf-1',
    conferenceName: 'Conf',
    mockRequests: true
  } as any

  it('throws when called with a non-object', () => {
    expect(() => new PeerMetrics(undefined as any))
      .toThrow(/Expected object/)
    expect(() => new PeerMetrics('not an object' as any))
      .toThrow(/Expected object/)
  })

  it('throws when apiKey is missing', () => {
    const { apiKey: _apiKey, ...rest } = validBaseOptions
    expect(() => new PeerMetrics(rest as any)).toThrow(/apiKey/)
  })

  it('throws when conferenceId is missing', () => {
    const { conferenceId: _conferenceId, ...rest } = validBaseOptions
    expect(() => new PeerMetrics(rest as any)).toThrow(/conferenceId/)
  })

  describe('appVersion', () => {
    it('throws when appVersion is not a string', () => {
      expect(() => new PeerMetrics({ ...validBaseOptions, appVersion: 123 as any }))
        .toThrow(/appVersion must be a string/)
    })

    it('throws when appVersion exceeds 16 characters', () => {
      expect(() => new PeerMetrics({ ...validBaseOptions, appVersion: 'x'.repeat(17) }))
        .toThrow(/max length of 16/)
    })

    it('accepts a valid appVersion', () => {
      expect(() => new PeerMetrics({ ...validBaseOptions, appVersion: '1.2.3' }))
        .not.toThrow()
    })
  })

  describe('meta', () => {
    it('throws when meta is not an object', () => {
      expect(() => new PeerMetrics({ ...validBaseOptions, meta: 'nope' as any }))
        .toThrow(/should be of type object/)
    })

    it('throws when meta has more than 5 keys', () => {
      const meta = { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6 }
      expect(() => new PeerMetrics({ ...validBaseOptions, meta }))
        .toThrow(/maximum of 5/)
    })

    it('drops keys that are too long or have unsupported value types (does not throw)', () => {
      const errSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
      const longKey = 'k'.repeat(65)
      const meta: any = { ok: 'yes', [longKey]: 'drop', bad: { nested: true } }
      expect(() => new PeerMetrics({ ...validBaseOptions, meta })).not.toThrow()
      expect(errSpy).toHaveBeenCalled()
      errSpy.mockRestore()
    })

    it('accepts allowed value types (string/number/boolean)', () => {
      const meta = { s: 'str', n: 2, b: true }
      expect(() => new PeerMetrics({ ...validBaseOptions, meta })).not.toThrow()
    })
  })
})
