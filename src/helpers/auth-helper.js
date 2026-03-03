import Boom from '@hapi/boom'

/**
 * Get the calling user from the auth credentials
 * @param {(UserCredentials & OidcStandardClaims) | undefined} user
 * @param {Roles[]} roles - The roles resolved from the user's entitlement
 * @returns {CallingUser}
 */
export function getCallingUser(user, roles) {
  if (!user?.oid || !user.name) {
    throw Boom.unauthorized(
      'Failed to get the calling user. User is undefined or has a malformed/missing oid/name.'
    )
  }

  const displayName =
    user.given_name && user.family_name
      ? `${user.given_name} ${user.family_name}`
      : user.name

  return {
    id: user.oid,
    displayName,
    roles
  }
}

/**
 * @import { CallingUser } from '~/src/api/types.js'
 * @import { UserCredentials } from '@hapi/hapi'
 * @import { OidcStandardClaims } from 'oidc-client-ts'
 * @import { Roles } from '@defra/forms-model'
 */
