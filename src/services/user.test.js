import { Roles, Scopes } from '@defra/forms-model'
import Boom from '@hapi/boom'
import { ObjectId } from 'mongodb'
import { pino } from 'pino'

import { mockUserId1, mockUserListWithIds } from '~/src/api/__stubs__/users.js'
import { config } from '~/src/config/index.js'
import {
  azureUser,
  callingUser,
  superadminCallingUser
} from '~/src/messaging/__stubs__/users.js'
import { client, prepareDb } from '~/src/mongo.js'
import { withLock } from '~/src/repositories/lock-repository.js'
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
  syncAdminUsersFromGroup,
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

    jest.mocked(withLock).mockImplementation(async (lockName, fn) => {
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
    it('should not include scopes by default', () => {
      const document = {
        _id: new ObjectId(),
        userId: '123',
        email: 'test@defra.gov.uk',
        displayName: 'Test User',
        roles: [Roles.Admin]
      }

      const result = mapUser(document)

      expect(result).toEqual({
        userId: '123',
        email: 'test@defra.gov.uk',
        displayName: 'Test User',
        roles: [Roles.Admin]
      })
      expect(result).not.toHaveProperty('scopes')
    })

    it('should not include a legacy scopes field from the document by default', () => {
      const result = mapUser({
        userId: '123',
        roles: [Roles.Admin],
        scopes: ['stale-scope']
      })
      expect(result).not.toHaveProperty('scopes')
    })

    it('should include computed scopes when includeScopes is true', () => {
      const document = {
        userId: '123',
        email: 'test@defra.gov.uk',
        displayName: 'Test User',
        roles: [Roles.Admin]
      }

      const result = mapUser(document, true)

      expect(result).toEqual({
        userId: '123',
        email: 'test@defra.gov.uk',
        displayName: 'Test User',
        roles: [Roles.Admin],
        scopes: [
          Scopes.FormDelete,
          Scopes.FormEdit,
          Scopes.FormRead,
          Scopes.FormPublish,
          Scopes.UserCreate,
          Scopes.UserDelete,
          Scopes.UserEdit,
          Scopes.FormsFeedback
        ]
      })
    })

    it('should ignore legacy scopes field and compute scopes from roles when includeScopes is true', () => {
      const document = {
        userId: '123',
        roles: [Roles.Admin],
        scopes: ['stale-scope']
      }

      const result = mapUser(document, true)

      expect(result.scopes).toEqual([
        Scopes.FormDelete,
        Scopes.FormEdit,
        Scopes.FormRead,
        Scopes.FormPublish,
        Scopes.UserCreate,
        Scopes.UserDelete,
        Scopes.UserEdit,
        Scopes.FormsFeedback
      ])
    })

    it('should map user without optional fields', () => {
      const result = mapUser({ userId: '123', roles: [Roles.Admin] }, true)

      expect(result).toEqual({
        userId: '123',
        roles: [Roles.Admin],
        scopes: [
          Scopes.FormDelete,
          Scopes.FormEdit,
          Scopes.FormRead,
          Scopes.FormPublish,
          Scopes.UserCreate,
          Scopes.UserDelete,
          Scopes.UserEdit,
          Scopes.FormsFeedback
        ]
      })
    })
  })

  describe('mapUsers', () => {
    it('should map array of user documents', () => {
      const result = mapUsers(mockUserListWithIds)

      expect(result).toHaveLength(3)
      expect(result[0]).toEqual(
        expect.objectContaining({
          userId: 'user-id-admin',
          roles: ['admin']
        })
      )
      expect(result[0]).not.toHaveProperty('scopes')
      expect(result[1]).toEqual(
        expect.objectContaining({
          userId: 'user-id-creator2',
          roles: ['form-creator']
        })
      )
      expect(result[1]).not.toHaveProperty('scopes')
      expect(result[2]).toEqual(
        expect.objectContaining({
          userId: 'user-id-creator',
          roles: ['form-creator']
        })
      )
      expect(result[2]).not.toHaveProperty('scopes')
    })

    it('should handle empty array', () => {
      const result = mapUsers([])
      expect(result).toEqual([])
    })
  })

  describe('getAllUsers', () => {
    it('should get all users', async () => {
      jest.mocked(getAll).mockResolvedValue(mockUserListWithIds)

      const result = await getAllUsers()

      expect(result).toHaveLength(3)
      expect(result[0]).toEqual(
        expect.objectContaining({
          userId: 'user-id-admin',
          roles: ['admin']
        })
      )
      expect(result[0]).not.toHaveProperty('scopes')
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

      expect(result).toEqual(
        expect.objectContaining({
          userId: 'user-id-admin',
          roles: ['admin'],
          scopes: expect.arrayContaining([
            Scopes.FormDelete,
            Scopes.FormEdit,
            Scopes.FormRead,
            Scopes.FormPublish,
            Scopes.UserCreate,
            Scopes.UserDelete,
            Scopes.UserEdit,
            Scopes.FormsFeedback
          ])
        })
      )
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
      const result = await addUser(testEmail, rolesToAdd, superadminCallingUser)

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
        addUser('test@defra.gov.uk', [Roles.Admin], superadminCallingUser)
      ).rejects.toThrow('Azure AD error')
      expect(mockSession.endSession).toHaveBeenCalled()
    })

    it('should handle database transaction errors', async () => {
      mockSession.withTransaction.mockRejectedValue(
        new Error('Transaction failed')
      )

      await expect(
        addUser('test@defra.gov.uk', [Roles.Admin], superadminCallingUser)
      ).rejects.toThrow('Transaction failed')
      expect(mockSession.endSession).toHaveBeenCalled()
    })

    it('should handle user not found errors', async () => {
      const mockGetUserByEmail = jest
        .fn()
        .mockRejectedValue(Boom.notFound('User not found'))

      jest
        .spyOn(azureAdModule, 'getAzureAdService')
        .mockReturnValue(
          /** @type {any} */ ({ getUserByEmail: mockGetUserByEmail })
        )

      await expect(
        addUser('test@defra.gov.uk', [Roles.Admin], superadminCallingUser)
      ).rejects.toThrow('User not found')
      expect(mockSession.endSession).toHaveBeenCalled()
    })

    it('should throw 403 when admin caller tries to assign admin role', async () => {
      await expect(
        addUser('test@defra.gov.uk', [Roles.Admin], callingUser)
      ).rejects.toThrow(
        expect.objectContaining({
          output: expect.objectContaining({ statusCode: 403 })
        })
      )
    })

    it('should throw 403 when admin caller tries to assign superadmin role', async () => {
      await expect(
        addUser('test@defra.gov.uk', [Roles.Superadmin], callingUser)
      ).rejects.toThrow(
        expect.objectContaining({
          output: expect.objectContaining({ statusCode: 403 })
        })
      )
    })

    it('should succeed when admin caller assigns form-creator role', async () => {
      jest.mocked(create).mockResolvedValue({
        acknowledged: true,
        insertedId: new ObjectId(mockUserId1)
      })

      const result = await addUser(
        'test@defra.gov.uk',
        [Roles.FormCreator],
        callingUser
      )

      expect(result).toBeDefined()
    })

    it('should succeed when admin caller assigns form-publisher role', async () => {
      jest.mocked(create).mockResolvedValue({
        acknowledged: true,
        insertedId: new ObjectId(mockUserId1)
      })

      const result = await addUser(
        'test@defra.gov.uk',
        [Roles.FormPublisher],
        callingUser
      )

      expect(result).toBeDefined()
    })

    it('should succeed when superadmin caller assigns any role', async () => {
      jest.mocked(create).mockResolvedValue({
        acknowledged: true,
        insertedId: new ObjectId(mockUserId1)
      })

      const result = await addUser(
        'test@defra.gov.uk',
        [Roles.Admin],
        superadminCallingUser
      )

      expect(result).toBeDefined()
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

      jest.mocked(get).mockResolvedValueOnce({
        _id: new ObjectId(),
        userId: mockUserId1,
        roles: [Roles.FormCreator],
        scopes: [Scopes.FormRead],
        email: 'test@defra.gov.uk',
        displayName: 'Test User'
      })

      const result = await updateUser(
        mockUserId1,
        [Roles.FormCreator],
        callingUser
      )

      expect(result.id).toBe(mockUserId1)
    })

    it('should handle database errors', async () => {
      jest.mocked(get).mockResolvedValueOnce({
        _id: new ObjectId(),
        userId: '123',
        roles: [Roles.FormCreator],
        scopes: [Scopes.FormRead],
        email: 'test@example.com',
        displayName: 'Test User'
      })

      mockSession.withTransaction.mockRejectedValue(new Error('Update failed'))

      await expect(
        updateUser('123', [Roles.FormCreator], callingUser)
      ).rejects.toThrow('Update failed')
      expect(mockSession.endSession).toHaveBeenCalled()
    })

    it('should throw 403 when caller tries to update own roles (self-management)', async () => {
      await expect(
        updateUser(callingUser.id, [Roles.FormCreator], callingUser)
      ).rejects.toThrow(
        expect.objectContaining({
          output: expect.objectContaining({ statusCode: 403 })
        })
      )
    })

    it('should throw 403 when admin caller tries to update an admin user', async () => {
      jest.mocked(get).mockResolvedValueOnce({
        _id: new ObjectId(),
        userId: 'target-user',
        roles: [Roles.Admin],
        scopes: [Scopes.UserCreate],
        email: 'target-admin@example.com',
        displayName: 'Target User'
      })

      await expect(
        updateUser('target-user', [Roles.FormCreator], callingUser)
      ).rejects.toThrow(
        expect.objectContaining({
          output: expect.objectContaining({ statusCode: 403 })
        })
      )
    })

    it('should throw 403 when admin caller tries to update a superadmin user', async () => {
      jest.mocked(get).mockResolvedValueOnce({
        _id: new ObjectId(),
        userId: 'target-user',
        roles: [Roles.Superadmin],
        scopes: [Scopes.UserCreate],
        email: 'target@example.com',
        displayName: 'Target User'
      })

      await expect(
        updateUser('target-user', [Roles.FormCreator], callingUser)
      ).rejects.toThrow(
        expect.objectContaining({
          output: expect.objectContaining({ statusCode: 403 })
        })
      )
    })

    it('should throw 403 when admin caller tries to assign admin/superadmin roles', async () => {
      jest.mocked(get).mockResolvedValueOnce({
        _id: new ObjectId(),
        userId: 'target-user',
        roles: [Roles.FormCreator],
        scopes: [Scopes.FormRead],
        email: 'target@example.com',
        displayName: 'Target User'
      })

      await expect(
        updateUser('target-user', [Roles.Admin], callingUser)
      ).rejects.toThrow(
        expect.objectContaining({
          output: expect.objectContaining({ statusCode: 403 })
        })
      )
    })

    it('should succeed when superadmin updates any user', async () => {
      jest.mocked(update).mockResolvedValue({
        acknowledged: true,
        upsertedId: new ObjectId(mockUserId1),
        matchedCount: 1,
        modifiedCount: 1,
        upsertedCount: 1
      })

      jest.mocked(get).mockResolvedValueOnce({
        _id: new ObjectId(),
        userId: 'target-user',
        roles: [Roles.Admin],
        scopes: [Scopes.UserCreate],
        email: 'target-admin@example.com',
        displayName: 'Target User'
      })

      const result = await updateUser(
        'target-user',
        [Roles.Superadmin],
        superadminCallingUser
      )

      expect(result.id).toBe('target-user')
    })
  })

  describe('deleteUser', () => {
    it('should delete user successfully', async () => {
      jest.mocked(remove).mockResolvedValue()
      jest.mocked(get).mockResolvedValueOnce({
        _id: new ObjectId(),
        userId: azureUser.id,
        email: azureUser.email,
        displayName: azureUser.displayName,
        roles: [Roles.FormCreator]
      })

      const result = await deleteUser(mockUserId1, callingUser)

      expect(result.id).toBe(mockUserId1)
    })

    it('should handle database errors', async () => {
      jest.mocked(get).mockResolvedValueOnce({
        _id: new ObjectId(),
        userId: '123',
        email: 'test@example.com',
        displayName: 'Test User',
        roles: [Roles.FormCreator]
      })

      mockSession.withTransaction.mockRejectedValue(new Error('Delete failed'))

      await expect(deleteUser('123', callingUser)).rejects.toThrow(
        'Delete failed'
      )
      expect(mockSession.endSession).toHaveBeenCalled()
    })

    it('should handle user not found (404) and still proceed with deletion', async () => {
      const notFoundError = Boom.notFound('User not found')
      jest.mocked(get).mockRejectedValue(notFoundError)
      jest.mocked(remove).mockResolvedValue()

      const result = await deleteUser('non-existent-user', callingUser)

      expect(result).toBeDefined()

      expect(get).toHaveBeenCalledWith('non-existent-user')
      expect(remove).toHaveBeenCalledWith('non-existent-user', mockSession)
      expect(mockSession.endSession).toHaveBeenCalled()
    })

    it('should throw 403 when caller tries to delete themselves (self-management)', async () => {
      await expect(deleteUser(callingUser.id, callingUser)).rejects.toThrow(
        expect.objectContaining({
          output: expect.objectContaining({ statusCode: 403 })
        })
      )
    })

    it('should throw 403 when admin tries to delete an admin user', async () => {
      jest.mocked(get).mockResolvedValueOnce({
        _id: new ObjectId(),
        userId: 'target-admin',
        roles: [Roles.Admin],
        scopes: [Scopes.UserCreate],
        email: 'admin@example.com',
        displayName: 'Target Admin'
      })

      await expect(deleteUser('target-admin', callingUser)).rejects.toThrow(
        expect.objectContaining({
          output: expect.objectContaining({ statusCode: 403 })
        })
      )
    })

    it('should throw 403 when admin tries to delete a superadmin user', async () => {
      jest.mocked(get).mockResolvedValueOnce({
        _id: new ObjectId(),
        userId: 'target-superadmin',
        roles: [Roles.Superadmin],
        scopes: [Scopes.UserCreate],
        email: 'superadmin@example.com',
        displayName: 'Target Superadmin'
      })

      await expect(
        deleteUser('target-superadmin', callingUser)
      ).rejects.toThrow(
        expect.objectContaining({
          output: expect.objectContaining({ statusCode: 403 })
        })
      )
    })

    it('should succeed when superadmin deletes any user', async () => {
      jest.mocked(remove).mockResolvedValue()
      jest.mocked(get).mockResolvedValueOnce({
        _id: new ObjectId(),
        userId: 'target-admin',
        roles: [Roles.Admin],
        scopes: [Scopes.UserCreate],
        email: 'admin@example.com',
        displayName: 'Target Admin'
      })

      const result = await deleteUser('target-admin', superadminCallingUser)

      expect(result.id).toBe('target-admin')
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
          roles: [Roles.Superadmin]
        }),
        mockSession
      )
      expect(create).toHaveBeenCalledWith(
        expect.not.objectContaining({ scopes: expect.anything() }),
        mockSession
      )
    })

    it('should replace form-creator role with superadmin role only', async () => {
      const mockMember = {
        id: 'azure-user-1',
        displayName: 'Test User',
        email: 'test@example.com'
      }

      const existingUser = {
        userId: 'azure-user-1',
        roles: [Roles.FormCreator]
      }

      const existingUsersMap = new Map([['azure-user-1', existingUser]])

      await processAdminUser(mockMember, mockSession, existingUsersMap)

      expect(update).toHaveBeenCalledWith(
        'azure-user-1',
        expect.objectContaining({
          roles: [Roles.Superadmin]
        }),
        mockSession
      )
      expect(update).toHaveBeenCalledWith(
        'azure-user-1',
        expect.not.objectContaining({ scopes: expect.anything() }),
        mockSession
      )
      expect(create).not.toHaveBeenCalled()
    })

    it('should replace all other roles with superadmin role only', async () => {
      const mockMember = {
        id: 'azure-user-1',
        displayName: 'Test User',
        email: 'test@example.com'
      }

      const existingUser = {
        userId: 'azure-user-1',
        roles: ['some-other-role', 'another-role']
      }

      const existingUsersMap = new Map([['azure-user-1', existingUser]])

      await processAdminUser(mockMember, mockSession, existingUsersMap)

      expect(update).toHaveBeenCalledWith(
        'azure-user-1',
        expect.objectContaining({
          roles: [Roles.Superadmin]
        }),
        mockSession
      )
      expect(create).not.toHaveBeenCalled()
    })

    it('should replace multiple roles including form-creator with superadmin only', async () => {
      const mockMember = {
        id: 'azure-user-1',
        displayName: 'Test User',
        email: 'test@example.com'
      }

      const existingUser = {
        userId: 'azure-user-1',
        roles: [Roles.FormCreator, Roles.Admin, 'other-role']
      }

      const existingUsersMap = new Map([['azure-user-1', existingUser]])

      await processAdminUser(mockMember, mockSession, existingUsersMap)

      expect(update).toHaveBeenCalledWith(
        'azure-user-1',
        expect.objectContaining({
          roles: [Roles.Superadmin]
        }),
        mockSession
      )
      expect(create).not.toHaveBeenCalled()
    })

    it('should not modify existing superadmin user', async () => {
      const mockMember = {
        id: 'azure-user-1',
        displayName: 'Test User',
        email: 'test@example.com'
      }

      const existingUser = {
        userId: 'azure-user-1',
        roles: [Roles.Superadmin]
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
        roles: undefined
      }

      const existingUsersMap = new Map([['azure-user-1', existingUser]])

      await processAdminUser(mockMember, mockSession, existingUsersMap)

      expect(update).toHaveBeenCalledWith(
        'azure-user-1',
        expect.objectContaining({
          roles: [Roles.Superadmin]
        }),
        mockSession
      )
      expect(create).not.toHaveBeenCalled()
    })

    it('should update users with Roles.Admin to Roles.Superadmin', async () => {
      const mockMember = {
        id: 'azure-user-1',
        displayName: 'Test User',
        email: 'test@example.com'
      }

      const existingUser = {
        userId: 'azure-user-1',
        displayName: 'azure user 1',
        email: 'azure-user-1@test.com',
        roles: [Roles.Admin],
        scopes: ['some-scope']
      }

      const existingUsersMap = new Map([['azure-user-1', existingUser]])

      // @ts-expect-error - partial mock with invalid scope
      await processAdminUser(mockMember, mockSession, existingUsersMap)

      expect(update).toHaveBeenCalledWith(
        'azure-user-1',
        expect.objectContaining({
          roles: [Roles.Superadmin]
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

      /** @type {any[]} */
      const mockUsersFromDb = [
        {
          _id: new ObjectId(),
          userId: 'existing-user',
          roles: [Roles.FormCreator],
          email: 'existing@defra.gov.uk',
          displayName: 'Existing User'
        },
        {
          _id: new ObjectId(),
          roles: [Roles.Admin],
          email: 'no-id@defra.gov.uk',
          displayName: 'No ID User'
        },
        {
          _id: new ObjectId(),
          userId: undefined,
          roles: [Roles.FormCreator],
          email: 'undefined@defra.gov.uk',
          displayName: 'Undefined ID User'
        },
        {
          _id: new ObjectId(),
          userId: 'another-existing-user',
          roles: [Roles.Admin],
          email: 'another@defra.gov.uk',
          displayName: 'Another User'
        }
      ]

      jest.mocked(getAll).mockResolvedValue(mockUsersFromDb)

      await processAllAdminUsers(mockMembers, mockSession)

      expect(mockSession.withTransaction).toHaveBeenCalled()

      expect(update).toHaveBeenCalledWith(
        'existing-user',
        expect.objectContaining({
          userId: 'existing-user',
          roles: [Roles.Superadmin]
        }),
        mockSession
      )

      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'new-user',
          roles: [Roles.Superadmin]
        }),
        mockSession
      )

      expect(update).toHaveBeenCalledTimes(1)
      expect(create).toHaveBeenCalledTimes(1)
    })
  })

  describe('syncAdminUsersFromGroup', () => {
    beforeEach(() => {
      jest.mocked(config.get).mockReturnValue('role-editor-group-id')
      jest.clearAllMocks()
    })

    test('should successfully sync admin users when lock is acquired', async () => {
      const mockGroupMembers = [
        {
          id: 'user-1',
          displayName: 'User One',
          email: 'user1@example.com'
        },
        {
          id: 'user-2',
          displayName: 'User Two',
          email: 'user2@example.com'
        }
      ]

      const mockSession = {
        withTransaction: jest.fn((fn) => fn()),
        endSession: jest.fn()
      }

      jest
        .mocked(client.startSession)
        .mockReturnValue(/** @type {any} */ (mockSession))

      jest.spyOn(azureAdModule, 'getAzureAdService').mockReturnValue(
        /** @type {any} */ ({
          getGroupMembers: jest.fn().mockResolvedValue(mockGroupMembers)
        })
      )

      jest.mocked(getAll).mockResolvedValue([])
      jest
        .mocked(create)
        .mockResolvedValue(/** @type {any} */ ({ acknowledged: true }))
      jest.mocked(withLock).mockImplementation(async (name, fn) => {
        return await fn()
      })

      await syncAdminUsersFromGroup()

      expect(withLock).toHaveBeenCalledWith(
        'admin-user-sync',
        expect.any(Function)
      )

      expect(client.startSession).toHaveBeenCalled()
      expect(mockSession.endSession).toHaveBeenCalled()
    })

    test('should log info when lock is not acquired (already running)', async () => {
      jest.mocked(withLock).mockResolvedValue(null)

      const consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation()

      await syncAdminUsersFromGroup()

      expect(withLock).toHaveBeenCalledWith(
        'admin-user-sync',
        expect.any(Function)
      )

      expect(client.startSession).not.toHaveBeenCalled()

      consoleInfoSpy.mockRestore()
    })

    test('should handle errors thrown during sync', async () => {
      const mockError = new Error('Azure AD connection failed')
      const mockSession = {
        withTransaction: jest.fn((fn) => fn()),
        endSession: jest.fn()
      }

      jest
        .mocked(client.startSession)
        .mockReturnValue(/** @type {any} */ (mockSession))

      jest.spyOn(azureAdModule, 'getAzureAdService').mockReturnValue(
        /** @type {any} */ ({
          getGroupMembers: jest.fn().mockRejectedValue(mockError)
        })
      )

      jest.mocked(withLock).mockImplementation(async (name, fn) => {
        return await fn()
      })

      await expect(syncAdminUsersFromGroup()).rejects.toThrow(mockError)

      expect(mockSession.endSession).toHaveBeenCalled()
    })

    test('should handle empty group members', async () => {
      const mockSession = {
        withTransaction: jest.fn((fn) => fn()),
        endSession: jest.fn()
      }

      jest
        .mocked(client.startSession)
        .mockReturnValue(/** @type {any} */ (mockSession))

      jest.spyOn(azureAdModule, 'getAzureAdService').mockReturnValue(
        /** @type {any} */ ({
          getGroupMembers: jest.fn().mockResolvedValue([])
        })
      )

      jest.mocked(withLock).mockImplementation(async (name, fn) => {
        return await fn()
      })

      await syncAdminUsersFromGroup()

      expect(withLock).toHaveBeenCalled()

      expect(client.startSession).toHaveBeenCalled()
      expect(mockSession.endSession).toHaveBeenCalled()

      expect(mockSession.withTransaction).not.toHaveBeenCalled()
    })
  })
})
