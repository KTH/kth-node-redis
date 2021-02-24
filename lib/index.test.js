const { Promise } = require('bluebird')

const RedisMockup = require('redis')
const LogMockup = require('kth-node-log')

const redis = require('./index')
const { resetRedisClients, listRedisClients } = require('./index')._testInternals

const {
  bold,
  red,
  REJECTS,
  green,
  IS_ACCESSIBLE,
  EXPECTS,
  RESOLVES,
  RETURNS,
  WORKS,
  copyObject,
} = require('../test-utils')
const { nextListHint } = require('../test-utils').getHintCallbacks()

/**
 * @param {RedisMockup.RedisClient} client
 * @returns {string|null}
 */
function _getNameOfCachedClient(client) {
  let result = null
  const allRegisteredClients = listRedisClients()
  Object.keys(allRegisteredClients).forEach(name => {
    if (allRegisteredClients[name] === client) {
      result = name
    }
  })
  return result
}

function runTestsAboutFunctionsOfRedisClient(initCallbackAsync) {
  describe(`${RESOLVES} with a ${bold('Redis client')} that has function(s)`, () => {
    let client
    beforeAll(async () => {
      client = await initCallbackAsync()
    })

    beforeEach(() => client.flushdb())

    it(`${bold('set()')} and ${bold('get()')} with expected behaviour`, async () => {
      const value1 = await new Promise(resolve => {
        client.get('testRedisKey', (error, reply) => {
          expect(error).toBeNull()
          resolve(reply)
        })
      })
      client.set('testRedisKey', 'okay')
      const value2 = await new Promise(resolve => {
        client.get('testRedisKey', (error, reply) => {
          expect(error).toBeNull()
          resolve(reply)
        })
      })

      expect(value1).toBe(null)
      expect(value2).toBe('okay')

      expect(LogMockup._listAllCalls()).toEqual({})
    })

    it(`${bold('setAsync()')} and ${bold('getAsync()')} with expected behaviour`, async () => {
      const value1 = await client.getAsync('testRedisKey')
      await client.setAsync('testRedisKey', 'okay')
      const value2 = await client.getAsync('testRedisKey')

      expect(value1).toBe(null)
      expect(value2).toBe('okay')

      expect(LogMockup._listAllCalls()).toEqual({})
    })

    it(`${bold('del()')} with expected behaviour`, async () => {
      await client.setAsync('testRedisKey', 'okay')

      await new Promise(resolve => {
        client.delAsync('testRedisKey', error => {
          expect(error).toBeNull()
          resolve()
        })
      })

      const value = await client.getAsync('testRedisKey')
      expect(value).toBeNull()

      expect(LogMockup._listAllCalls()).toEqual({})
    })

    it(`${bold('delAsync()')} with expected behaviour`, async () => {
      await client.setAsync('testRedisKey', 'okay')

      await client.delAsync('testRedisKey')

      const value = await client.getAsync('testRedisKey')
      expect(value).toBeNull()

      expect(LogMockup._listAllCalls()).toEqual({})
    })

    it(`${bold('keys()')} with expected behaviour`, async () => {
      await client.setAsync('testRedisKey', 'okay')

      const keys = await new Promise(resolve => {
        client.keys('*', (error, result) => {
          expect(error).toBeNull()
          resolve(result)
        })
      })

      expect(keys).toEqual(['testRedisKey'])

      expect(LogMockup._listAllCalls()).toEqual({})
    })

    it(`${bold('keysAsync()')} with expected behaviour`, async () => {
      await client.setAsync('testRedisKey', 'okay')

      const keys = await client.keysAsync('*')

      expect(keys).toEqual(['testRedisKey'])

      expect(LogMockup._listAllCalls()).toEqual({})
    })

    it(`${bold('hmset()')} and ${bold('hgetall()')} with expected behaviour`, async () => {
      await new Promise(resolve =>
        client.hmset('testRedisKey', 'name', 'test', 'city', 'Stockholm', error => {
          expect(error).toBeNull()
          resolve()
        })
      )
      const value = await new Promise(resolve =>
        client.hgetall('testRedisKey', (error, result) => {
          expect(error).toBeNull()
          resolve(result)
        })
      )

      expect(value).toEqual({ city: 'Stockholm', name: 'test' })

      expect(LogMockup._listAllCalls()).toEqual({})
    })

    it(`${bold('hmsetAsync()')} and ${bold('hgetallAsync()')} with expected behaviour`, async () => {
      await client.hmsetAsync('testRedisKey', 'name', 'test', 'city', 'Stockholm')
      const value = await client.hgetallAsync('testRedisKey')

      expect(value).toEqual({ city: 'Stockholm', name: 'test' })

      expect(LogMockup._listAllCalls()).toEqual({})
    })

    it(`${bold('expire()')} with expected behaviour`, async () => {
      await client.setAsync('testRedisKey', 'okay')

      const result = await new Promise(resolve =>
        client.expireAsync('testRedisKey', 0.4, (error, _result) => {
          expect(error).toBeNull()
          resolve(_result)
        })
      )

      expect(result).toBe(1)
      await expect(client.getAsync('testRedisKey')).resolves.toBe('okay')

      await new Promise(resolve => setTimeout(resolve, 200))
      await expect(client.getAsync('testRedisKey')).resolves.toBe('okay')

      await new Promise(resolve => setTimeout(resolve, 400))
      await expect(client.getAsync('testRedisKey')).resolves.toBeNull()
    }, 3000)

    it(`${bold('expireAsync()')} with expected behaviour`, async () => {
      await client.setAsync('testRedisKey', 'okay')

      const result = await client.expireAsync('testRedisKey', 0.4)

      expect(result).toBe(1)
      await expect(client.getAsync('testRedisKey')).resolves.toBe('okay')

      await new Promise(resolve => setTimeout(resolve, 200))
      await expect(client.getAsync('testRedisKey')).resolves.toBe('okay')

      await new Promise(resolve => setTimeout(resolve, 400))
      await expect(client.getAsync('testRedisKey')).resolves.toBeNull()
    }, 3000)
  })
}

function runTestsAboutEventHandlersOfRedisClient({ caption, initCallbackAsync, expectedHandlers }) {
  describe(`${caption} a ${green('Redis client that listens to')}`, () => {
    const _prepareClientAsync = async () => {
      await resetRedisClients()
      const client = await initCallbackAsync()
      return client
    }

    it(`exactly all expected events ("${expectedHandlers.join('", "')}")`, async () => {
      const client = await _prepareClientAsync()
      expect(client.eventNames()).toEqual(expectedHandlers)
    })

    if (expectedHandlers.includes('connect')) {
      it(`event ${bold('"connect"')} as expected`, async () => {
        const client = await _prepareClientAsync()
        LogMockup._clearAllCalls()

        expect(client.listenerCount('connect')).toBe(1)
        client.emit('connect')

        expect(LogMockup._listAllCalls()).toEqual({
          debug: [['kth-node-redis: Redis connected: testName', { event: 'connect' }]],
        })
      })
    }

    if (expectedHandlers.includes('ready')) {
      it(`event ${bold('"ready"')} as expected`, async () => {
        const client = await _prepareClientAsync()
        LogMockup._clearAllCalls()

        expect(client.listenerCount('ready')).toBe(1)
        client.emit('ready')

        expect(LogMockup._listAllCalls()).toEqual({
          debug: [['kth-node-redis: Redis server version: n/a']],
          info: [['kth-node-redis: Redis client ready: testName', { event: 'ready' }]],
        })
      })
    }

    if (expectedHandlers.includes('warning')) {
      it(`event ${bold('"warning"')} as expected`, async () => {
        const client = await _prepareClientAsync()
        LogMockup._clearAllCalls()
        const testError = new Error('test-error')

        expect(client.listenerCount('warning')).toBe(1)
        client.emit('warning', testError)

        expect(LogMockup._listAllCalls()).toEqual({
          warn: [['kth-node-redis: Redis client warning', { event: 'warning', error: testError }]],
        })
      })
    }

    if (expectedHandlers.includes('error')) {
      it(`event ${bold('"error"')} as expected`, async () => {
        const client = await _prepareClientAsync()
        LogMockup._clearAllCalls()
        const testError = new Error('test-error')

        expect(client.listenerCount('error')).toBe(1)
        client.emit('error', testError)

        expect(LogMockup._listAllCalls()).toEqual({
          error: [['kth-node-redis: Redis client error', { event: 'error', error: testError }]],
        })
      })
    }

    if (expectedHandlers.includes('reconnecting')) {
      it(`event ${bold('"reconnecting"')} as expected`, async () => {
        const client = await _prepareClientAsync()
        LogMockup._clearAllCalls()

        expect(client.listenerCount('reconnecting')).toBe(1)
        client.emit('reconnecting')

        expect(LogMockup._listAllCalls()).toEqual({
          debug: [['kth-node-redis: Redis client reconnecting: testName', { event: 'reconnecting' }]],
        })
      })
    }

    if (expectedHandlers.length > 1 && expectedHandlers.includes('end')) {
      it(`event ${bold('"end"')} as expected`, async () => {
        const client = await _prepareClientAsync()
        LogMockup._clearAllCalls()
        expect(_getNameOfCachedClient(client)).toBe('testName')

        expect(client.listenerCount('end')).toBe(1)
        client.emit('end')

        expect(_getNameOfCachedClient(client)).toBeNull()
        expect(LogMockup._listAllCalls()).toEqual({
          debug: [['kth-node-redis: Redis client end: testName', { event: 'end' }]],
        })
      })
    }

    if (expectedHandlers.length === 1 && expectedHandlers[0] === 'end') {
      it(`event ${bold('"end"')} as expected, only`, async () => {
        const client = await _prepareClientAsync()
        LogMockup._clearAllCalls()
        expect(_getNameOfCachedClient(client)).toBe('testName')

        expect(client.listenerCount('end')).toBe(1)
        client.emit('end')

        expect(_getNameOfCachedClient(client)).toBeNull()
        expect(LogMockup._listAllCalls()).toEqual({})
      })
    }
  })
}

function runTestsAboutRedisClientCreatedTwice(initCallbackAsync, resolvesConnected) {
  const testCasesWhenUsingTwice = [
    {
      caption1: 'w/o arguments',
      caption2: 'same object',
      args1: [],
      args2: [],
    },
    {
      caption1: 'with same arguments "name" and "options"',
      caption2: 'same object',
      args1: ['testName', { testOption: true }],
      args2: ['testName', { testOption: true }],
    },
    {
      caption1: 'with different argument "name"',
      caption2: 'different objects',
      args1: ['testName1', { testOption: true }],
      args2: ['testName2', { testOption: true }],
    },
    {
      caption1: 'with different argument "options"',
      caption2: 'same object',
      args1: ['testName', { testOption1: true, testOption2: 'KTH' }],
      args2: ['testName', { testOption2: false, testOption3: 179 }],
    },
  ]

  testCasesWhenUsingTwice.forEach(({ caption1, caption2, args1, args2 }) => {
    it(`- when used ${bold('twice')} ${caption1} - ${RETURNS} ${caption2}`, async () => {
      await resetRedisClients()

      const client1 = await initCallbackAsync(...args1)

      if (resolvesConnected) {
        expect(client1.connected).toBeTrue()
      } else {
        expect(client1.connected).toBeFalse()
        await new Promise(resolve => client1.on('connect', resolve))
      }

      const client2 = await initCallbackAsync(...args2)

      if (caption2 === 'same object') {
        expect(client1).toBe(client2)
      } else {
        expect(client1).not.toBe(client2)
      }
    })
  })

  it(`- when used ${bold('twice')} with different argument "options" - ${red(
    'IGNORES'
  )} second "options"`, async () => {
    await resetRedisClients()

    await initCallbackAsync('testName', { testOption1: true, testOption2: 'KTH' })
    await initCallbackAsync('testName', { testOption2: false, testOption3: 179 })

    expect(RedisMockup.createClient).toHaveBeenCalledTimes(1)
    expect(copyObject(RedisMockup.createClient.mock.calls, { replaceFunctions: true })).toEqual([
      [{ retry_strategy: '(FUNC:retry_strategy)', testOption1: true, testOption2: 'KTH' }],
    ])
  })
}

function runTestsAboutCreationOfRedisClient({ caption, callback, resolvesConnected }) {
  describe(`${nextListHint()} exports ${caption} which`, () => {
    it(IS_ACCESSIBLE, () => expect(callback).toBeFunction())

    it(`${EXPECTS} two arguments (name, options)`, () => expect(callback).toHaveLength(2))

    const testCasesWhenUsedOnce = [
      {
        caption1: 'w/o arguments',
        caption2: 'Redis client "default"',
        name: undefined,
        options: undefined,
        clientName: 'default',
      },
      {
        caption1: 'with arguments "name" and "options"',
        caption2: 'named Redis client',
        name: 'testName',
        options: { testOption: true },
        clientName: 'testName',
      },
    ]

    testCasesWhenUsedOnce.forEach(({ caption1, caption2, name, options, clientName }) => {
      it(`- when used ${caption1} - ${RESOLVES} with ${caption2}`, async () => {
        await resetRedisClients()
        const client = await callback(name, options)

        expect(client).toBeInstanceOf(RedisMockup.RedisClient)

        expect(_getNameOfCachedClient(client)).toBe(clientName)
      })
    })

    runTestsAboutRedisClientCreatedTwice((...args) => callback(...args), resolvesConnected)

    runTestsAboutFunctionsOfRedisClient(() => callback('testName', {}))
  })
}

function runTestsWithDefaultExport() {
  describe(`${nextListHint()} exports an async function ${bold('as default')} which`, () => {
    const defaultExport = redis

    it(IS_ACCESSIBLE, () => expect(defaultExport).toBeFunction())

    it(`${EXPECTS} two arguments (name, options)`, () => expect(defaultExport).toHaveLength(2))

    it.skip(`${RETURNS} a Promise`, async () => {
      await resetRedisClients()

      const resultSync1 = defaultExport()
      expect(resultSync1).toBeInstanceOf(Promise)

      const resultSync2 = defaultExport('testName', {})
      expect(resultSync2).toBeInstanceOf(Promise)

      await Promise.all([resultSync1, resultSync2])
    })

    const testCasesWhenUsedOnce = [
      {
        caption1: 'w/o arguments',
        caption2: 'Redis client "default"',
        name: undefined,
        options: undefined,
        clientName: 'default',
      },
      {
        caption1: 'with arguments "name" and "options"',
        caption2: 'named Redis client',
        name: 'testName',
        options: { testOption: true },
        clientName: 'testName',
      },
    ]

    testCasesWhenUsedOnce.forEach(({ caption1, caption2, name, options, clientName }) => {
      it(`- when used ${caption1} - ${RESOLVES} with ${caption2}`, async () => {
        await resetRedisClients()
        const client = await defaultExport(name, options)

        expect(client).toBeInstanceOf(RedisMockup.RedisClient)
        // expect(client).toContainAllKeys([
        //   '_events',
        //   '_eventsCount',
        //   '_maxListeners',
        //   'options',
        //   'stream',
        //   'connected',
        //   'ready',
        //   'pub_sub_mode',
        //   '_redisMock',
        //   'subscriptions',
        //   'psubscriptions',
        //   '_selectedDbIndex',
        //   'log',
        // ])

        expect(_getNameOfCachedClient(client)).toBe(clientName)
      })

      it.skip(`- when used ${caption1} - ${green('resolves after')} client has connected`, async () => {
        await resetRedisClients()
        const client = await defaultExport(name, options)

        expect(client.connected).toBeTrue()

        const calls = copyObject(RedisMockup.createClient.mock.calls, { replaceFunctions: true })
        expect(calls).toHaveLength(1)
        expect(calls).toEqual([[{ retry_strategy: '(FUNC:retry_strategy)', ...options }]])
      })

      it.skip(`- when used ${caption1} - ${green('logs')} as expected`, async () => {
        await resetRedisClients()
        LogMockup._clearAllCalls()

        await defaultExport(name, options)

        expect(LogMockup.child).toHaveBeenCalledTimes(1)
        expect(LogMockup.child).toHaveBeenCalledWith({ redis: clientName })

        expect(LogMockup._listAllCalls()).toEqual({
          debug: [
            ['kth-node-redis: Redis clients', { clients: [clientName] }],
            [`kth-node-redis: Redis connected: ${clientName}`, { event: 'connect' }],
            ['kth-node-redis: Redis server version: n/a'],
          ],
          info: [[`kth-node-redis: Redis client ready: ${clientName}`, { event: 'ready' }]],
        })
      })
    })

    runTestsAboutRedisClientCreatedTwice((...args) => defaultExport(...args), true)

    it.skip(`- when used twice with same "name" and "options" - ${green('logs')} as expected`, async () => {
      await resetRedisClients()
      await defaultExport('testName', {})
      LogMockup._clearAllCalls()

      await defaultExport('testName', {})

      expect(LogMockup.child).not.toHaveBeenCalled()
      expect(LogMockup._listAllCalls()).toEqual({
        debug: [['kth-node-redis: Redis using client: testName']],
      })
    })

    runTestsAboutFunctionsOfRedisClient(() => defaultExport('testName', {}))

    // const expectedHandlers = ['connect', 'ready', 'warning', 'error', 'reconnecting', 'end']
    // runTestsAboutEventHandlersOfRedisClient({
    //   caption: `${RESOLVES} with`,
    //   initCallbackAsync: () => defaultExport('testName', {}),
    //   expectedHandlers,
    // })
  })
}

function runTestsAboutGetClient() {
  describe(`${nextListHint()} exports a function ${bold('getClient()')} which`, () => {
    const { getClient } = redis

    it(IS_ACCESSIBLE, () => expect(getClient).toBeFunction())

    it(`${EXPECTS} one argument (name, options)`, () => expect(getClient).toHaveLength(2))

    const testCasesWhenUsedOnce = [
      {
        caption1: 'w/o arguments',
        caption2: 'Redis client "default"',
        name: undefined,
        options: undefined,
        clientName: 'default',
      },
      {
        caption1: 'with arguments "name" and "options"',
        caption2: 'named Redis client',
        name: 'testName',
        options: { testOption: true },
        clientName: 'testName',
      },
    ]

    testCasesWhenUsedOnce.forEach(({ caption1, caption2, name, options, clientName }) => {
      it(`- when used ${caption1} - ${RETURNS} with ${caption2}`, async () => {
        await resetRedisClients()

        const client = getClient(name, options)

        expect(client).toBeInstanceOf(RedisMockup.RedisClient)
        // expect(client).toContainAllKeys([
        //   '_events',
        //   '_eventsCount',
        //   '_maxListeners',
        //   'options',
        //   'stream',
        //   'connected',
        //   'ready',
        //   'pub_sub_mode',
        //   '_redisMock',
        //   'subscriptions',
        //   'psubscriptions',
        //   '_selectedDbIndex',
        // ])

        expect(_getNameOfCachedClient(client)).toBe(clientName)
      })

      it.skip(`- when used ${caption1} - ${green('returns before')} client has connected`, async () => {
        await resetRedisClients()
        const client = getClient(name, options)

        expect(client.connected).toBeFalse()

        await new Promise(resolve => client.on('connect', resolve))
        expect(client.connected).toBe(true)

        const calls = copyObject(RedisMockup.createClient.mock.calls, { replaceFunctions: true })
        expect(calls).toHaveLength(1)
        expect(calls).toEqual([[{ retry_strategy: '(FUNC:retry_strategy)', ...options }]])
      })

      it.skip(`- when used ${caption1} - ${green('logs')} as expected`, async () => {
        await resetRedisClients()
        LogMockup._clearAllCalls()

        getClient(name, options)

        expect(LogMockup.child).not.toHaveBeenCalled()
        expect(LogMockup._listAllCalls()).toEqual({
          debug: [
            [
              'kth-node-redis',
              {
                moment: 'app called function exported as redis.getClient()',
                note: 'deprecated function?!',
                redis: clientName,
              },
            ],
          ],
        })
      })
    })

    runTestsAboutRedisClientCreatedTwice((...args) => getClient(...args), false)

    it.skip(`- when used twice with same arguments "name" and "options" - ${green('logs')} as expected`, async () => {
      await resetRedisClients()
      LogMockup._clearAllCalls()

      getClient('testName', {})
      getClient('testName', {})

      expect(LogMockup.child).not.toHaveBeenCalled()
      expect(LogMockup._listAllCalls()).toEqual({
        debug: [
          [
            'kth-node-redis',
            {
              moment: 'app called function exported as redis.getClient()',
              note: 'deprecated function?!',
              redis: 'testName',
            },
          ],
          [
            'kth-node-redis',
            {
              moment: 'app called function exported as redis.getClient()',
              note: 'deprecated function?!',
              redis: 'testName',
            },
          ],
        ],
      })
    })

    runTestsAboutFunctionsOfRedisClient(() => getClient('testName', {}))

    // runTestsAboutEventHandlersOfRedisClient({
    //   caption: `${RESOLVES} with`,
    //   initCallbackAsync: () => getClient('testName', {}),
    //   expectedHandlers: ['end'],
    // })
  })
}

function runTestsAboutDefaultExportInCombinationWithGetClient() {
  describe(`${nextListHint()} exports the two similar functions ${bold('as default')} and ${bold(
    'getClient()'
  )} which`, () => {
    const defaultExport = redis
    const { getClient } = redis

    it(`- when default export is called before getClient() with same arguments - deliver same Redis client`, async () => {
      await resetRedisClients()
      const client1 = await defaultExport('testName', {})
      const client2 = getClient('testName', {})
      expect(client1).toBe(client2)
    })

    it(`- when getClient() is called before default export with same arguments - deliver same Redis client`, async () => {
      await resetRedisClients()
      const client1 = getClient('testName', {})
      const client2 = await defaultExport('testName', {})
      expect(client1).toBe(client2)
    })

    describe(`${red('behave slightly differently')}:`, () => {
      const _getFreshDefaultClient = async () => {
        await resetRedisClients()
        LogMockup._clearAllCalls()
        const client = await defaultExport('testName', {})
        return client
      }

      const _getFreshAlternativeClient = async () => {
        await resetRedisClients()
        LogMockup._clearAllCalls()
        const client = getClient('testName', {})
        await new Promise(resolve => client.once('connect', resolve))
        return client
      }

      it(`${bold('only')} default export ${RETURNS} a Promise`, async () => {
        await resetRedisClients()
        const resultSync1 = defaultExport('testName', {})
        expect(resultSync1).toBeInstanceOf(Promise)
        await resultSync1

        await resetRedisClients()
        const resultSync2 = getClient('testName', {})
        expect(resultSync2).toBeInstanceOf(RedisMockup.RedisClient)
      })

      it(`${bold('only')} default export ${green('resolves after')} client has connected`, async () => {
        await resetRedisClients()
        const client1 = await defaultExport('testName', {})
        expect(client1.connected).toBeTrue()

        await resetRedisClients()
        const client2 = getClient('testName', {})
        expect(client2.connected).toBeFalse()
      })

      runTestsAboutEventHandlersOfRedisClient({
        caption: `${bold('default export')} creates`,
        initCallbackAsync: () => defaultExport('testName', {}),
        expectedHandlers: ['connect', 'ready', 'warning', 'error', 'reconnecting', 'end'],
      })

      runTestsAboutEventHandlersOfRedisClient({
        caption: `${bold('getClient()')} creates`,
        initCallbackAsync: () => getClient('testName', {}),
        expectedHandlers: ['end'],
      })

      it(`${bold('only')} default export ${green('initializes')} logger as child`, async () => {
        await _getFreshDefaultClient()
        expect(LogMockup.child).toHaveBeenCalledTimes(1)
        expect(LogMockup.child).toHaveBeenCalledWith({ redis: 'testName' })

        await _getFreshAlternativeClient()
        expect(LogMockup.child).toHaveBeenCalledTimes(0)
      })

      it(`${bold('only')} default export ${green('adds')} logger as a property to Redis client`, async () => {
        const client1 = await _getFreshDefaultClient()
        expect(client1.log).toBe(LogMockup.child())

        const client2 = await _getFreshAlternativeClient()
        expect(client2.log).toBeUndefined()
      })

      it(`they ${green('output')} different logs when creating client`, async () => {
        await _getFreshDefaultClient()
        expect(LogMockup._listAllCalls()).toEqual({
          debug: [
            ['kth-node-redis: Redis clients', { clients: ['testName'] }],
            ['kth-node-redis: Redis connected: testName', { event: 'connect' }],
            ['kth-node-redis: Redis server version: n/a'],
          ],
          info: [['kth-node-redis: Redis client ready: testName', { event: 'ready' }]],
        })

        await _getFreshAlternativeClient()
        expect(LogMockup._listAllCalls()).toEqual({
          debug: [
            [
              'kth-node-redis',
              {
                moment: 'app called function exported as redis.getClient()',
                note: 'deprecated function?!',
                redis: 'testName',
              },
            ],
          ],
        })
      })

      it(`they ${green('output')} different logs when returning cached client`, async () => {
        await _getFreshDefaultClient()
        LogMockup._clearAllCalls()
        await defaultExport('testName', {})
        expect(LogMockup._listAllCalls()).toEqual({
          debug: [['kth-node-redis: Redis using client: testName']],
        })

        await _getFreshAlternativeClient()
        LogMockup._clearAllCalls()
        getClient('testName', {})
        expect(LogMockup._listAllCalls()).toEqual({
          debug: [
            [
              'kth-node-redis',
              {
                moment: 'app called function exported as redis.getClient()',
                note: 'deprecated function?!',
                redis: 'testName',
              },
            ],
          ],
        })
      })
    })
  })
}

function runTestsAboutConnectClient() {
  describe(`${nextListHint()} exports an async function ${bold('connectClient()')} which`, () => {
    const { connectClient } = redis

    it(IS_ACCESSIBLE, () => expect(connectClient).toBeFunction())

    it(`${EXPECTS} one argument (name)`, () => expect(connectClient).toHaveLength(1))

    it(`${RETURNS} a Promise`, async () => {
      await resetRedisClients()

      const result1 = connectClient()
      expect(result1).toBeInstanceOf(Promise)
      await expect(result1).rejects.toThrow()

      const result2 = connectClient('testRedis')
      expect(result2).toBeInstanceOf(Promise)
      await expect(result2).rejects.toThrow()
    })

    it(`- when used w/o argument and before creating a client - ${REJECTS} as expected`, async () => {
      await resetRedisClients()
      await expect(connectClient).rejects.toThrow('No such client: undefined')
    })

    it(`- when used w/o argument and after creating a client named "undefined" - ${RESOLVES} with client`, async () => {
      await resetRedisClients()
      const client1 = await redis('undefined', {})
      const client2 = await connectClient()

      expect(client1).toBe(client2)
    })

    it(`- when used with argument "name", but before creating the client - ${REJECTS} as expected`, async () => {
      await resetRedisClients()
      await expect(() => connectClient('testRedis')).rejects.toThrow('No such client: testRedis')
    })

    it(`- when used with argument "name" and after creating a matching client - ${RESOLVES} with client`, async () => {
      await resetRedisClients()
      const client1 = await redis('testRedis', {})
      const client2 = await connectClient('testRedis')

      expect(client1).toBe(client2)
    })

    it(`- when used with argument "name" and after creating a matching client - ${green(
      'logs'
    )} as expected`, async () => {
      await resetRedisClients()
      await redis('testRedis', {})

      LogMockup._clearAllCalls()
      await connectClient('testRedis')

      expect(LogMockup.child).not.toHaveBeenCalled()
      expect(LogMockup._listAllCalls()).toEqual({
        debug: [
          [
            'kth-node-redis',
            {
              moment: 'app called function exported as redis.connectClient()',
              note: 'deprecated function?!',
              redis: 'testRedis',
            },
          ],
        ],
      })
    })

    it(`- when earlier created client is still connecting - ${WORKS} as expected`, async () => {
      const client = await redis('testRedis', {})
      client.connected = false

      const steps = []

      await new Promise(resolve => {
        setTimeout(() => {
          steps.push('... 200')
        }, 200)
        setTimeout(() => {
          steps.push('... 400')
          client.emit('ready')
        }, 400)
        setTimeout(() => {
          steps.push('... 600')
          resolve()
        }, 600)

        connectClient('testRedis').then(() => steps.push('connected'))
      })

      expect(steps).toEqual(['... 200', '... 400', 'connected', '... 600'])
    })
  })
}

function runTestsAboutQuit() {
  describe(`${nextListHint()} exports a function ${bold('quit()')} which`, () => {
    const { quit } = redis

    it(IS_ACCESSIBLE, () => expect(quit).toBeFunction())

    it(`${EXPECTS} one argument (name)`, () => expect(quit).toHaveLength(1))

    const testCases = [
      { caption: 'w/o arguments', argument: undefined, clientName: 'default' },
      { caption: 'with argument "name"', argument: 'testName', clientName: 'testName' },
    ]

    testCases.forEach(({ caption, argument, clientName }) => {
      it(`- when used ${caption} - ${RETURNS} undefined`, () => expect(quit(argument)).toBeUndefined())

      it(`- when used ${caption} - ${green('initiates')} removal of client`, async () => {
        await resetRedisClients()
        const client = await redis(clientName, {})

        const activeEvents = client.eventNames()
        expect(activeEvents).toContain('end')
        activeEvents.forEach(name => expect([name, client.listenerCount(name)]).toEqual([name, 1]))

        const _wrapSingleEventHandlerWithMockupAndStoreInObject = (name, obj) => {
          const originalListener = client.listeners(name)[0]
          // eslint-disable-next-line no-param-reassign
          obj[name] = jest.fn(originalListener)
          client.off(name, originalListener)
          client.on(name, obj[name])
        }

        const handlerMockups = {}
        activeEvents.forEach(name => _wrapSingleEventHandlerWithMockupAndStoreInObject(name, handlerMockups))

        quit(argument)

        expect(_getNameOfCachedClient(client)).toBe(clientName)
        expect(handlerMockups.end).toHaveBeenCalledTimes(0)

        await new Promise(resolve => setTimeout(resolve, 200))

        expect(_getNameOfCachedClient(client)).toBeNull()
        expect(handlerMockups.end).toHaveBeenCalledTimes(1)
        expect(handlerMockups.end).toHaveBeenCalledWith()

        activeEvents
          .filter(name => name !== 'end')
          .forEach(name => {
            expect([name, handlerMockups[name].mock.calls.length]).toEqual([name, 0])
          })
      })

      it(`- when used ${caption} - ${green('logs')} as expected`, async () => {
        await resetRedisClients()
        await redis(clientName, {})

        LogMockup._clearAllCalls()
        quit(argument)

        const logs = LogMockup._listAllCalls()
        expect(logs).toContainAllKeys(['debug'])
        expect(logs.debug).toHaveLength(1)
        expect(logs.debug[0]).toHaveLength(2)
        expect(logs.debug[0][0]).toBe('kth-node-redis')
        expect({ ...logs.debug[0][1], stack: 'ignored' }).toEqual({
          moment: 'app called function exported as redis.quit()',
          redis: clientName,
          stack: 'ignored',
        })
      })
    })
  })
}

describe(`Package "kth-node-redis"`, () => {
  it(`has all expected exports`, () => {
    const defaultExport = redis

    const otherExports = {}
    Object.keys(redis).forEach(key => {
      otherExports[key] = redis[key]
    })

    expect({ defaultExport, otherExports }).toMatchInlineSnapshot(`
      Object {
        "defaultExport": [Function],
        "otherExports": Object {
          "_testInternals": Object {
            "listRedisClients": [Function],
            "resetRedisClients": [Function],
          },
          "connectClient": [Function],
          "getClient": [Function],
          "quit": [Function],
        },
      }
    `)
  })

  // runTestsAboutCreationOfRedisClient({
  //   caption: `an async function ${bold('as default')}`,
  //   callback: redis,
  //   resolvesConnected: true,
  // })

  // runTestsAboutCreationOfRedisClient({
  //   caption: `a function ${bold('getClient')}`,
  //   callback: redis.getClient,
  //   resolvesConnected: false,
  // })

  runTestsWithDefaultExport()
  runTestsAboutGetClient()

  runTestsAboutDefaultExportInCombinationWithGetClient()

  runTestsAboutConnectClient()
  runTestsAboutQuit()
})
