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
  if (
    !document.userId ||
    !document.roles ||
    !document.scopes ||
    !document.email ||
    !document.displayName
  ) {
    throw Error(
      'User is malformed in the database. Expected fields are missing.'
    )
  }

  return {
    userId: document.userId,
    email: document.email,
    displayName: document.displayName,
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
 * Add a user
 * @param {string} email
 * @param {string[]} roles
 */
export async function addUser(email, roles) {
  logger.info(`Adding user`)

  const azureAdService = getAzureAdService()
  const azureUser = await azureAdService.validateUserByEmail(email)

  const session = client.startSession()

  try {
    await session.withTransaction(async () => {
      const user = {
        ...azureUser,
        roles,
        scopes: mapScopesToRoles(roles)
      }
      // Add the user
      const newUserEntity = await create(user, session)

      return newUserEntity
    })

    logger.info(`Added user with userID '${azureUser.userId}'`)

    return {
      id: azureUser.userId,
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

  const azureAdService = getAzureAdService()
  const azureUser = await azureAdService.validateUserById(userId)

  const session = client.startSession()

  try {
    await session.withTransaction(async () => {
      const user = {
        ...azureUser,
        roles,
        scopes: mapScopesToRoles(roles)
      }

      // Update the user
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
 * @import { UserEntitlementDocument } from '~/src/api/types.js'
 * @import { WithId } from 'mongodb'
 */
