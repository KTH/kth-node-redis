// @ts-check

const mocks = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  fatal: jest.fn(),
}

const child = jest.fn(() => mocks)

function _listAllCalls() {
  const allCalls = {}

  const mockedFunctions = Object.keys(mocks)
  mockedFunctions.forEach(name => {
    const { calls } = mocks[name].mock
    if (calls.length > 0) {
      allCalls[name] = calls
    }
  })

  return allCalls
}

function _clearAllCalls() {
  child.mockClear()
  Object.values(mocks).forEach(func => func.mockClear())
}

module.exports = {
  ...mocks,
  child,
  _listAllCalls,
  _clearAllCalls,
}
