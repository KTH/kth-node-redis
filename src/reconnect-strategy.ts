import { ConnectionTimeoutError, SocketTimeoutError } from 'redis'

export const createStrategy =
  (cleanup: () => void) =>
  (retries: number, cause: Error): false | Error | number => {
    if (retries >= 4) {
      cleanup()
      return false
    }

    if (cause instanceof SocketTimeoutError) {
      cleanup()
      return false
    }

    if (cause instanceof ConnectionTimeoutError) {
      cleanup()
      return false
    }

    // Exponential back off starting at 50ms
    const delay = Math.pow(2, retries) * 50

    return delay
  }
