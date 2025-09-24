import { getErrorMessage } from '@defra/forms-model'
import Boom from '@hapi/boom'
import { MongoServerError } from 'mongodb'

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
  } catch (err) {
    logger.error(
      err,
      `[getUserById] Getting user with ID '${userId}' failed - ${getErrorMessage(err)}`
    )

    if (err instanceof Error && !Boom.isBoom(err)) {
      throw Boom.badRequest(err)
    }

    throw err
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
  } catch (err) {
    const message = `Creating user failed for user ID '${document.userId}'`

    if (
      err instanceof MongoServerError &&
      err.code === DUPLICATE_DOCUMENT_CODE
    ) {
      logger.info(
        `[duplicateUser] Creating user with user ID '${document.userId}' failed - user already exists`
      )
      throw Boom.conflict('User already exists')
    }

    if (err instanceof MongoServerError) {
      logger.error(
        err,
        `[mongoError] ${message} - MongoDB error code: ${err.code} - ${err.message}`
      )
    } else {
      logger.error(err, `[updateError] ${message} - ${getErrorMessage(err)}`)
    }
    throw err
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

    if (result.matchedCount === 0) {
      throw Boom.notFound(`User with ID '${userId}' not found`)
    }

    logger.info(`User with ID '${userId}' updated`)

    return result
  } catch (err) {
    logger.error(
      err,
      `[updateUser] Updating user with ID '${userId}' failed - ${getErrorMessage(err)}`
    )

    if (err instanceof Error && !Boom.isBoom(err)) {
      throw Boom.internal(err)
    }

    throw err
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
    throw Boom.notFound(`User with ID '${userId}' not found`)
  }

  logger.info(`Removed user with ID '${userId}'`)
}

/**
 * @import { ClientSession, Collection, UpdateFilter } from 'mongodb'
 * @import { UserEntitlementDocument } from '~/src/api/types.js'
 */
