import { getErrorMessage } from '~/src/helpers/error-message.js'
import { createLogger } from '~/src/helpers/logging/logger.js'
import { client } from '~/src/mongo.js'
import { mapScopesToRoles } from '~/src/repositories/scopes.js'
import {
  create,
  get,
  getAll,
  update
} from '~/src/repositories/user-repository.js'

export const logger = createLogger()

/**
 * Get all users
 */
export async function getAllUsers() {
  logger.info(`Getting all users`)

  try {
    return await getAll()
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
  logger.info(`Getting user with userID ${userId}`)

  try {
    return await get(userId)
  } catch (err) {
    logger.error(
      `[getUser] Failed to get user with userId ${userId} - ${getErrorMessage(err)}`
    )

    throw err
  }
}

/**
 * Add a user
 * @param {string} userId
 * @param {string[]} roles
 */
export async function addUser(userId, roles) {
  logger.info(`Adding user with userID ${userId}`)

  const session = client.startSession()

  try {
    const newUser = await session.withTransaction(async () => {
      const user = {
        userId,
        roles,
        scopes: mapScopesToRoles(roles)
      }
      // Add the user
      const newUserEntity = await create(user, session)

      // TODO - send audit event

      return newUserEntity
    })

    logger.info(`Added user with userID ${userId}`)

    return newUser
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
  logger.info(`Updating user with userID ${userId}`)

  const session = client.startSession()

  try {
    const updatedUser = await session.withTransaction(async () => {
      const user = {
        userId,
        roles,
        scopes: mapScopesToRoles(roles)
      }

      // Update the user
      const updatedUserEntity = await update(userId, user, session)

      // TODO - send audit event

      return updatedUserEntity
    })

    logger.info(`Updated user with userID ${userId}`)

    return updatedUser
  } catch (err) {
    logger.error(`[updateUser] Failed to update user - ${getErrorMessage(err)}`)

    throw err
  } finally {
    await session.endSession()
  }
}

/**
 * @import { UserEntitlementDocument } from '~/src/api/types.js'
 */
