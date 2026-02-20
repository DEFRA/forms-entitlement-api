import Boom from '@hapi/boom'

import { createServer } from '~/src/api/server.js'
import * as allUsers from '~/src/services/user.js'
import { auth, noEntitlementAuth } from '~/test/fixtures/auth.js'

jest.mock('~/src/services/user.js')
jest.mock('~/src/mongo.js')
jest.mock('~/src/services/scheduler.js', () => ({
  initialiseAdminUserSync: jest.fn(() => null)
}))

const expectedCallingUser = {
  id: auth.credentials.user.oid,
  displayName: 'Enrique Chase'
}

describe('User route', () => {
  /** @type {import('@hapi/hapi').Server} */
  let server

  // Common test fixtures
  const okStatusCode = 200
  const jsonContentType = 'application/json'

  beforeEach(async () => {
    server = await createServer()
    await server.initialize()
    jest.clearAllMocks()
  })

  describe('Success responses', () => {
    describe('GET /users', () => {
      test('should return list of users', async () => {
        jest.mocked(allUsers.getAllUsers).mockResolvedValue([])

        const response = await server.inject({
          method: 'GET',
          url: '/users',
          auth
        })

        expect(response.statusCode).toEqual(okStatusCode)
        expect(response.headers['content-type']).toContain(jsonContentType)
        expect(response.result).toEqual({ entities: [] })

        expect(allUsers.getAllUsers).toHaveBeenCalled()
      })
    })

    describe('GET /users/{userId}', () => {
      test('should return the user', async () => {
        jest.mocked(allUsers.getUser).mockResolvedValue({
          userId: '456',
          roles: ['admin'],
          scopes: ['user-create', 'user-edit']
        })

        const response = await server.inject({
          method: 'GET',
          url: '/users/456',
          auth
        })

        expect(response.statusCode).toBe(okStatusCode)
        expect(response.headers['content-type']).toContain(jsonContentType)
        expect(response.result).toEqual({
          entity: {
            userId: '456',
            roles: ['admin'],
            scopes: ['user-create', 'user-edit']
          }
        })

        expect(allUsers.getUser).toHaveBeenCalledWith('456')
      })
    })

    describe('POST /users', () => {
      test('should add the user', async () => {
        jest.mocked(allUsers.addUser).mockResolvedValue({
          id: '456',
          email: 'test@example.com',
          displayName: 'Test User'
        })

        jest.mocked(allUsers.getUser).mockResolvedValue({
          userId: '456',
          roles: ['admin'],
          scopes: ['user-create', 'user-edit']
        })

        const response = await server.inject({
          method: 'POST',
          url: '/users',
          auth,
          payload: {
            email: 'test@example.com',
            roles: ['admin']
          }
        })

        expect(response.statusCode).toBe(okStatusCode)
        expect(response.headers['content-type']).toContain(jsonContentType)
        expect(response.result).toEqual({
          id: '456',
          email: 'test@example.com',
          displayName: 'Test User',
          entity: {
            userId: '456',
            roles: ['admin'],
            scopes: ['user-create', 'user-edit']
          }
        })

        expect(allUsers.addUser).toHaveBeenCalledWith(
          'test@example.com',
          ['admin'],
          expectedCallingUser,
          auth.credentials.roles
        )
        expect(allUsers.getUser).toHaveBeenCalledWith('456')
      })
    })

    describe('PUT /users/{userId}', () => {
      test('should update the user', async () => {
        jest.mocked(allUsers.updateUser).mockResolvedValue({
          id: '456'
        })

        const response = await server.inject({
          method: 'PUT',
          url: '/users/456',
          auth,
          payload: {
            roles: ['admin']
          }
        })

        expect(response.statusCode).toBe(okStatusCode)
        expect(response.headers['content-type']).toContain(jsonContentType)
        expect(response.result).toEqual({ id: '456' })

        expect(allUsers.updateUser).toHaveBeenCalledWith(
          '456',
          ['admin'],
          expectedCallingUser,
          auth.credentials.roles
        )
      })
    })

    describe('DELETE /users/{userId}', () => {
      test('should delete the user', async () => {
        jest.mocked(allUsers.deleteUser).mockResolvedValue({
          id: '456'
        })

        const response = await server.inject({
          method: 'DELETE',
          url: '/users/456',
          auth
        })

        expect(response.statusCode).toBe(okStatusCode)
        expect(response.headers['content-type']).toContain(jsonContentType)
        expect(response.result).toEqual({ id: '456' })

        expect(allUsers.deleteUser).toHaveBeenCalledWith(
          '456',
          expectedCallingUser,
          auth.credentials.roles
        )
      })
    })

    describe('GET /roles', () => {
      test('should return list of roles with their names and codes', async () => {
        const response = await server.inject({
          method: 'GET',
          url: '/roles',
          auth
        })

        expect(response.statusCode).toBe(200)

        const result = JSON.parse(response.payload)
        expect(result.roles).toHaveLength(4)
        expect(result.roles).toEqual([
          {
            name: 'Superadmin',
            code: 'superadmin'
          },
          {
            name: 'Admin',
            code: 'admin'
          },
          {
            name: 'Form publisher',
            code: 'form-publisher'
          },
          {
            name: 'Form creator',
            code: 'form-creator'
          }
        ])
      })
    })
  })

  describe('Error handling', () => {
    describe('POST /users', () => {
      test('should return 500 when addUser fails with generic error', async () => {
        jest.mocked(allUsers.addUser).mockRejectedValue(new Error('Some error'))

        const response = await server.inject({
          method: 'POST',
          url: '/users',
          auth,
          payload: {
            email: 'test@example.com',
            roles: ['admin']
          }
        })

        expect(response.statusCode).toBe(500)
      })

      test('should re-throw Boom errors without modification', async () => {
        const boomError = Boom.badRequest('Bad request')
        jest.mocked(allUsers.addUser).mockRejectedValue(boomError)

        const response = await server.inject({
          method: 'POST',
          url: '/users',
          auth,
          payload: {
            email: 'test@example.com',
            roles: ['admin']
          }
        })

        expect(response.statusCode).toBe(400)
      })

      test('should return 500 when getUser fails after successful addUser', async () => {
        jest.mocked(allUsers.addUser).mockResolvedValue({
          id: '456',
          email: 'test@example.com',
          displayName: 'Test User'
        })
        jest.mocked(allUsers.getUser).mockRejectedValue(new Error('DB error'))

        const response = await server.inject({
          method: 'POST',
          url: '/users',
          auth,
          payload: {
            email: 'test@example.com',
            roles: ['admin']
          }
        })

        expect(response.statusCode).toBe(500)
      })
    })

    describe('PUT /users/{userId}', () => {
      test('should return 500 when updateUser fails with generic error', async () => {
        jest
          .mocked(allUsers.updateUser)
          .mockRejectedValue(new Error('Some error'))

        const response = await server.inject({
          method: 'PUT',
          url: '/users/456',
          auth,
          payload: {
            roles: ['admin']
          }
        })

        expect(response.statusCode).toBe(500)
      })

      test('should re-throw Boom errors without modification', async () => {
        const boomError = Boom.notFound('Not found')
        jest.mocked(allUsers.updateUser).mockRejectedValue(boomError)

        const response = await server.inject({
          method: 'PUT',
          url: '/users/456',
          auth,
          payload: {
            roles: ['admin']
          }
        })

        expect(response.statusCode).toBe(404)
      })
    })

    describe('DELETE /users/{userId}', () => {
      test('should return 404 when deleteUser fails with not found error', async () => {
        const boomError = Boom.notFound('User not found')
        jest.mocked(allUsers.deleteUser).mockRejectedValue(boomError)

        const response = await server.inject({
          method: 'DELETE',
          url: '/users/456',
          auth
        })

        expect(response.statusCode).toBe(404)
      })

      test('should return 500 when deleteUser fails with generic error', async () => {
        jest
          .mocked(allUsers.deleteUser)
          .mockRejectedValue(new Error('Some error'))

        const response = await server.inject({
          method: 'DELETE',
          url: '/users/12345',
          auth,
          payload: {}
        })

        expect(response.statusCode).toBe(500)
      })

      test('should re-throw Boom errors without modification', async () => {
        const boomError = Boom.badRequest('Bad request')
        jest.mocked(allUsers.deleteUser).mockRejectedValue(boomError)

        const response = await server.inject({
          method: 'DELETE',
          url: '/users/12345',
          auth,
          payload: {}
        })

        expect(response.statusCode).toBe(400)
      })
    })
  })

  describe('Scope enforcement', () => {
    describe('POST /users', () => {
      test('should return 403 when caller lacks user-create scope', async () => {
        const response = await server.inject({
          method: 'POST',
          url: '/users',
          auth: noEntitlementAuth,
          payload: {
            email: 'test@example.com',
            roles: ['form-creator']
          }
        })

        expect(response.statusCode).toBe(403)
      })

      test('should return 403 when admin tries to create admin/superadmin user', async () => {
        jest
          .mocked(allUsers.addUser)
          .mockRejectedValue(
            Boom.forbidden('You do not have sufficient privileges')
          )

        const response = await server.inject({
          method: 'POST',
          url: '/users',
          auth,
          payload: {
            email: 'test@example.com',
            roles: ['admin']
          }
        })

        expect(response.statusCode).toBe(403)
      })
    })

    describe('PUT /users/{userId}', () => {
      test('should return 403 when caller lacks user-edit scope', async () => {
        const response = await server.inject({
          method: 'PUT',
          url: '/users/456',
          auth: noEntitlementAuth,
          payload: {
            roles: ['form-creator']
          }
        })

        expect(response.statusCode).toBe(403)
      })

      test('should return 403 for self-management attempt', async () => {
        jest
          .mocked(allUsers.updateUser)
          .mockRejectedValue(
            Boom.forbidden('You cannot perform this action on your own account')
          )

        const response = await server.inject({
          method: 'PUT',
          url: `/users/${auth.credentials.user.oid}`,
          auth,
          payload: {
            roles: ['form-creator']
          }
        })

        expect(response.statusCode).toBe(403)
      })
    })

    describe('DELETE /users/{userId}', () => {
      test('should return 403 when caller lacks user-delete scope', async () => {
        const response = await server.inject({
          method: 'DELETE',
          url: '/users/456',
          auth: noEntitlementAuth
        })

        expect(response.statusCode).toBe(403)
      })

      test('should return 403 for self-management attempt', async () => {
        jest
          .mocked(allUsers.deleteUser)
          .mockRejectedValue(
            Boom.forbidden('You cannot perform this action on your own account')
          )

        const response = await server.inject({
          method: 'DELETE',
          url: `/users/${auth.credentials.user.oid}`,
          auth
        })

        expect(response.statusCode).toBe(403)
      })
    })

    describe('GET /users', () => {
      test('should succeed with no-entitlement auth (no scope required)', async () => {
        jest.mocked(allUsers.getAllUsers).mockResolvedValue([])

        const response = await server.inject({
          method: 'GET',
          url: '/users',
          auth: noEntitlementAuth
        })

        expect(response.statusCode).toBe(200)
      })
    })

    describe('GET /users/{userId}', () => {
      test('should succeed with no-entitlement auth', async () => {
        jest.mocked(allUsers.getUser).mockResolvedValue({
          userId: '456',
          roles: ['admin'],
          scopes: ['user-create']
        })

        const response = await server.inject({
          method: 'GET',
          url: '/users/456',
          auth: noEntitlementAuth
        })

        expect(response.statusCode).toBe(200)
      })
    })

    describe('GET /roles', () => {
      test('should succeed with no-entitlement auth', async () => {
        const response = await server.inject({
          method: 'GET',
          url: '/roles',
          auth: noEntitlementAuth
        })

        expect(response.statusCode).toBe(200)
      })
    })
  })
})
