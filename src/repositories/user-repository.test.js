import Boom from '@hapi/boom'
import { MongoServerError } from 'mongodb'

import { buildMockCollection } from '~/src/api/__stubs__/mongo.js'
import {
  mockUserId1,
  mockUserList,
  mockUserListWithIds
} from '~/src/api/__stubs__/users.js'
import { db } from '~/src/mongo.js'
import {
  create,
  get,
  getAll,
  remove,
  update
} from '~/src/repositories/user-repository.js'

const mockCollection = buildMockCollection()

const mockUser = mockUserList[0]
const mockUserWithId = mockUserListWithIds[0]
const mockSession = /** @type {any} */ ({ id: 'user' })

jest.mock('~/src/mongo.js', () => {
  let isPrepared = false
  const collection =
    /** @satisfies {Collection<{draft: FormDefinition}>} */ jest
      .fn()
      .mockImplementation(() => mockCollection)
  return {
    db: {
      collection
    },
    get client() {
      if (!isPrepared) {
        return undefined
      }

      return {
        startSession: () => ({
          endSession: jest.fn().mockResolvedValue(undefined),
          withTransaction: jest.fn(
            /**
             * Mock transaction handler
             * @param {() => Promise<void>} fn
             */
            async (fn) => fn()
          )
        })
      }
    },

    prepareDb() {
      isPrepared = true
      return Promise.resolve()
    }
  }
})

describe('user-repository', () => {
  beforeEach(() => {
    jest.mocked(db.collection).mockReturnValue(mockCollection)
  })

  describe('get', () => {
    beforeEach(() => {
      jest.mocked(db.collection).mockReturnValue(mockCollection)
      mockCollection.findOne.mockResolvedValue(mockUserWithId)
    })

    it('should handle a call outside of a session', async () => {
      const user = await get(mockUserId1)
      const [filter, options] = mockCollection.findOne.mock.calls[0]

      expect(filter).toEqual({ userId: mockUserId1 })
      expect(options).toBeUndefined()
      expect(user).toEqual(mockUserWithId)
    })

    it('should handle a call inside a session', async () => {
      await get(mockUserId1, mockSession)
      const [, options] = mockCollection.findOne.mock.calls[0]

      expect(options).toEqual({
        session: mockSession
      })
    })

    it('should handle not found', async () => {
      mockCollection.findOne.mockResolvedValue(undefined)
      await expect(get(mockUserId1, mockSession)).rejects.toThrow(
        "User with ID '111f119119e644a0a8c72118' not found"
      )
    })

    it('should handle DB error (not Boom)', async () => {
      mockCollection.findOne.mockImplementationOnce(() => {
        throw new Error('db error')
      })
      await expect(get(mockUserId1, mockSession)).rejects.toThrow('db error')
    })

    it('should handle Boom error', async () => {
      mockCollection.findOne.mockImplementationOnce(() => {
        throw Boom.boomify(new Error('boom error'))
      })
      await expect(get(mockUserId1, mockSession)).rejects.toThrow('boom error')
    })
  })

  describe('getAll', () => {
    beforeEach(() => {
      jest.mocked(db.collection).mockReturnValue(mockCollection)
      mockCollection.find.mockImplementationOnce(() => {
        return {
          sort: jest.fn().mockImplementationOnce(() => {
            return {
              limit: jest.fn().mockImplementationOnce(() => {
                return {
                  toArray: jest.fn().mockReturnValueOnce(mockUserListWithIds)
                }
              })
            }
          })
        }
      })
    })

    it('should get all users', async () => {
      const users = await getAll()
      expect(users).toEqual(mockUserListWithIds)
    })
  })

  describe('addUser', () => {
    it('should add a user', async () => {
      mockCollection.insertOne.mockResolvedValue(mockUserWithId)
      const result = await create(mockUser, mockSession)
      expect(result).toEqual(mockUserWithId)
    })

    it('should handle DB error', async () => {
      mockCollection.insertOne.mockImplementationOnce(() => {
        throw new Error('db error')
      })
      await expect(create(mockUser, mockSession)).rejects.toThrow('db error')
    })

    it('should handle duplicate entry', async () => {
      mockCollection.insertOne.mockImplementationOnce(() => {
        throw new MongoServerError({ message: 'server error', code: 11000 })
      })
      await expect(create(mockUser, mockSession)).rejects.toThrow(
        'User already exists'
      )
    })

    it('should handle other mongo server error', async () => {
      mockCollection.insertOne.mockImplementationOnce(() => {
        throw new MongoServerError({ message: 'server error' })
      })
      await expect(create(mockUser, mockSession)).rejects.toThrow(
        'server error'
      )
    })
  })

  describe('updateUser', () => {
    it('should update a user', async () => {
      mockCollection.updateOne.mockResolvedValue({ modifiedCount: 1 })
      const result = await update(mockUserId1, mockUser, mockSession)
      expect(result).toEqual({ modifiedCount: 1 })
    })

    it('should handle a failure to update', async () => {
      mockCollection.updateOne.mockResolvedValue({ modifiedCount: 0 })
      await expect(update(mockUserId1, mockSession)).rejects.toThrow(
        "User with ID '111f119119e644a0a8c72118' not updated. Modified count 0"
      )
    })

    it('should handle DB error (not Boom)', async () => {
      mockCollection.updateOne.mockImplementationOnce(() => {
        throw new Error('db error')
      })
      await expect(update(mockUserId1, mockSession)).rejects.toThrow('db error')
    })

    it('should handle Boom error', async () => {
      mockCollection.updateOne.mockImplementationOnce(() => {
        throw Boom.boomify(new Error('boom error'))
      })
      await expect(update(mockUserId1, mockSession)).rejects.toThrow(
        'boom error'
      )
    })
  })

  describe('removeUser', () => {
    it('should remove a user', async () => {
      mockCollection.deleteOne.mockResolvedValue({ deletedCount: 1 })
      await expect(remove(mockUserId1, mockSession)).resolves.not.toThrow()
    })

    it('should handle a failure to remove', async () => {
      mockCollection.deleteOne.mockResolvedValue({ deletedCount: 0 })
      await expect(remove(mockUserId1, mockSession)).rejects.toThrow(
        "ailed to delete user ID '111f119119e644a0a8c72118'. Expected deleted count of 1, received 0"
      )
    })
  })
})

/**
 * @import { UserEntitlementDocument } from '~/src/api/types.js'
 * @import { ClientSession } from 'mongodb'
 */
