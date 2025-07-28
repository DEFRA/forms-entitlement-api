import { config } from '~/src/config/index.js'
import { getErrorMessage } from '~/src/helpers/error-message.js'
import { createLogger } from '~/src/helpers/logging/logger.js'
import { client } from '~/src/mongo.js'
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

  return {
    userId: document.userId,
    roles: document.roles,
    scopes: document.scopes
  }
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
    logger.error(
      `[getUser] Failed to get user with userID '${userId}' - ${getErrorMessage(err)}`
    )

    throw err
  }
}

/**
 * Add a user with Azure AD validation
 * @param {string} userId
 * @param {string[]} roles
 */
export async function addUser(userId, roles) {
  logger.info(`Adding user with userID '${userId}'`)

  const session = client.startSession()

  try {
    // Always validate users against Azure AD
    const azureAdService = getAzureAdService()
    await azureAdService.validateUser(userId)
    logger.info(`User ${userId} validated in Azure AD`)

    await session.withTransaction(async () => {
      const user = {
        userId,
        roles,
        scopes: mapScopesToRoles(roles)
      }
      const newUserEntity = await create(user, session)

      return newUserEntity
    })

    logger.info(`Added user with userID '${userId}'`)

    return {
      id: userId,
      status: 'success'
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
      const user = {
        userId,
        roles,
        scopes: mapScopesToRoles(roles)
      }

      const updatedUserEntity = await update(userId, user, session)

      return updatedUserEntity
    })

    logger.info(`Updated user with userID '${userId}'`)

    return {
      id: userId,
      status: 'success'
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
      id: userId,
      status: 'success'
    }
  } catch (err) {
    logger.error(`[deleteUser] Failed to delete user - ${getErrorMessage(err)}`)

    throw err
  } finally {
    await session.endSession()
  }
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
    'Syncing admin users from role editor group: ' + roleEditorGroupId
  )

  const session = client.startSession()

  try {
    // Get all members of the role editor group from Azure AD
    const azureAdService = getAzureAdService()
    const groupMembers = await azureAdService.getGroupMembers(roleEditorGroupId)

    if (groupMembers.length === 0) {
      logger.warn('No members found in role editor group')
      return
    }

    logger.info(
      'Found ' +
        groupMembers.length.toString() +
        ' members in role editor group'
    )

    await session.withTransaction(async () => {
      for (const member of groupMembers) {
        try {
          try {
            // Check if user already exists
            const existingUser = await get(member.id)

            // If user exists but doesn't have admin role, update them
            if (existingUser.roles && !existingUser.roles.includes('admin')) {
              const updatedRoles = [
                ...new Set([...existingUser.roles, 'admin'])
              ]
              const user = {
                userId: member.id,
                roles: updatedRoles,
                scopes: mapScopesToRoles(updatedRoles)
              }
              await update(member.id, user, session)
              logger.info(
                'Updated user with admin privileges: ' +
                  member.id +
                  ' (' +
                  member.displayName +
                  ')'
              )
            } else {
              logger.info(
                'User already has admin privileges: ' +
                  member.id +
                  ' (' +
                  member.displayName +
                  ')'
              )
            }
          } catch {
            // User doesn't exist, create them with admin role
            const user = {
              userId: member.id,
              roles: ['admin'],
              scopes: mapScopesToRoles(['admin'])
            }
            await create(user, session)
            logger.info(
              'Created admin user: ' +
                member.id +
                ' (' +
                member.displayName +
                ')'
            )
          }
        } catch (err) {
          logger.error(
            'Failed to sync admin user ' +
              member.id +
              ': ' +
              getErrorMessage(err)
          )
          // Continue with other users even if one fails
        }
      }
    })

    logger.info('Admin user sync completed successfully')
  } catch (err) {
    logger.error(
      'Failed to sync admin users from group: ' + getErrorMessage(err)
    )
    throw err
  } finally {
    await session.endSession()
  }
}

/**
 * Migrate users from Azure AD group to the entitlements api
 * @param {string[]} roles - Default roles to assign to migrated users
 * @returns {Promise<MigrationResult>} Migration results
 */
export async function migrateUsersFromAzureGroup(roles = ['form-creator']) {
  logger.info('Starting user migration from role editor Azure AD group')

  const roleEditorGroupId = config.get('roleEditorGroupId')
  const azureAdService = getAzureAdService()
  const session = client.startSession()

  try {
    const azureUsers = await azureAdService.getGroupMembers(roleEditorGroupId)
    logger.info(
      'Found ' +
        azureUsers.length.toString() +
        ' users in role editor group for migration'
    )

    /** @type {{successful: MigratedUser[], failed: FailedUser[], skipped: SkippedUser[]}} */
    const results = {
      successful: [],
      failed: [],
      skipped: []
    }

    await session.withTransaction(async () => {
      for (const azureUser of azureUsers) {
        try {
          try {
            await get(azureUser.id)
            logger.info(`User ${azureUser.id} already exists, skipping`)
            results.skipped.push({
              userId: azureUser.id,
              displayName: azureUser.displayName,
              email: azureUser.email,
              reason: 'User already exists'
            })
            continue
          } catch {
            // User doesn't exist, proceed with creation, this is expected for new users
          }

          const user = {
            userId: azureUser.id,
            roles,
            scopes: mapScopesToRoles(roles)
          }

          await create(user, session)

          results.successful.push({
            userId: azureUser.id,
            displayName: azureUser.displayName,
            email: azureUser.email,
            roles,
            scopes: user.scopes
          })

          logger.info(`Successfully migrated user ${azureUser.id}`)
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
  } catch (err) {
    logger.error(`[migrateUsers] Migration failed - ${getErrorMessage(err)}`)
    throw err
  } finally {
    await session.endSession()
  }
}

/**
 * @import { UserEntitlementDocument } from '~/src/api/types.js'
 * @import { WithId } from 'mongodb'
 */

/**
 * @typedef {object} MigrationResult
 * @property {string} status - Migration status
 * @property {object} summary - Migration summary
 * @property {number} summary.total - Total users processed
 * @property {number} summary.successful - Successfully migrated users
 * @property {number} summary.failed - Failed migration users
 * @property {number} summary.skipped - Skipped users
 * @property {object} results - Detailed results
 * @property {MigratedUser[]} results.successful - Successfully migrated users
 * @property {FailedUser[]} results.failed - Failed migration users
 * @property {SkippedUser[]} results.skipped - Skipped users
 */

/**
 * @typedef {object} MigratedUser
 * @property {string} userId - Azure AD user ID
 * @property {string} displayName - User display name
 * @property {string} email - User email
 * @property {string[]} roles - Assigned roles
 * @property {string[]} scopes - Assigned scopes
 */

/**
 * @typedef {object} FailedUser
 * @property {string} userId - Azure AD user ID
 * @property {string} displayName - User display name
 * @property {string} email - User email
 * @property {string} error - Error message
 */

/**
 * @typedef {object} SkippedUser
 * @property {string} userId - Azure AD user ID
 * @property {string} displayName - User display name
 * @property {string} email - User email
 * @property {string} reason - Reason for skipping
 */
