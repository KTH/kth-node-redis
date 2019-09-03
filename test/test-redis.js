/* eslint-env mocha */
/* eslint-disable no-unused-expressions */

const expect = require("chai").expect;
const mockRedis = require("redis-mock");

mockRedis.Multi = {
  prototype: Object.create(null)
};

const mockery = require("mockery");

const mockLogger = {};
mockLogger.error = mockLogger.debug = mockLogger.info = mockLogger.warn = function() {};
mockLogger.child = function() {
  return mockLogger;
};

mockery.registerMock("kth-node-log", mockLogger);
mockery.registerMock("redis", mockRedis);
mockery.enable({
  warnOnUnregistered: false
});

const redis = require("../");

describe("Redis", function() {
  it("should timeout after 2 seconds, if a bad uri is specified", function(done) {
    this.timeout(3000);
    redis("Testing", { uri: "", port: 0 })
      .then(client => {
        done();
      })
      .catch(err => {
        expect(err).to.not.be.undefined;
        done();
      });
  });

  it("should resolve a client with a default config", function() {
    let client = redis.getClient("default");
    expect(client).to.not.be.undefined;
  });

  it("should return a client on a connectClient call", function() {
    redis.getClient("default");
    let connectedClient = redis.connectClient("default");
    expect(connectedClient.constructor.name).to.be.equal("RedisClient");
  });

  it("should return a promise on a connectClient call", function() {
    let client = redis.getClient("default");
    client.connected = false;
    let connectedClient = redis.connectClient("default");
    expect(connectedClient.constructor.name).to.be.equal("Promise");
  });
});
