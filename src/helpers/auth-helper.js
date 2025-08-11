import Boom from '@hapi/boom'

/**
 * Get the calling user from the auth credentials
 * @param {UserCredentials & OidcStandardClaims} [user]
 * @returns {AuditUser}
 */
export function getCallingUser(user) {
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
    displayName
  }
}

/**
 * @import { AuditUser } from '@defra/forms-model'
 * @import { UserCredentials } from '@hapi/hapi'
 * @import { OidcStandardClaims } from 'oidc-client-ts'
 */
