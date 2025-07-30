import Boom from '@hapi/boom'

import {
  mockAdminUser,
  mockFormCreatorUser
} from '~/src/api/__stubs__/users.js'
import { createServer } from '~/src/api/server.js'
import {
  addUser,
  deleteUser,
  getAllUsers,
  getUser,
  updateUser
} from '~/src/services/user.js'
import { auth } from '~/test/fixtures/auth.js'

jest.mock('~/src/mongo.js')
jest.mock('~/src/services/user.js')

const okStatusCode = 200
const jsonContentType = 'application/json'

describe('User route', () => {
  /** @type {Server} */
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(() => {
    return server.stop()
  })

  describe('Success responses', () => {
    describe('GET /users', () => {
      test('should return list of users', async () => {
        jest.mocked(getAllUsers).mockResolvedValue([])

        const response = await server.inject({
          method: 'GET',
          url: '/users',
          auth
        })

        expect(response.statusCode).toEqual(okStatusCode)
        expect(response.headers['content-type']).toContain(jsonContentType)
        expect(response.result).toEqual({ entities: [], message: 'success' })
      })
    })

    describe('GET /users/{userId}', () => {
      test('should return the user', async () => {
        jest.mocked(getUser).mockResolvedValue(mockFormCreatorUser)

        const response = await server.inject({
          method: 'GET',
          url: '/users/123',
          auth
        })

        expect(response.statusCode).toEqual(okStatusCode)
        expect(response.headers['content-type']).toContain(jsonContentType)
        expect(response.result).toEqual({
          entity: mockFormCreatorUser,
          message: 'success'
        })
      })
    })

    describe('POST /users', () => {
      test('should add the user', async () => {
        jest.mocked(addUser).mockResolvedValue({
          id: 'user-test-defra-gov-uk',
          email: 'test@defra.gov.uk',
          displayName: 'Test User',
          status: 'success'
        })

        jest.mocked(getUser).mockResolvedValue({
          userId: 'user-test-defra-gov-uk',
          roles: ['form-creator'],
          scopes: ['form_create', 'form_update']
        })

        const response = await server.inject({
          method: 'POST',
          url: '/users',
          payload: {
            email: 'test@defra.gov.uk',
            roles: ['form-creator']
          },
          auth
        })

        expect(response.statusCode).toEqual(okStatusCode)
        expect(response.headers['content-type']).toContain(jsonContentType)
        expect(response.result).toEqual({
          id: 'user-test-defra-gov-uk',
          email: 'test@defra.gov.uk',
          displayName: 'Test User',
          message: 'success',
          entity: {
            userId: 'user-test-defra-gov-uk',
            roles: ['form-creator'],
            scopes: ['form_create', 'form_update']
          }
        })
      })
    })

    describe('PUT /users/{userId}', () => {
      test('should update the user', async () => {
        jest
          .mocked(updateUser)
          .mockResolvedValue({ id: '456', status: 'success' })

        const response = await server.inject({
          method: 'PUT',
          url: '/users/123',
          payload: {
            roles: mockAdminUser.roles
          },
          auth
        })

        expect(response.statusCode).toEqual(okStatusCode)
        expect(response.headers['content-type']).toContain(jsonContentType)
        expect(response.result).toEqual({ id: '456', message: 'success' })
      })
    })

    describe('DELETE /users/{userId}', () => {
      test('should delete the user', async () => {
        jest
          .mocked(deleteUser)
          .mockResolvedValue({ id: '456', status: 'success' })

        const response = await server.inject({
          method: 'DELETE',
          url: '/users/123',
          auth
        })

        expect(response.statusCode).toEqual(okStatusCode)
        expect(response.headers['content-type']).toContain(jsonContentType)
        expect(response.result).toEqual({ id: '456', message: 'success' })
      })
    })

    describe('GET /roles', () => {
      test('should return list of roles with their descriptions', async () => {
        const response = await server.inject({
          method: 'GET',
          url: '/roles',
          auth
        })

        expect(response.statusCode).toEqual(okStatusCode)
        expect(response.headers['content-type']).toContain(jsonContentType)
        expect(response.result).toEqual({
          message: 'success',
          roles: [
            {
              name: 'Admin',
              code: 'admin',
              description:
                'Allows full access to forms and user management functions'
            },
            {
              name: 'Form creator',
              code: 'form-creator',
              description:
                'Allows a user to create a form and edit it while in draft'
            }
          ]
        })
      })
    })
  })

  describe('Error handling', () => {
    beforeEach(() => {
      jest.clearAllMocks()
    })

    describe('POST /users', () => {
      test('should return 500 when addUser fails with generic error', async () => {
        jest
          .mocked(addUser)
          .mockRejectedValue(new Error('Database connection failed'))

        const response = await server.inject({
          method: 'POST',
          url: '/users',
          payload: {
            email: 'test@defra.gov.uk',
            roles: ['form-creator']
          },
          auth
        })

        expect(response.statusCode).toBe(500)
        expect(response.result).toBeDefined()
        // @ts-expect-error - Boom error response structure
        expect(response.result.message).toBe(
          'An internal server error occurred'
        )
      })

      test('should re-throw Boom errors without modification', async () => {
        const boomError = Boom.conflict('User already exists')

        jest.mocked(addUser).mockRejectedValue(boomError)

        const response = await server.inject({
          method: 'POST',
          url: '/users',
          payload: {
            email: 'test@defra.gov.uk',
            roles: ['form-creator']
          },
          auth
        })

        expect(response.statusCode).toBe(409)
        expect(response.result).toBeDefined()
        // @ts-expect-error - Boom error response structure
        expect(response.result.message).toBe('User already exists')
      })

      test('should return 500 when getUser fails after successful addUser', async () => {
        jest.mocked(addUser).mockResolvedValue({
          id: 'user-test-defra-gov-uk',
          email: 'test@defra.gov.uk',
          displayName: 'Test User',
          status: 'success'
        })

        jest
          .mocked(getUser)
          .mockRejectedValue(new Error('Failed to retrieve user'))

        const response = await server.inject({
          method: 'POST',
          url: '/users',
          payload: {
            email: 'test@defra.gov.uk',
            roles: ['form-creator']
          },
          auth
        })

        expect(response.statusCode).toBe(500)
        expect(response.result).toBeDefined()
        // @ts-expect-error - Boom error response structure
        expect(response.result.message).toBe(
          'An internal server error occurred'
        )
      })
    })

    describe('PUT /users/{userId}', () => {
      test('should return 500 when updateUser fails with generic error', async () => {
        jest
          .mocked(updateUser)
          .mockRejectedValue(new Error('Database update failed'))

        const response = await server.inject({
          method: 'PUT',
          url: '/users/123',
          payload: {
            roles: ['admin']
          },
          auth
        })

        expect(response.statusCode).toBe(500)
        expect(response.result).toBeDefined()
        // @ts-expect-error - Boom error response structure
        expect(response.result.message).toBe(
          'An internal server error occurred'
        )
      })

      test('should re-throw Boom errors without modification', async () => {
        const boomError = Boom.notFound('User not found')

        jest.mocked(updateUser).mockRejectedValue(boomError)

        const response = await server.inject({
          method: 'PUT',
          url: '/users/nonexistent',
          payload: {
            roles: ['admin']
          },
          auth
        })

        expect(response.statusCode).toBe(404)
        expect(response.result).toBeDefined()
        // @ts-expect-error - Boom error response structure
        expect(response.result.message).toBe('User not found')
      })
    })
  })
})

/**
 * @import { Server } from '@hapi/hapi'
 */
