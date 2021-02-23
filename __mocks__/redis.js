const mockRedis = require('redis-mock')

mockRedis.Multi = {
  prototype: Object.create(null),
}

mockRedis.createClient = jest.fn(mockRedis.createClient)

module.exports = mockRedis
