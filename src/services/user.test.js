import { ObjectId } from 'mongodb'
import { pino } from 'pino'

import {
  mockUserId1,
  mockUserList,
  mockUserListWithIds
} from '~/src/api/__stubs__/users.js'
import { prepareDb } from '~/src/mongo.js'
import { Roles } from '~/src/repositories/roles.js'
import { Scopes } from '~/src/repositories/scopes.js'
import {
  create,
  get,
  getAll,
  remove,
  update
} from '~/src/repositories/user-repository.js'
import { getAzureAdService } from '~/src/services/azure-ad.js'
import {
  addUser,
  deleteUser,
  getAllUsers,
  getUser,
  mapUser,
  updateUser
} from '~/src/services/user.js'

jest.mock('~/src/repositories/user-repository.js')
jest.mock('~/src/services/azure-ad.js')
jest.mock('~/src/mongo.js')

jest.useFakeTimers().setSystemTime(new Date('2020-01-01'))

const validUser = {
  userId: '12345',
  displayName: 'John Smith',
  email: 'john.smith@site.com',
  roles: ['admin'],
  scopes: ['form-creator', 'form-publish', 'user-edit']
}

describe('User service', () => {
  beforeAll(async () => {
    await prepareDb(pino())
  })

  beforeEach(() => {
    jest.clearAllMocks()
    jest.mocked(getAzureAdService).mockImplementation(() => {
      return {
        validateUserByEmail: jest.fn().mockResolvedValue(validUser),
        validateUserById: jest.fn().mockResolvedValue(validUser)
      }
    })
  })

  describe('mapUser', () => {
    it('should throw if missing properties', () => {
      expect(() =>
        mapUser(/** @type {WithId<Partial<UserEntitlementDocument>>} */ ({}))
      ).toThrow(
        'User is malformed in the database. Expected fields are missing.'
      )
      expect(() =>
        mapUser(
          /** @type {WithId<Partial<UserEntitlementDocument>>} */ ({
            userId: '123'
          })
        )
      ).toThrow(
        'User is malformed in the database. Expected fields are missing.'
      )
      expect(() =>
        mapUser(
          /** @type {WithId<Partial<UserEntitlementDocument>>} */ ({
            userId: '123',
            roles: [Roles.Admin]
          })
        )
      ).toThrow(
        'User is malformed in the database. Expected fields are missing.'
      )
      expect(() =>
        mapUser(
          /** @type {WithId<Partial<UserEntitlementDocument>>} */ ({
            roles: [Roles.Admin],
            scopes: [Scopes.FormRead]
          })
        )
      ).toThrow(
        'User is malformed in the database. Expected fields are missing.'
      )
    })
  })

  describe('getAllUsers', () => {
    it('should get all users', async () => {
      jest.mocked(getAll).mockResolvedValue(mockUserListWithIds)

      const result = await getAllUsers()

      expect(result).toHaveLength(3)
      expect(result).toEqual(mockUserList)
    })

    it('should throw if error', async () => {
      jest.mocked(getAll).mockImplementation(() => {
        throw new Error('backend error')
      })

      await expect(getAllUsers()).rejects.toThrow('backend error')
    })
  })

  describe('getUser', () => {
    it('should get a single user', async () => {
      jest.mocked(get).mockResolvedValue(mockUserListWithIds[0])

      const result = await getUser('123')

      expect(result).toEqual(mockUserList[0])
    })

    it('should throw if error', async () => {
      jest.mocked(get).mockImplementation(() => {
        throw new Error('backend error')
      })

      await expect(getUser('123')).rejects.toThrow('backend error')
    })
  })

  describe('addUser', () => {
    it('should add a user', async () => {
      jest.mocked(create).mockResolvedValue({
        acknowledged: true,
        insertedId: new ObjectId(mockUserId1)
      })

      const rolesToAdd = [Roles.Admin]
      const result = await addUser(mockUserId1, rolesToAdd)

      expect(result.id).toBe('12345')
      expect(result.status).toBe('success')
    })

    it('should throw if error', async () => {
      jest.mocked(create).mockImplementation(() => {
        throw new Error('backend error')
      })

      await expect(addUser('123', [Roles.Admin])).rejects.toThrow(
        'backend error'
      )
    })
  })

  describe('updateUser', () => {
    it('should update user', async () => {
      jest.mocked(update).mockResolvedValue({
        acknowledged: true,
        upsertedId: new ObjectId(mockUserId1),
        matchedCount: 1,
        modifiedCount: 1,
        upsertedCount: 1
      })

      const rolesToUpdate = [Roles.FormCreator]
      const result = await updateUser(mockUserId1, rolesToUpdate)

      expect(result.id).toBe(mockUserId1)
      expect(result.status).toBe('success')
    })

    it('should throw if error', async () => {
      jest.mocked(update).mockImplementation(() => {
        throw new Error('backend error')
      })

      await expect(updateUser('123', [Roles.Admin])).rejects.toThrow(
        'backend error'
      )
    })
  })

  describe('deleteUser', () => {
    it('should delete user', async () => {
      jest.mocked(remove).mockResolvedValue()

      const result = await deleteUser(mockUserId1)

      expect(result.id).toBe(mockUserId1)
      expect(result.status).toBe('success')
    })

    it('should throw if error', async () => {
      jest.mocked(remove).mockImplementation(() => {
        throw new Error('backend error')
      })

      await expect(deleteUser('123')).rejects.toThrow('backend error')
    })
  })
})

/**
 * @import { UserEntitlementDocument } from '~/src/api/types.js'
 * @import { WithId } from 'mongodb'
 */
