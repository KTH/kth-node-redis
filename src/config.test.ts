import { RedisClientOptions } from 'redis'
import { parseConfig } from './config'

describe('Config parsing', () => {
  describe('Transform config from "unpackRedisConfig" in package "kth-node-configuration', () => {
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
  describe('Allow other formats to pass', () => {
    test('return config as is if it has "url"', () => {
      const options = {
        url: 'redis://my-server',
      }

      const result = parseConfig(options)

      expect(result).toEqual(options)
    })
    test('return config as is if it has "socket.host"', () => {
      const options = {
        socket: { host: 'my-server' },
      }

      const result = parseConfig(options)

      expect(result).toEqual(options)
    })
    test('return config as is if it has "socket.port"', () => {
      const options = {
        socket: { port: 7000 },
      }

      const result = parseConfig(options)

      expect(result).toEqual(options)
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
    const options = 'invalid-config'

    expect(() => parseConfig(options)).toThrow()
  })
})
