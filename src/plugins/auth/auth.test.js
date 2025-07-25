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

    const jwtModule = await import('@hapi/jwt')
    Jwt = /** @type {Jwt} */ (jwtModule.default)

    authModule = await import('~/src/plugins/auth/index.js')
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
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
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          ][2]
        )
        validateFn = strategyOptions.validate
      } else {
        validateFn = () => ({ isValid: false })
      }
    })

    test('should return isValid: false when user is missing from payload', () => {
      const artifacts = /** @type {any} */ ({
        decoded: {
          payload: null
        }
      })
      const result = validateFn(artifacts)
      expect(result).toEqual({ isValid: false })
      expect(mockActualTestInfoFn).toHaveBeenCalledWith(
        '[authMissingUser] Auth: Missing user from token payload.'
      )
    })

    test('should return isValid: false when oid is missing', () => {
      const artifacts = /** @type {any} */ ({
        decoded: {
          payload: {
            groups: ['some-group']
          }
        }
      })
      const result = validateFn(artifacts)
      expect(result).toEqual({ isValid: false })
      expect(mockActualTestInfoFn).toHaveBeenCalledWith(
        '[authMissingOID] Auth: User OID is missing in token payload.'
      )
    })

    test('should handle string groups claim that is valid JSON array', () => {
      const artifacts = /** @type {any} */ ({
        decoded: {
          payload: {
            oid: 'test-oid',
            groups: JSON.stringify(['editor-group-id'])
          }
        }
      })
      const result = validateFn(artifacts)
      expect(result).toEqual({
        isValid: true,
        credentials: {
          user: {
            oid: 'test-oid',
            groups: ['editor-group-id']
          }
        }
      })
    })

    test('should handle string groups claim that is not a valid JSON array', () => {
      const artifacts = /** @type {any} */ ({
        decoded: {
          payload: {
            oid: 'test-oid',
            groups: JSON.stringify({ notAnArray: true })
          }
        }
      })
      const result = validateFn(artifacts)
      expect(result).toEqual({ isValid: false })
      expect(mockActualTestWarnFn).toHaveBeenCalledWith(
        expect.stringContaining(
          "[authGroupsInvalid] Auth: User test-oid: 'groups' claim was string but not valid JSON array"
        )
      )
    })

    test('should handle parsing error for string groups claim', () => {
      const artifacts = /** @type {any} */ ({
        decoded: {
          payload: {
            oid: 'test-oid',
            groups: '{invalid-json'
          }
        }
      })
      const result = validateFn(artifacts)
      expect(result).toEqual({ isValid: false })
      expect(mockActualTestErrorFn).toHaveBeenCalledWith(
        expect.stringContaining(
          "[authGroupsParseError] Auth: User test-oid: Failed to parse 'groups' claim"
        )
      )
    })

    test('should handle array groups claim directly', () => {
      const artifacts = /** @type {any} */ ({
        decoded: {
          payload: {
            oid: 'test-oid',
            groups: ['editor-group-id']
          }
        }
      })
      const result = validateFn(artifacts)
      expect(result).toEqual({
        isValid: true,
        credentials: {
          user: {
            oid: 'test-oid',
            groups: ['editor-group-id']
          }
        }
      })
    })

    test('should handle missing groups claim by setting an empty array', () => {
      const artifacts = /** @type {any} */ ({
        decoded: {
          payload: {
            oid: 'test-oid'
          }
        }
      })
      const result = validateFn(artifacts)
      expect(result).toEqual({ isValid: false })
      expect(mockActualTestWarnFn).toHaveBeenCalledWith(
        expect.stringContaining(
          '[authGroupNotFound] Auth: User test-oid: Authorisation failed. Required group "editor-group-id" not found'
        )
      )
    })

    test('should return isValid: false when required group is not in groups array', () => {
      const artifacts = /** @type {any} */ ({
        decoded: {
          payload: {
            oid: 'test-oid',
            groups: ['some-other-group']
          }
        }
      })
      const result = validateFn(artifacts)
      expect(result).toEqual({ isValid: false })
      expect(mockActualTestWarnFn).toHaveBeenCalledWith(
        expect.stringContaining(
          '[authGroupNotFound] Auth: User test-oid: Authorisation failed. Required group "editor-group-id" not found'
        )
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
 * @typedef {(artifacts: Artifacts<UserCredentials>) => ({ isValid: boolean, credentials?: any })} ValidateFn
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
