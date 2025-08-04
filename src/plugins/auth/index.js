import Jwt from '@hapi/jwt'

import { config } from '~/src/config/index.js'
import { getErrorMessage } from '~/src/helpers/error-message.js'
import { createLogger } from '~/src/helpers/logging/logger.js'

const oidcJwksUri = config.get('oidcJwksUri')
const oidcVerifyAud = config.get('oidcVerifyAud')
const oidcVerifyIss = config.get('oidcVerifyIss')
const roleEditorGroupId = config.get('roleEditorGroupId')

const logger = createLogger()

/**
 * Processes the groups claim from the token payload
 * @param {unknown} groupsClaim - The groups claim from the token
 * @param {string} oid - User OID for logging purposes
 * @returns {string[]} Processed groups array
 */
function processGroupsClaim(groupsClaim, oid) {
  let processedGroups = []

  // For the integration tests, the OIDC mock server sends the 'groups' claim as a stringified JSON array which
  // requires parsing, while a real Azure AD would typically provide 'groups' as a proper array.
  // We handle both formats for flexibility between test and production environments.
  if (typeof groupsClaim === 'string') {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- we know this is a stringified JSON array
      const parsed = JSON.parse(groupsClaim)
      if (Array.isArray(parsed)) {
        processedGroups = parsed
      } else {
        logger.warn(
          `[authGroupsInvalid] Auth: User ${oid}: 'groups' claim was string but not valid JSON array: '${String(groupsClaim)}'`
        )
      }
    } catch (error) {
      logger.error(
        `[authGroupsParseError] Auth: User ${oid}: Failed to parse 'groups' claim - ${getErrorMessage(error)}`
      )
    }
  } else if (Array.isArray(groupsClaim)) {
    processedGroups = groupsClaim
  } else {
    processedGroups = []
  }

  return processedGroups
}

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
  const groupsClaim = user.groups

  if (!oid) {
    logger.info('[authMissingOID] Auth: User OID is missing in token payload.')
    return {
      isValid: false
    }
  }

  const processedGroups = processGroupsClaim(groupsClaim, oid)

  if (!processedGroups.includes(roleEditorGroupId)) {
    logger.warn(
      `[authGroupNotFound] Auth: User ${oid}: Authorisation failed. Required group "${roleEditorGroupId}" not found`
    )
    return {
      isValid: false
    }
  }

  return {
    isValid: true,
    credentials: {
      user: {
        ...user,
        groups: processedGroups
      }
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
