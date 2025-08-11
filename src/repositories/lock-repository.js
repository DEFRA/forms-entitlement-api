import { getErrorMessage } from '~/src/helpers/error-message.js'
import { createLogger } from '~/src/helpers/logging/logger.js'
import { SYNC_LOCKS_COLLECTION_NAME, db } from '~/src/mongo.js'

const DUPLICATE_KEY_ERROR_CODE = 11000

const logger = createLogger()

/**
 * Attempts to acquire a distributed lock
 * @param {string} lockName - Unique name for the lock
 * @param {string} lockId - Unique identifier for this lock attempt
 * @param {number} timeoutMinutes - Lock timeout in minutes
 * @returns {Promise<boolean>} True if lock was acquired, false otherwise
 */
export async function acquireLock(lockName, lockId, timeoutMinutes = 30) {
  const lockCollection = db.collection(SYNC_LOCKS_COLLECTION_NAME)

  try {
    await lockCollection.insertOne({
      lockName,
      lockId,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + timeoutMinutes * 60 * 1000)
    })

    return true
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === DUPLICATE_KEY_ERROR_CODE
    ) {
      return false
    }

    logger.error(
      `[LockRepository] Failed to acquire lock '${lockName}': ${getErrorMessage(error)}`
    )
    throw error
  }
}

/**
 * Releases a distributed lock
 * @param {string} lockName - Name of the lock to release
 * @param {string} lockId - ID of the lock holder
 * @returns {Promise<boolean>} True if lock was released, false otherwise
 */
export async function releaseLock(lockName, lockId) {
  const lockCollection = db.collection(SYNC_LOCKS_COLLECTION_NAME)

  try {
    const result = await lockCollection.deleteOne({
      lockName,
      lockId
    })

    return result.deletedCount > 0
  } catch (error) {
    logger.warn(
      `[LockRepository] Failed to release lock '${lockName}': ${getErrorMessage(error)}`
    )
    return false
  }
}

/**
 * Executes a function with distributed locking
 * @param {string} lockName - Name of the lock
 * @param {string} lockId - Unique ID for this lock attempt
 * @param {Function} fn - Function to execute while holding the lock
 * @param {number} timeoutMinutes - Lock timeout in minutes
 * @returns {Promise<any>} Result of the function execution
 */
export async function withLock(lockName, lockId, fn, timeoutMinutes = 30) {
  const acquired = await acquireLock(lockName, lockId, timeoutMinutes)

  if (!acquired) {
    return null
  }

  try {
    return await fn()
  } finally {
    await releaseLock(lockName, lockId)
  }
}

/**
 * Gets information about a lock
 * @param {string} lockName - Name of the lock to check
 * @returns {Promise<object|null>} Lock information or null if not found
 */
export async function getLockInfo(lockName) {
  const lockCollection = db.collection(SYNC_LOCKS_COLLECTION_NAME)

  try {
    const lock = await lockCollection.findOne({ lockName })

    if (!lock) {
      return null
    }

    return {
      lockName: lock.lockName,
      lockId: lock.lockId,
      createdAt: lock.createdAt,
      expiresAt: lock.expiresAt,
      isExpired: lock.expiresAt < new Date()
    }
  } catch (error) {
    logger.error(
      `[LockRepository] Failed to get lock info for '${lockName}': ${getErrorMessage(error)}`
    )
    return null
  }
}
