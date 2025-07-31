import Boom from '@hapi/boom'
import { StatusCodes } from 'http-status-codes'

import { config } from '~/src/config/index.js'
import { getErrorMessage } from '~/src/helpers/error-message.js'
import { createLogger } from '~/src/helpers/logging/logger.js'
import { client } from '~/src/mongo.js'
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
 */
export async function addUser(email, roles) {
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
 */
export async function updateUser(userId, roles) {
  logger.info(`Updating user with userID '${userId}'`)

  const session = client.startSession()

  try {
    await session.withTransaction(async () => {
      const updatedUserEntity = await updateUserInternal(userId, roles, session)
      return updatedUserEntity
    })

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
 */
export async function deleteUser(userId) {
  logger.info(`Deleting user with userID '${userId}'`)

  const session = client.startSession()

  try {
    await session.withTransaction(async () => {
      await remove(userId, session)
    })

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
    if (!userRoles.includes(Roles.Admin)) {
      const updatedRoles = [...new Set([...userRoles, Roles.Admin])]
      await updateUserInternal(member.id, updatedRoles, session)
      logger.info(`Updated user with admin privileges: ${member.id}`)
    } else {
      logger.info(`User already has admin privileges: ${member.id}`)
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
 * Sync admin users from Azure AD role editor group
 * Called on service startup to ensure admin access based on AD group membership
 */
export async function syncAdminUsersFromGroup() {
  const roleEditorGroupId = config.get('roleEditorGroupId')

  if (!roleEditorGroupId) {
    logger.warn('No role editor group ID configured')
    return
  }

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
 * Process a single user for migration
 * @param {AzureUser} azureUser - Azure AD user to migrate
 * @param {string[]} roles - Roles to assign to the user
 * @param {{successful: MigratedUser[], failed: FailedUser[], skipped: FailedUser[]}} results - Results object to populate
 * @param {ClientSession} session - MongoDB session
 */
async function processMigrationUser(azureUser, roles, results, session) {
  const existingUser = await findExistingUser(azureUser.id)

  if (existingUser) {
    logger.info(`User ${azureUser.id} already exists, skipping`)
    results.skipped.push({
      userId: azureUser.id,
      displayName: azureUser.displayName,
      email: azureUser.email,
      error: 'User already exists'
    })
    return
  }

  await createUserInternal(
    azureUser.id,
    roles,
    session,
    azureUser.email,
    azureUser.displayName
  )

  results.successful.push({
    userId: azureUser.id,
    displayName: azureUser.displayName,
    email: azureUser.email,
    roles,
    scopes: mapScopesToRoles(roles)
  })

  logger.info(`Successfully migrated user ${azureUser.id}`)
}

/**
 * Process all users for migration in a transaction
 * @param {AzureUser[]} azureUsers - Array of Azure AD users
 * @param {string[]} roles - Roles to assign
 * @param {{successful: MigratedUser[], failed: FailedUser[], skipped: FailedUser[]}} results - Results object to populate
 * @param {ClientSession} session - MongoDB session
 */
async function processAllMigrationUsers(azureUsers, roles, results, session) {
  await session.withTransaction(async () => {
    for (const azureUser of azureUsers) {
      try {
        await processMigrationUser(azureUser, roles, results, session)
      } catch (err) {
        logger.error(
          `Failed to migrate user ${azureUser.id}: ${getErrorMessage(err)}`
        )
        results.failed.push({
          userId: azureUser.id,
          displayName: azureUser.displayName,
          email: azureUser.email,
          error: getErrorMessage(err)
        })
      }
    }
  })
}

/**
 * Initialise migration resources
 * @returns {{roleEditorGroupId: string, azureAdService: any, session: any}} Migration resources
 */
export function initialiseMigrationResources() {
  const roleEditorGroupId = config.get('roleEditorGroupId')
  const azureAdService = getAzureAdService()
  const session = client.startSession()

  return { roleEditorGroupId, azureAdService, session }
}

/**
 * Create initial results structure
 * @returns {{successful: MigratedUser[], failed: FailedUser[], skipped: FailedUser[]}} Empty results object
 */
export function createMigrationResults() {
  return {
    successful: [],
    failed: [],
    skipped: []
  }
}

/**
 * Log migration completion and create final result
 * @param {any[]} azureUsers - Array of Azure users
 * @param {{successful: MigratedUser[], failed: FailedUser[], skipped: FailedUser[]}} results - Migration results
 * @returns {MigrationResult} Final migration result
 */
export function finaliseMigrationResult(azureUsers, results) {
  logger.info(
    `Migration completed: ${results.successful.length} successful, ${results.failed.length} failed, ${results.skipped.length} skipped`
  )

  return {
    status: 'completed',
    summary: {
      total: azureUsers.length,
      successful: results.successful.length,
      failed: results.failed.length,
      skipped: results.skipped.length
    },
    results
  }
}

/**
 * Migrate users from Azure AD group to the entitlements api
 * @param {string[]} roles - Default roles to assign to migrated users
 * @returns {Promise<MigrationResult>} Migration results
 */
export async function migrateUsersFromAzureGroup(roles = [Roles.Admin]) {
  logger.info('Starting user migration from role editor Azure AD group')

  const { roleEditorGroupId, azureAdService, session } =
    initialiseMigrationResources()

  try {
    const azureUsers = await azureAdService.getGroupMembers(roleEditorGroupId)
    logger.info(
      `Found ${azureUsers.length} users in role editor group for migration`
    )

    const results = createMigrationResults()

    await processAllMigrationUsers(azureUsers, roles, results, session)

    return finaliseMigrationResult(azureUsers, results)
  } catch (err) {
    logger.error(`[migrateUsers] Migration failed - ${getErrorMessage(err)}`)
    throw err
  } finally {
    await session.endSession()
  }
}

/**
 * @import { UserEntitlementDocument } from '~/src/api/types.js'
 * @import { MigrationResult, MigratedUser, FailedUser } from '~/src/api/types.js'
 * @import { AzureUser } from '~/src/services/azure-ad.js'
 * @import { WithId, ClientSession } from 'mongodb'
 */
