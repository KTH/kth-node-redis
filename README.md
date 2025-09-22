# kth-node-redis

Redis client module for Node.js.  
It can keep multiple active client, differentiated by the "name" parameter.

## Usage

### getClient

An async operation, that creates and connects a client.  
Will reuse and/or reconnect existing clients with the same name.

```javascript
import { getClient } from 'kth-node-redis'
// const redis = require('kth-node-redis') // alternative default import

// basics
getClient('default', {
  /* optional redis client config */
})
  .then(function (client) {
    return client.get('key')
  })
  .then(function (value) {
    // do something with value
  })
  .catch(function (err) {
    // handle error
  })

// multi
getClient('default', {
  /* optional redis client config */
})
  .then(function (client) {
    return client.multi().hSet('foo', { value: 'bar' }).expire('foo', 30).hGetAll('foo').exec()
  })
  .then(function (results) {
    // results[1] => 1
    // results[1] => 1
    // results[2] => { value: 'bar' }
    // results will depend on what commands are executed
  })
  .catch(function (err) {
    // handle error
  })

// quit if needed
getClient('default').then(function (client) {
  client.destroy()
})
```

### createClient

A non-blocking operation that creates a client, without connecting it.  
Useful when you need to supply a client to a third-party library.

The same client names can be used in combination with `getClient`.

```javascript
import { createClient } from 'kth-node-redis'

const myClient = createClient'default', { /* optional redis client config */ })

const externalLib = new ExternalLibrary({redisClient: myClient})
```

## Options

- `name` optional name, defaults to `default`. Use the same name to get
  the same client instance or re-create it. Use a new name to create a
  new instance.
- `options` optional config for the Redis client. Compatible with either:
  - Output from `unpackRedisConfig` in package [kth-node-configuration](https://github.com/KTH/kth-node-configuration)
  - Configuration native to [redis@5](https://raw.githubusercontent.com/redis/node-redis/refs/heads/master/docs/client-configuration.md)

## Migrate 3 -> 4

No more callback based methods.  
Promised based methods have new names.

If used in combination with `@kth/api-call`, that needs to be at least version 4.4.0

If you are using `client.get`, change to a promise based approach like:

```javascript
// Old v3 code
client.get('my_key', data => {
  console.log('got data', data)
})

// New v4 code
const data = await client.get('my_key')
console.log('got data', data)
```

If you are using `client.getAsync`, it should be fine to just use `client.get` instead.
