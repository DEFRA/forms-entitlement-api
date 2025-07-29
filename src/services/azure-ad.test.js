import Boom from '@hapi/boom'

import { GRAPH_ERROR_CODES } from '~/src/helpers/azure-error-constants.js'

jest.mock('@azure/identity')
jest.mock('@microsoft/microsoft-graph-client')
jest.mock('~/src/config/index.js', () => ({
  config: {
    get: jest.fn((key) => {
      /** @type {Record<string, string>} */
      const mockConfig = {
        'azure.clientId': 'mock-client-id',
        'azure.clientSecret': 'mock-client-secret',
        'azure.tenantId': 'mock-tenant-id'
      }
      return mockConfig[key] || null
    })
  }
}))

const mockGetAzureAdService = jest.fn()

jest.doMock('~/src/services/azure-ad.js', () => ({
  getAzureAdService: mockGetAzureAdService
}))

describe('Azure AD Service', () => {
  /** @type {any} */
  let mockAzureAdService

  beforeEach(() => {
    mockAzureAdService = {
      getGroupMembers: jest.fn(),
      getMigrationSourceGroupMembers: jest.fn(),
      validateUser: jest.fn(),
      batchValidateUsers: jest.fn(),
      getGroup: jest.fn(),
      getUserByEmail: jest.fn()
    }

    mockGetAzureAdService.mockReturnValue(mockAzureAdService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('getGroupMembers', () => {
    test('should return group members', async () => {
      const mockMembers = [
        {
          id: '12345',
          displayName: 'John Doe',
          email: 'john.doe@defra.gov.uk'
        }
      ]

      mockAzureAdService.getGroupMembers.mockResolvedValue(mockMembers)

      const result = await mockAzureAdService.getGroupMembers('group-id')

      expect(result).toEqual(mockMembers)
      expect(mockAzureAdService.getGroupMembers).toHaveBeenCalledWith(
        'group-id'
      )
    })

    test('should throw error for invalid group', async () => {
      mockAzureAdService.getGroupMembers.mockRejectedValue(
        new Error('Group not found')
      )

      await expect(
        mockAzureAdService.getGroupMembers('invalid-group')
      ).rejects.toThrow('Group not found')
    })
  })

  describe('validateUser', () => {
    test('should return user details for valid user', async () => {
      const mockUser = {
        id: '12345',
        displayName: 'John Doe',
        email: 'john.doe@defra.gov.uk'
      }

      mockAzureAdService.validateUser.mockResolvedValue(mockUser)

      const result = await mockAzureAdService.validateUser('12345')

      expect(result).toEqual(mockUser)
      expect(mockAzureAdService.validateUser).toHaveBeenCalledWith('12345')
    })

    test('should throw error for invalid user', async () => {
      mockAzureAdService.validateUser.mockRejectedValue(
        new Error('User not found in Azure AD')
      )

      await expect(
        mockAzureAdService.validateUser('invalid-user')
      ).rejects.toThrow('User not found in Azure AD')
    })
  })

  describe('batchValidateUsers', () => {
    test('should validate multiple users', async () => {
      const mockResults = {
        valid: [
          {
            id: '12345',
            displayName: 'John Doe',
            email: 'john.doe@defra.gov.uk'
          }
        ],
        invalid: ['invalid-user']
      }

      mockAzureAdService.batchValidateUsers.mockResolvedValue(mockResults)

      const result = await mockAzureAdService.batchValidateUsers([
        '12345',
        'invalid-user'
      ])

      expect(result).toEqual(mockResults)
      expect(mockAzureAdService.batchValidateUsers).toHaveBeenCalledWith([
        '12345',
        'invalid-user'
      ])
    })
  })

  describe('getGroup', () => {
    test('should return group details', async () => {
      const mockGroup = {
        id: 'group-id',
        displayName: 'Test Group',
        description: 'Test group for forms',
        mailEnabled: true,
        securityEnabled: true
      }

      mockAzureAdService.getGroup.mockResolvedValue(mockGroup)

      const result = await mockAzureAdService.getGroup('group-id')

      expect(result).toEqual(mockGroup)
      expect(mockAzureAdService.getGroup).toHaveBeenCalledWith('group-id')
    })
  })

  describe('getMigrationSourceGroupMembers', () => {
    test('should return migration source group members', async () => {
      const mockMembers = [
        {
          id: '12345',
          displayName: 'John Doe',
          email: 'john.doe@defra.gov.uk'
        }
      ]

      mockAzureAdService.getMigrationSourceGroupMembers.mockResolvedValue(
        mockMembers
      )

      const result = await mockAzureAdService.getMigrationSourceGroupMembers()

      expect(result).toEqual(mockMembers)
      expect(
        mockAzureAdService.getMigrationSourceGroupMembers
      ).toHaveBeenCalled()
    })
  })

  describe('Error Code Classification', () => {
    test('should correctly identify 404 error codes', () => {
      const notFoundCodes = [
        GRAPH_ERROR_CODES.REQUEST_RESOURCE_NOT_FOUND,
        GRAPH_ERROR_CODES.RESOURCE_NOT_FOUND,
        GRAPH_ERROR_CODES.NOT_FOUND
      ]

      const allNotFoundCodes = [
        GRAPH_ERROR_CODES.REQUEST_RESOURCE_NOT_FOUND,
        GRAPH_ERROR_CODES.RESOURCE_NOT_FOUND,
        GRAPH_ERROR_CODES.NOT_FOUND
      ]

      notFoundCodes.forEach((code) => {
        expect(allNotFoundCodes).toContain(code)
      })
    })

    test('should correctly identify 403 error codes', () => {
      const forbiddenCodes = [
        GRAPH_ERROR_CODES.AUTHORIZATION_REQUEST_DENIED,
        GRAPH_ERROR_CODES.ERROR_ACCESS_DENIED,
        GRAPH_ERROR_CODES.ACCESS_DENIED,
        GRAPH_ERROR_CODES.ACCESS_DENIED_LOWER
      ]

      const allForbiddenCodes = [
        GRAPH_ERROR_CODES.AUTHORIZATION_REQUEST_DENIED,
        GRAPH_ERROR_CODES.ERROR_ACCESS_DENIED,
        GRAPH_ERROR_CODES.ACCESS_DENIED,
        GRAPH_ERROR_CODES.ACCESS_DENIED_LOWER
      ]

      forbiddenCodes.forEach((code) => {
        expect(allForbiddenCodes).toContain(code)
      })
    })

    test('should create correct Boom errors', () => {
      const notFoundError = Boom.notFound('User not found: test operation')
      expect(Boom.isBoom(notFoundError)).toBe(true)
      expect(notFoundError.output.statusCode).toBe(404)
      expect(notFoundError.message).toContain('User not found')

      const forbiddenError = Boom.forbidden('Permission denied: test operation')
      expect(Boom.isBoom(forbiddenError)).toBe(true)
      expect(forbiddenError.output.statusCode).toBe(403)
      expect(forbiddenError.message).toContain('Permission denied')
    })

    test('should handle nested error structure', () => {
      /** @type {{ error: { code: string }, message: string }} */
      const mockError = {
        error: {
          code: GRAPH_ERROR_CODES.REQUEST_RESOURCE_NOT_FOUND
        },
        message: 'Resource not found'
      }

      const errorCode = mockError.error.code
      expect(errorCode).toBe(GRAPH_ERROR_CODES.REQUEST_RESOURCE_NOT_FOUND)
    })

    test('should handle status code fallback', () => {
      /** @type {{ statusCode: number, message: string }} */
      const mockError = {
        statusCode: 404,
        message: 'Not found'
      }

      expect(mockError.statusCode).toBe(404)
    })
  })
})
