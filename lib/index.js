// @ts-check

const ONE_MINUTE = 60 * 1000

const logger = require('kth-node-log')
const redis = require('redis')
const Promise = require('bluebird')

// const ManualReconnect = require('./manualReconnect')

Promise.promisifyAll(redis.RedisClient.prototype)
Promise.promisifyAll(redis.Multi.prototype)

const Global = {
  clients: {},
  defaultName: 'default',
}

function _getDefaultRedisOptions(name) {
  const defaults = {
    retry_strategy: options => {
      const retryInfo = { name }

      if (options != null && typeof options === 'object') {
        retryInfo.attempt = options.attempt
        retryInfo.totalRetryTime = options.total_retry_time
        retryInfo.timesConnected = options.times_connected
        retryInfo.errorCode = options.error != null && typeof options.error === 'object' ? options.error.code : null
      }

      // if (retryInfo.errorCode === 'ECONNREFUSED') {
      //   logger.fatal('kth-node-redis - retry_strategy() got ECONNREFUSED', retryInfo)
      //   return new Error('Connection refused by server.')
      // }

      if (retryInfo.totalRetryTime > 60 * ONE_MINUTE) {
        logger.fatal('kth-node-redis - retry_strategy() got exceeded total_retry_time', retryInfo)
        return new Error('Retry time exhausted')
      }

      if (retryInfo.timesConnected > 10) {
        logger.fatal('kth-node-redis - retry_strategy() got exceeded times_connected', retryInfo)
        return undefined
      }

      const delay = retryInfo.timesConnected ? Math.min(retryInfo.timesConnected * 300, 60000) : 60000
      logger.info(`kth-node-redis - retry_strategy() is requesting retry after ${delay} ms`, retryInfo)
      return delay
    },
  }
  return defaults
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
  // let isReady = false

  const defaultConfig = _getDefaultRedisOptions(name)
  const config = { ...defaultConfig, ...options }
  const client = redis.createClient(config)

  const callbackOnce = _once(callback)
  Global.clients[name] = client
  Global.clients[name].log = log

  log.debug('kth-node-redis: Redis clients', { clients: Object.keys(Global.clients) })

  const eventHandlers = {}

  eventHandlers.connect = () => {
    log.debug(`kth-node-redis: Redis connected: ${name}`, { event: 'connect' })
  }

  eventHandlers.ready = () => {
    const redisVersion =
      client != null &&
      typeof client === 'object' &&
      client.server_info != null &&
      typeof client.server_info === 'object'
        ? client.server_info.redis_version || 'n/a'
        : 'n/a'

    log.info(`kth-node-redis: Redis client ready: ${name}`, { event: 'ready' })
    log.debug(`kth-node-redis: Redis server version: ${redisVersion}`)

    // isReady = true
    callbackOnce(null, client)
  }

  eventHandlers.warning = error => {
    log.warn('kth-node-redis: Redis client warning', { event: 'warning', error })
  }

  eventHandlers.error = error => {
    log.error('kth-node-redis: Redis client error', { event: 'error', error })
    callbackOnce(error)

    // const createNewClient = () => _createClient(name, options, () => {})
    // ManualReconnect.checkErrorAndReconnectIfNeeded({ name, error, createNewClient })
  }

  eventHandlers.reconnecting = () => {
    log.debug(`kth-node-redis: Redis client reconnecting: ${name}`, { event: 'reconnecting' })
  }

  eventHandlers.end = () => {
    // log.debug(`kth-node-redis: Redis client end: ${name}`, { event: 'end', isReady })
    log.debug(`kth-node-redis: Redis client end: ${name}`, { event: 'end' })

    // client.quit()
    delete Global.clients[name]

    //   ManualReconnect.markClientAsDisconnected(name)

    //   const stillConnectedClients = Object.keys(Global.clients)
    //   log.debug(
    //     { stillConnectedClients },
    //     `kth-node-redis: Number of still connected Redis clients: ${stillConnectedClients.length}`
    //   )

    //   if (!isReady) {
    //     log.fatal('kth-node-redis: Failed to connect to Redis')
    //     callbackOnce(new Error('kth-node-redis: Failed to connect to Redis'))
    //   }
  }

  Object.keys(eventHandlers).forEach(eventName => {
    client.on(eventName, eventHandlers[eventName])
  })

  // ManualReconnect.memorizeNewClient({ name, client, config, eventHandlers, log })
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
 * @returns {redis.RedisClient}
 */
function getClientAlternative(name, options) {
  const _name = name || Global.defaultName
  let client = Global.clients[_name]

  logger.debug('kth-node-redis', {
    redis: _name,
    moment: 'app called function exported as redis.getClient()',
    note: 'deprecated function?!',
  })

  if (client) {
    return client
  }

  const defaultConfig = _getDefaultRedisOptions(name)
  const config = { ...defaultConfig, ...options }
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
 * @returns {Promise<redis.RedisClient>}
 *      Resolves with the connected Redis client
 * @throws
 */
function getConnectedRedisClient(clientName) {
  logger.debug('kth-node-redis', {
    redis: clientName,
    moment: 'app called function exported as redis.connectClient()',
    note: 'deprecated function?!',
  })

  const client = Global.clients[clientName]
  if (!client) {
    return Promise.reject(new Error(`kth-node-redis: No such client: ${clientName}`))
  }

  return new Promise((resolve, reject) => {
    if (client.connected) {
      resolve(client)
      return
    }
    client.on('ready', () => {
      resolve(client)
    })
    client.on('error end warning', err => {
      reject(err)
    })
  })
}

function _getStackTrace() {
  const errorId = 'dummy error to get stack trace'
  const { stack } = new Error(errorId)

  const outputLines = stack
    .split('\n')
    .filter(line => !line.includes(errorId) && !line.includes('_getStackTrace'))
    .map(line => line.replace(/^\s+(at )?/, ''))

  return outputLines
}

/**
 * Helper to close a Redis client connection by its name.
 *
 * @param {String} name - Name of the Redis instance.
 */
function quit(name) {
  const _name = name || Global.defaultName
  const client = Global.clients[_name]

  logger.debug('kth-node-redis', {
    redis: _name,
    moment: 'app called function exported as redis.quit()',
    stack: _getStackTrace(),
  })

  if (client) {
    // triggers end event
    client.quit()
  }
}

module.exports = getClient
module.exports.getClient = getClientAlternative
module.exports.connectClient = getConnectedRedisClient
module.exports.quit = quit

module.exports._testInternals = {
  async resetRedisClients() {
    const activeClients = Object.values(Global.clients)
    if (activeClients.length > 0) {
      if (activeClients[0]._redisMock != null) {
        activeClients[0]._redisMock.removeAllListeners()
      }
      await Promise.all(activeClients.map(client => new Promise(resolve => client.quit(resolve))))
    }
    Global.clients = {}
  },
  listRedisClients() {
    return Global.clients
  },
}
