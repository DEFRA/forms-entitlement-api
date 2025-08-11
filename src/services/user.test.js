import Boom from '@hapi/boom'
import { ObjectId } from 'mongodb'
import { pino } from 'pino'

import {
  mockUserId1,
  mockUserList,
  mockUserListWithIds
} from '~/src/api/__stubs__/users.js'
import { config } from '~/src/config/index.js'
import { azureUser, callingUser } from '~/src/messaging/__stubs__/users.js'
import { client, prepareDb } from '~/src/mongo.js'
import { withLock } from '~/src/repositories/lock-repository.js'
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
  processAdminUser,
  processAllAdminUsers,
  updateUser
} from '~/src/services/user.js'

jest.mock('~/src/messaging/publish.js')
jest.mock('~/src/repositories/user-repository.js')
jest.mock('~/src/repositories/lock-repository.js')
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
    get: jest.fn()
  }
}))

jest.useFakeTimers().setSystemTime(new Date('2020-01-01'))

describe('User service', () => {
  /** @type {any} */
  let mockSession

  beforeAll(async () => {
    await prepareDb(pino())
  })

  beforeEach(() => {
    jest.clearAllMocks()

    mockSession = {
      withTransaction: jest.fn((fn) => fn()),
      endSession: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      abortTransaction: jest.fn()
    }

    jest.mocked(client.startSession).mockReturnValue(mockSession)

    // Mock the withLock function to just execute the callback
    jest.mocked(withLock).mockImplementation(async (lockName, lockId, fn) => {
      return await fn()
    })

    jest.mocked(config.get).mockReturnValue('test-group-id')

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
    it('should map a complete user document', () => {
      const document = {
        userId: '123',
        email: 'test@defra.gov.uk',
        displayName: 'Test User',
        roles: [Roles.Admin],
        scopes: [Scopes.FormRead]
      }

      const result = mapUser(document)

      expect(result).toEqual({
        userId: '123',
        email: 'test@defra.gov.uk',
        displayName: 'Test User',
        roles: [Roles.Admin],
        scopes: [Scopes.FormRead]
      })
    })

    it('should throw if missing userId', () => {
      expect(() =>
        mapUser(
          /** @type {any} */ ({
            roles: [Roles.Admin],
            scopes: [Scopes.FormRead]
          })
        )
      ).toThrow(
        'User is malformed in the database. Expected fields are missing.'
      )
    })

    it('should throw if missing roles', () => {
      expect(() =>
        mapUser(
          /** @type {any} */ ({ userId: '123', scopes: [Scopes.FormRead] })
        )
      ).toThrow(
        'User is malformed in the database. Expected fields are missing.'
      )
    })

    it('should throw if missing scopes', () => {
      expect(() =>
        mapUser(/** @type {any} */ ({ userId: '123', roles: [Roles.Admin] }))
      ).toThrow(
        'User is malformed in the database. Expected fields are missing.'
      )
    })

    it('should map user without optional fields', () => {
      const document = {
        userId: '123',
        roles: [Roles.Admin],
        scopes: [Scopes.FormRead]
      }

      const result = mapUser(document)

      expect(result).toEqual({
        userId: '123',
        roles: [Roles.Admin],
        scopes: [Scopes.FormRead]
      })
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
        /** @type {any} */ ({ userId: 'incomplete' })
      ]

      expect(() => mapUsers(malformedUsers)).toThrow(
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

    it('should throw if repository error', async () => {
      jest.mocked(getAll).mockRejectedValue(new Error('Database error'))

      await expect(getAllUsers()).rejects.toThrow('Database error')
    })
  })

  describe('getUser', () => {
    it('should get a single user', async () => {
      jest.mocked(get).mockResolvedValue(mockUserListWithIds[0])

      const result = await getUser('123')

      expect(result).toEqual(mockUserList[0])
    })

    it('should throw if repository error', async () => {
      jest.mocked(get).mockRejectedValue(new Error('User not found'))

      await expect(getUser('123')).rejects.toThrow('User not found')
    })
  })

  describe('addUser', () => {
    it('should add a user successfully', async () => {
      jest.mocked(create).mockResolvedValue({
        acknowledged: true,
        insertedId: new ObjectId(mockUserId1)
      })

      const testEmail = 'test@defra.gov.uk'
      const rolesToAdd = [Roles.Admin]
      const result = await addUser(testEmail, rolesToAdd, callingUser)

      expect(result.id).toBe(
        `user-${testEmail.replace('@', '-').replace('.', '-')}`
      )
      expect(result.email).toBe(testEmail)
      expect(result.displayName).toBe('Test User')
    })

    it('should handle Azure AD service errors', async () => {
      const mockGetUserByEmail = jest
        .fn()
        .mockRejectedValue(new Error('Azure AD error'))

      jest
        .spyOn(azureAdModule, 'getAzureAdService')
        .mockReturnValue(
          /** @type {any} */ ({ getUserByEmail: mockGetUserByEmail })
        )

      await expect(
        addUser('test@defra.gov.uk', [Roles.Admin], callingUser)
      ).rejects.toThrow('Azure AD error')
      expect(mockSession.endSession).toHaveBeenCalled()
    })

    it('should handle database transaction errors', async () => {
      mockSession.withTransaction.mockRejectedValue(
        new Error('Transaction failed')
      )

      await expect(
        addUser('test@defra.gov.uk', [Roles.Admin], callingUser)
      ).rejects.toThrow('Transaction failed')
      expect(mockSession.endSession).toHaveBeenCalled()
    })
  })

  describe('updateUser', () => {
    it('should update user successfully', async () => {
      jest.mocked(update).mockResolvedValue({
        acknowledged: true,
        upsertedId: new ObjectId(mockUserId1),
        matchedCount: 1,
        modifiedCount: 1,
        upsertedCount: 1
      })

      const result = await updateUser(
        mockUserId1,
        [Roles.FormCreator],
        callingUser
      )

      expect(result.id).toBe(mockUserId1)
    })

    it('should handle database errors', async () => {
      mockSession.withTransaction.mockRejectedValue(new Error('Update failed'))

      await expect(
        updateUser('123', [Roles.Admin], callingUser)
      ).rejects.toThrow('Update failed')
      expect(mockSession.endSession).toHaveBeenCalled()
    })
  })

  describe('deleteUser', () => {
    it('should delete user successfully', async () => {
      jest.mocked(remove).mockResolvedValue()
      jest.mocked(get).mockResolvedValueOnce({
        userId: azureUser.id,
        email: azureUser.email,
        displayName: azureUser.displayName
      })

      const result = await deleteUser(mockUserId1, callingUser)

      expect(result.id).toBe(mockUserId1)
    })

    it('should handle database errors', async () => {
      mockSession.withTransaction.mockRejectedValue(new Error('Delete failed'))

      await expect(deleteUser('123', callingUser)).rejects.toThrow(
        'Delete failed'
      )
      expect(mockSession.endSession).toHaveBeenCalled()
    })
  })

  describe('processAdminUser', () => {
    const mockMember = {
      id: 'azure-user-1',
      displayName: 'John Doe',
      email: 'john.doe@defra.gov.uk'
    }

    it('should create new admin user when user does not exist', async () => {
      jest.mocked(get).mockRejectedValue(Boom.notFound('User not found'))
      jest.mocked(create).mockResolvedValue({
        acknowledged: true,
        insertedId: new ObjectId()
      })

      await processAdminUser(mockMember, mockSession)

      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'azure-user-1',
          email: 'john.doe@defra.gov.uk',
          displayName: 'John Doe',
          roles: [Roles.Admin]
        }),
        mockSession
      )
    })

    it('should replace form-creator role with admin role only', async () => {
      const mockMember = {
        id: 'azure-user-1',
        displayName: 'Test User',
        email: 'test@example.com'
      }

      const existingUser = {
        userId: 'azure-user-1',
        roles: [Roles.FormCreator],
        scopes: ['some-scope']
      }

      const existingUsersMap = new Map([['azure-user-1', existingUser]])

      await processAdminUser(mockMember, mockSession, existingUsersMap)

      expect(update).toHaveBeenCalledWith(
        'azure-user-1',
        expect.objectContaining({
          roles: [Roles.Admin]
        }),
        mockSession
      )
      expect(create).not.toHaveBeenCalled()
    })

    it('should replace all other roles with admin role only', async () => {
      const mockMember = {
        id: 'azure-user-1',
        displayName: 'Test User',
        email: 'test@example.com'
      }

      const existingUser = {
        userId: 'azure-user-1',
        roles: ['some-other-role', 'another-role'],
        scopes: ['some-scope']
      }

      const existingUsersMap = new Map([['azure-user-1', existingUser]])

      await processAdminUser(mockMember, mockSession, existingUsersMap)

      expect(update).toHaveBeenCalledWith(
        'azure-user-1',
        expect.objectContaining({
          roles: [Roles.Admin]
        }),
        mockSession
      )
      expect(create).not.toHaveBeenCalled()
    })

    it('should replace multiple roles including form-creator with admin only', async () => {
      const mockMember = {
        id: 'azure-user-1',
        displayName: 'Test User',
        email: 'test@example.com'
      }

      const existingUser = {
        userId: 'azure-user-1',
        roles: [Roles.FormCreator, Roles.Admin, 'other-role'],
        scopes: ['some-scope']
      }

      const existingUsersMap = new Map([['azure-user-1', existingUser]])

      await processAdminUser(mockMember, mockSession, existingUsersMap)

      expect(update).toHaveBeenCalledWith(
        'azure-user-1',
        expect.objectContaining({
          roles: [Roles.Admin]
        }),
        mockSession
      )
      expect(create).not.toHaveBeenCalled()
    })

    it('should not modify existing admin user', async () => {
      const mockMember = {
        id: 'azure-user-1',
        displayName: 'Test User',
        email: 'test@example.com'
      }

      const existingUser = {
        userId: 'azure-user-1',
        roles: [Roles.Admin],
        scopes: ['some-scope']
      }

      const existingUsersMap = new Map([['azure-user-1', existingUser]])

      await processAdminUser(mockMember, mockSession, existingUsersMap)

      expect(update).not.toHaveBeenCalled()
      expect(create).not.toHaveBeenCalled()
    })

    it('should handle users with undefined roles', async () => {
      const mockMember = {
        id: 'azure-user-1',
        displayName: 'Test User',
        email: 'test@example.com'
      }

      const existingUser = {
        userId: 'azure-user-1',
        roles: undefined,
        scopes: ['some-scope']
      }

      const existingUsersMap = new Map([['azure-user-1', existingUser]])

      await processAdminUser(mockMember, mockSession, existingUsersMap)

      expect(update).toHaveBeenCalledWith(
        'azure-user-1',
        expect.objectContaining({
          roles: [Roles.Admin]
        }),
        mockSession
      )
      expect(create).not.toHaveBeenCalled()
    })
  })

  describe('processAllAdminUsers', () => {
    it('should process all users successfully', async () => {
      const mockMembers = [
        { id: 'user-1', displayName: 'User 1', email: 'user1@defra.gov.uk' },
        { id: 'user-2', displayName: 'User 2', email: 'user2@defra.gov.uk' }
      ]

      // Mock getAll to return empty array
      jest.mocked(getAll).mockResolvedValue([])

      await processAllAdminUsers(mockMembers, mockSession)

      expect(mockSession.withTransaction).toHaveBeenCalled()
      expect(create).toHaveBeenCalledTimes(2)
    })

    it('should handle individual user processing errors gracefully', async () => {
      const mockMembers = [
        { id: 'user-1', displayName: 'User 1', email: 'user1@defra.gov.uk' },
        { id: 'user-2', displayName: 'User 2', email: 'user2@defra.gov.uk' },
        { id: 'user-3', displayName: 'User 3', email: 'user3@defra.gov.uk' }
      ]

      // Mock getAll to return empty array
      jest.mocked(getAll).mockResolvedValue([])

      // Make user-2 creation fail
      jest
        .mocked(create)
        .mockResolvedValueOnce({
          acknowledged: true,
          insertedId: new ObjectId()
        })
        .mockRejectedValueOnce(new Error('Database error'))
        .mockResolvedValueOnce({
          acknowledged: true,
          insertedId: new ObjectId()
        })

      // Should not throw even if individual users fail
      await expect(
        processAllAdminUsers(mockMembers, mockSession)
      ).resolves.toBeUndefined()
      expect(mockSession.withTransaction).toHaveBeenCalled()
    })

    it('should handle transaction errors', async () => {
      const mockMembers = [
        { id: 'user-1', displayName: 'User 1', email: 'user1@defra.gov.uk' }
      ]

      // Mock getAll to return empty array
      jest.mocked(getAll).mockResolvedValue([])

      // Mock transaction to fail
      mockSession.withTransaction.mockRejectedValue(
        new Error('Transaction failed')
      )

      await expect(
        processAllAdminUsers(mockMembers, mockSession)
      ).rejects.toThrow('Transaction failed')
    })

    it('should filter out users without userId when creating existingUsersMap', async () => {
      const mockMembers = [
        {
          id: 'existing-user',
          displayName: 'User 1',
          email: 'user1@defra.gov.uk'
        },
        { id: 'new-user', displayName: 'User 2', email: 'user2@defra.gov.uk' }
      ]

      const mockUsersFromDb = [
        {
          _id: new ObjectId(),
          userId: 'existing-user',
          roles: [Roles.FormCreator],
          scopes: [Scopes.FormRead]
        },
        {
          _id: new ObjectId(),
          roles: [Roles.Admin],
          scopes: [Scopes.FormRead]
        },
        {
          _id: new ObjectId(),
          userId: undefined,
          roles: [Roles.FormCreator],
          scopes: [Scopes.FormRead]
        },
        {
          _id: new ObjectId(),
          userId: 'another-existing-user',
          roles: [Roles.Admin],
          scopes: [Scopes.FormRead]
        }
      ]

      jest.mocked(getAll).mockResolvedValue(mockUsersFromDb)

      await processAllAdminUsers(mockMembers, mockSession)

      expect(mockSession.withTransaction).toHaveBeenCalled()

      expect(update).toHaveBeenCalledWith(
        'existing-user',
        expect.objectContaining({
          userId: 'existing-user',
          roles: [Roles.Admin]
        }),
        mockSession
      )

      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'new-user',
          roles: [Roles.Admin]
        }),
        mockSession
      )

      expect(update).toHaveBeenCalledTimes(1)
      expect(create).toHaveBeenCalledTimes(1)
    })
  })
})

/**
 * @import { UserEntitlementDocument } from '~/src/api/types.js'
 * @import { WithId } from 'mongodb'
 */
