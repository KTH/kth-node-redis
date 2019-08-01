'use strict'

const logger = require('kth-node-log')
const redis = require('redis')
const Promise = require('bluebird')
const deepAssign = require('deep-assign')
const { safeGet } = require('safe-utils')

Promise.promisifyAll(redis.RedisClient.prototype)
Promise.promisifyAll(redis.Multi.prototype)

const _defaults = {
  retry_strategy: function (options) {
    if (safeGet(() => options.error.code === 'ECONNREFUSED')) {
      return new Error('Connection refused by server.')
    }

    if (safeGet(() => options.total_retry_time > 1000 * 60 * 60)) {
      return new Error('Retry time exhausted')
    }

    if (safeGet(() => options.times_connected > 10)) {
      return undefined
    }

    return Math.max(options.attempt * 100, 3000)
  },
  connect_timeout: 10000 // for initially connecting to redis. This prevents hanging on a bad REDIS_URI (increased to 10s due to Azure)
}

const _defaultName = 'default'

let _clients = {}

function _once (fn) {
  let called = false
  let value = false

  return function () {
    if (called) {
      return value
    }

    value = fn.apply(this, arguments)
    called = true
    return value
  }
}

/**
 * Creates a Redis client based on the given name and options.
 * @param {*} name the given name for the Redis client.
 * @param {*} options the given options for the Redis client.
 * @param {*} callback
 */
function _createClient (name, options, callback) {
  const log = logger.child({ redis: name })
  log.debug('Redis creating client: ' + name)
  let isReady = false

  const config = {}
  deepAssign(config, _defaults, options)
  let client = redis.createClient(config)

  callback = _once(callback)
  _clients[ name ] = client
  _clients[ name ].log = log

  log.debug({ clients: Object.keys(_clients) }, 'Redis clients')

  client.on('error', function (err) {
    log.error({ err: err }, 'Redis client error')
    callback(err)
  })

  client.on('warning', function (err) {
    log.warn({ err: err }, 'Redis client warning')
  })

  client.on('connect', function () {
    log.debug('Redis connected: ' + name)
  })

  client.on('ready', function () {
    log.debug('Redis client ready: ' + name)
    log.debug(`Redis server version: ${safeGet(() => client.server_info.redis_version)}`)
    isReady = true
    callback(null, client)
  })

  client.on('reconnecting', function () {
    log.debug('Redis client reconnecting: ' + name)
  })

  client.on('end', function () {
    log.debug('Redis client end: ' + name)
    // Close the connection before removing reference.
    client.quit()
    client = null
    delete _clients[ name ]
    log.debug({ clients: Object.keys(_clients) }, 'Redis clients: ' + _clients.length)
    if (!isReady) {
      callback(new Error('Done - Failed to connect to Redis'))
    }
  })
}

/**
 * Creates a new client or uses an existing client.
 * @param {String} name - Name of the Redis instance.
 * @param {Object} options - Redis configuration.
 * @returns {Promise} Promise that resolves to a Redis client.
 */
module.exports = function (name, options) {
  name = name || _defaultName
  let client = _clients[ name ]

  if (client) {
    logger.debug(`Redis using client: ${name}`)
    return Promise.resolve(client)
  }

  return new Promise(function (resolve, reject) {
    _createClient(name, options, function (err, client) {
      if (err) {
        reject(err)
      } else {
        resolve(client)
      }
    })
  })
}

/**
 * Get Redis client based on the given client name.
 * @param {*} name The name of the client to get.
 * @param {*} options given options for Redis client
 */
module.exports.getClient = function (name, options) {
  name = name || _defaultName
  let client = _clients[ name ]
  if (client) {
    return client
  }

  const config = {}
  deepAssign(config, _defaults, options)
  client = redis.createClient(config)
  _clients[ name ] = client

  client.on('end', function () {
    client = null
    delete _clients[ name ]
  })
  return client
}

/**
 * Get a connected Redis client or a Promise if the given client is not connected.
 * @param {*} clientName the name of the client to get.
 * @returns {Promise} Promise that resolves to a Redis client or a Redis client if already connected.
 */
module.exports.connectClient = function (clientName) {
  let client = _clients[ clientName ]
  if (!client) throw new Error('No such client: ' + clientName)
  if (client.connected) return client // we are connected
  return new Promise((resolve, reject) => {
    client.on('ready', function () {
      resolve(client)
    })
    client.on('error end warning', function (err) {
      reject(err)
    })
  })
}

/**
 * Helper to close a Redis client connection by its name.
 * @param {String} name - Name of the Redis instance.
 */
module.exports.quit = function (name) {
  name = name || _defaultName
  let client = _clients[ name ]
  if (client) {
    // triggers end event
    client.quit()
  }
}
