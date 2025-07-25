import Boom from '@hapi/boom'
import { MongoServerError } from 'mongodb'

import { getErrorMessage } from '~/src/helpers/error-message.js'
import { createLogger } from '~/src/helpers/logging/logger.js'
import { USER_COLLECTION_NAME, db } from '~/src/mongo.js'

const MAX_RESULTS = 1000

const DUPLICATE_DOCUMENT_CODE = 11000

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
 * @param {ClientSession | undefined} [session]
 */
export async function get(userId, session = undefined) {
  logger.info(`Getting user with ID ${userId}`)

  const coll =
    /** @satisfies {Collection<Partial<UserEntitlementDocument>>} */ (
      db.collection(USER_COLLECTION_NAME)
    )

  const sessionOptions = /** @type {FindOptions} */ session && { session }

  try {
    const document = await coll.findOne({ userId }, sessionOptions)

    if (!document) {
      throw Boom.notFound(`User with ID '${userId}' not found`)
    }

    logger.info(`User with ID ${userId} found`)

    return document
  } catch (error) {
    logger.error(
      `[getUserById] Getting user with ID '${userId}' failed - ${getErrorMessage(error)}`
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
  logger.info(`Creating user with user ID '${document.userId}'`)

  const coll = /** @satisfies {Collection<UserEntitlementDocument>} */ (
    db.collection(USER_COLLECTION_NAME)
  )

  try {
    const result = await coll.insertOne(document, { session })

    logger.info(`User created with user ID '${document.userId}'`)

    return result
  } catch (cause) {
    const message = `Creating user failed for user ID '${document.userId}'`

    if (
      cause instanceof MongoServerError &&
      cause.code === DUPLICATE_DOCUMENT_CODE
    ) {
      logger.info(
        `[duplicateUser] Creating user with user ID '${document.userId}' failed - user already exists`
      )
      throw Boom.conflict('User already exists')
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
 * @param {UserEntitlementDocument} user - user entitlement document
 * @param {ClientSession} [session] - mongo transaction session
 */
export async function update(userId, user, session) {
  logger.info(`Updating user with ID '${userId}'`)

  const coll = /** @satisfies {Collection<UserEntitlementDocument>} */ (
    db.collection(USER_COLLECTION_NAME)
  )

  try {
    const result = await coll.updateOne(
      { userId },
      { $set: user },
      {
        session
      }
    )

    // Throw if updated record count is not 1
    if (result.modifiedCount !== 1) {
      throw Boom.badRequest(
        `User with ID '${userId}' not updated. Modified count ${result.modifiedCount}`
      )
    }

    logger.info(`User with ID '${userId}' updated`)

    return result
  } catch (error) {
    logger.error(
      `[updateUser] Updating user with ID '${userId}' failed - ${getErrorMessage(error)}`
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
  logger.info(`Removing user with ID '${userId}'`)

  const coll = db.collection(USER_COLLECTION_NAME)

  const result = await coll.deleteOne({ userId }, { session })
  const { deletedCount } = result

  if (deletedCount !== 1) {
    throw new Error(
      `Failed to delete user ID '${userId}'. Expected deleted count of 1, received ${deletedCount}`
    )
  }

  logger.info(`Removed user with ID '${userId}'`)
}

/**
 * @import { ClientSession, Collection, UpdateFilter } from 'mongodb'
 * @import { UserEntitlementDocument } from '~/src/api/types.js'
 */
