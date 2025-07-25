import { MongoClient } from 'mongodb'

import { prepareDb } from '~/src/mongo.js'

const mockLogger = /** @type {any} */ ({
  info: jest.fn()
})

jest.mock('mongodb')

const createIndexMock = jest.fn()

describe('mongo', () => {
  beforeEach(() => {
    MongoClient.connect = jest.fn().mockResolvedValue({
      db: jest.fn().mockReturnValue({
        collection: jest.fn().mockReturnValue({
          createIndex: createIndexMock
        }),
        databaseName: 'my-db'
      })
    })
  })

  test('should prepareDB', async () => {
    const res = await prepareDb(mockLogger)
    expect(res).toBeDefined()
    expect(res.databaseName).toBe('my-db')
    expect(createIndexMock).toHaveBeenCalledWith(
      { userId: 1 },
      { unique: true }
    )
  })
})
