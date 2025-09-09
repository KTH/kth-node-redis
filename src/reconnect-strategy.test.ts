import { createStrategy } from './reconnect-strategy'
import { ConnectionTimeoutError, SocketTimeoutError } from 'redis'

describe('createStrategy', () => {
  let cleanup: jest.Mock

  beforeEach(() => {
    cleanup = jest.fn()
  })

  it('should stop retrying after 4 retries', () => {
    const strategy = createStrategy(cleanup)
    expect(strategy(4, new Error('Some error'))).toBe(false)
    expect(cleanup).toHaveBeenCalled()
  })

  it('should not reconnect on SocketTimeoutError', () => {
    const strategy = createStrategy(cleanup)
    const error = new SocketTimeoutError(9001)
    expect(strategy(1, error)).toBe(false)
    expect(cleanup).toHaveBeenCalled()
  })

  it('should not reconnect on ConnectionTimeoutError', () => {
    const strategy = createStrategy(cleanup)
    const error = new ConnectionTimeoutError()
    expect(strategy(1, error)).toBe(false)
    expect(cleanup).toHaveBeenCalled()
  })

  it('should return exponential backoff delay for normal errors', () => {
    const strategy = createStrategy(cleanup)
    expect(strategy(0, new Error('Other error'))).toBe(50)
    expect(strategy(1, new Error('Other error'))).toBe(100)
    expect(strategy(2, new Error('Other error'))).toBe(200)
    expect(strategy(3, new Error('Other error'))).toBe(400)
    expect(cleanup).not.toHaveBeenCalled()
  })
})
