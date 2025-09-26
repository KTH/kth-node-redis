import { RedisClientOptions } from 'redis'
import { KthConfigurationUnpackedRedisConfig } from './config'

export type KthRedisConfig = RedisClientOptions | KthConfigurationUnpackedRedisConfig
