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
        jest.mocked(addUser).mockResolvedValue({ id: '123', status: 'success' })

        const response = await server.inject({
          method: 'POST',
          url: '/users',
          payload: {
            userId: mockFormCreatorUser.userId,
            roles: mockFormCreatorUser.roles
          },
          auth
        })

        expect(response.statusCode).toEqual(okStatusCode)
        expect(response.headers['content-type']).toContain(jsonContentType)
        expect(response.result).toEqual({ id: '123', message: 'success' })
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
              name: 'admin',
              description:
                'Allows full access to forms and user management functions'
            },
            {
              name: 'form-creator',
              description:
                'Allows a user to create a form and edit it while in draft'
            }
          ]
        })
      })
    })
  })
})

/**
 * @import { Server } from '@hapi/hapi'
 */
