import { locker } from '~/src/mongo.js'

/**
 * Executes a function with distributed locking
 * @param {string} lockName - Name of the lock
 * @param {Function} fn - Function to execute while holding the lock
 * @returns {Promise<any>} Result of the function execution or null if lock not acquired
 */
export async function withLock(lockName, fn) {
  const lock = await locker.lock(lockName)

  if (!lock) {
    return null
  }

  try {
    return await fn()
  } finally {
    await lock.free()
  }
}
