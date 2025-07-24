import { MongoClient } from 'mongodb'

import { prepareDb } from '~/src/mongo.js'

const mockLogger = /** @type {any} */ ({
  info: jest.fn()
})

jest.mock('mongodb')

describe('mongo', () => {
  beforeEach(() => {
    MongoClient.connect = jest.fn().mockResolvedValue({
      db: jest.fn().mockReturnValue({
        collection: jest.fn().mockReturnValue({
          createIndex: jest.fn()
        }),
        databaseName: 'my-db'
      })
    })
  })

  test('should prepareDB', async () => {
    const res = await prepareDb(mockLogger)
    expect(res).toBeDefined()
    expect(res.databaseName).toBe('my-db')
  })
})
