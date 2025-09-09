import * as redis from 'redis'
import { RedisClientType } from 'redis'
import { parseConfig } from './config'
import { createStrategy } from './reconnect-strategy'
import { KthRedisConfig } from './types'

const log = require('@kth/log')

export type RedisClient = RedisClientType<any>
export type { KthRedisConfig } from './types'

export const version = 'kth-node-redis-4'

const globalClients: Record<string, RedisClient> = {}

export const getClient = async (name = 'default', options?: KthRedisConfig): Promise<RedisClient> => {
  const config = parseConfig(options)

  const abortAndCleanup = () => {
    try {
      client.destroy()
    } catch (error) {
      log.debug('kth-node-redis: Failed to destroy client', error)
    }
    delete globalClients[name]
  }

  config.socket = config.socket || {}
  config.socket.reconnectStrategy = createStrategy(abortAndCleanup)

  const thisClient = globalClients[name]
  if (thisClient) {
    if (!(thisClient.isOpen && thisClient.isReady)) {
      await thisClient.connect()
    }

    return thisClient
  }

  const client = redis.createClient({ name, ...config })

  client.on('connect', () => log.debug(`kth-node-redis: Redis connected: ${name}`))
  client.on('ready', () => log.info(`kth-node-redis: Redis client ready: ${name}`))
  client.on('reconnecting', () => log.info(`kth-node-redis: Redis client reconnecting: ${name}`))

  client.on('error', error => {
    log.error('kth-node-redis: Redis client error', { error })

    if (error instanceof redis.SimpleError && error.message.includes('ERR AUTH <password>')) {
      abortAndCleanup()
    }

    if (error instanceof redis.SimpleError && error.message.includes('WRONGPASS')) {
      abortAndCleanup()
    }
  })

  client.on('end', () => {
    log.debug(`kth-node-redis: Redis client end: ${name}`)
  })

  globalClients[name] = client as RedisClient

  await client.connect()

  if (client.isOpen && client.isReady) {
    return client as RedisClient
  }

  throw new Error('kth-node-redis: Could not connect client')
}

// Compatability with cjs "require"
module.exports = getClient
module.exports.getClient = getClient
module.exports.version = version
// Compatability with cjs "require"

export default getClient
