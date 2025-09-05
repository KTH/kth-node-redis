import * as redis from 'redis'
import { RedisClientType } from 'redis'
import { parseConfig } from './config'
import { KthRedisConfig } from './types'

export type RedisClient = RedisClientType<any>

export const version = 'kth-node-redis-4'

const globalClients: Record<string, RedisClient> = {}

export const getClient = async (name = 'default', options?: KthRedisConfig): Promise<RedisClient> => {
  const config = parseConfig(options)

  const thisClient = globalClients[name]
  if (thisClient) {
    return thisClient
  }

  const client = redis.createClient({ name, ...config })

  globalClients[name] = client as RedisClient
  await client.connect()

  return client as RedisClient
}

// Compatability with cjs "require"
module.exports = getClient
module.exports.getClient = getClient
module.exports.version = version
// Compatability with cjs "require"

export default getClient
