import Boom from '@hapi/boom'
import { MongoServerError, ObjectId } from 'mongodb'

import { UserAlreadyExistsError } from '~/src/api/forms/errors.js'
import { getErrorMessage } from '~/src/helpers/error-message.js'
import { createLogger } from '~/src/helpers/logging/logger.js'
import { USER_COLLECTION_NAME, db } from '~/src/mongo.js'

export const MAX_RESULTS = 1000

const logger = createLogger()

/**
 * Retrieves the list of documents from the database
 */
export async function getAll() {
  const coll = /** @type {Collection<Partial<UserEntitlementDocument>>} */ (
    db.collection(USER_COLLECTION_NAME)
  )

  return coll
    .find()
    .sort({
      updatedAt: -1
    })
    .limit(MAX_RESULTS)
    .toArray()
}

/**
 * Retrieves a user entitlement entry by ID
 * @param {string} userId - ID of the user
 */
export async function get(userId) {
  logger.info(`Getting user with ID ${userId}`)

  const coll =
    /** @satisfies {Collection<Partial<UserEntitlementDocument>>} */ (
      db.collection(USER_COLLECTION_NAME)
    )

  try {
    const document = await coll.findOne({ _id: new ObjectId(userId) })

    if (!document) {
      throw Boom.notFound(`User with ID '${userId}' not found`)
    }

    logger.info(`User with ID ${userId} found`)

    return document
  } catch (error) {
    logger.error(
      `[getUserById] Getting user with ID ${userId} failed - ${getErrorMessage(error)}`
    )

    if (error instanceof Error && !Boom.isBoom(error)) {
      throw Boom.badRequest(error)
    }

    throw error
  }
}

/**
 * Create a document in the database
 * @param {UserEntitlementDocument} document - user entitlement document
 * @param {ClientSession} session - mongo transaction session
 */
export async function create(document, session) {
  logger.info(`Creating user`)

  const coll = /** @satisfies {Collection<UserEntitlementDocument>} */ (
    db.collection(USER_COLLECTION_NAME)
  )

  try {
    const result = await coll.insertOne(document, { session })
    const userId = result.insertedId.toString()

    logger.info(`User created as user ID ${userId}`)

    return result
  } catch (cause) {
    const message = `Creating user failed`

    if (cause instanceof MongoServerError && cause.code === 11000) {
      const error = new UserAlreadyExistsError(document.userId, { cause })

      logger.info(
        `[duplicateUser] Creating user with userId ${document.userId} failed - user already exists`
      )
      throw Boom.badRequest(error)
    }

    if (cause instanceof MongoServerError) {
      logger.error(
        `[mongoError] ${message} - MongoDB error code: ${cause.code} - ${cause.message}`
      )
    } else {
      logger.error(`[updateError] ${message} - ${getErrorMessage(cause)}`)
    }
    throw cause
  }
}

/**
 * Update a document in the database
 * @param {string} userId - ID of the user
 * @param {UpdateFilter<UserEntitlementDocument>} update - user entitlement document update filter
 * @param {ClientSession} [session] - mongo transaction session
 */
export async function update(userId, update, session) {
  logger.info(`Updating user with ID ${userId}`)

  const coll = /** @satisfies {Collection<UserEntitlementDocument>} */ (
    db.collection(USER_COLLECTION_NAME)
  )

  try {
    const result = await coll.updateOne({ _id: new ObjectId(userId) }, update, {
      session
    })

    // Throw if updated record count is not 1
    if (result.modifiedCount !== 1) {
      throw Boom.badRequest(
        `User with ID ${userId} not updated. Modified count ${result.modifiedCount}`
      )
    }

    logger.info(`User with ID ${userId} updated`)

    return result
  } catch (error) {
    logger.error(
      `[updateUser] Updating user with ID ${userId} failed - ${getErrorMessage(error)}`
    )

    if (error instanceof Error && !Boom.isBoom(error)) {
      throw Boom.internal(error)
    }

    throw error
  }
}

/**
 * Removes a user
 * @param {string} userId - ID of the user
 * @param {ClientSession} session
 */
export async function remove(userId, session) {
  logger.info(`Removing user with ID ${userId}`)

  const coll = db.collection(USER_COLLECTION_NAME)

  const result = await coll.deleteOne(
    { _id: new ObjectId(userId) },
    { session }
  )
  const { deletedCount } = result

  if (deletedCount !== 1) {
    throw new Error(
      `Failed to delete user id '${userId}'. Expected deleted count of 1, received ${deletedCount}`
    )
  }

  logger.info(`Removed user with ID ${userId}`)
}

/**
 * @import { ClientSession, Collection, UpdateFilter } from 'mongodb'
 * @import { UserEntitlementDocument } from '~/src/api/types.js'
 */
