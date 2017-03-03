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
  connect_timeout: 2000 // for initially connecting to redis. This prevents hanging on a bad REDIS_URI
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

function _createClient (name, options, callback) {
  const log = logger.child({ redis: name })
  log.debug('Redis creating client')
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
    log.debug('Redis connected')
  })

  client.on('ready', function () {
    log.debug('Redis client ready')
    log.debug({ config: config }, 'Redis client config')
    log.debug(`Redis server version: ${safeGet(() => client.server_info.redis_version)}`)
    isReady = true
    callback(null, client)
  })

  client.on('reconnecting', function () {
    log.debug('Redis client reconnecting')
  })

  client.on('end', function () {
    log.debug('Redis client end')
    client = null
    delete _clients[ name ]
    log.debug({ clients: Object.keys(_clients) }, 'Redis clients')
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
