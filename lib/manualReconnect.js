/* eslint no-use-before-define: ["error", "nofunc"] */

// @ts-check

module.exports = {
  memorizeNewClient,
  markClientAsDisconnected,
  checkErrorAndReconnectIfNeeded,
  forgetDisconnectedClient,
}

const TIME_TO_WAIT_BEFORE_RECONNECT = 10000

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
 */
function memorizeNewClient({ name, client, config, eventHandlers, log }) {
  forgetDisconnectedClient(name)

  Global.clientData[name] = {
    redisClient: client,
    options: config,
    handlers: eventHandlers,
    log,
    disconnected: false,
  }

  if (Global.reconnectCounters[name] == null) {
    Global.reconnectCounters[name] = 0
  }
}

/**
 * @param {string} name internal ID of Redis client, e.g. "programApi"
 */
function markClientAsDisconnected(name) {
  if (Global.clientData[name] == null) {
    logger.error(
      'kth-node-redis: _markClientAsDisconnected() failed ' +
        `- no data found for client with name "${name}"`
    )
    return
  }

  const now = new Date().getTime()
  Global.clientData[name].disconnected = now
}

/**
 * @param {object} input
 * @param {string} input.name internal ID of Redis client, e.g. "programApi"
 * @param {object} input.error error from event handler of Redis client
 * @param {function} input.createNewClient callback which can be used to reconnect Redis
 */
function checkErrorAndReconnectIfNeeded({ name, error, createNewClient }) {
  if (error.code !== 'NR_CLOSED') {
    return
  }

  if (Global.clientData[name] == null) {
    logger.error(
      'kth-node-redis - checkErrorAndReconnectIfNeeded() failed ' +
        `- no data found for client with name "${name}"`
    )
    return
  }

  const { disconnected, log } = Global.clientData[name]

  if (!disconnected) {
    log.error(
      'kth-node-redis - checkErrorAndReconnectIfNeeded() failed ' +
        `- client is still marked as connected (name "${name}")`
    )
    return
  }

  const now = new Date().getTime()
  const timeSinceDisconnect = now - disconnected
  const secondsSinceDisconnect = Math.floor(timeSinceDisconnect / 1000)

  if (timeSinceDisconnect <= TIME_TO_WAIT_BEFORE_RECONNECT) {
    log.warn('kth-node-redis - skipping manually reconnect because of active disconnect timeout')
    return
  }

  Global.reconnectCounters[name] += 1
  log.info(
    `kth-node-redis - Initiating manual reconnect #${Global.reconnectCounters[name]} ` +
      `of client "${name}" (disconnected ${secondsSinceDisconnect} seconds ago)`
  )

  createNewClient()
}

/**
 * @param {string} name internal ID of Redis client, e.g. "programApi"
 */
function forgetDisconnectedClient(name) {
  if (Global.clientData[name] == null) {
    return
  }

  const { disconnected, redisClient, handlers, log } = Global.clientData[name]

  if (!disconnected) {
    log.error(
      'kth-node-redis: Unexpectedly found still connected client ' +
        `while establishing another connection with same name "${name}"`
    )
    return
  }

  Object.keys(handlers).forEach(eventName => {
    redisClient.off(eventName, handlers[eventName])
  })

  delete Global.clientData[name]
}
