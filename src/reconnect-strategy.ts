import { ConnectionTimeoutError, SocketTimeoutError } from 'redis'

export const createStrategy =
  (onAbort: () => void) =>
  (retries: number, cause: Error): false | Error | number => {
    if (retries >= 4) {
      onAbort()
      return false
    }

    if (cause instanceof SocketTimeoutError) {
      onAbort()
      return false
    }

    if (cause instanceof ConnectionTimeoutError) {
      onAbort()
      return false
    }

    // Exponential back off starting at 50ms
    const delay = Math.pow(2, retries) * 50

    return delay
  }
