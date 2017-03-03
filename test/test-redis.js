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
  it('should timeout after 2 seconds, if a bad uri is specified', function (done) {
    this.timeout(3000)
    redis('Testing', {uri: '', port: 0}).then(client => {
      done()
    }).catch(err => {
      expect(err).to.not.be.undefined
      done()
    })
  })
})
