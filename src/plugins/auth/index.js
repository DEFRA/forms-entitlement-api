import Jwt from '@hapi/jwt'

import { config } from '~/src/config/index.js'
import { createLogger } from '~/src/helpers/logging/logger.js'

const oidcJwksUri = config.get('oidcJwksUri')
const oidcVerifyAud = config.get('oidcVerifyAud')
const oidcVerifyIss = config.get('oidcVerifyIss')

const logger = createLogger()

/**
 * Validates user credentials from JWT token
 * @param {Artifacts<UserCredentials>} artifacts - JWT artifacts
 * @returns {{ isValid: boolean, credentials?: any }} Validation result
 */
function validateUserCredentials(artifacts) {
  const user = artifacts.decoded.payload

  if (!user) {
    logger.info('[authMissingUser] Auth: Missing user from token payload.')
    return {
      isValid: false
    }
  }

  const oid = user.oid

  if (!oid) {
    logger.info('[authMissingOID] Auth: User OID is missing in token payload.')
    return {
      isValid: false
    }
  }

  return {
    isValid: true,
    credentials: {
      user
    }
  }
}

/**
 * @satisfies {ServerRegisterPluginObject<void>}
 */
export const auth = {
  plugin: {
    name: 'auth',
    async register(server) {
      await server.register(Jwt)

      server.auth.strategy('azure-oidc-token', 'jwt', {
        keys: {
          uri: oidcJwksUri
        },
        verify: {
          aud: oidcVerifyAud,
          iss: oidcVerifyIss,
          sub: false,
          nbf: true,
          exp: true
        },
        validate: validateUserCredentials
      })

      // Set as the default strategy
      server.auth.default('azure-oidc-token')
    }
  }
}

/**
 * @import { ServerRegisterPluginObject, UserCredentials } from '@hapi/hapi'
 * @import { Artifacts } from '~/src/plugins/auth/types.js'
 */
