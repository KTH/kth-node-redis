/* eslint no-use-before-define: ["error", "nofunc"] */

// @ts-check

module.exports = getClient
module.exports.getClient = getRedisClient
module.exports.connectClient = getConnectedRedisClient
module.exports.quit = quit

const _isTruthyEnv = varName => ['true', 'yes'].includes(String(process.env[varName]).toLowerCase())

const __USE_NEW_RETRY_STRATEGY__ = _isTruthyEnv('FEATURE_REDIS_USES_NEW_RETRY_STRATEGY')
const __USE_OLD_RETRY_STRATEGY__ = !__USE_NEW_RETRY_STRATEGY__

const ONE_MINUTE = 60 * 1000

const logger = require('kth-node-log')
const redis = require('redis')
const Promise = require('bluebird')

const ManualReconnect = require('./manualReconnect')

Promise.promisifyAll(redis.RedisClient.prototype)
Promise.promisifyAll(redis.Multi.prototype)

const Global = {
  clients: {},
  defaultName: 'default',
  defaults: {
    retry_strategy: options => {
      if (options != null && typeof options === 'object') {
        const errorCode =
          options.error != null && typeof options.error === 'object' ? options.error.code : null
        if (errorCode === 'ECONNREFUSED') {
          logger.fatal('kth-node-redis - retry_strategy() got ECONNREFUSED')
          return new Error('Connection refused by server.')
        }
        if (options.total_retry_time > 60 * ONE_MINUTE) {
          logger.fatal('kth-node-redis - retry_strategy() got exceeded total_retry_time')
          return new Error('Retry time exhausted')
        }
        if (options.times_connected > 10) {
          logger.fatal('kth-node-redis - retry_strategy() got exceeded times_connected')
          return undefined
        }
      }

      const delay = Math.max(options.attempt * 100, 3000)
      logger.info(`kth-node-redis - retry_strategy() is requesting retry after ${delay} ms`)
      return delay
    },
  },
}

if (__USE_OLD_RETRY_STRATEGY__) {
  Global.defaults.connect_timeout = 10000
  // for initially connecting to redis. This prevents hanging on a bad REDIS_URI (increased to 10s due to Azure)
}

function _once(fn) {
  let called = false
  let value
  return (...args) => {
    if (!called) {
      value = fn.apply(fn, args)
      called = true
    }
    return value
  }
}

/**
 * Creates a Redis client based on the given name and options.
 *
 * @param {*} name the given name for the Redis client.
 * @param {*} options the given options for the Redis client.
 * @param {*} callback
 */
function _createClient(name, options, callback) {
  const log = logger.child({ redis: name })
  log.debug('kth-node-redis: Redis creating client: ' + name)
  let isReady = false

  if (__USE_NEW_RETRY_STRATEGY__) {
    log.debug(
      'kth-node-redis: Client will use new retry strategy because of FEATURE_REDIS_USES_NEW_RETRY_STRATEGY'
    )
  } else {
    log.debug(
      'kth-node-redis: Client will use old retry strategy - consider trying FEATURE_REDIS_USES_NEW_RETRY_STRATEGY'
    )
  }

  const config = { ...Global.defaults, ...options }
  const client = redis.createClient(config)

  const callbackOnce = _once(callback)
  Global.clients[name] = client
  Global.clients[name].log = log

  log.debug({ clients: Object.keys(Global.clients) }, 'kth-node-redis: Redis clients')

  const eventHandlers = {}

  eventHandlers.connect = () => {
    log.debug(`kth-node-redis: Redis connected: ${name}`)
  }

  eventHandlers.ready = () => {
    const redisVersion =
      client != null &&
      typeof client === 'object' &&
      client.server_info != null &&
      typeof client.server_info === 'object'
        ? client.server_info.redis_version || 'n/a'
        : 'n/a'

    log.debug(`kth-node-redis: Redis client ready: ${name}`)
    log.debug(`kth-node-redis: Redis server version: ${redisVersion}`)

    isReady = true
    callbackOnce(null, client)
  }

  eventHandlers.warning = error => {
    log.warn('kth-node-redis: Redis client warning', { error })
  }

  eventHandlers.error = error => {
    log.error('kth-node-redis: Redis client error', { error })
    callbackOnce(error)

    if (__USE_NEW_RETRY_STRATEGY__) {
      const createNewClient = () => _createClient(name, options, () => {})
      ManualReconnect.checkErrorAndReconnectIfNeeded({ name, error, createNewClient })
    }
  }

  eventHandlers.reconnecting = () => {
    log.debug(`kth-node-redis: Redis client reconnecting: ${name}`)
  }

  eventHandlers.end = () => {
    log.debug(`kth-node-redis: Redis client end: ${name}`)

    client.quit()
    delete Global.clients[name]

    if (__USE_NEW_RETRY_STRATEGY__) {
      ManualReconnect.markClientAsDisconnected(name)
    }

    const stillConnectedClients = Object.keys(Global.clients)
    log.debug(
      { stillConnectedClients },
      `kth-node-redis: Number of still connected Redis clients: ${stillConnectedClients.length}`
    )

    if (!isReady) {
      log.fatal('kth-node-redis: Failed to connect to Redis')
      callbackOnce(new Error('kth-node-redis: Failed to connect to Redis'))
    }
  }

  Object.keys(eventHandlers).forEach(eventName => {
    client.on(eventName, eventHandlers[eventName])
  })

  if (__USE_NEW_RETRY_STRATEGY__) {
    ManualReconnect.memorizeNewClient({ name, client, config, eventHandlers, log })
  }
}

/**
 * Creates a new client or uses an existing client.
 *
 * @param {String} name - Name of the Redis instance.
 * @param {Object} options - Redis configuration.
 *
 * @returns {Promise<redis.RedisClient>}
 * @throws
 */
function getClient(name, options) {
  const _name = name || Global.defaultName
  const client = Global.clients[_name]

  if (client) {
    logger.debug(`kth-node-redis: Redis using client: ${_name}`)
    return Promise.resolve(client)
  }

  return new Promise((resolve, reject) => {
    _createClient(_name, options, (err, client2) => {
      if (err) {
        reject(err)
      } else {
        resolve(client2)
      }
    })
  })
}

/**
 * Get Redis client based on the given client name.
 *
 * @param {*} name The name of the client to get.
 * @param {*} options given options for Redis client
 *
 * @returns {Promise<redis.RedisClient>}
 */
function getRedisClient(name, options) {
  const _name = name || Global.defaultName
  let client = Global.clients[_name]
  if (client) {
    return client
  }

  const config = { ...Global.defaults, ...options }
  client = redis.createClient(config)
  Global.clients[_name] = client

  client.on('end', () => {
    client = null
    delete Global.clients[_name]
  })
  return client
}

/**
 * Get a connected Redis client or a Promise if the given client is not connected.
 *
 * @param {string} clientName the name of the client to get.
 *
 * @returns {redis.RedisClient|Promise<redis.RedisClient>}
 *      Promise that resolves to a Redis client or a Redis client if already connected.
 * @throws
 */
function getConnectedRedisClient(clientName) {
  const client = Global.clients[clientName]
  if (!client) {
    if (__USE_OLD_RETRY_STRATEGY__) {
      throw new Error(`kth-node-redis: No such client: ${clientName}`)
    }
    if (__USE_NEW_RETRY_STRATEGY__) {
      return Promise.reject(new Error(`kth-node-redis: No such client: ${clientName}`))
    }
  }

  if (__USE_OLD_RETRY_STRATEGY__) {
    if (client.connected) {
      return client
    }
  }

  return new Promise((resolve, reject) => {
    if (__USE_NEW_RETRY_STRATEGY__) {
      if (client.connected) {
        resolve(client)
        return
      }
    }
    client.on('ready', () => {
      resolve(client)
    })
    client.on('error end warning', err => {
      reject(err)
    })
  })
}

/**
 * Helper to close a Redis client connection by its name.
 *
 * @param {String} name - Name of the Redis instance.
 */
function quit(name) {
  const _name = name || Global.defaultName
  const client = Global.clients[_name]

  if (client) {
    // triggers end event
    client.quit()
  }
}
