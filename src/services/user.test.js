import { ObjectId } from 'mongodb'
import { pino } from 'pino'

import {
  mockUserId1,
  mockUserList,
  mockUserListWithIds
} from '~/src/api/__stubs__/users.js'
import { client, prepareDb } from '~/src/mongo.js'
import { Roles } from '~/src/repositories/roles.js'
import { Scopes } from '~/src/repositories/scopes.js'
import {
  create,
  get,
  getAll,
  remove,
  update
} from '~/src/repositories/user-repository.js'
import * as azureAdModule from '~/src/services/azure-ad.js'
import {
  addUser,
  deleteUser,
  getAllUsers,
  getUser,
  mapUser,
  mapUsers,
  migrateUsersFromAzureGroup,
  syncAdminUsersFromGroup,
  updateUser
} from '~/src/services/user.js'

jest.mock('~/src/repositories/user-repository.js')
jest.mock('~/src/mongo.js', () => ({
  client: {
    startSession: jest.fn()
  },
  prepareDb: jest.fn()
}))
jest.mock('~/src/helpers/logging/logger.js', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }))
}))
jest.mock('~/src/config/index.js', () => ({
  config: {
    get: jest.fn().mockReturnValue('test-group-id')
  }
}))

jest.useFakeTimers().setSystemTime(new Date('2020-01-01'))

describe('User service', () => {
  beforeAll(async () => {
    await prepareDb(pino())
  })

  beforeEach(() => {
    jest.clearAllMocks()

    const mockSession = {
      withTransaction: jest.fn((fn) => fn()),
      endSession: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      abortTransaction: jest.fn()
    }

    // @ts-expect-error - Mocking MongoDB session
    jest.mocked(client.startSession).mockReturnValue(mockSession)

    const mockValidateUser = jest.fn().mockResolvedValue({
      id: 'test-user-id',
      displayName: 'Test User',
      email: 'test@defra.gov.uk'
    })

    const mockGetUserByEmail = jest.fn().mockImplementation((email) =>
      Promise.resolve({
        id: `user-${email.replace('@', '-').replace('.', '-')}`,
        displayName: 'Test User',
        email
      })
    )

    const mockGetGroupMembers = jest.fn().mockResolvedValue([
      {
        id: 'azure-user-1',
        displayName: 'John Doe',
        email: 'john.doe@defra.gov.uk'
      },
      {
        id: 'azure-user-2',
        displayName: 'Jane Smith',
        email: 'jane.smith@defra.gov.uk'
      }
    ])

    jest.spyOn(azureAdModule, 'getAzureAdService').mockReturnValue(
      /** @type {any} */ ({
        validateUser: mockValidateUser,
        getUserByEmail: mockGetUserByEmail,
        getGroupMembers: mockGetGroupMembers
      })
    )
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

      const testEmail = 'test@defra.gov.uk'
      const rolesToAdd = [Roles.Admin]
      const result = await addUser(testEmail, rolesToAdd)

      expect(result.id).toBe(
        `user-${testEmail.replace('@', '-').replace('.', '-')}`
      )
      expect(result.email).toBe(testEmail)
      expect(result.displayName).toBe('Test User')
      expect(result.status).toBe('success')
    })

    it('should throw if error', async () => {
      // Mock Azure AD service to throw an error
      const mockGetUserByEmail = jest
        .fn()
        .mockRejectedValue(new Error('backend error'))

      jest.spyOn(azureAdModule, 'getAzureAdService').mockReturnValue(
        /** @type {any} */ ({
          getUserByEmail: mockGetUserByEmail
        })
      )

      await expect(addUser('test@defra.gov.uk', [Roles.Admin])).rejects.toThrow(
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

  describe('mapUsers', () => {
    it('should map array of user documents', () => {
      const result = mapUsers(mockUserListWithIds)

      expect(result).toHaveLength(3)
      expect(result).toEqual(mockUserList)
    })

    it('should handle empty array', () => {
      const result = mapUsers([])

      expect(result).toEqual([])
    })

    it('should throw if any user is malformed', () => {
      const malformedUsers = [
        mockUserListWithIds[0],
        /** @type {WithId<Partial<UserEntitlementDocument>>} */ ({
          userId: 'incomplete'
        })
      ]

      expect(() => mapUsers(malformedUsers)).toThrow(
        'User is malformed in the database. Expected fields are missing.'
      )
    })
  })

  describe('syncAdminUsersFromGroup', () => {
    it('should handle missing roleEditorGroupId config', async () => {
      const { config } = await import('~/src/config/index.js')
      jest.mocked(config.get).mockReturnValue(null)

      await syncAdminUsersFromGroup()

      expect(get).not.toHaveBeenCalled()
    })

    it('should complete successfully with valid config', async () => {
      // Ensure config returns valid group ID
      const { config } = await import('~/src/config/index.js')
      jest.mocked(config.get).mockReturnValue('test-group-id')

      // Should complete without throwing
      await expect(syncAdminUsersFromGroup()).resolves.toBeUndefined()
    })
  })

  describe('migrateUsersFromAzureGroup', () => {
    it('should migrate users successfully', async () => {
      jest.mocked(get).mockRejectedValue(new Error('User not found'))
      jest.mocked(create).mockResolvedValue({
        acknowledged: true,
        insertedId: new ObjectId()
      })

      const result = await migrateUsersFromAzureGroup([Roles.FormCreator])

      expect(result.status).toBe('completed')
      expect(result.summary.total).toBe(2)
      expect(result.summary.successful).toBe(2)
      expect(result.results.successful).toHaveLength(2)
    })

    it('should use default FormCreator role', async () => {
      jest.mocked(get).mockRejectedValue(new Error('User not found'))
      jest.mocked(create).mockResolvedValue({
        acknowledged: true,
        insertedId: new ObjectId()
      })

      await migrateUsersFromAzureGroup()

      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({
          roles: [Roles.FormCreator]
        }),
        expect.any(Object)
      )
    })
  })
})

/**
 * @import { UserEntitlementDocument } from '~/src/api/types.js'
 * @import { WithId } from 'mongodb'
 */
