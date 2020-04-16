/* eslint no-use-before-define: ["error", "nofunc"] */

// @ts-check

const mocks = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  fatal: jest.fn(),
}

module.exports = {
  ...mocks,
  child: jest.fn(() => mocks),
  _listAllCalls,
  _clearAllCalls,
}

function _listAllCalls() {
  const allCalls = {}
  let foundCall = false

  const mockedFunctions = Object.keys(mocks)

  mockedFunctions.forEach(name => {
    const { calls } = mocks[name].mock
    if (calls.length > 0) {
      foundCall = true
      allCalls[name] = calls
    }
  })

  return foundCall ? allCalls : null
}

function _clearAllCalls() {
  Object.values(mocks).forEach(func => func.mockClear())
}
