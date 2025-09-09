import { RedisClientOptions } from 'redis'

export type KthConfigurationUnpackedRedisConfig = {
  host: string
  port: number

  /**
   * For TLS connections, use tls: { servername: [SAME_AS_HOST] }
   */
  tls?: {
    servername: string
  }

  /**
   * Redis password
   */
  auth_pass?: string

  /**
   * Not used, kept for compatability
   */
  abortConnect?: any
}

export const parseConfig = (opts: any = {}): RedisClientOptions => {
  if (isKthConfig(opts)) {
    return parseKthConfig(opts as KthConfigurationUnpackedRedisConfig)
  }

  if (typeof opts === 'object') {
    return opts
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
