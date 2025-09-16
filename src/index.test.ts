import * as redis from 'redis'
import { parseConfig, isAzureServer } from './config'
import { createStrategy } from './reconnect-strategy'
import { KthRedisConfig } from './types'
import { getClient } from './index'

jest.mock('./config')
jest.mock('./reconnect-strategy')
jest.mock('redis', () => ({ createClient: jest.fn(() => mockClient) }))

/* 
  ⚠️ Warning: Unique (random) client names are needed for each test ⚠️
  The global list of clients will not reset between tests.
  To avoid interference, use "randomizeName" for each new client.
*/

const randomizeName = () => 'testClient_' + (Math.random() + 1).toString(36).substring(2)

const mockClient = {
  on: jest.fn(),
  connect: jest.fn(),
  isOpen: true,
  isReady: true,
}
const mockParseConfig = parseConfig as jest.Mock
const mockIsAzureServer = isAzureServer as jest.Mock
const mockCreateStrategy = createStrategy as jest.Mock

describe('Create client', () => {
  beforeEach(() => {
    mockParseConfig.mockReturnValue({})
  })
  afterEach(() => {
    jest.clearAllMocks()
    jest.restoreAllMocks()
  })
  it('Connects to client with a name', async () => {
    await getClient('testClientName')

    expect(redis.createClient).toHaveBeenCalledWith(expect.objectContaining({ name: 'testClientName' }))
  })
  it('Uses config parser', async () => {
    const myConfig = { setting1: 1, setting2: 2 } as unknown as KthRedisConfig

    const parsedConfig = { setting1: 1, addedSetting: 'new stuff' }

    mockParseConfig.mockReturnValueOnce(parsedConfig)

    await getClient(randomizeName(), myConfig)

    expect(parseConfig).toHaveBeenCalledWith(myConfig)
    expect(redis.createClient).toHaveBeenCalledWith(expect.objectContaining({ setting1: 1, addedSetting: 'new stuff' }))
  })
  it('Adds a retry strategy', async () => {
    const mockStrategy = () => {}

    mockCreateStrategy.mockReturnValueOnce(mockStrategy)

    await getClient(randomizeName())

    expect(mockCreateStrategy).toHaveBeenCalledWith(expect.any(Function))
    expect(redis.createClient).toHaveBeenCalledWith(
      expect.objectContaining({ socket: { reconnectStrategy: mockStrategy } })
    )
  })
  describe('Add pingInterval on Azure servers', () => {
    it('checks if config points to Azure server', async () => {
      const myConfig = { url: 'server.to.check' }
      mockParseConfig.mockReturnValueOnce(myConfig)

      // mockIsAzureServer.mockReturnValueOnce(true)
      await getClient(randomizeName())
      expect(mockIsAzureServer).toHaveBeenCalledWith(myConfig)
    })
    it('Sets pingInterval for Azure servers', async () => {
      mockIsAzureServer.mockReturnValueOnce(true)
      await getClient(randomizeName())
      expect(redis.createClient).toHaveBeenCalledWith(expect.objectContaining({ pingInterval: 5 * 60 * 1000 }))
    })

    it('Does not set pingInterval for non-Azure servers', async () => {
      mockIsAzureServer.mockReturnValueOnce(false)
      await getClient(randomizeName())
      expect(redis.createClient).not.toHaveBeenCalledWith(expect.objectContaining({ pingInterval: expect.anything() }))
    })
  })
})
