import { LockManager } from 'mongo-locks'
import { MongoClient } from 'mongodb'

import { config } from '~/src/config/index.js'
import { secureContext } from '~/src/secure-context.js'

/**
 * @type {Db}
 */
export let db

/**
 * @type {MongoClient}
 */
export let client

/**
 * @type {LockManager}
 */
// NOSONAR - Following  pattern for db and client exports
export let locker

export const USER_COLLECTION_NAME = 'user-entitlement'
export const MONGO_LOCKS_COLLECTION_NAME = 'mongo-locks'

/**
 * Connects to mongo database
 * @param {Logger} logger
 */
export async function prepareDb(logger) {
  const mongoUri = config.get('mongo.uri')
  const databaseName = config.get('mongo.databaseName')
  const isSecureContextEnabled = config.get('isSecureContextEnabled')

  logger.info('Setting up mongodb')

  client = await MongoClient.connect(
    mongoUri,
    /** @type {any} */ ({
      retryWrites: false,
      readPreference: 'primary',
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- secureContext can be undefined in non-production
      ...(isSecureContextEnabled && secureContext && { secureContext })
    })
  )

  db = client.db(databaseName)
  locker = new LockManager(db.collection(MONGO_LOCKS_COLLECTION_NAME))

  // Ensure db indexes
  const userColl = db.collection(USER_COLLECTION_NAME)
  await userColl.createIndex({ userId: 1 }, { unique: true })

  const locksColl = db.collection(MONGO_LOCKS_COLLECTION_NAME)
  await locksColl.createIndex({ id: 1 })

  logger.info(`Mongodb connected to ${databaseName}`)

  return db
}

/**
 * @import { Db } from 'mongodb'
 * @import { Logger } from 'pino'
 */
