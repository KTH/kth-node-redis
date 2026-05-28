import { ConnectionTimeoutError, SocketTimeoutError } from 'redis'
const log = require('@kth/log')

export const createStrategy =
  (onAbort: () => void) =>
  (retries: number, cause: Error): false | Error | number => {
    if (retries >= 7) {
      return 5000
    }

    if (cause instanceof SocketTimeoutError) {
      log.warn('kth-node-redis: Abort reconnect on SocketTimeoutError')
      onAbort()
      return false
    }

    if (cause instanceof ConnectionTimeoutError) {
      log.warn('kth-node-redis: Abort reconnect on ConnectionTimeoutError')
      onAbort()
      return false
    }

    // Exponential back off starting at 50ms
    const delay = Math.pow(2, retries) * 50

    return delay
  }
