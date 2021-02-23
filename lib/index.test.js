const { Promise } = require('bluebird')

const RedisMockup = require('redis')
const LogMockup = require('kth-node-log')

const redis = require('./index')
const { resetRedisClients } = require('./index')._testInternals

const {
  bold,
  REJECTS,
  green,
  IS_ACCESSIBLE,
  EXPECTS,
  RESOLVES,
  RETURNS,
  WORKS,
} = require('../test-utils')
const { nextListHint, nextSnapshotHint } = require('../test-utils').getHintCallbacks()

// describe('Redis', () => {
//   it('should resolve with a client with a default config', () => {
//     const client = redis.getClient('default')
//     expect(client).toBeInstanceOf(RedisClient)
//   })

//   it('should return a promise on a connectClient call', () => {
//     const client = redis.getClient('default')
//     client.connected = false
//     const connectedClient = redis.connectClient('default')
//     expect(connectedClient).toBeInstanceOf(Promise)
//   })

//   it('should resolve with a client on a connectClient call', async () => {
//     redis.getClient('default')
//     const connectedClient = await redis.connectClient('default')
//     expect(connectedClient).toBeInstanceOf(RedisClient)
//   })
// })

function runTestsAboutDefaultExport() {
  describe(`${nextListHint()} has an async function ${bold('as default export')} which`, () => {
    const defaultExport = redis

    it(IS_ACCESSIBLE, () => expect(defaultExport).toBeFunction())

    it(`${EXPECTS} two arguments (name, options)`, () => expect(defaultExport).toHaveLength(2))

    it(`${RETURNS} a Promise`, () => {
      expect(defaultExport()).toBeInstanceOf(Promise)
      expect(defaultExport()).toBeInstanceOf(Promise)
      expect(defaultExport('testName1')).toBeInstanceOf(Promise)
      expect(defaultExport('testName1')).toBeInstanceOf(Promise)
      expect(defaultExport('testName2', {})).toBeInstanceOf(Promise)
      expect(defaultExport('testName2', {})).toBeInstanceOf(Promise)
    })

    // it(`- when used w/o arguments - ${RESOLVES} with a Redis client ${nextSnapshotHint()}`, async () => {
    it(`- when used w/o arguments - ${RESOLVES} with a Redis client`, async () => {
      const client = await defaultExport()

      expect(client).toBeInstanceOf(RedisMockup.RedisClient)
      expect(client).toContainAllKeys([
        '_events',
        '_eventsCount',
        '_maxListeners',
        'options',
        'stream',
        'connected',
        'ready',
        'pub_sub_mode',
        '_redisMock',
        'subscriptions',
        'psubscriptions',
        '_selectedDbIndex',
        'log',
      ])

      // expect(client).toMatchSnapshot('> RedisClient "default" <')
    })

    it(`- when used w/o arguments - ${WORKS} as expected`, async () => {
      await resetRedisClients()
      await defaultExport()

      const { calls } = RedisMockup.createClient.mock
      expect(calls).toMatchInlineSnapshot(`
        Array [
          Array [
            Object {
              "retry_strategy": [Function],
            },
          ],
        ]
      `)
    })

    // it(`- when used with "name" and "options" - ${RESOLVES} with a Redis client ${nextSnapshotHint()}`, async () => {
    it(`- when used with "name" and "options" - ${RESOLVES} with a Redis client`, async () => {
      const client = await defaultExport('testName', {})

      expect(client).toBeInstanceOf(RedisMockup.RedisClient)
      expect(client).toContainAllKeys([
        '_events',
        '_eventsCount',
        '_maxListeners',
        'options',
        'stream',
        'connected',
        'ready',
        'pub_sub_mode',
        '_redisMock',
        'subscriptions',
        'psubscriptions',
        '_selectedDbIndex',
        'log',
      ])

      // expect(client).toMatchSnapshot('> RedisClient "testName" <')
    })

    it(`- when used with "name" and "options" - ${green('logs')} as expected`, async () => {
      await resetRedisClients()

      LogMockup._clearAllCalls()
      await defaultExport('testName', {})

      expect(LogMockup.child).toHaveBeenCalledTimes(1)
      expect(LogMockup.child).toHaveBeenCalledWith({ redis: 'testName' })

      expect(LogMockup._listAllCalls()).toEqual({
        debug: [
          ['kth-node-redis: Redis clients', { clients: ['testName'] }],
          ['kth-node-redis: Redis connected: testName', { event: 'connect' }],
          ['kth-node-redis: Redis server version: n/a'],
        ],
        info: [['kth-node-redis: Redis client ready: testName', { event: 'ready' }]],
      })
    })

    it(`- when used with "name" and "options" - ${WORKS} as expected`, async () => {
      await resetRedisClients()

      await defaultExport('testName', { testOption: true })

      const { calls } = RedisMockup.createClient.mock
      expect(calls).toMatchInlineSnapshot(`
        Array [
          Array [
            Object {
              "retry_strategy": [Function],
              "testOption": true,
            },
          ],
        ]
      `)
    })

    it(`- when used twice with "name" and "options" - ${RESOLVES} with same buffered data`, async () => {
      await resetRedisClients()
      const client1 = await defaultExport('testName', {})
      const client2 = await defaultExport('testName', {})
      expect(client1).toBeObject()
      expect(client1).toBe(client2)
    })

    it(`- when used twice with "name" and "options" - ${green('logs')} as expected`, async () => {
      await resetRedisClients()
      await defaultExport('testName', {})

      LogMockup._clearAllCalls()
      await defaultExport('testName', {})

      expect(LogMockup.child).not.toHaveBeenCalled()
      expect(LogMockup._listAllCalls()).toEqual({
        debug: [['kth-node-redis: Redis using client: testName']],
      })
    })

    describe(`resolves with a ${bold('Redis client')} that`, () => {
      let client
      beforeAll(async () => {
        client = await defaultExport('testName', {})
      })

      beforeEach(() => client.flushdb())

      it(`has functions ${bold('set()')} and ${bold(
        'get()'
      )} with expected behaviour`, async () => {
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

      it(`has functions ${bold('setAsync()')} and ${bold(
        'getAsync()'
      )} with expected behaviour`, async () => {
        const value1 = await client.getAsync('testRedisKey')
        await client.setAsync('testRedisKey', 'okay')
        const value2 = await client.getAsync('testRedisKey')

        expect(value1).toBe(null)
        expect(value2).toBe('okay')

        expect(LogMockup._listAllCalls()).toEqual({})
      })

      it(`has function ${bold('del()')} with expected behaviour`, async () => {
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

      it(`has function ${bold('delAsync()')} with expected behaviour`, async () => {
        await client.setAsync('testRedisKey', 'okay')

        await client.delAsync('testRedisKey')

        const value = await client.getAsync('testRedisKey')
        expect(value).toBeNull()

        expect(LogMockup._listAllCalls()).toEqual({})
      })

      it(`has function ${bold('keys()')} with expected behaviour`, async () => {
        await client.setAsync('testRedisKey', 'okay')

        const keys = await new Promise(resolve => {
          client.keys('*', (error, result) => {
            expect(error).toBeNull()
            resolve(result)
          })
        })

        expect(keys).toMatchInlineSnapshot(`
          Array [
            "testRedisKey",
          ]
        `)

        expect(LogMockup._listAllCalls()).toEqual({})
      })

      it(`has function ${bold('keysAsync()')} with expected behaviour`, async () => {
        await client.setAsync('testRedisKey', 'okay')

        const keys = await client.keysAsync('*')

        expect(keys).toMatchInlineSnapshot(`
          Array [
            "testRedisKey",
          ]
        `)

        expect(LogMockup._listAllCalls()).toEqual({})
      })

      it(`has functions ${bold('hmset()')} and ${bold(
        'hgetall()'
      )} with expected behaviour`, async () => {
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

      it(`has functions ${bold('hmsetAsync()')} and ${bold(
        'hgetallAsync()'
      )} with expected behaviour`, async () => {
        await client.hmsetAsync('testRedisKey', 'name', 'test', 'city', 'Stockholm')
        const value = await client.hgetallAsync('testRedisKey')

        expect(value).toEqual({ city: 'Stockholm', name: 'test' })

        expect(LogMockup._listAllCalls()).toEqual({})
      })

      it(`has function ${bold('expire()')} with expected behaviour`, async () => {
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

      it(`has function ${bold('expireAsync()')} with expected behaviour`, async () => {
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
  })
}

function runTestsAboutConnectClient() {
  describe(`${nextListHint()} exports an async function ${bold('connectClient()')} which`, () => {
    const { connectClient } = redis

    it(IS_ACCESSIBLE, () => expect(connectClient).toBeFunction())

    it(`${EXPECTS} one argument (clientName)`, () => expect(connectClient).toHaveLength(1))

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

    it(`- when used with argument "clientName", but before creating the client - ${REJECTS} as expected`, async () => {
      await resetRedisClients()
      await expect(() => connectClient('testRedis')).rejects.toThrow('No such client: testRedis')
    })

    it(`- when used with argument "clientName" and after creating a matching client - ${RESOLVES} with client`, async () => {
      await resetRedisClients()
      const client1 = await redis('testRedis', {})
      const client2 = await connectClient('testRedis')

      expect(client1).toBe(client2)
    })

    it(`- when used with argument "clientName" and after creating a matching client - ${green(
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

function runTestsAboutGetClient() {}

function runTestsAboutQuit() {}

describe(`Package "kth-node-redis"`, () => {
  it(`has the expected exports`, () => {
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
            "resetRedisClients": [Function],
          },
          "connectClient": [Function],
          "getClient": [Function],
          "quit": [Function],
        },
      }
    `)
  })

  runTestsAboutDefaultExport()
  runTestsAboutConnectClient()
  runTestsAboutGetClient()
  runTestsAboutQuit()
})
