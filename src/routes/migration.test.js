import Boom from '@hapi/boom'

import { createServer } from '~/src/api/server.js'
import { migrateUsersFromAzureGroup } from '~/src/services/user.js'
import { auth } from '~/test/fixtures/auth.js'

jest.mock('~/src/mongo.js')
jest.mock('~/src/services/user.js')

const okStatusCode = 200
const serverErrorStatusCode = 500
const jsonContentType = 'application/json'

describe('Migration routes', () => {
  /** @type {Server} */
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(() => {
    return server.stop()
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('POST /users/migrate', () => {
    test('should migrate users successfully', async () => {
      const mockMigrationResult = {
        status: 'completed',
        summary: {
          total: 2,
          successful: 2,
          failed: 0,
          skipped: 0
        },
        results: {
          successful: [
            {
              userId: '12345',
              displayName: 'John Doe',
              email: 'john.doe@defra.gov.uk',
              roles: ['form-creator'],
              scopes: ['form_create', 'form_update']
            },
            {
              userId: '67890',
              displayName: 'Jane Smith',
              email: 'jane.smith@defra.gov.uk',
              roles: ['form-creator'],
              scopes: ['form_create', 'form_update']
            }
          ],
          failed: [],
          skipped: []
        }
      }

      jest
        .mocked(migrateUsersFromAzureGroup)
        .mockResolvedValue(mockMigrationResult)

      const response = await server.inject({
        method: 'POST',
        url: '/users/migrate',
        payload: {
          roles: ['form-creator']
        },
        auth
      })

      expect(response.statusCode).toEqual(okStatusCode)
      expect(response.headers['content-type']).toContain(jsonContentType)
      expect(response.result).toEqual({
        message: 'Migration completed',
        ...mockMigrationResult
      })
      expect(migrateUsersFromAzureGroup).toHaveBeenCalledWith(['form-creator'])
    })

    test('should use default roles when none provided', async () => {
      const mockMigrationResult = {
        status: 'completed',
        summary: {
          total: 1,
          successful: 1,
          failed: 0,
          skipped: 0
        },
        results: {
          successful: [
            {
              userId: '12345',
              displayName: 'John Doe',
              email: 'john.doe@defra.gov.uk',
              roles: ['form-creator'],
              scopes: ['form_create', 'form_update']
            }
          ],
          failed: [],
          skipped: []
        }
      }

      jest
        .mocked(migrateUsersFromAzureGroup)
        .mockResolvedValue(mockMigrationResult)

      const response = await server.inject({
        method: 'POST',
        url: '/users/migrate',
        auth
      })

      expect(response.statusCode).toEqual(okStatusCode)
      expect(response.headers['content-type']).toContain(jsonContentType)
      expect(migrateUsersFromAzureGroup).toHaveBeenCalledWith(['form-creator'])
    })

    test('should handle migration with some failures', async () => {
      const mockMigrationResult = {
        status: 'completed',
        summary: {
          total: 3,
          successful: 1,
          failed: 1,
          skipped: 1
        },
        results: {
          successful: [
            {
              userId: '12345',
              displayName: 'John Doe',
              email: 'john.doe@defra.gov.uk',
              roles: ['form-creator'],
              scopes: ['form_create', 'form_update']
            }
          ],
          failed: [
            {
              userId: '67890',
              displayName: 'Jane Smith',
              email: 'jane.smith@defra.gov.uk',
              error: 'Database error'
            }
          ],
          skipped: [
            {
              userId: '99999',
              displayName: 'Bob Wilson',
              email: 'bob.wilson@defra.gov.uk',
              reason: 'User already exists'
            }
          ]
        }
      }

      jest
        .mocked(migrateUsersFromAzureGroup)
        .mockResolvedValue(mockMigrationResult)

      const response = await server.inject({
        method: 'POST',
        url: '/users/migrate',
        payload: {
          roles: ['admin']
        },
        auth
      })

      expect(response.statusCode).toEqual(okStatusCode)
      expect(response.headers['content-type']).toContain(jsonContentType)
      expect(response.result).toEqual({
        message: 'Migration completed',
        ...mockMigrationResult
      })
      expect(migrateUsersFromAzureGroup).toHaveBeenCalledWith(['admin'])
    })

    test('should return 500 when migration fails', async () => {
      jest
        .mocked(migrateUsersFromAzureGroup)
        .mockRejectedValue(new Error('Azure AD service unavailable'))

      const response = await server.inject({
        method: 'POST',
        url: '/users/migrate',
        auth
      })

      expect(response.statusCode).toEqual(serverErrorStatusCode)
      expect(response.result).toBeDefined()
      // @ts-expect-error - Boom error response structure
      expect(response.result.message).toBe('An internal server error occurred')
    })

    test('should re-throw Boom errors without modification', async () => {
      const boomError = Boom.badRequest('Invalid Azure group configuration')

      jest.mocked(migrateUsersFromAzureGroup).mockRejectedValue(boomError)

      const response = await server.inject({
        method: 'POST',
        url: '/users/migrate',
        auth
      })

      expect(response.statusCode).toBe(400)
      expect(response.result).toBeDefined()
      // @ts-expect-error - Boom error response structure
      expect(response.result.message).toBe('Invalid Azure group configuration')
    })

    test('should validate role values', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/users/migrate',
        payload: {
          roles: ['invalid-role']
        },
        auth
      })

      expect(response.statusCode).toBe(400)
    })

    test('should accept valid role values', async () => {
      const mockMigrationResult = {
        status: 'completed',
        summary: { total: 0, successful: 0, failed: 0, skipped: 0 },
        results: { successful: [], failed: [], skipped: [] }
      }

      jest
        .mocked(migrateUsersFromAzureGroup)
        .mockResolvedValue(mockMigrationResult)

      for (const role of ['admin', 'form-publisher', 'form-creator']) {
        const response = await server.inject({
          method: 'POST',
          url: '/users/migrate',
          payload: {
            roles: [role]
          },
          auth
        })

        expect(response.statusCode).toEqual(okStatusCode)
        expect(migrateUsersFromAzureGroup).toHaveBeenCalledWith([role])
        jest.clearAllMocks()
      }
    })
  })
})

/**
 * @import { Server } from '@hapi/hapi'
 */
