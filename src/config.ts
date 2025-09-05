import { RedisClientOptions } from 'redis'

export type KthConfigurationUnpackedRedisConfig = {
  host: string
  port: number
  tls?: {
    servername: string
  }
  auth_pass?: string
}

export const parseConfig = (opts: any = {}): RedisClientOptions => {
  if (typeof opts === 'object' && JSON.stringify(opts) === '{}') {
    return {}
  }

  if (isKthConfig(opts)) {
    return parseKthConfig(opts as KthConfigurationUnpackedRedisConfig)
  }

  throw new Error('Unknown Redis config')
}

const isKthConfig = (options: any): boolean => options?.host && options?.port

const parseKthConfig = (options: KthConfigurationUnpackedRedisConfig): RedisClientOptions => {
  const { host, port } = options

  // This logic looks weird, but that is the form the data comes in. 🤷‍♂️
  const tls = host === options.tls?.servername || undefined

  const password = options.auth_pass

  return {
    socket: { host, port, tls },
    password,
  }
}
