import { getClient } from './index'
import { parseConfig } from './config'
import * as redis from 'redis'
import { KthRedisConfig } from './types'

jest.mock('./config')
jest.mock('redis', () => ({ createClient: jest.fn(() => mockClient) }))

const mockClient = {
  on: jest.fn(),
  connect: jest.fn(),
  isOpen: true,
  isReady: true,
}
const mockParseConfig = parseConfig as jest.Mock

describe('Create client', () => {
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

    await getClient('testClientConfig', myConfig)

    expect(parseConfig).toHaveBeenCalledWith(myConfig)
    expect(redis.createClient).toHaveBeenCalledWith(expect.objectContaining({ setting1: 1, addedSetting: 'new stuff' }))
  })
})
