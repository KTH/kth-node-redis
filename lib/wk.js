function _once(fn) {
  let called = false
  let value
  return (...args) => {
    if (!called) {
      value = fn.apply(fn, args)
      called = true
    }
    return value
  }
}

function _createTest(name, options, callback) {
  const callbackOnce = _once(myCallback)
  const client = {
    callbackOnce,
  }
  return client
}
function myCallback(error) {
  console.log('this is myCallback', error)
}
//const myclient = Promise.resolve(getClient('wk', { msg: 'hej' }, myCallback))

const myclient = _createTest('wk', { msg: 'hej' }, myCallback)

console.log('myclient', myclient)
myclient.callbackOnce('client 1')
myclient.callbackOnce('client 2')
myclient.callbackOnce('client 3')

const callbackOnce = _once(myCallback)
callbackOnce('1')
callbackOnce('2')
callbackOnce('3')
callbackOnce('4')
