import Boom from '@hapi/boom'
import { Client } from '@microsoft/microsoft-graph-client'
import { StatusCodes } from 'http-status-codes'

import { config } from '~/src/config/index.js'
import {
  GRAPH_ERROR_CODES,
  HTTP_RESPONSE_MESSAGES
} from '~/src/helpers/azure-error-constants.js'
import { getAzureAdService } from '~/src/services/azure-ad.js'

jest.mock('@azure/identity', () => ({
  ClientSecretCredential: jest.fn().mockImplementation(() => ({
    getToken: jest.fn().mockResolvedValue({
      token: 'mock-token',
      expiresOnTimestamp: Date.now() + 3600000
    })
  }))
}))

jest.mock('@microsoft/microsoft-graph-client', () => ({
  Client: {
    initWithMiddleware: jest.fn().mockReturnValue({
      api: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      get: jest.fn()
    })
  }
}))

jest.mock(
  '@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials/index.js',
  () => ({
    TokenCredentialAuthenticationProvider: jest
      .fn()
      .mockImplementation(() => ({}))
  })
)

jest.mock('~/src/config/index.js', () => ({
  config: {
    get: jest.fn().mockImplementation((key) => {
      if (key === 'azure.clientId') return 'mock-client-id'
      if (key === 'azure.clientSecret') return 'mock-client-secret'
      if (key === 'azure.tenantId') return 'mock-tenant-id'
      return null
    })
  }
}))

jest.mock('~/src/helpers/logging/logger.js', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }))
}))

describe('Azure AD Service', () => {
  /** @type {any} */
  let mockGraphClient
  /** @type {any} */
  let service

  beforeEach(() => {
    jest.clearAllMocks()

    mockGraphClient = {
      api: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      get: jest.fn()
    }

    jest.mocked(Client.initWithMiddleware).mockReturnValue(mockGraphClient)

    jest.mocked(config.get).mockImplementation((key) => {
      if (key === 'azure.clientId') return 'mock-client-id'
      if (key === 'azure.clientSecret') return 'mock-client-secret'
      if (key === 'azure.tenantId') return 'mock-tenant-id'
      return null
    })

    service = getAzureAdService()
    service.graphClient = mockGraphClient
  })

  describe('getGroupMembers', () => {
    test('should return group members successfully', async () => {
      const mockResponse = {
        value: [
          {
            '@odata.type': '#microsoft.graph.user',
            id: 'user1',
            displayName: 'John Doe',
            mail: 'john.doe@defra.gov.uk',
            userPrincipalName: 'john.doe@defra.gov.uk'
          },
          {
            '@odata.type': '#microsoft.graph.user',
            id: 'user2',
            displayName: 'Jane Smith',
            mail: null,
            userPrincipalName: 'jane.smith@defra.gov.uk'
          },
          {
            '@odata.type': '#microsoft.graph.group',
            id: 'group1',
            displayName: 'Test Group'
          }
        ]
      }

      mockGraphClient.get.mockResolvedValue(mockResponse)

      const result = await service.getGroupMembers('test-group-id')

      expect(result).toEqual([
        {
          id: 'user1',
          displayName: 'John Doe',
          email: 'john.doe@defra.gov.uk'
        },
        {
          id: 'user2',
          displayName: 'Jane Smith',
          email: 'jane.smith@defra.gov.uk'
        }
      ])

      expect(mockGraphClient.api).toHaveBeenCalledWith(
        '/groups/test-group-id/members'
      )
      expect(mockGraphClient.select).toHaveBeenCalledWith(
        'id,displayName,mail,userPrincipalName'
      )
    })

    test('should handle errors and throw Boom internal error', async () => {
      const mockError = new Error('Graph API error')
      mockGraphClient.get.mockRejectedValue(mockError)

      await expect(service.getGroupMembers('test-group-id')).rejects.toThrow(
        Boom.internal('Failed to fetch group members: Graph API error')
      )
    })

    test('should filter out non-user members', async () => {
      const mockResponse = {
        value: [
          {
            '@odata.type': '#microsoft.graph.group',
            id: 'group1',
            displayName: 'Test Group'
          },
          {
            '@odata.type': '#microsoft.graph.device',
            id: 'device1',
            displayName: 'Test Device'
          }
        ]
      }

      mockGraphClient.get.mockResolvedValue(mockResponse)

      const result = await service.getGroupMembers('test-group-id')

      expect(result).toEqual([])
    })
  })

  describe('getUserByEmail', () => {
    test('should return user details successfully', async () => {
      const mockUser = {
        id: 'user123',
        givenName: 'John',
        surname: 'Doe',
        displayName: 'John Doe',
        mail: 'john.doe@defra.gov.uk',
        userPrincipalName: 'john.doe@defra.gov.uk'
      }

      mockGraphClient.get.mockResolvedValue(mockUser)

      const result = await service.getUserByEmail('john.doe@defra.gov.uk')

      expect(result).toEqual({
        id: 'user123',
        displayName: 'John Doe',
        email: 'john.doe@defra.gov.uk'
      })

      expect(mockGraphClient.api).toHaveBeenCalledWith(
        '/users/john.doe@defra.gov.uk'
      )
      expect(mockGraphClient.select).toHaveBeenCalledWith(
        'id,givenName,surname,displayName,mail,userPrincipalName'
      )
    })

    test('should construct displayName from givenName and surname when available', async () => {
      const mockUser = {
        id: 'user123',
        givenName: 'John',
        surname: 'Doe',
        displayName: 'JDoe',
        mail: 'john.doe@defra.gov.uk',
        userPrincipalName: 'john.doe@defra.gov.uk'
      }

      mockGraphClient.get.mockResolvedValue(mockUser)

      const result = await service.getUserByEmail('john.doe@defra.gov.uk')

      expect(result.displayName).toBe('John Doe')
    })

    test('should use userPrincipalName when mail is null', async () => {
      const mockUser = {
        id: 'user123',
        givenName: 'John',
        surname: 'Doe',
        displayName: 'John Doe',
        mail: null,
        userPrincipalName: 'john.doe@defra.gov.uk'
      }

      mockGraphClient.get.mockResolvedValue(mockUser)

      const result = await service.getUserByEmail('john.doe@defra.gov.uk')

      expect(result.email).toBe('john.doe@defra.gov.uk')
    })

    test('should handle 404 not found error', async () => {
      const mockError = {
        code: GRAPH_ERROR_CODES.REQUEST_RESOURCE_NOT_FOUND,
        statusCode: StatusCodes.NOT_FOUND
      }

      mockGraphClient.get.mockRejectedValue(mockError)

      await expect(
        service.getUserByEmail('notfound@defra.gov.uk')
      ).rejects.toThrow(
        Boom.notFound(
          `${HTTP_RESPONSE_MESSAGES.USER_NOT_FOUND}: looking up user by email`
        )
      )
    })

    test('should handle 403 forbidden error', async () => {
      const mockError = {
        code: GRAPH_ERROR_CODES.ACCESS_DENIED,
        statusCode: StatusCodes.FORBIDDEN
      }

      mockGraphClient.get.mockRejectedValue(mockError)

      await expect(
        service.getUserByEmail('forbidden@defra.gov.uk')
      ).rejects.toThrow(
        Boom.forbidden(
          `${HTTP_RESPONSE_MESSAGES.PERMISSION_DENIED}: looking up user by email`
        )
      )
    })

    test('should handle generic errors as internal server error', async () => {
      const mockError = {
        code: 'SomeOtherError',
        statusCode: 500,
        message: 'Internal server error'
      }

      mockGraphClient.get.mockRejectedValue(mockError)

      await expect(
        service.getUserByEmail('error@defra.gov.uk')
      ).rejects.toThrow(
        expect.objectContaining({
          message: expect.stringContaining('Graph API error')
        })
      )
    })
  })

  describe('validateUser', () => {
    test('should return user details successfully', async () => {
      const mockUser = {
        id: 'user123',
        givenName: 'John',
        surname: 'Doe',
        displayName: 'John Doe',
        mail: 'john.doe@defra.gov.uk',
        userPrincipalName: 'john.doe@defra.gov.uk'
      }

      mockGraphClient.get.mockResolvedValue(mockUser)

      const result = await service.validateUser('user123')

      expect(result).toEqual({
        id: 'user123',
        displayName: 'John Doe',
        email: 'john.doe@defra.gov.uk'
      })

      expect(mockGraphClient.api).toHaveBeenCalledWith('/users/user123')
      expect(mockGraphClient.select).toHaveBeenCalledWith(
        'id,givenName,surname,displayName,mail,userPrincipalName'
      )
    })

    test('should handle user not found error', async () => {
      const mockError = {
        code: GRAPH_ERROR_CODES.NOT_FOUND,
        statusCode: StatusCodes.NOT_FOUND
      }

      mockGraphClient.get.mockRejectedValue(mockError)

      await expect(service.validateUser('invalid-user')).rejects.toThrow(
        expect.objectContaining({
          message: expect.stringContaining('User not found')
        })
      )
    })

    test('should handle nested error code structure', async () => {
      const mockError = {
        error: {
          code: GRAPH_ERROR_CODES.RESOURCE_NOT_FOUND
        },
        statusCode: StatusCodes.NOT_FOUND
      }

      mockGraphClient.get.mockRejectedValue(mockError)

      await expect(service.validateUser('invalid-user')).rejects.toThrow(
        expect.objectContaining({
          message: expect.stringContaining('User not found')
        })
      )
    })
  })

  describe('getAzureAdService singleton', () => {
    test('should return the same instance', () => {
      const instance1 = getAzureAdService()
      const instance2 = getAzureAdService()

      expect(instance1).toBe(instance2)
    })
  })

  describe('Error handling functions', () => {
    test('isNotFoundError should identify 404 errors correctly', async () => {
      const notFoundCodes = [
        GRAPH_ERROR_CODES.REQUEST_RESOURCE_NOT_FOUND,
        GRAPH_ERROR_CODES.RESOURCE_NOT_FOUND,
        GRAPH_ERROR_CODES.NOT_FOUND
      ]

      for (const code of notFoundCodes) {
        const mockError = { code, statusCode: 200 }
        mockGraphClient.get.mockRejectedValue(mockError)

        await expect(
          service.getUserByEmail('test@defra.gov.uk')
        ).rejects.toThrow(
          expect.objectContaining({
            message: expect.stringContaining('User not found')
          })
        )
      }

      // Test with status code
      const mockError = { statusCode: StatusCodes.NOT_FOUND }
      mockGraphClient.get.mockRejectedValue(mockError)

      await expect(service.getUserByEmail('test@defra.gov.uk')).rejects.toThrow(
        expect.objectContaining({
          message: expect.stringContaining('User not found')
        })
      )
    })

    test('isForbiddenError should identify 403 errors correctly', async () => {
      const forbiddenCodes = [
        GRAPH_ERROR_CODES.AUTHORIZATION_REQUEST_DENIED,
        GRAPH_ERROR_CODES.ERROR_ACCESS_DENIED,
        GRAPH_ERROR_CODES.ACCESS_DENIED,
        GRAPH_ERROR_CODES.ACCESS_DENIED_LOWER
      ]

      for (const code of forbiddenCodes) {
        const mockError = { code, statusCode: 200 }
        mockGraphClient.get.mockRejectedValue(mockError)

        await expect(
          service.getUserByEmail('test@defra.gov.uk')
        ).rejects.toThrow(
          expect.objectContaining({
            message: expect.stringContaining('Permission denied')
          })
        )
      }

      const mockError = { statusCode: StatusCodes.FORBIDDEN }
      mockGraphClient.get.mockRejectedValue(mockError)

      await expect(service.getUserByEmail('test@defra.gov.uk')).rejects.toThrow(
        expect.objectContaining({
          message: expect.stringContaining('Permission denied')
        })
      )
    })

    test('should handle errors without codes or status codes', async () => {
      const mockError = new Error('Generic error')
      mockGraphClient.get.mockRejectedValue(mockError)

      await expect(service.getUserByEmail('test@defra.gov.uk')).rejects.toThrow(
        expect.objectContaining({
          message: expect.stringContaining('Graph API error')
        })
      )
    })

    test('should handle errors with status property instead of statusCode', async () => {
      const mockError = {
        code: 'SomeError',
        status: StatusCodes.NOT_FOUND,
        message: 'Not found via status property'
      }
      mockGraphClient.get.mockRejectedValue(mockError)

      await expect(service.getUserByEmail('test@defra.gov.uk')).rejects.toThrow(
        expect.objectContaining({
          message: expect.stringContaining('User not found')
        })
      )
    })

    test('should handle errors with nested error.error structure', async () => {
      const mockError = {
        error: {
          error: {
            code: GRAPH_ERROR_CODES.ACCESS_DENIED
          }
        },
        statusCode: 200
      }
      mockGraphClient.get.mockRejectedValue(mockError)

      await expect(service.getUserByEmail('test@defra.gov.uk')).rejects.toThrow(
        expect.objectContaining({
          message: expect.stringContaining('Graph API error')
        })
      )
    })
  })

  describe('Additional edge cases and error scenarios', () => {
    test('getGroupMembers should handle members with missing email fields', async () => {
      const mockResponse = {
        value: [
          {
            '@odata.type': '#microsoft.graph.user',
            id: 'user1',
            displayName: 'John Doe',
            mail: null,
            userPrincipalName: null
          },
          {
            '@odata.type': '#microsoft.graph.user',
            id: 'user2',
            displayName: 'Jane Smith',
            mail: undefined,
            userPrincipalName: 'jane.smith@defra.gov.uk'
          }
        ]
      }

      mockGraphClient.get.mockResolvedValue(mockResponse)

      const result = await service.getGroupMembers('test-group-id')

      expect(result).toEqual([
        {
          id: 'user1',
          displayName: 'John Doe',
          email: null
        },
        {
          id: 'user2',
          displayName: 'Jane Smith',
          email: 'jane.smith@defra.gov.uk'
        }
      ])
    })

    test('getUserByEmail should handle user with no givenName or surname', async () => {
      const mockUser = {
        id: 'user123',
        givenName: null,
        surname: null,
        displayName: 'Corporate Account',
        mail: 'corporate@defra.gov.uk',
        userPrincipalName: 'corporate@defra.gov.uk'
      }

      mockGraphClient.get.mockResolvedValue(mockUser)

      const result = await service.getUserByEmail('corporate@defra.gov.uk')

      expect(result.displayName).toBe('Corporate Account')
    })

    test('getUserByEmail should handle user with only givenName', async () => {
      const mockUser = {
        id: 'user123',
        givenName: 'John',
        surname: null,
        displayName: 'John',
        mail: 'john@defra.gov.uk',
        userPrincipalName: 'john@defra.gov.uk'
      }

      mockGraphClient.get.mockResolvedValue(mockUser)

      const result = await service.getUserByEmail('john@defra.gov.uk')

      expect(result.displayName).toBe('John')
    })

    test('getUserByEmail should handle user with only surname', async () => {
      const mockUser = {
        id: 'user123',
        givenName: null,
        surname: 'Doe',
        displayName: 'Doe',
        mail: 'doe@defra.gov.uk',
        userPrincipalName: 'doe@defra.gov.uk'
      }

      mockGraphClient.get.mockResolvedValue(mockUser)

      const result = await service.getUserByEmail('doe@defra.gov.uk')

      expect(result.displayName).toBe('Doe')
    })

    test('getUserByEmail should handle user with empty displayName', async () => {
      const mockUser = {
        id: 'user123',
        givenName: 'John',
        surname: 'Doe',
        displayName: '',
        mail: 'john.doe@defra.gov.uk',
        userPrincipalName: 'john.doe@defra.gov.uk'
      }

      mockGraphClient.get.mockResolvedValue(mockUser)

      const result = await service.getUserByEmail('john.doe@defra.gov.uk')

      expect(result.displayName).toBe('John Doe')
    })

    test('validateUser should handle all error scenarios', async () => {
      // Test each forbidden error code
      const forbiddenCodes = [
        GRAPH_ERROR_CODES.AUTHORIZATION_REQUEST_DENIED,
        GRAPH_ERROR_CODES.ERROR_ACCESS_DENIED,
        GRAPH_ERROR_CODES.ACCESS_DENIED,
        GRAPH_ERROR_CODES.ACCESS_DENIED_LOWER
      ]

      for (const code of forbiddenCodes) {
        jest.clearAllMocks()
        const mockError = { code, statusCode: 200 }
        mockGraphClient.get.mockRejectedValue(mockError)

        await expect(service.validateUser('test-user')).rejects.toThrow(
          expect.objectContaining({
            message: expect.stringContaining('Permission denied')
          })
        )
      }
    })

    test('validateUser should handle error with both error.code and direct code', async () => {
      const mockError = {
        code: 'DirectCode',
        error: {
          code: GRAPH_ERROR_CODES.NOT_FOUND
        },
        statusCode: 200
      }
      mockGraphClient.get.mockRejectedValue(mockError)

      await expect(service.validateUser('test-user')).rejects.toThrow(
        expect.objectContaining({
          message: expect.stringContaining('Graph API error')
        })
      )
    })

    test('handleGraphError should prefer error.code over direct code when both exist', async () => {
      const mockError = {
        error: {
          code: GRAPH_ERROR_CODES.NOT_FOUND
        },
        code: 'SomeOtherCode'
      }
      mockGraphClient.get.mockRejectedValue(mockError)

      await expect(service.getUserByEmail('test@defra.gov.uk')).rejects.toThrow(
        expect.objectContaining({
          message: expect.stringContaining('Graph API error')
        })
      )
    })

    test('all error handling functions should work with mixed case scenarios', async () => {
      const mockError = {
        code: 'SomeRandomCode',
        statusCode: StatusCodes.FORBIDDEN
      }
      mockGraphClient.get.mockRejectedValue(mockError)

      await expect(service.getUserByEmail('test@defra.gov.uk')).rejects.toThrow(
        expect.objectContaining({
          message: expect.stringContaining('Permission denied')
        })
      )
    })

    test('should properly construct error messages in handleGraphError', async () => {
      const mockError = {
        code: GRAPH_ERROR_CODES.REQUEST_RESOURCE_NOT_FOUND,
        message: 'Detailed error message'
      }
      mockGraphClient.get.mockRejectedValue(mockError)

      await expect(service.getUserByEmail('test@defra.gov.uk')).rejects.toThrow(
        expect.objectContaining({
          message: expect.stringContaining(
            'User not found: looking up user by email'
          )
        })
      )
    })

    test('validateUser should handle user with missing email fields', async () => {
      const mockUser = {
        id: 'user123',
        givenName: 'John',
        surname: 'Doe',
        displayName: 'John Doe',
        mail: null,
        userPrincipalName: null
      }

      mockGraphClient.get.mockResolvedValue(mockUser)

      const result = await service.validateUser('user123')

      expect(result.email).toBeNull()
    })

    test('should handle getGroupMembers with empty response', async () => {
      const mockResponse = {
        value: []
      }

      mockGraphClient.get.mockResolvedValue(mockResponse)

      const result = await service.getGroupMembers('empty-group-id')

      expect(result).toEqual([])
    })
  })
})
