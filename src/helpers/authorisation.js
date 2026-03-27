import { Roles } from '@defra/forms-model'
import Boom from '@hapi/boom'

/**
 * Roles that each caller role is permitted to manage.
 * Superadmin can manage all roles; Admin can only manage lower-privilege roles.
 */
const manageableRoles = {
  [Roles.Superadmin]: Object.values(Roles),
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
      `You do not have sufficient privileges to manage ${formatList(disallowedRoles)} users`
    )
  }
}

/**
 * Formats an array of items as a human-readable list.
 * e.g. ['a'] → 'a', ['a', 'b'] → 'a or b', ['a', 'b', 'c'] → 'a, b or c'
 * @param {string[]} items
 * @returns {string}
 */
function formatList(items) {
  if (items.length <= 1) {
    return items[0] ?? ''
  }

  return `${items.slice(0, -1).join(', ')} or ${items.at(-1)}`
}

/**
 * Validates self-management prevention, hierarchy against requested roles,
 * and optionally hierarchy against the target user's current roles.
 * Throws `Boom.forbidden` if any check fails.
 * @param {string} callingUserId - The ID of the calling user
 * @param {string[]} callingUserRoles - The roles of the calling user
 * @param {string} targetUserId - The ID of the target user
 * @param {string[]} requestedRoles - The roles being requested (pass empty array for delete operations)
 * @param {string[]} [currentRoles] - The target user's current roles from the database
 */
export function validateUserManagement(
  callingUserId,
  callingUserRoles,
  targetUserId,
  requestedRoles,
  currentRoles = []
) {
  validateNotSelfAction(callingUserId, targetUserId)
  if (requestedRoles.length > 0) {
    validateRoleHierarchy(callingUserRoles, requestedRoles)
  }
  if (currentRoles.length > 0) {
    validateRoleHierarchy(callingUserRoles, currentRoles)
  }
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
