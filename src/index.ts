import * as redis from 'redis'
import { RedisClientType } from 'redis'

type TypePlaceholder = any

export type RedisClient = RedisClientType<any>

export const version = 'kth-node-redis-4'

const globalClients: Record<string, RedisClient> = {}

export const getClient = async (name = 'default', options: TypePlaceholder): Promise<RedisClient> => {
  const config = { ...options }

  const thisClient = globalClients[name]
  if (thisClient) {
    return thisClient
  }

  const client = redis.createClient()

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
