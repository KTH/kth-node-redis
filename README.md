# kth-node-redis

Redis client module for Node.js. Everything with Promises!

## Usage

```javascript
const redis = require('kth-redis');

// basics
redis('default', { /* optional redis client config */ })
  .then(function(client) {
    return client.getAsync('key');
  })
  .then(function(value) {
    // do something with value
  })
  .catch(function(err) {
    // handle error
  });

// multi
redis('default', { /* optional redis client config */ })
  .then(function(client) {
    return client.multi()
      .hmset('foo', { value: 'bar' })
      .expire('foo', 30)
      .hgetall('foo')
      .execAsync();
  })
  .then(function(results) {
    // results[1] => 'OK'
    // results[1] => 1
    // results[2] => { value: 'bar' }

    // results will depend on what commands are executed
  })
  .catch(function(err) {
    // handle error
  });

// quit if needed
redis.quit('default');
```

## Options

- `name` optional name, defaults to `default`. Use the same name to get
  the same client instance or re-create it. Use a new name to create a
  new instance.
- `options` optional config for the Redis client. Has a default retry
  strategy. See below for details. For info about the Redis client
  options, see https://www.npmjs.com/package/redis.

## Default retry strategy

```javascript
function retry_strategy(options) {
  if (options.error.code === 'ECONNREFUSED') {
    return new Error('Connection refused by server.');
  }

  if (options.total_retry_time > 1000 * 60 * 60) {
    return new Error('Retry time exhausted');
  }

  if (options.times_connected > 10) {
    return undefined;
  }

  return Math.max(options.attempt * 100, 3000);
}
```
