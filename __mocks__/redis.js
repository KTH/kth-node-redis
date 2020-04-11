const mockRedis = require('redis-mock')

mockRedis.Multi = {
  prototype: Object.create(null),
}

module.exports = mockRedis
