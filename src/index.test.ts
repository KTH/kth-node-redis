import * as redis from 'redis'
import { parseConfig, isAzureServer } from './config'
import { createStrategy } from './reconnect-strategy'
import { KthRedisConfig } from './types'
import { getClient, createClient } from './index'

jest.mock('./config')
jest.mock('./reconnect-strategy')
jest.mock('redis', () => ({ createClient: jest.fn(() => mockClient) }))

/* 
  ⚠️ Warning: Unique (random) client names are needed for each test ⚠️
  The global list of clients will not reset between tests.
  To avoid unintentional interference, use "randomizeName" for each new client.
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
const mockCreateClient = redis.createClient as jest.Mock

describe('getClient (creates and connects a client)', () => {
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
  it('Returns a client several times once created', async () => {
    const myClient = {
      ...mockClient,
    }
    mockCreateClient.mockReturnValueOnce(myClient)
    const client1 = await getClient('createOnceClient')
    const client2 = await getClient('createOnceClient')
    const client3 = await getClient('createOnceClient')

    expect(mockCreateClient).toHaveBeenCalledTimes(1)
    expect(client1).toBe(client2)
    expect(client1).toBe(client3)
  })
  it('Only connect a client once while it stays connected', async () => {
    const myClient = {
      ...mockClient,
      isOpen: false,
    }
    myClient.connect = jest.fn(() => (myClient.isOpen = true))
    mockCreateClient.mockReturnValueOnce(myClient)

    await getClient('connectOnceClient')
    await getClient('connectOnceClient')
    await getClient('connectOnceClient')

    expect(myClient.connect).toHaveBeenCalledTimes(1)
  })
  it('Attempt to connect client again if it exists but is not open', async () => {
    const myClient = {
      ...mockClient,
      isOpen: true,
    }
    myClient.connect = jest.fn(() => (myClient.isOpen = true))
    mockCreateClient.mockReturnValueOnce(myClient)

    await getClient('needsReconnectClient')

    myClient.connect.mockReset()
    myClient.isOpen = false
    await getClient('needsReconnectClient')

    expect(myClient.connect).toHaveBeenCalled()
  })
  it('Throw error if client fails to connect', async () => {
    const myClient = {
      ...mockClient,
      isOpen: false,
      isReady: false,
    }
    mockCreateClient.mockReturnValueOnce(myClient)

    await expect(getClient(randomizeName())).rejects.toThrow()
  })

  it('Deletes a client that fails to connect', async () => {
    const failingClient = {
      ...mockClient,
      isOpen: false,
      isReady: false,
    }
    mockCreateClient.mockReturnValueOnce(failingClient)

    await expect(getClient('failedAndDeletedClient')).rejects.toThrow()

    const workingClient = {
      ...mockClient,
      isOpen: true,
      isReady: true,
    }
    mockCreateClient.mockReturnValueOnce(workingClient)

    await getClient('failedAndDeletedClient')
    expect(mockCreateClient).toHaveBeenCalledTimes(2) // Client was deleted and created again on second call
  })
})

describe('createClient (creates a client)', () => {
  beforeEach(() => {
    mockParseConfig.mockReturnValue({})
  })
  afterEach(() => {
    jest.clearAllMocks()
    jest.restoreAllMocks()
  })
  it('Creates a client with a name', () => {
    const clientName = 'named_' + randomizeName()

    createClient(clientName)

    expect(redis.createClient).toHaveBeenCalledWith(expect.objectContaining({ name: clientName }))
  })
  it('Uses config parser', () => {
    const myConfig = { setting1: 1, setting2: 2 } as unknown as KthRedisConfig

    const parsedConfig = { setting1: 1, addedSetting: 'new stuff' }

    mockParseConfig.mockReturnValueOnce(parsedConfig)

    createClient(randomizeName(), myConfig)

    expect(parseConfig).toHaveBeenCalledWith(myConfig)
    expect(redis.createClient).toHaveBeenCalledWith(expect.objectContaining({ setting1: 1, addedSetting: 'new stuff' }))
  })
  it('Adds a retry strategy', () => {
    const mockStrategy = () => {}

    mockCreateStrategy.mockReturnValueOnce(mockStrategy)

    createClient(randomizeName())

    expect(mockCreateStrategy).toHaveBeenCalledWith(expect.any(Function))
    expect(redis.createClient).toHaveBeenCalledWith(
      expect.objectContaining({ socket: { reconnectStrategy: mockStrategy } })
    )
  })
  describe('Add pingInterval on Azure servers', () => {
    it('checks if config points to Azure server', () => {
      const myConfig = { url: 'server.to.check' }
      mockParseConfig.mockReturnValueOnce(myConfig)

      createClient(randomizeName())
      expect(mockIsAzureServer).toHaveBeenCalledWith(myConfig)
    })
    it('Sets pingInterval for Azure servers', () => {
      mockIsAzureServer.mockReturnValueOnce(true)
      createClient(randomizeName())
      expect(redis.createClient).toHaveBeenCalledWith(expect.objectContaining({ pingInterval: 5 * 60 * 1000 }))
    })

    it('Does not set pingInterval for non-Azure servers', () => {
      mockIsAzureServer.mockReturnValueOnce(false)
      createClient(randomizeName())
      expect(redis.createClient).not.toHaveBeenCalledWith(expect.objectContaining({ pingInterval: expect.anything() }))
    })
  })
  it('Returns a client several times once created', () => {
    const clientName = 'createOnce_' + randomizeName()

    const myClient = {
      ...mockClient,
    }
    mockCreateClient.mockReturnValueOnce(myClient)
    const client1 = createClient(clientName)
    const client2 = createClient(clientName)
    const client3 = createClient(clientName)

    expect(mockCreateClient).toHaveBeenCalledTimes(1)
    expect(client1).toBe(client2)
    expect(client1).toBe(client3)
  })
  it('Does not connect the client', () => {
    const clientName = 'doNotConnect_' + randomizeName()

    const myClient = {
      ...mockClient,
      isOpen: false,
    }
    myClient.connect = jest.fn(() => (myClient.isOpen = true))
    mockCreateClient.mockReturnValueOnce(myClient)

    createClient(clientName)

    expect(myClient.connect).not.toHaveBeenCalled()
  })
  it('Does not attempt to connect the client if it exists but is not open', () => {
    const clientName = 'needsReconnect_' + randomizeName()

    const myClient = {
      ...mockClient,
      isOpen: true,
    }
    myClient.connect = jest.fn(() => (myClient.isOpen = true))
    mockCreateClient.mockReturnValueOnce(myClient)

    createClient(clientName)

    myClient.connect.mockReset()
    myClient.isOpen = false
    createClient(clientName)

    expect(myClient.connect).not.toHaveBeenCalled()
  })
})
