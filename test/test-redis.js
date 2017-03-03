/* eslint-env mocha */

const expect = require('chai').expect
const mockery = require('mockery')

const mockLogger = {}
mockLogger.error = mockLogger.debug = mockLogger.info = mockLogger.warn = function () {}
mockLogger.child = function () {
  return mockLogger
}
// mockLogger.error = mockLogger.debug = mockLogger.info = mockLogger.warn = console.log

mockery.registerMock('kth-node-log', mockLogger)
mockery.enable({
  warnOnUnregistered: false
})

const redis = require('../')

describe('Redis', function () {
  it('should get a standard config, with a connect_timeout of 2 seconds, if none is specified', function (done) {
    redis('Testing', {url: null, port: null}).then(client => {
      expect(client.connect_timeout).to.equal(2000)
      done()
    })
  })
})
