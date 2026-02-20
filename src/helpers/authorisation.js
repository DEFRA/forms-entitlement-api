import { Roles } from '@defra/forms-model'
import Boom from '@hapi/boom'

/**
 * Roles that each caller role is permitted to manage.
 * Superadmin can manage all roles; Admin can only manage lower-privilege roles.
 * @type {Record<string, string[]>}
 */
const manageableRoles = {
  [Roles.Superadmin]: [
    Roles.Superadmin,
    Roles.Admin,
    Roles.FormPublisher,
    Roles.FormCreator
  ],
  [Roles.Admin]: [Roles.FormPublisher, Roles.FormCreator]
}

/**
 * Validates that the calling user is not performing an action on themselves.
 * Throws `Boom.forbidden` if the calling user's ID matches the target user's ID.
 * @param {string} callingUserId - The ID of the calling user
 * @param {string} targetUserId - The ID of the target user
 */
export function validateNotSelfAction(callingUserId, targetUserId) {
  if (callingUserId === targetUserId) {
    throw Boom.forbidden('You cannot perform this action on your own account')
  }
}

/**
 * Validates that the calling user's role level permits managing a user with the given target roles.
 * Throws `Boom.forbidden` if the caller's highest role does not permit managing any of the target roles.
 * @param {string[]} callingUserRoles - The roles of the calling user
 * @param {string[]} targetRoles - The roles of the target user (current or requested)
 */
export function validateRoleHierarchy(callingUserRoles, targetRoles) {
  const callerAllowedRoles = getHighestAllowedRoles(callingUserRoles)

  if (!callerAllowedRoles) {
    throw Boom.forbidden(
      'You do not have sufficient privileges to manage users'
    )
  }

  const disallowedRoles = targetRoles.filter(
    (role) => !callerAllowedRoles.includes(role)
  )

  if (disallowedRoles.length > 0) {
    throw Boom.forbidden(
      `You do not have sufficient privileges to manage users with role: ${disallowedRoles.join(', ')}`
    )
  }
}

/**
 * Combines self-management and role hierarchy validation.
 * Throws `Boom.forbidden` if either check fails.
 * @param {string} callingUserId - The ID of the calling user
 * @param {string[]} callingUserRoles - The roles of the calling user
 * @param {string} targetUserId - The ID of the target user
 * @param {string[]} targetRoles - The roles of the target user (current or requested)
 */
export function validateUserManagement(
  callingUserId,
  callingUserRoles,
  targetUserId,
  targetRoles
) {
  validateNotSelfAction(callingUserId, targetUserId)
  validateRoleHierarchy(callingUserRoles, targetRoles)
}

/**
 * Returns the set of roles that the highest-privilege role in the caller's roles can manage.
 * Returns `null` if the caller has no user-management privileges.
 * @param {string[]} callingUserRoles - The roles of the calling user
 * @returns {string[] | null} The roles the caller is permitted to manage, or null
 */
function getHighestAllowedRoles(callingUserRoles) {
  // Check in order of highest privilege
  if (callingUserRoles.includes(Roles.Superadmin)) {
    return manageableRoles[Roles.Superadmin]
  }

  if (callingUserRoles.includes(Roles.Admin)) {
    return manageableRoles[Roles.Admin]
  }

  return null
}
