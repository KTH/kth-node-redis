const mockLogger = {
  error: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
}

mockLogger.child = jest.fn(() => mockLogger)

module.exports = mockLogger
