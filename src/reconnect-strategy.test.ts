import { createStrategy } from './reconnect-strategy'
import { ConnectionTimeoutError, SocketTimeoutError } from 'redis'

describe('createStrategy', () => {
  let cleanup: jest.Mock

  beforeEach(() => {
    cleanup = jest.fn()
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
    expect(strategy(4, new Error('Other error'))).toBe(800)
    expect(strategy(5, new Error('Other error'))).toBe(1600)
    expect(strategy(6, new Error('Other error'))).toBe(3200)
    expect(cleanup).not.toHaveBeenCalled()
  })

  it('after increasing delay it stays at 5000 ms', () => {
    const strategy = createStrategy(cleanup)
    expect(strategy(7, new Error('Other error'))).toBe(5000)
    expect(strategy(8, new Error('Other error'))).toBe(5000)
    expect(strategy(15, new Error('Other error'))).toBe(5000)
    expect(strategy(100, new Error('Other error'))).toBe(5000)
    expect(strategy(1_000, new Error('Other error'))).toBe(5000)
    expect(strategy(1_000_000, new Error('Other error'))).toBe(5000)
    expect(cleanup).not.toHaveBeenCalled()
  })
})
