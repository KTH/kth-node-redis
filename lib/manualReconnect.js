/* eslint no-use-before-define: ["error", "nofunc"] */

// @ts-check

module.exports = {
  memorizeNewClient,
  markClientAsDisconnected,
  checkErrorAndReconnectIfNeeded,
  forgetDisconnectedClient,
}

const TIME_TO_WAIT_BEFORE_RECONNECT = process.env.NODE_ENV === 'test' ? 1000 : 10000

const logger = require('kth-node-log')

const Global = {
  clientData: {},
  reconnectCounters: {},
  lastReconnect: {},
}

/**
 * @param {object} input
 * @param {string} input.name internal ID of Redis client, e.g. "programApi"
 * @param {object} input.client RedisClient
 * @param {object} input.config options used during redis.createClient()
 * @param {object} input.eventHandlers list of event handlers registered with client
 * @param {object} input.log logging service
 *
 * @returns {boolean} True iff data was memorized
 */
function memorizeNewClient({ name, client, config, eventHandlers, log }) {
  forgetDisconnectedClient(name)

  Global.clientData[name] = {
    redisClient: client,
    options: config,
    handlers: eventHandlers,
    log,
    disconnectedTimestamp: null,
  }

  if (Global.reconnectCounters[name] == null) {
    Global.reconnectCounters[name] = 0
  }

  return true
}

/**
 * @param {string} name internal ID of Redis client, e.g. "programApi"
 *
 * @returns {boolean} True iff the memorized client was marked as disconnected
 */
function markClientAsDisconnected(name) {
  if (Global.clientData[name] == null) {
    logger.error('kth-node-redis: markClientAsDisconnected() failed - no data found for client', {
      name,
    })
    return false
  }

  const { disconnectedTimestamp, log } = Global.clientData[name]
  const now = new Date()

  if (disconnectedTimestamp != null) {
    const before = new Date().setTime(disconnectedTimestamp)
    log.info('kth-node-redis: Redis client was already marked as disconnected before', {
      name,
      before,
      now,
    })
    return true
  }

  Global.clientData[name].disconnectedTimestamp = now.getTime()
  log.info('kth-node-redis: Redis client marked as disconnected', { name, now })

  return true
}

/**
 * @param {object} input
 * @param {string} input.name internal ID of Redis client, e.g. "programApi"
 * @param {object} input.error error from event handler of Redis client
 * @param {function} input.createNewClient callback which can be used to reconnect Redis
 *
 * @returns {boolean} True iff new client connection was initiated
 */
function checkErrorAndReconnectIfNeeded({ name, error, createNewClient }) {
  const errorCodesRelatedToLostConnection = ['NR_CLOSED']
  if (!errorCodesRelatedToLostConnection.includes(error.code)) {
    return false
  }

  if (Global.clientData[name] == null) {
    logger.error(
      'kth-node-redis - checkErrorAndReconnectIfNeeded() failed - no data found for client',
      { name }
    )
    return false
  }

  const { disconnectedTimestamp, log } = Global.clientData[name]

  const connected = disconnectedTimestamp == null
  if (connected) {
    log.error(
      'kth-node-redis - checkErrorAndReconnectIfNeeded() failed - client is still marked as connected',
      { name }
    )
    return false
  }

  const now = new Date()
  const timeSinceDisconnect = now.getTime() - disconnectedTimestamp

  const disconnect = new Date().setTime(disconnectedTimestamp)

  if (timeSinceDisconnect <= TIME_TO_WAIT_BEFORE_RECONNECT) {
    log.warn('kth-node-redis - skipping manually reconnect because of active disconnect timeout', {
      disconnect,
      now,
      timeSinceDisconnect,
      TIME_TO_WAIT_BEFORE_RECONNECT,
    })
    return false
  }

  Global.reconnectCounters[name] += 1

  const reconnectNumber = Global.reconnectCounters[name]
  log.info('kth-node-redis - Initiating manual reconnect of Redis client', {
    reconnectNumber,
    name,
    disconnect,
    now,
    timeSinceDisconnect,
  })

  createNewClient()
  return true
}

/**
 * @param {string} name internal ID of Redis client, e.g. "programApi"
 *
 * @returns {boolean} True iff some old client data was cleaned up
 */
function forgetDisconnectedClient(name) {
  if (Global.clientData[name] == null) {
    return false
  }

  const { disconnectedTimestamp, redisClient, handlers, log } = Global.clientData[name]

  const connected = disconnectedTimestamp == null
  if (connected) {
    log.error(
      'kth-node-redis: Unexpectedly found still connected client while establishing another connection with same name',
      { name }
    )
    return false
  }

  logger.info('kth-node-redis: Cleaning up earlier disconnected Redis client', { name })

  redisClient.end(false)

  Object.keys(handlers).forEach(eventName => {
    redisClient.off(eventName, handlers[eventName])
  })
  redisClient.on('error', () => {
    logger.fatal(
      'kth-node-redis: Avoiding unhandled exception ' +
        '- Earlier disconnected Redis client unexpectedly still receives error messages ' +
        '- Are you caching the Redis client in your application?',
      { name }
    )
  })

  delete Global.clientData[name]

  return true
}
