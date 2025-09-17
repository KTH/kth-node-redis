import * as redis from 'redis'
import { RedisClientType } from 'redis'
import { parseConfig, isAzureServer } from './config'
import { createStrategy } from './reconnect-strategy'
import { KthRedisConfig } from './types'

const log = require('@kth/log')

export type RedisClient = RedisClientType<any>
export type { KthRedisConfig } from './types'

export const version = 'kth-node-redis-4'

const globalClients: Record<string, RedisClient> = {}

export const getClient = async (name = 'default', options?: KthRedisConfig): Promise<RedisClient> => {
  const config = parseConfig(options)

  const destroyClient = () => {
    try {
      globalClients[name]?.destroy()
    } catch (error) {
      log.debug('kth-node-redis: Failed to destroy client', error)
    }
  }

  config.socket = config?.socket || {}
  config.socket.reconnectStrategy = createStrategy(destroyClient)

  if (isAzureServer(config)) {
    config.pingInterval = 5 * 60 * 1000
  }

  const existingClient = globalClients[name]
  if (existingClient) {
    if (!existingClient.isOpen) {
      await existingClient.connect()
    }
    return existingClient
  }

  const client = redis.createClient({ name, ...config })

  client.on('connect', () => log.debug(`kth-node-redis: Redis connected: ${name}`))
  client.on('ready', () => log.info(`kth-node-redis: Redis client ready: ${name}`))
  client.on('reconnecting', () => log.info(`kth-node-redis: Redis client reconnecting: ${name}`))

  client.on('error', error => {
    log.error('kth-node-redis: Redis client error', { error })

    if (error instanceof redis.SimpleError && error.message.includes('ERR AUTH <password>')) {
      destroyClient()
    }

    if (error instanceof redis.SimpleError && error.message.includes('WRONGPASS')) {
      destroyClient()
    }
  })

  client.on('end', () => {
    delete globalClients[name]
    log.debug(`kth-node-redis: Redis client end: ${name}`)
  })

  globalClients[name] = client as RedisClient
  await client.connect()

  if (client.isOpen && client.isReady) {
    return globalClients[name]
  }

  destroyClient()
  delete globalClients[name]
  throw new Error('kth-node-redis: Could not connect client')
}

// Compatability with cjs "require"
module.exports = getClient
module.exports.getClient = getClient
module.exports.version = version
// Compatability with cjs "require"

export default getClient
