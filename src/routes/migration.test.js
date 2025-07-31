import Boom from '@hapi/boom'

import { createServer } from '~/src/api/server.js'
import { syncAdminUsersFromGroup } from '~/src/services/user.js'
import { auth } from '~/test/fixtures/auth.js'

jest.mock('~/src/mongo.js')
jest.mock('~/src/services/user.js')

const okStatusCode = 200
const serverErrorStatusCode = 500
const jsonContentType = 'application/json'

describe('Sync routes', () => {
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

  describe('POST /users/sync', () => {
    test('should sync admin users successfully', async () => {
      jest.mocked(syncAdminUsersFromGroup).mockResolvedValue(undefined)

      const response = await server.inject({
        method: 'POST',
        url: '/users/sync',
        auth
      })

      expect(response.statusCode).toEqual(okStatusCode)
      expect(response.headers['content-type']).toContain(jsonContentType)
      expect(response.result).toEqual({
        message: 'Admin users synced successfully'
      })
      expect(syncAdminUsersFromGroup).toHaveBeenCalledWith()
    })

    test('should return 500 when sync fails', async () => {
      jest
        .mocked(syncAdminUsersFromGroup)
        .mockRejectedValue(new Error('Azure AD service unavailable'))

      const response = await server.inject({
        method: 'POST',
        url: '/users/sync',
        auth
      })

      expect(response.statusCode).toEqual(serverErrorStatusCode)
      expect(response.result).toBeDefined()
      // @ts-expect-error - Boom error response structure
      expect(response.result.message).toBe('An internal server error occurred')
    })

    test('should re-throw Boom errors without modification', async () => {
      const boomError = Boom.badRequest('Invalid Azure group configuration')

      jest.mocked(syncAdminUsersFromGroup).mockRejectedValue(boomError)

      const response = await server.inject({
        method: 'POST',
        url: '/users/sync',
        auth
      })

      expect(response.statusCode).toBe(400)
      expect(response.result).toBeDefined()
      // @ts-expect-error - Boom error response structure
      expect(response.result.message).toBe('Invalid Azure group configuration')
    })
  })
})

/**
 * @import { Server } from '@hapi/hapi'
 */
