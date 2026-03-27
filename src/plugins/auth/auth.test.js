import { Roles, Scopes } from '@defra/forms-model'

const mockActualTestErrorFn = jest.fn()
const mockActualTestWarnFn = jest.fn()
const mockActualTestInfoFn = jest.fn()

jest.mock('~/src/helpers/logging/logger.js', () => ({
  createLogger: jest.fn().mockReturnValue({
    error: mockActualTestErrorFn,
    warn: mockActualTestWarnFn,
    info: mockActualTestInfoFn
  })
}))

jest.mock('~/src/config/index.js', () => ({
  config: {
    get: jest.fn((key) => {
      if (key === 'roleEditorGroupId') return 'editor-group-id'
      return 'mock-value'
    })
  }
}))

jest.mock('@hapi/jwt')

const mockGet = jest.fn()

jest.mock('~/src/repositories/user-repository.js', () => ({
  get: mockGet
}))

describe('auth plugin', () => {
  /** @type {AuthModule} */
  let authModule
  /** @type {Auth} */
  let auth
  /** @type {ValidateFn} */
  let validateFn
  /** @type {Jwt} */
  let Jwt

  const server = {
    register: jest.fn().mockResolvedValue(undefined),
    auth: {
      strategy: jest.fn(),
      default: jest.fn()
    }
  }

  beforeEach(async () => {
    jest.resetModules()
    jest.clearAllMocks()
    mockGet.mockReset()

    const jwtModule = await import('@hapi/jwt')
    Jwt = /** @type {Jwt} */ (jwtModule.default)

    authModule = await import('~/src/plugins/auth/index.js')

    auth = authModule.auth
  })

  test('should register the JWT plugin', async () => {
    await auth.plugin.register(/** @type {any} */ (server))
    expect(server.register).toHaveBeenCalledWith(Jwt)
  })

  test('should set up the auth strategy', async () => {
    await auth.plugin.register(/** @type {any} */ (server))
    expect(server.auth.strategy).toHaveBeenCalledWith(
      'azure-oidc-token',
      'jwt',
      expect.objectContaining({
        keys: expect.any(Object),
        verify: expect.any(Object),
        validate: expect.any(Function)
      })
    )
  })

  test('should set the default auth strategy', async () => {
    await auth.plugin.register(/** @type {any} */ (server))
    expect(server.auth.default).toHaveBeenCalledWith('azure-oidc-token')
  })

  describe('validate function', () => {
    beforeEach(async () => {
      await auth.plugin.register(/** @type {any} */ (server))
      if (server.auth.strategy.mock.calls.length > 0) {
        const strategyOptions = /** @type {{ validate: ValidateFn }} */ (
          server.auth.strategy.mock.calls[
            server.auth.strategy.mock.calls.length - 1
          ][2]
        )
        validateFn = strategyOptions.validate
      } else {
        validateFn = () => Promise.resolve({ isValid: false })
      }
    })

    test('should return isValid: false when user is missing from payload', async () => {
      const artifacts = /** @type {any} */ ({
        decoded: {
          payload: null
        }
      })
      const result = await validateFn(artifacts)
      expect(result).toEqual({ isValid: false })
      expect(mockActualTestInfoFn).toHaveBeenCalledWith(
        '[authMissingUser] Auth: Missing user from token payload.'
      )
    })

    test('should return isValid: false when oid is missing', async () => {
      const artifacts = /** @type {any} */ ({
        decoded: {
          payload: {}
        }
      })
      const result = await validateFn(artifacts)
      expect(result).toEqual({ isValid: false })
      expect(mockActualTestInfoFn).toHaveBeenCalledWith(
        '[authMissingOID] Auth: User OID is missing in token payload.'
      )
    })

    test('should populate credentials.scope and credentials.roles when user entitlement exists', async () => {
      const mockUser = {
        oid: 'test-oid-123',
        name: 'Test User'
      }

      mockGet.mockResolvedValue({
        userId: 'test-oid-123',
        roles: [Roles.Admin]
      })

      const artifacts = /** @type {any} */ ({
        decoded: {
          payload: mockUser
        }
      })

      const result = await validateFn(artifacts)

      expect(result).toEqual({
        isValid: true,
        credentials: {
          user: mockUser,
          scope: expect.arrayContaining([
            Scopes.UserCreate,
            Scopes.UserEdit,
            Scopes.UserDelete,
            Scopes.FormRead,
            Scopes.FormEdit,
            Scopes.FormDelete,
            Scopes.FormPublish,
            Scopes.FormsFeedback
          ]),
          roles: [Roles.Admin]
        }
      })
    })

    test('should set empty scope and roles when user entitlement not found (404)', async () => {
      const Boom = (await import('@hapi/boom')).default

      const mockUser = {
        oid: 'unknown-oid',
        name: 'Unknown User'
      }

      mockGet.mockRejectedValue(Boom.notFound('User not found'))

      const artifacts = /** @type {any} */ ({
        decoded: {
          payload: mockUser
        }
      })

      const result = await validateFn(artifacts)

      expect(result).toEqual({
        isValid: true,
        credentials: {
          user: mockUser,
          scope: [],
          roles: []
        }
      })
    })

    test('should return isValid: true for both user found and not found cases', async () => {
      const Boom = (await import('@hapi/boom')).default

      // User found case
      mockGet.mockResolvedValue({
        userId: 'test-oid',
        roles: ['form-creator'],
        scopes: ['form-read']
      })

      const foundResult = await validateFn(
        /** @type {any} */ ({
          decoded: { payload: { oid: 'test-oid', name: 'Test' } }
        })
      )
      expect(foundResult.isValid).toBe(true)

      // User not found case
      mockGet.mockRejectedValue(Boom.notFound('User not found'))

      const notFoundResult = await validateFn(
        /** @type {any} */ ({
          decoded: { payload: { oid: 'unknown-oid', name: 'Unknown' } }
        })
      )
      expect(notFoundResult.isValid).toBe(true)
    })

    test('should return isValid: false when DB throws a non-404 error', async () => {
      const mockUser = {
        oid: 'test-oid-error',
        name: 'Error User'
      }

      mockGet.mockRejectedValue(new Error('Database connection failed'))

      const artifacts = /** @type {any} */ ({
        decoded: {
          payload: mockUser
        }
      })

      const result = await validateFn(artifacts)

      expect(result).toEqual({ isValid: false })
      expect(mockActualTestInfoFn).toHaveBeenCalledWith(
        '[authEntitlementError] Auth: Failed to resolve entitlement for user test-oid-error'
      )
    })
  })
})

/**
 * @typedef {typeof AuthModuleDefinitionStar} AuthModule
 */
/**
 * @typedef {AuthTypeDefinition} Auth
 */
/**
 * @typedef {(artifacts: Artifacts<UserCredentials>) => Promise<{ isValid: boolean, credentials?: any }>} ValidateFn
 */
/**
 * @typedef {jest.Mocked<JwtTypeDefinition>} Jwt
 */

/**
 * @import { UserCredentials } from '@hapi/hapi'
 * @import { Artifacts } from '~/src/plugins/auth/types.js'
 * @import * as AuthModuleDefinitionStar from '~/src/plugins/auth/index.js'
 * @import { auth as AuthTypeDefinition } from '~/src/plugins/auth/index.js'
 * @import { default as JwtTypeDefinition } from '@hapi/jwt'
 */
