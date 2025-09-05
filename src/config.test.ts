import { RedisClientOptions } from 'redis'
import { parseConfig } from './config'

describe('Config parsing', () => {
  describe('From "unpackRedisConfig" in package "kth-node-configuration', () => {
    test('when config is based on Azure connection string', () => {
      const options = {
        host: 'app-name.redis.cache.windows.net',
        port: 6380,
        tls: {
          servername: 'app-name.redis.cache.windows.net',
        },
        auth_pass: 'secret_password_123',
        abortConnect: false,
      }

      const result = parseConfig(options)

      const expectation: RedisClientOptions = {
        socket: { host: 'app-name.redis.cache.windows.net', port: 6380, tls: true },
        password: 'secret_password_123',
      }

      expect(result).toEqual(expectation)
    })
    test('when config is based on non secured redis url', () => {
      const options = {
        host: '127.0.0.1',
        port: 6379,
      }

      const result = parseConfig(options)

      const expectation: RedisClientOptions = {
        socket: { host: '127.0.0.1', port: 6379 },
      }

      expect(result).toEqual(expectation)
    })
  })
  it('returns empty object when empty object is passed', () => {
    const options = {}

    const result = parseConfig(options)

    const expectation: RedisClientOptions = {}

    expect(result).toEqual(expectation)
  })
  it('returns empty object when nothing passed', () => {
    const result = parseConfig()

    const expectation: RedisClientOptions = {}

    expect(result).toEqual(expectation)
  })
  it('throws when unknown format is passed', () => {
    const options = { value: 'This is not expected' }

    expect(() => parseConfig(options)).toThrow()
  })
})
