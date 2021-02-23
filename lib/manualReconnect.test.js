/* eslint no-use-before-define: ["error", "nofunc"] */

// @ts-check

const ManualReconnect = require('./manualReconnect')

const loggerMockup = require('kth-node-log')
// @ts-ignore
const { _listAllCalls: listAllLoggerCalls, _clearAllCalls: clearAllLoggerCalls } = loggerMockup

const validClientData = {
  name: 'testApi',
  client: { connected: true, end: jest.fn(), off: jest.fn(), on: jest.fn() },
  config: { host: 'localhost' },
  eventHandlers: { error: jest.fn() },
  log: loggerMockup.child({ redis: 'testApi' }),
}

describe('Helper functions for manual reconnects', () => {
  runTestsAboutMemorizeNewClient()
  runTestsAboutMarkClientAsDisconnected()
  runTestsAboutCheckErrorAndReconnectIfNeeded()
  runTestsAboutForgetDisconnectedClient()
})

function runTestsAboutMemorizeNewClient() {
  describe('have memorizeNewClient() which', () => {
    it('is a function', () => {
      expect(ManualReconnect.memorizeNewClient).toBeFunction()
    })

    it('- when called w/o arguments - FAILS as expected', () => {
      expect(ManualReconnect.memorizeNewClient).toThrow('Cannot destructure property')
    })

    it('- when called with minimal arguments - succeeds', () => {
      // @ts-ignore
      const result = ManualReconnect.memorizeNewClient({})

      const allLogs = listAllLoggerCalls()
      expect(allLogs).toEqual({})

      expect(result).toBe(true)
    })

    it('- when called with valid arguments - succeeds', () => {
      const result = ManualReconnect.memorizeNewClient(validClientData)

      const allLogs = listAllLoggerCalls()
      expect(allLogs).toEqual({})

      expect(result).toBe(true)
    })
  })
}

function runTestsAboutMarkClientAsDisconnected() {
  describe('have markClientAsDisconnected() which', () => {
    it('is a function', () => {
      expect(ManualReconnect.markClientAsDisconnected).toBeFunction()
    })

    it('- when called w/o arguments - FAILS as expected', () => {
      expect(ManualReconnect.markClientAsDisconnected).toThrow('Cannot read property')
    })

    it('- when called with unknown client name - works as expected', () => {
      const result = ManualReconnect.markClientAsDisconnected('unknownClient')

      const allLogs = listAllLoggerCalls()
      expect(allLogs).toContainAllKeys(['error'])
      expect(allLogs.error).toHaveLength(1)
      expect(allLogs.error[0][0]).toMatchInlineSnapshot(
        `"kth-node-redis: markClientAsDisconnected() failed - no data found for client"`
      )

      expect(result).toBe(false)
    })

    it('- when called with known client name - succeeds', () => {
      ManualReconnect.memorizeNewClient(validClientData)
      clearAllLoggerCalls()

      const result = ManualReconnect.markClientAsDisconnected(validClientData.name)

      const allLogs = listAllLoggerCalls()
      expect(allLogs).toContainAllKeys(['info'])
      expect(allLogs.info).toHaveLength(1)
      expect(allLogs.info[0][0]).toMatchInlineSnapshot(
        `"kth-node-redis: Redis client marked as disconnected"`
      )

      expect(result).toBe(true)
    })
  })
}

function runTestsAboutCheckErrorAndReconnectIfNeeded() {
  const validErrorInput = {
    name: validClientData.name,
    error: _getLostConnectionError(),
    createNewClient: jest.fn(),
  }

  describe('have checkErrorAndReconnectIfNeeded() which', () => {
    it('is a function', () => {
      expect(ManualReconnect.checkErrorAndReconnectIfNeeded).toBeFunction()
    })

    it('- when called w/o arguments - FAILS as expected', () => {
      expect(ManualReconnect.checkErrorAndReconnectIfNeeded).toThrow('Cannot destructure property')
    })

    it('- when called with unknown client name - works as expected', () => {
      const input = { ...validErrorInput, name: 'unknownClient' }
      const result = ManualReconnect.checkErrorAndReconnectIfNeeded(input)

      const allLogs = listAllLoggerCalls()
      expect(allLogs).toContainAllKeys(['error'])
      expect(allLogs.error).toHaveLength(1)
      expect(allLogs.error[0][0]).toMatchInlineSnapshot(
        `"kth-node-redis - checkErrorAndReconnectIfNeeded() failed - no data found for client"`
      )

      expect(result).toBe(false)
    })

    it('- when called with unknown error - works as expected', () => {
      ManualReconnect.memorizeNewClient(validClientData)
      ManualReconnect.markClientAsDisconnected(validClientData.name)
      clearAllLoggerCalls()

      const input = { ...validErrorInput, error: new Error('unknown error') }
      const result = ManualReconnect.checkErrorAndReconnectIfNeeded(input)

      const allLogs = listAllLoggerCalls()
      expect(allLogs).toEqual({})

      expect(result).toBe(false)
    })

    it('- when called with valid arguments but no delay - works as expected', () => {
      ManualReconnect.memorizeNewClient(validClientData)
      ManualReconnect.markClientAsDisconnected(validClientData.name)
      clearAllLoggerCalls()

      const result = ManualReconnect.checkErrorAndReconnectIfNeeded(validErrorInput)

      const allLogs = listAllLoggerCalls()
      expect(allLogs).toContainAllKeys(['warn'])
      expect(allLogs.warn).toHaveLength(1)
      expect(allLogs.warn[0][0]).toMatchInlineSnapshot(
        `"kth-node-redis - skipping manually reconnect because of active disconnect timeout"`
      )

      expect(result).toBe(false)
    })

    it('- when called with valid arguments and enough delay - succeeds', done => {
      ManualReconnect.memorizeNewClient(validClientData)
      ManualReconnect.markClientAsDisconnected(validClientData.name)
      clearAllLoggerCalls()

      setTimeout(() => {
        const result = ManualReconnect.checkErrorAndReconnectIfNeeded(validErrorInput)

        const allLogs = listAllLoggerCalls()
        expect(allLogs).toContainAllKeys(['info'])
        expect(allLogs.info).toHaveLength(1)
        expect(allLogs.info[0][0]).toMatchInlineSnapshot(
          `"kth-node-redis - Initiating manual reconnect of Redis client"`
        )

        expect(validErrorInput.createNewClient).toHaveBeenCalledTimes(1)
        expect(result).toBe(true)

        done()
      }, 1250)
    })
  })
}

function runTestsAboutForgetDisconnectedClient() {
  describe('have forgetDisconnectedClient() which', () => {
    it('is a function', () => {
      expect(ManualReconnect.forgetDisconnectedClient).toBeFunction()
    })

    it('- when called w/o arguments - FAILS as expected', () => {
      expect(ManualReconnect.forgetDisconnectedClient).toThrow('Cannot read property')
    })

    it('- when called with unknown client name - works as expected', () => {
      const result = ManualReconnect.forgetDisconnectedClient('unknownClient')

      const allLogs = listAllLoggerCalls()
      expect(allLogs).toEqual({})

      expect(result).toBe(false)
    })

    it('- when called with known client name - succeeds', () => {
      ManualReconnect.memorizeNewClient(validClientData)
      ManualReconnect.markClientAsDisconnected(validClientData.name)
      clearAllLoggerCalls()

      const result = ManualReconnect.forgetDisconnectedClient(validClientData.name)

      const allLogs = listAllLoggerCalls()
      expect(allLogs).toContainAllKeys(['info'])
      expect(allLogs.info).toHaveLength(1)
      expect(allLogs.info[0][0]).toMatchInlineSnapshot(
        `"kth-node-redis: Cleaning up earlier disconnected Redis client"`
      )

      expect(result).toBe(true)
    })
  })
}

function _getLostConnectionError() {
  const error = new Error('testError')
  // @ts-ignore
  error.code = 'NR_CLOSED'
  return error
}
