import { LockManager } from 'mongo-locks'
import { MongoClient } from 'mongodb'

import { prepareDb } from '~/src/mongo.js'

const mockLogger = /** @type {any} */ ({
  info: jest.fn()
})

jest.mock('mongodb')
jest.mock('mongo-locks')

const createIndexMock = jest.fn()
const collectionMock = jest.fn()

describe('mongo', () => {
  beforeEach(() => {
    collectionMock.mockReturnValue({
      createIndex: createIndexMock
    })

    MongoClient.connect = jest.fn().mockResolvedValue({
      db: jest.fn().mockReturnValue({
        collection: collectionMock,
        databaseName: 'my-db'
      })
    })

    // @ts-expect-error -- mock implementation
    LockManager.mockImplementation(() => ({
      collection: {
        findOne: jest.fn()
      },
      lock: jest.fn(),
      free: jest.fn()
    }))
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  test('should prepareDB', async () => {
    const res = await prepareDb(mockLogger)

    expect(res).toBeDefined()
    expect(res.databaseName).toBe('my-db')

    // Check that user collection index was created
    expect(collectionMock).toHaveBeenCalledWith('user-entitlement')
    expect(createIndexMock).toHaveBeenCalledWith(
      { userId: 1 },
      { unique: true }
    )

    // Check that mongo-locks collection index was created
    expect(collectionMock).toHaveBeenCalledWith('mongo-locks')
    expect(createIndexMock).toHaveBeenCalledWith({ id: 1 })

    // Check that LockManager was initialized
    expect(LockManager).toHaveBeenCalledWith(expect.any(Object))
  })
})
