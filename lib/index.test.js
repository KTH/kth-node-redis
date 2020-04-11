/* eslint-disable func-names */
/* eslint-disable import/no-extraneous-dependencies */

const { Promise } = require('bluebird')
const { RedisClient } = require('redis')
const redis = require('..')

describe('Redis', function () {
  it.skip('- WAS NEVER WORKING EXACTLY!? - should timeout after 2 seconds, if a bad uri is specified', async () => {
    const runAsync = () => redis('Testing', { uri: '', port: 0 })
    await expect(runAsync()).rejects.toThrow()
  }, 3000)

  it('should resolve with a client with a default config', () => {
    const client = redis.getClient('default')
    expect(client).toBeInstanceOf(RedisClient)
  })

  it('should return a promise on a connectClient call', () => {
    const client = redis.getClient('default')
    client.connected = false

    const connectedClient = redis.connectClient('default')
    expect(connectedClient).toBeInstanceOf(Promise)
  })

  it('should resolve with a client on a connectClient call', async () => {
    redis.getClient('default')

    const connectedClient = await redis.connectClient('default')
    expect(connectedClient).toBeInstanceOf(RedisClient)
  })
})
