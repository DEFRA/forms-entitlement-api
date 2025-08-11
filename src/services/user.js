import { randomUUID } from 'crypto'

import Boom from '@hapi/boom'
import { StatusCodes } from 'http-status-codes'

import { config } from '~/src/config/index.js'
import { getErrorMessage } from '~/src/helpers/error-message.js'
import { createLogger } from '~/src/helpers/logging/logger.js'
import {
  publishEntitlementCreatedEvent,
  publishEntitlementDeletedEvent,
  publishEntitlementUpdatedEvent
} from '~/src/messaging/publish.js'
import { client } from '~/src/mongo.js'
import { withLock } from '~/src/repositories/lock-repository.js'
import { Roles } from '~/src/repositories/roles.js'
import { mapScopesToRoles } from '~/src/repositories/scopes.js'
import {
  create,
  get,
  getAll,
  remove,
  update
} from '~/src/repositories/user-repository.js'
import { getAzureAdService } from '~/src/services/azure-ad.js'

export const logger = createLogger()

/**
 * Maps a user document from MongoDB to a user object
 * @param {Partial<UserEntitlementDocument>} document - user document (with ID)
 * @returns {UserEntitlementDocument}
 */
export function mapUser(document) {
  if (!document.userId || !document.roles || !document.scopes) {
    throw Error(
      'User is malformed in the database. Expected fields are missing.'
    )
  }

  const user = /** @type {UserEntitlementDocument} */ ({
    userId: document.userId,
    roles: document.roles,
    scopes: document.scopes
  })

  if (document.email) {
    user.email = document.email
  }

  if (document.displayName) {
    user.displayName = document.displayName
  }

  return user
}

/**
 * @param {WithId<Partial<UserEntitlementDocument>>[]} documents - user documents (with ID)
 */
export function mapUsers(documents) {
  return documents.map((doc) => mapUser(doc))
}

/**
 * Get all users
 */
export async function getAllUsers() {
  logger.info(`Getting all users`)

  try {
    return mapUsers(await getAll())
  } catch (err) {
    logger.error(`[getUser] Failed to get all users - ${getErrorMessage(err)}`)

    throw err
  }
}

/**
 * Get a user
 * @param {string} userId
 */
export async function getUser(userId) {
  logger.info(`Getting user with userID '${userId}'`)

  try {
    return mapUser(await get(userId))
  } catch (err) {
    logger.info(
      `[getUser] Failed to get user with userID '${userId}' - ${getErrorMessage(err)}`
    )

    throw err
  }
}

/**
 * Add a user with Azure AD validation by email
 * @param {string} email - The user's email address
 * @param {string[]} roles
 * @param {AuditUser} callingUser
 */
export async function addUser(email, roles, callingUser) {
  logger.info(`Adding user with email '${email}'`)

  const session = client.startSession()

  try {
    const azureAdService = getAzureAdService()
    const azureUser = await azureAdService.getUserByEmail(email)
    logger.info(`User found in Azure AD with ID: ${azureUser.id}`)

    await session.withTransaction(async () => {
      const newUserEntity = await createUserInternal(
        azureUser.id,
        roles,
        session,
        azureUser.email,
        azureUser.displayName
      )
      return newUserEntity
    })

    await publishEntitlementCreatedEvent(azureUser, roles, callingUser)

    logger.info(`Added user with Azure ID: ${azureUser.id}`)

    return {
      id: azureUser.id,
      email: azureUser.email,
      displayName: azureUser.displayName
    }
  } catch (err) {
    logger.error(`[addUser] Failed to add user - ${getErrorMessage(err)}`)

    throw err
  } finally {
    await session.endSession()
  }
}

/**
 * Update a user
 * @param {string} userId
 * @param {string[]} roles
 * @param {AuditUser} callingUser
 */
export async function updateUser(userId, roles, callingUser) {
  logger.info(`Updating user with userID '${userId}'`)

  const session = client.startSession()

  try {
    const azureAdService = getAzureAdService()
    const azureUser = await azureAdService.validateUser(userId)
    logger.info(`User found in Azure AD with ID: ${azureUser.id}`)

    await session.withTransaction(async () => {
      const updatedUserEntity = await updateUserInternal(userId, roles, session)
      return updatedUserEntity
    })

    await publishEntitlementUpdatedEvent(azureUser, roles, callingUser)

    logger.info(`Updated user with userID '${userId}'`)

    return {
      id: userId
    }
  } catch (err) {
    logger.error(`[updateUser] Failed to update user - ${getErrorMessage(err)}`)

    throw err
  } finally {
    await session.endSession()
  }
}

/**
 * Delete a user
 * @param {string} userId
 * @param {AuditUser} callingUser
 */
export async function deleteUser(userId, callingUser) {
  logger.info(`Deleting user with userID '${userId}'`)

  const session = client.startSession()

  try {
    const user = await findExistingUser(userId)

    const azureUser = /** @type {AzureUser} */ ({
      id: user?.userId,
      displayName: user?.displayName,
      email: user?.email
    })

    await session.withTransaction(async () => {
      await remove(userId, session)
    })

    await publishEntitlementDeletedEvent(azureUser, callingUser)

    logger.info(`Deleted user with userID '${userId}'`)

    return {
      id: userId
    }
  } catch (err) {
    logger.error(`[deleteUser] Failed to delete user - ${getErrorMessage(err)}`)

    throw err
  } finally {
    await session.endSession()
  }
}

/**
 * Check if user exists and return user data, or null if not found
 * @param {string} userId - User ID to check
 * @returns {Promise<Partial<UserEntitlementDocument>|null>} User data or null if not found
 */
async function findExistingUser(userId) {
  try {
    return await get(userId)
  } catch (error) {
    if (
      Boom.isBoom(error) &&
      error.output.statusCode === Number(StatusCodes.NOT_FOUND)
    ) {
      return null
    }
    throw error
  }
}

/**
 * Create a user with given roles (internal function used within transactions)
 * @param {string} userId - Azure AD user ID
 * @param {string[]} roles - Roles to assign
 * @param {ClientSession} session - MongoDB session for transaction
 * @param {string} [email] - User's email address
 * @param {string} [displayName] - User's display name
 */
async function createUserInternal(userId, roles, session, email, displayName) {
  const user = /** @type {UserEntitlementDocument} */ ({
    userId,
    roles,
    scopes: mapScopesToRoles(roles)
  })

  if (email) {
    user.email = email
  }

  if (displayName) {
    user.displayName = displayName
  }

  return create(user, session)
}

/**
 * Update a user with given roles (internal function used within transactions)
 * @param {string} userId - Azure AD user ID
 * @param {string[]} roles - Roles to assign
 * @param {ClientSession} session - MongoDB session for transaction
 */
async function updateUserInternal(userId, roles, session) {
  const user = {
    userId,
    roles,
    scopes: mapScopesToRoles(roles)
  }
  return update(userId, user, session)
}

/**
 * Process a single admin user - create if doesn't exist, add admin role if missing
 * @param {AzureUser} member - Azure AD group member
 * @param {ClientSession} session - MongoDB session for transaction
 * @param {Map<string, Partial<UserEntitlementDocument>>} existingUsers - Map of existing users by userId
 */
export async function processAdminUser(
  member,
  session,
  existingUsers = new Map()
) {
  const existingUser = existingUsers.get(member.id)

  if (existingUser) {
    const userRoles = existingUser.roles ?? []

    if (userRoles.length !== 1 || !userRoles.includes(Roles.Admin)) {
      await updateUserInternal(member.id, [Roles.Admin], session)
      logger.info(
        `Updated user to admin role only: ${member.id} (previous roles: ${userRoles.join(', ')})`
      )
    } else {
      logger.info(`User already has correct admin privileges: ${member.id}`)
    }
  } else {
    // User doesn't exist, create them with admin role
    await createUserInternal(
      member.id,
      [Roles.Admin],
      session,
      member.email,
      member.displayName
    )
    logger.info(`Created admin user: ${member.id} (${member.displayName})`)
  }
}

/**
 * Process all admin users from a group with transaction support
 * @param {AzureUser[]} groupMembers - Array of group members from Azure AD
 * @param {ClientSession} session - MongoDB session for transaction
 */
export async function processAllAdminUsers(groupMembers, session) {
  // First, get all existing users to avoid individual lookups
  const allUsers = await getAll()
  const existingUsersMap = new Map(
    allUsers
      .filter((user) => user.userId)
      .map((user) => [/** @type {string} */ (user.userId), user])
  )

  logger.info(`Found ${allUsers.length} existing users in database`)

  await session.withTransaction(async () => {
    for (const member of groupMembers) {
      try {
        await processAdminUser(member, session, existingUsersMap)
      } catch (err) {
        logger.error(
          `Failed to process admin user ${member.id}: ${getErrorMessage(err)}`
        )
      }
    }
  })
}

/**
 * Internal sync function (without locking)
 * @private
 */
async function syncAdminUsersInternal() {
  const roleEditorGroupId = config.get('roleEditorGroupId')

  logger.info(
    `Syncing admin users from role editor group: ${roleEditorGroupId}`
  )

  const session = client.startSession()

  try {
    const azureAdService = getAzureAdService()
    const groupMembers = await azureAdService.getGroupMembers(roleEditorGroupId)

    if (groupMembers.length === 0) {
      logger.warn('No members found in role editor group')
      return
    }

    logger.info(`Found ${groupMembers.length} members in role editor group`)

    await processAllAdminUsers(groupMembers, session)

    logger.info('Admin user sync completed successfully')
  } catch (err) {
    logger.error(
      `Failed to sync admin users from group: ${getErrorMessage(err)}`
    )
    throw err
  } finally {
    await session.endSession()
  }
}

/**
 * Sync admin users from Azure AD role editor group with locking
 * Called on service startup and by scheduler to ensure admin access based on AD group membership
 * Uses locking to prevent concurrent execution across multiple containers
 */
export async function syncAdminUsersFromGroup() {
  const lockId = randomUUID()
  const lockTimeoutMinutes = 30

  const result = await withLock(
    'admin-user-sync',
    lockId,
    syncAdminUsersInternal,
    lockTimeoutMinutes
  )

  if (result === null) {
    logger.info(
      'Admin user sync skipped - already running on another container'
    )
  }
}

/**
 * @import { AuditUser } from '@defra/forms-model'
 * @import { UserEntitlementDocument } from '~/src/api/types.js'
 * @import { AzureUser } from '~/src/services/azure-ad.js'
 * @import { WithId, ClientSession } from 'mongodb'
 */
